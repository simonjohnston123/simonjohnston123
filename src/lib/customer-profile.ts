import "server-only";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Customer lifecycle engine.
//
// An order is not a customer. The same person is a username on eBay and an
// email on Shopify, and if we treat those as two people then every lifetime
// value is halved, every segment is wrong, and no automation can be trusted to
// fire at the right person.
//
// So this does three things, in order:
//   1. Resolve identity  — one person, many marketplace accounts
//   2. Compute the facts — LTV, profit, frequency, recency
//   3. Derive the labels — interests, behaviour, health
//
// Everything here is DERIVED and rebuilt from orders. Nothing is hand-edited,
// so a re-run is always safe and never drifts from what actually happened.
// ---------------------------------------------------------------------------

type OrderLine = { name?: string; qty?: number; price?: number; sku?: string };

/** Marketplace an order arrived from, normalised. */
function marketplaceOf(source: string | null): string {
  const s = (source ?? "").toLowerCase();
  if (s.includes("ebay")) return "eBay";
  if (s.includes("shopify")) return "Shopify";
  if (s.includes("amazon")) return "Amazon";
  if (s.includes("temu")) return "Temu";
  if (s.includes("etsy")) return "Etsy";
  return "Direct";
}

/** Normalised street line — the most stable part of an address across channels. */
function streetKey(address: string | null): string {
  return (address ?? "").replace(/\s+/g, " ").split(",")[0]!.trim().toLowerCase();
}

