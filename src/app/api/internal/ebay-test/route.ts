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
