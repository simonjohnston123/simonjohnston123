import "server-only";
import { prisma } from "@/lib/db";
import { decryptJson } from "@/lib/crypto";

// Import a business's Shopify catalogue into CRM Products. Built for SCALE (stores
// with 10k+ products): each call imports ONE batch via since_id pagination and
// reports a cursor, so the client loops until done — no single request holds the
// server for a minute. Idempotent: dedupes by (source="Shopify", externalId).

const API_VERSION = "2024-07";
const BATCH = 1000; // products imported per action call
const PAGE = 250; // Shopify max page size
const FIELDS = "id,title,product_type,vendor,status,image,variants,tags";

type ShopifyCreds = { shopDomain: string; adminToken: string };

async function getCreds(locationId: string): Promise<ShopifyCreds | null> {
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

/**
 * On-demand sync of supplier COST (Shopify unitCost) + freight metafield for a
 * set of products, by their Shopify product id (externalId). Used when a listing
 * batch is created so profit maths has real numbers — no 60k backfill needed.
 * Returns how many products were updated.
 */
export async function syncCostsForProducts(locationId: string, externalIds: string[]): Promise<number> {
  const creds = await getCreds(locationId);
  if (!creds || externalIds.length === 0) return 0;
  const url = `https://${creds.shopDomain}/admin/api/${API_VERSION}/graphql.json`;
  const headers = { "X-Shopify-Access-Token": creds.adminToken, "content-type": "application/json" };
  const query = `query($ids:[ID!]!){ nodes(ids:$ids){ ... on Product { legacyResourceId variants(first:1){edges{node{inventoryItem{unitCost{amount}}}}} metafield(namespace:"pdd",key:"freight"){value} } } }`;
  let updated = 0;
  for (let i = 0; i < externalIds.length; i += 100) {
    const ids = externalIds.slice(i, i + 100).map((id) => `gid://shopify/Product/${id}`);
    let json: { data?: { nodes?: Array<{ legacyResourceId?: string; variants?: { edges?: Array<{ node?: { inventoryItem?: { unitCost?: { amount?: string } } } }> }; metafield?: { value?: string } | null }> } };
    try {
      const res = await fetch(url, { method: "POST", headers, cache: "no-store", body: JSON.stringify({ query, variables: { ids } }) });
      if (!res.ok) continue;
      json = await res.json();
    } catch {
      continue;
    }
    for (const n of json?.data?.nodes ?? []) {
      if (!n?.legacyResourceId) continue;
      const amt = n.variants?.edges?.[0]?.node?.inventoryItem?.unitCost?.amount;
      const freightRaw = n.metafield?.value;
      const data: { costCents?: number; freightCents?: number } = {};
      if (amt != null && Number.isFinite(Number(amt))) data.costCents = Math.round(Number(amt) * 100);
      if (freightRaw != null && Number.isFinite(Number(freightRaw))) data.freightCents = Math.round(Number(freightRaw) * 100);
      if (Object.keys(data).length) {
        await prisma.product.updateMany({ where: { locationId, source: "Shopify", externalId: String(n.legacyResourceId) }, data });
        updated++;
      }
    }
  }
  return updated;
}

type ShopifyVariant = { price?: string; sku?: string; inventory_quantity?: number };
type ShopifyProduct = {
  id: number;
  title: string;
  product_type?: string;
  vendor?: string;
  status?: string;
  image?: { src?: string } | null;
  variants?: ShopifyVariant[];
  tags?: string; // comma-separated
};

// Pull the warehouse code out of a "Warehouse-AU" style tag.
function warehouseFromTags(tags: string[]): string | null {
  const t = tags.find((x) => /^warehouse-/i.test(x));
  return t ? t.replace(/^warehouse-/i, "").trim().toUpperCase() || null : null;
}

/** Map a Shopify product (REST or webhook payload) to CRM Product fields. Shared
 *  by the bulk import and the live webhook so they never drift. */
export function productDataFromShopify(p: ShopifyProduct) {
  const variants = p.variants ?? [];
  const first = variants[0] ?? {};
  const priceCents = first.price != null ? Math.round(Number(first.price) * 100) : null;
  const inventory = variants.reduce((s, v) => s + (typeof v.inventory_quantity === "number" ? v.inventory_quantity : 0), 0);
  const tags = (p.tags || "").split(",").map((t) => t.trim()).filter(Boolean);
  const warehouse = warehouseFromTags(tags);
  return {
    name: p.title || "Untitled product",
    category: p.product_type || null,
    vendor: p.vendor || null,
    supplier: p.vendor || null,
    warehouse,
    shipCountries: warehouse ? [warehouse] : [],
    tags,
    sku: first.sku || null,
    priceCents,
    price: priceCents != null ? Math.round(priceCents / 100) : null,
    inventory,
    imageUrl: p.image?.src || null,
    active: (p.status ?? "active") === "active",
  };
}

export type ProductSyncResult = {
  ok: boolean;
  reason?: string;
  fetched: number;
  imported: number;
  updated: number;
  lastId: number | null; // pass back as sinceId to continue
  done: boolean;
};

/** Import one batch starting after `sinceId` (0 = from the start). */
export async function importShopifyProducts(locationId: string, sinceId = 0): Promise<ProductSyncResult> {
  const creds = await getCreds(locationId);
  if (!creds) return { ok: false, reason: "Shopify isn't connected", fetched: 0, imported: 0, updated: 0, lastId: null, done: true };

  const headers = { "X-Shopify-Access-Token": creds.adminToken, "content-type": "application/json" };
  const products: ShopifyProduct[] = [];
  let cursor = sinceId;
  try {
    while (products.length < BATCH) {
      const url = `https://${creds.shopDomain}/admin/api/${API_VERSION}/products.json?limit=${PAGE}&since_id=${cursor}&order=id+asc&fields=${FIELDS}`;
      const res = await fetch(url, { headers, cache: "no-store" });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        if (products.length === 0) return { ok: false, reason: `Shopify ${res.status}: ${detail.slice(0, 120)}`, fetched: 0, imported: 0, updated: 0, lastId: null, done: true };
        break;
      }
      const batch = ((await res.json()) as { products?: ShopifyProduct[] }).products ?? [];
      if (batch.length === 0) break;
      products.push(...batch);
      cursor = batch[batch.length - 1].id; // ascending order → last id is the high-water mark
      if (batch.length < PAGE) break;
    }
  } catch (e) {
    if (products.length === 0) return { ok: false, reason: e instanceof Error ? e.message : "fetch failed", fetched: 0, imported: 0, updated: 0, lastId: null, done: true };
  }

  const done = products.length < BATCH; // a short batch means we reached the end
  const ids = products.map((p) => String(p.id));
  const existing = new Set(
    (await prisma.product.findMany({ where: { locationId, source: "Shopify", externalId: { in: ids } }, select: { externalId: true } })).map((r) => r.externalId),
  );

  const toCreate: Prisma_ProductCreate[] = [];
  let updated = 0;
  for (const p of products) {
    const externalId = String(p.id);
    const data = productDataFromShopify(p);
    if (existing.has(externalId)) {
      await prisma.product.updateMany({ where: { locationId, source: "Shopify", externalId }, data });
      updated++;
    } else {
      toCreate.push({ locationId, source: "Shopify", externalId, channels: ["shopify"], ...data });
    }
  }

  // Bulk-insert new products in chunks (fast even for thousands).
  for (let i = 0; i < toCreate.length; i += 500) {
    await prisma.product.createMany({ data: toCreate.slice(i, i + 500), skipDuplicates: true });
  }

  const lastId = products.length ? Number(products[products.length - 1].id) : null;
  return { ok: true, fetched: products.length, imported: toCreate.length, updated, lastId, done };
}

