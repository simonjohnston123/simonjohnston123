import "server-only";
import { prisma } from "@/lib/db";
import { decryptJson } from "@/lib/crypto";
import { getOrderRoute, routeOrderToTrack } from "@/lib/order-routing";

// Pull a business's Shopify orders into the CRM (Orders + Contacts). Uses the
// admin token the business connected under Integrations → Shopify. Idempotent:
// dedupes by (source="Shopify", externalId=shopify order id).

const API_VERSION = "2024-07";

type ShopifyCreds = { shopDomain: string; adminToken: string };

async function getShopifyCreds(locationId: string): Promise<ShopifyCreds | null> {
  const conn = await prisma.connection.findUnique({
    where: { locationId_provider: { locationId, provider: "SHOPIFY" } },
  });
  if (!conn?.secretCipher || conn.status !== "CONNECTED") return null;
  try {
    const c = decryptJson<{ shopDomain?: string; adminToken?: string }>(conn.secretCipher);
    if (!c.shopDomain || !c.adminToken) return null;
    return { shopDomain: c.shopDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, ""), adminToken: c.adminToken };
  } catch {
    return null;
  }
}

type ShopifyOrder = {
  id: number;
  order_number: number;
  created_at?: string;
  total_price: string;
  financial_status?: string;
  fulfillment_status?: string | null;
  email?: string;
  customer?: { first_name?: string; last_name?: string; email?: string; phone?: string };
  line_items?: { title: string; quantity: number; price: string }[];
  shipping_address?: { address1?: string; address2?: string; city?: string; province?: string; zip?: string; country?: string; name?: string; phone?: string };
};

function mapStatus(o: ShopifyOrder): "NEW" | "CONFIRMED" | "COMPLETED" | "CANCELLED" {
  if (o.fulfillment_status === "fulfilled") return "COMPLETED";
  if ((o.financial_status || "").toLowerCase() === "paid") return "CONFIRMED";
  return "NEW";
}

function addressLine(a?: ShopifyOrder["shipping_address"]): string | null {
  if (!a) return null;
  return [a.address1, a.address2, a.city, a.province, a.zip, a.country].filter(Boolean).join(", ") || null;
}

export type ShopifySyncResult = { ok: boolean; reason?: string; fetched: number; imported: number; updated: number };

export async function syncShopifyOrders(locationId: string): Promise<ShopifySyncResult> {
  const creds = await getShopifyCreds(locationId);
  if (!creds) return { ok: false, reason: "Shopify isn't connected", fetched: 0, imported: 0, updated: 0 };

  // Pull full history, following Shopify's Link-header cursor pagination up to the cap.
  const MAX_ORDERS = 1000;
  const headers = { "X-Shopify-Access-Token": creds.adminToken, "content-type": "application/json" };
  const orders: ShopifyOrder[] = [];
  let url: string | null = `https://${creds.shopDomain}/admin/api/${API_VERSION}/orders.json?status=any&limit=250`;
  try {
    while (url && orders.length < MAX_ORDERS) {
      const res: Response = await fetch(url, { headers, cache: "no-store" });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        if (orders.length === 0) return { ok: false, reason: `Shopify ${res.status}: ${detail.slice(0, 120)}`, fetched: 0, imported: 0, updated: 0 };
        break;
      }
      orders.push(...(((await res.json()) as { orders?: ShopifyOrder[] }).orders ?? []));
      // Next page comes from the Link header: <…>; rel="next"
      const link = res.headers.get("link") || "";
      const next = link.split(",").find((p) => p.includes('rel="next"'));
      const m = next?.match(/<([^>]+)>/);
      url = m ? m[1] : null;
    }
  } catch (e) {
    if (orders.length === 0) return { ok: false, reason: e instanceof Error ? e.message : "fetch failed", fetched: 0, imported: 0, updated: 0 };
  }

  const route = await getOrderRoute(locationId);

  let imported = 0;
  let updated = 0;
  for (const o of orders) {
    const externalId = String(o.id);
    const email = (o.customer?.email || o.email || "").toLowerCase().trim() || null;
    const first = o.customer?.first_name || "";
    const last = o.customer?.last_name || "";
    const custName = [first, last].filter(Boolean).join(" ") || o.shipping_address?.name || null;
    const phone = o.customer?.phone || o.shipping_address?.phone || null;

    // Find or create the customer as a Contact (by email).
    let contactId: string | null = null;
    if (email) {
      let contact = await prisma.contact.findFirst({ where: { locationId, email } });
      if (!contact) {
        contact = await prisma.contact.create({
          data: { locationId, email, firstName: first || null, lastName: last || null, phone, source: "Shopify" },
        });
      }
      contactId = contact.id;
    }

    const items = (o.line_items ?? []).map((li) => ({ name: li.title, qty: li.quantity, price: Number(li.price) || 0 }));
    const data = {
      contactId,
      number: o.order_number || 0,
      status: mapStatus(o),
      items,
      total: Number(o.total_price) || 0,
      customerName: custName,
      customerPhone: phone,
      customerEmail: email,
      deliveryAddress: addressLine(o.shipping_address),
      placedAt: o.created_at ? new Date(o.created_at) : null,
    };

    const existing = await prisma.order.findFirst({ where: { locationId, source: "Shopify", externalId }, select: { id: true } });
    if (existing) {
      await prisma.order.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.order.create({ data: { locationId, source: "Shopify", externalId, type: "PRODUCT", ...data } });
      imported++;
      await routeOrderToTrack(locationId, route, {
        contactId,
        title: `Shopify #${data.number || externalId}${custName ? ` — ${custName}` : ""}`,
        value: data.total,
      });
    }
  }

  await prisma.connection.update({
    where: { locationId_provider: { locationId, provider: "SHOPIFY" } },
    data: { meta: { lastSyncedAt: new Date().toISOString(), lastCount: orders.length } },
  });

  return { ok: true, fetched: orders.length, imported, updated };
}
