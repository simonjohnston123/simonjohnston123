import "server-only";
import { prisma } from "@/lib/db";
import { encryptJson, decryptJson } from "@/lib/crypto";
import { refreshToken } from "@/lib/oauth-providers";

// Pull a business's eBay orders into the CRM (Orders + Contacts) via the Sell
// Fulfillment API, using the token stored when they connected eBay. eBay masks
// buyer email, so we match/create contacts by ship-to name (+ email when given).

const FULFILLMENT_URL = "https://api.ebay.com/sell/fulfillment/v1/order?limit=50";

type StoredToken = { accessToken?: string; refreshToken?: string; expiresAt?: number };

async function getValidToken(locationId: string): Promise<string | null> {
  const conn = await prisma.connection.findUnique({
    where: { locationId_provider: { locationId, provider: "EBAY" } },
  });
  if (!conn?.secretCipher || conn.status !== "CONNECTED") return null;
  let creds: StoredToken;
  try {
    creds = decryptJson<StoredToken>(conn.secretCipher);
  } catch {
    return null;
  }
  if (!creds.accessToken) return null;

  // Refresh if it's expired (or about to).
  if (creds.expiresAt && creds.expiresAt < Date.now() + 60_000 && creds.refreshToken) {
    const set = await refreshToken("EBAY", creds.refreshToken);
    if (set?.accessToken) {
      const merged: StoredToken = {
        accessToken: set.accessToken,
        refreshToken: set.refreshToken ?? creds.refreshToken,
        expiresAt: set.expiresAt,
      };
      await prisma.connection.update({ where: { id: conn.id }, data: { secretCipher: encryptJson(merged) } });
      return set.accessToken;
    }
  }
  return creds.accessToken;
}

type EbayOrder = {
  orderId: string;
  legacyOrderId?: string;
  orderFulfillmentStatus?: string;
  pricingSummary?: { total?: { value?: string } };
  buyer?: { username?: string };
  lineItems?: { title?: string; quantity?: number; lineItemCost?: { value?: string } }[];
  fulfillmentStartInstructions?: {
    shippingStep?: {
      shipTo?: {
        fullName?: string;
        email?: string;
        primaryPhone?: { phoneNumber?: string };
        contactAddress?: { addressLine1?: string; addressLine2?: string; city?: string; stateOrProvince?: string; postalCode?: string; countryCode?: string };
      };
    };
  }[];
};

function shipTo(o: EbayOrder) {
  return o.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo;
}
function addressLine(o: EbayOrder): string | null {
  const a = shipTo(o)?.contactAddress;
  if (!a) return null;
  return [a.addressLine1, a.addressLine2, a.city, a.stateOrProvince, a.postalCode, a.countryCode].filter(Boolean).join(", ") || null;
}
function mapStatus(o: EbayOrder): "NEW" | "CONFIRMED" | "COMPLETED" {
  return o.orderFulfillmentStatus === "FULFILLED" ? "COMPLETED" : "CONFIRMED";
}

export type EbaySyncResult = { ok: boolean; reason?: string; fetched: number; imported: number; updated: number };

export async function syncEbayOrders(locationId: string): Promise<EbaySyncResult> {
  const token = await getValidToken(locationId);
  if (!token) return { ok: false, reason: "eBay isn't connected", fetched: 0, imported: 0, updated: 0 };

  let orders: EbayOrder[];
  try {
    const res = await fetch(FULFILLMENT_URL, {
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, reason: `eBay ${res.status}: ${detail.slice(0, 120)}`, fetched: 0, imported: 0, updated: 0 };
    }
    orders = ((await res.json()) as { orders?: EbayOrder[] }).orders ?? [];
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "fetch failed", fetched: 0, imported: 0, updated: 0 };
  }

  let imported = 0;
  let updated = 0;
  for (const o of orders) {
    const externalId = o.orderId;
    const to = shipTo(o);
    const name = to?.fullName || o.buyer?.username || "eBay buyer";
    const email = (to?.email || "").toLowerCase().trim() || null;
    const phone = to?.primaryPhone?.phoneNumber || null;

    // Match a contact by email if eBay gave one, else by name.
    let contactId: string | null = null;
    let contact = email
      ? await prisma.contact.findFirst({ where: { locationId, email } })
      : await prisma.contact.findFirst({ where: { locationId, firstName: name, source: "eBay" } });
    if (!contact) {
      contact = await prisma.contact.create({
        data: { locationId, email, firstName: name, phone, source: "eBay" },
      });
    }
    contactId = contact.id;

    const items = (o.lineItems ?? []).map((li) => ({ name: li.title ?? "Item", qty: li.quantity ?? 1, price: Number(li.lineItemCost?.value) || 0 }));
    const data = {
      contactId,
      number: Number(o.legacyOrderId) || 0,
      status: mapStatus(o),
      items,
      total: Number(o.pricingSummary?.total?.value) || 0,
      customerName: name,
      customerPhone: phone,
      customerEmail: email,
      deliveryAddress: addressLine(o),
    };

    const existing = await prisma.order.findFirst({ where: { locationId, source: "eBay", externalId }, select: { id: true } });
    if (existing) {
      await prisma.order.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.order.create({ data: { locationId, source: "eBay", externalId, type: "PRODUCT", ...data } });
      imported++;
    }
  }

  return { ok: true, fetched: orders.length, imported, updated };
}
