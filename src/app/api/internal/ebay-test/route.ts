import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getValidToken, resolveListingContext, pushProductToEbay } from "@/lib/ebay-listing";

export const dynamic = "force-dynamic";

/**
 * TEMPORARY diagnostic harness for the eBay listing push (remove after testing).
 * Guarded by CRON_SECRET. `dry=1` validates prerequisites (business policies +
 * merchant location) WITHOUT creating any listing — safe. Without dry, it pushes
 * exactly one product live (inventory_item -> offer -> publish) and returns the
 * raw eBay result/error for diagnosis.
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const locationId = req.nextUrl.searchParams.get("locationId") || "";
  const productId = req.nextUrl.searchParams.get("productId") || "";
  const dry = req.nextUrl.searchParams.get("dry") === "1";

  const token = await getValidToken(locationId);
  if (!token) return NextResponse.json({ step: "token", ok: false, error: "eBay not connected for this location" });

  // Raw probe of the eBay endpoints resolveListingContext relies on, so we can
  // see exactly what eBay returns (status + body) when policies don't resolve.
  if (req.nextUrl.searchParams.get("probe") === "1") {
    const H = {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "Content-Language": "en-AU",
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_AU",
    };
    const probe = async (path: string) => {
      const r = await fetch(`https://api.ebay.com${path}`, { headers: H, cache: "no-store" });
      return { path, status: r.status, body: (await r.text()).slice(0, 500) };
    };
    const out = await Promise.all([
      probe("/sell/account/v1/fulfillment_policy?marketplace_id=EBAY_AU"),
      probe("/sell/account/v1/payment_policy?marketplace_id=EBAY_AU"),
      probe("/sell/account/v1/return_policy?marketplace_id=EBAY_AU"),
      probe("/sell/account/v1/privilege"),
      probe("/sell/inventory/v1/location"),
    ]);
    return NextResponse.json({ step: "probe", results: out });
  }

  const ctx = await resolveListingContext(token);
  if (!ctx.ok || !ctx.ctx) return NextResponse.json({ step: "context", ok: false, reason: ctx.reason });
  if (dry) return NextResponse.json({ step: "context", ok: true, ctx: ctx.ctx });

  const p = await prisma.product.findFirst({
    where: { id: productId, locationId },
    select: { id: true, externalId: true, name: true, description: true, imageUrl: true, priceCents: true, inventory: true, sku: true, category: true },
  });
  if (!p) return NextResponse.json({ step: "product", ok: false, error: "product not found" });

  const r = await pushProductToEbay(locationId, p, ctx.ctx, token);
  return NextResponse.json({ step: "push", product: { id: p.id, name: p.name, price: p.priceCents, img: !!p.imageUrl }, result: r });
}
