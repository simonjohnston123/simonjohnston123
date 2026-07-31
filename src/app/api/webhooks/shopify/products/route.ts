import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyWebhookHmac, locationForShop } from "@/lib/shopify-webhooks";
import { productDataFromShopify } from "@/lib/shopify-products";

export const dynamic = "force-dynamic";

// Live product sync receiver. Shopify POSTs product create/update/delete here; we
// upsert the matching CRM Product (same mapping as the bulk import). Always answer
// 200 on handled cases so Shopify doesn't retry-storm; only bad HMAC gets a 401.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256") || "";
  if (!(await verifyWebhookHmac(raw, hmac))) return new NextResponse("unauthorized", { status: 401 });

  const shop = req.headers.get("x-shopify-shop-domain") || "";
  const topic = req.headers.get("x-shopify-topic") || "";
  const locationId = await locationForShop(shop);
  if (!locationId) return NextResponse.json({ ok: true, skipped: "unknown shop" });

  let body: { id?: number | string } & Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" });
  }
  if (body.id == null) return NextResponse.json({ ok: false, error: "no id" });
  const externalId = String(body.id);

  try {
    if (topic === "products/delete") {
      await prisma.product.deleteMany({ where: { locationId, source: "Shopify", externalId } });
      return NextResponse.json({ ok: true, deleted: true });
    }
    const data = productDataFromShopify(body as Parameters<typeof productDataFromShopify>[0]);
    const existing = await prisma.product.findFirst({ where: { locationId, source: "Shopify", externalId }, select: { id: true } });
    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data });
    } else {
      await prisma.product.create({ data: { locationId, source: "Shopify", externalId, channels: ["shopify"], ...data } });
    }
    return NextResponse.json({ ok: true, topic });
  } catch (e) {
    console.error("[shopify-webhook]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false });
  }
}