export type BackfillResult = { ok: boolean; reason?: string; processed: number; lastId: number | null; done: boolean };

/** Fast shipping backfill: fetch only id+tags, derive warehouse, and BULK-update
 *  grouped by warehouse (a few queries per 1000, not one per product). Resumable. */
export async function backfillShippingBatch(locationId: string, sinceId = 0): Promise<BackfillResult> {
  const creds = await getCreds(locationId);
  if (!creds) return { ok: false, reason: "Shopify isn't connected", processed: 0, lastId: null, done: true };
  const headers = { "X-Shopify-Access-Token": creds.adminToken, "content-type": "application/json" };

  const rows: { id: number; tags?: string }[] = [];
  let cursor = sinceId;
  try {
    while (rows.length < BATCH) {
      const url = `https://${creds.shopDomain}/admin/api/${API_VERSION}/products.json?limit=${PAGE}&since_id=${cursor}&order=id+asc&fields=id,tags`;
      const res = await fetch(url, { headers, cache: "no-store" });
      if (!res.ok) {
        if (rows.length === 0) return { ok: false, reason: `Shopify ${res.status}`, processed: 0, lastId: null, done: true };
        break;
      }
      const batch = ((await res.json()) as { products?: { id: number; tags?: string }[] }).products ?? [];
      if (batch.length === 0) break;
      rows.push(...batch);
      cursor = batch[batch.length - 1].id;
      if (batch.length < PAGE) break;
    }
  } catch (e) {
    if (rows.length === 0) return { ok: false, reason: e instanceof Error ? e.message : "fetch failed", processed: 0, lastId: null, done: true };
  }

  const done = rows.length < BATCH;
  // Group product ids by their derived warehouse, then one updateMany per group.
  const byWarehouse = new Map<string, string[]>();
  for (const r of rows) {
    const wh = warehouseFromTags((r.tags || "").split(",").map((t) => t.trim()).filter(Boolean));
    if (!wh) continue;
    const list = byWarehouse.get(wh) ?? [];
    list.push(String(r.id));
    byWarehouse.set(wh, list);
  }
  for (const [wh, ids] of byWarehouse) {
    await prisma.product.updateMany({
      where: { locationId, source: "Shopify", externalId: { in: ids } },
      data: { warehouse: wh, shipCountries: [wh] },
    });
  }

  const lastId = rows.length ? Number(rows[rows.length - 1].id) : null;
  return { ok: true, processed: rows.length, lastId, done };
}

// Local shape for createMany rows (avoids importing Prisma's generated type name churn).
type Prisma_ProductCreate = {
  locationId: string;
  source: string;
  externalId: string;
  channels: string[];
  name: string;
  category: string | null;
  vendor: string | null;
  supplier: string | null;
  warehouse: string | null;
  shipCountries: string[];
  tags: string[];
  sku: string | null;
  priceCents: number | null;
  price: number | null;
  inventory: number;
  imageUrl: string | null;
  active: boolean;
};
