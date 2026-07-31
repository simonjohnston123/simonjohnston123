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
    const variants = p.variants ?? [];
    const first = variants[0] ?? {};
    const priceCents = first.price != null ? Math.round(Number(first.price) * 100) : null;
    const inventory = variants.reduce((s, v) => s + (typeof v.inventory_quantity === "number" ? v.inventory_quantity : 0), 0);
    const tags = (p.tags || "").split(",").map((t) => t.trim()).filter(Boolean);
    const warehouse = warehouseFromTags(tags);
    const data = {
      name: p.title || "Untitled product",
      category: p.product_type || null,
      vendor: p.vendor || null,
      supplier: p.vendor || null, // dropshipper/supplier (Dropshipzone/CJ/…)
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
