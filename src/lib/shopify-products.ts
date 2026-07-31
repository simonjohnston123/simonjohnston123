import "server-only";
import { prisma } from "@/lib/db";
import { decryptJson } from "@/lib/crypto";

// Import a business's Shopify catalogue into CRM Products. Idempotent: dedupes by
// (source="Shopify", externalId=shopify product id). This is the master catalogue
// we'll later push OUT to chosen platforms (eBay/Placid Connect) + the buy-where widget.

const API_VERSION = "2024-07";
const MAX_PRODUCTS = 2000;

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
  body_html?: string;
  product_type?: string;
  vendor?: string;
  status?: string;
  image?: { src?: string } | null;
  images?: { src?: string }[];
  variants?: ShopifyVariant[];
};

function stripHtml(html?: string): string | null {
  if (!html) return null;
  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 2000) : null;
}

export type ProductSyncResult = { ok: boolean; reason?: string; fetched: number; imported: number; updated: number };

export async function importShopifyProducts(locationId: string): Promise<ProductSyncResult> {
  const creds = await getCreds(locationId);
  if (!creds) return { ok: false, reason: "Shopify isn't connected", fetched: 0, imported: 0, updated: 0 };

  const headers = { "X-Shopify-Access-Token": creds.adminToken, "content-type": "application/json" };
  const products: ShopifyProduct[] = [];
  let url: string | null = `https://${creds.shopDomain}/admin/api/${API_VERSION}/products.json?limit=250`;
  try {
    while (url && products.length < MAX_PRODUCTS) {
      const res: Response = await fetch(url, { headers, cache: "no-store" });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        if (products.length === 0) return { ok: false, reason: `Shopify ${res.status}: ${detail.slice(0, 120)}`, fetched: 0, imported: 0, updated: 0 };
        break;
      }
      products.push(...(((await res.json()) as { products?: ShopifyProduct[] }).products ?? []));
      const link = res.headers.get("link") || "";
      const next = link.split(",").find((p) => p.includes('rel="next"'));
      const m = next?.match(/<([^>]+)>/);
      url = m ? m[1] : null;
    }
  } catch (e) {
    if (products.length === 0) return { ok: false, reason: e instanceof Error ? e.message : "fetch failed", fetched: 0, imported: 0, updated: 0 };
  }

  let imported = 0;
  let updated = 0;
  for (const p of products) {
    const externalId = String(p.id);
    const variants = p.variants ?? [];
    const first = variants[0] ?? {};
    const priceCents = first.price != null ? Math.round(Number(first.price) * 100) : null;
    const inventory = variants.reduce((s, v) => s + (typeof v.inventory_quantity === "number" ? v.inventory_quantity : 0), 0);
    const imageUrl = p.image?.src || p.images?.[0]?.src || null;

    const data = {
      name: p.title || "Untitled product",
      description: stripHtml(p.body_html),
      category: p.product_type || null,
      vendor: p.vendor || null,
      sku: first.sku || null,
      priceCents,
      price: priceCents != null ? Math.round(priceCents / 100) : null,
      inventory,
      imageUrl,
      active: (p.status ?? "active") === "active",
    };

    const existing = await prisma.product.findFirst({
      where: { locationId, source: "Shopify", externalId },
      select: { id: true },
    });
    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.product.create({ data: { locationId, source: "Shopify", externalId, channels: ["shopify"], ...data } });
      imported++;
    }
  }

  return { ok: true, fetched: products.length, imported, updated };
}