function nameKey(name: string | null): string {
  return (name ?? "")
    .toLowerCase()
    .replace(/\(.*?\)/g, "") // Shopify appends "(handle)"
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Relay addresses issued BY a marketplace, not owned by the person.
 *
 * eBay hands out "…@members.ebay.com.au" per buyer per seller. It looks like an
 * email and is stable within eBay, but the same human on Shopify has a
 * completely different one — so keying identity on it guarantees the two never
 * meet, which is exactly what happened on the first run: 260 orders became 259
 * customers and nothing merged.
 */
const RELAY_DOMAINS = ["members.ebay.com", "members.ebay.com.au", "marketplace.amazon.com", "relay.amazon.com", "marketplace.etsy.com"];

const isRelayEmail = (email: string) => RELAY_DOMAINS.some((d) => email.endsWith(`@${d}`) || email.includes(`@${d}`));

/**
 * The identity key for an order.
 *
 * A real email is the strongest signal we get. A marketplace relay address is
 * not — it identifies an account, not a person — so those fall through to name
 * + street, which identifies a household. That is the honest limit of what the
 * data supports, and it is what lets one buyer on eBay and Shopify become one
 * customer.
 */
function identityKey(o: { customerEmail: string | null; customerName: string | null; deliveryAddress: string | null }): string | null {
  const email = (o.customerEmail ?? "").trim().toLowerCase();
  const name = nameKey(o.customerName);
  const street = streetKey(o.deliveryAddress);

  if (email.includes("@") && !isRelayEmail(email)) return `email:${email}`;
  if (name && street) return `addr:${name}|${street}`;
  // A relay address is better than nothing when there's no address to use.
  if (email.includes("@")) return `email:${email}`;
  return null;
}

export type ProfileBuildResult = {
  ordersScanned: number;
  customers: number;
  merged: number;
  accountsLinked: number;
};

/**
 * Rebuild every customer profile for a location from its order history.
 *
 * Deliberately a full rebuild rather than an incremental update: the derived
 * fields are cheap to recompute and impossible to drift when they're always
 * recalculated from source.
 */
export async function rebuildCustomerProfiles(locationId: string): Promise<ProfileBuildResult> {
  const orders = await prisma.order.findMany({
    where: { locationId },
    orderBy: { placedAt: "asc" },
    select: {
      id: true, contactId: true, source: true, total: true, items: true,
      customerName: true, customerEmail: true, customerPhone: true,
      deliveryAddress: true, placedAt: true, createdAt: true,
    },
  });

  // Cost lookup so profit is real rather than assumed.
  const products = await prisma.product.findMany({
    where: { locationId, costCents: { not: null } },
    select: { name: true, costCents: true, category: true, attributes: true },
  });
  const costByName = new Map(products.map((p) => [p.name.toLowerCase(), p.costCents!]));
  const categoryByName = new Map(
    products.map((p) => {
      const attrs = (p.attributes ?? {}) as { category?: { l1?: string } };
      return [p.name.toLowerCase(), attrs.category?.l1 ?? p.category ?? null];
    }),
  );

  type Agg = {
    key: string;
    contactIds: Set<string>;
    name: string | null; email: string | null; phone: string | null; address: string | null;
    revenueCents: number; costCents: number; orders: number;
    first: Date | null; last: Date | null;
    interests: Map<string, number>;
    accounts: Map<string, { handle: string; count: number; first: Date; last: Date }>;
  };

  const byIdentity = new Map<string, Agg>();
  let scanned = 0;

  for (const o of orders) {
    const key = identityKey(o);
    if (!key) continue;
    scanned++;

    const when = o.placedAt ?? o.createdAt;
    const marketplace = marketplaceOf(o.source);
    const handle = (o.customerEmail || o.customerName || "unknown").trim().toLowerCase();

    let agg = byIdentity.get(key);
    if (!agg) {
      agg = {
        key,
        contactIds: new Set(),
        name: o.customerName, email: o.customerEmail, phone: o.customerPhone, address: o.deliveryAddress,
        revenueCents: 0, costCents: 0, orders: 0,
        first: null, last: null,
        interests: new Map(),
        accounts: new Map(),
      };
      byIdentity.set(key, agg);
    }

    if (o.contactId) agg.contactIds.add(o.contactId);
    agg.email ??= o.customerEmail;
    agg.phone ??= o.customerPhone;
    agg.address ??= o.deliveryAddress;
    agg.orders++;
    agg.revenueCents += Math.round((o.total ?? 0) * 100);
    if (!agg.first || when < agg.first) agg.first = when;
    if (!agg.last || when > agg.last) agg.last = when;

    const acct = agg.accounts.get(marketplace);
    if (acct) {
      acct.count++;
      if (when > acct.last) acct.last = when;
      if (when < acct.first) acct.first = when;
    } else {
      agg.accounts.set(marketplace, { handle, count: 1, first: when, last: when });
    }

    for (const line of (Array.isArray(o.items) ? o.items : []) as OrderLine[]) {
      const n = (line.name ?? "").toLowerCase();
      const qty = Number(line.qty ?? 1) || 1;
      const cost = costByName.get(n);
      if (cost) agg.costCents += cost * qty;

      // Interests come from what they actually bought, not what they browsed.
      const cat = categoryByName.get(n);
      if (cat) agg.interests.set(cat, (agg.interests.get(cat) ?? 0) + qty);
    }
  }

  const now = Date.now();
  let merged = 0;
  let accountsLinked = 0;

  for (const agg of byIdentity.values()) {
    // One contact per identity. Extra contacts pointing at the same person are
    // repointed rather than deleted — their conversations and tasks matter.
    const ids = [...agg.contactIds];
    let contactId = ids[0] ?? null;

    if (!contactId) {
      const [first, ...rest] = (agg.name ?? "Customer").split(/\s+/);
      const created = await prisma.contact.create({
        data: {
          locationId,
          firstName: first || "Customer",
          lastName: rest.join(" ") || null,
          email: agg.email,
          phone: agg.phone,
          source: "Marketplace order",
        },
        select: { id: true },
      });
      contactId = created.id;
    } else if (ids.length > 1) {
      // Same person, several contact records — pull their history together.
      const others = ids.slice(1);
      await prisma.order.updateMany({ where: { contactId: { in: others } }, data: { contactId } });
      await prisma.conversation.updateMany({ where: { contactId: { in: others } }, data: { contactId } });
      await prisma.task.updateMany({ where: { contactId: { in: others } }, data: { contactId } });
      await prisma.contact.deleteMany({ where: { id: { in: others }, locationId } });
      merged += others.length;
    }

    const revenue = agg.revenueCents;
    const profit = revenue - agg.costCents;
    const daysSince = agg.last ? Math.floor((now - agg.last.getTime()) / 86_400_000) : null;

    // Interests, strongest first — a customer who bought six camping items and
    // one kettle is a camper.
    const interests = [...agg.interests.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);

    const tags: string[] = [];
    tags.push(agg.orders === 1 ? "new_customer" : "returning_customer");
    if (agg.orders >= 5) tags.push("frequent_buyer");
    if (revenue >= 100_000) tags.push("high_value");
    if (revenue >= 250_000) tags.push("vip");
    if (agg.accounts.size > 1) tags.push("multi_marketplace");
    if (daysSince != null && daysSince > 180) tags.push("dormant");
    // Only claim a margin problem when cost is actually known.
    if (agg.costCents > 0 && profit <= 0) tags.push("loss_making");

    // Health leans on recency and repeat, which are the two things that
    // actually predict the next order.
    let health = "neutral";
    if (daysSince == null) health = "neutral";
    else if (daysSince > 365) health = "lost";
    else if (daysSince > 180) health = "at_risk";
    else if (agg.orders >= 3 && daysSince <= 90) health = "excellent";
    else if (daysSince <= 90) health = "healthy";

    await prisma.contact.update({
      where: { id: contactId },
      data: {
        email: agg.email ?? undefined,
        phone: agg.phone ?? undefined,
        lifetimeValueCents: revenue,
        profitCents: profit,
        orderCount: agg.orders,
        avgOrderValueCents: agg.orders ? Math.round(revenue / agg.orders) : 0,
        firstPurchaseAt: agg.first,
        lastPurchaseAt: agg.last,
        interests,
        behaviourTags: tags,
        healthScore: health,
      },
    });

    for (const [marketplace, a] of agg.accounts) {
      await prisma.customerAccount.upsert({
        where: { locationId_marketplace_handle: { locationId, marketplace, handle: a.handle } },
        create: {
          locationId, contactId, marketplace, handle: a.handle,
          orderCount: a.count, firstSeenAt: a.first, lastSeenAt: a.last,
        },
        update: { contactId, orderCount: a.count, lastSeenAt: a.last },
      });
      accountsLinked++;
    }
  }

  return { ordersScanned: scanned, customers: byIdentity.size, merged, accountsLinked };
}
