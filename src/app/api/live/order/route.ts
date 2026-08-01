import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public on-site checkout for the live shopping block. Creates a guest Order for
// the business (no login) — the whole flow stays on the business's own site.
export async function POST(req: NextRequest) {
  let body: { locationId?: string; cart?: { productId: string; qty: number }[]; name?: string; email?: string; phone?: string; address?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const locationId = String(body.locationId ?? "");
  const address = String(body.address ?? "").trim();
  if (!locationId) return NextResponse.json({ error: "missing store" }, { status: 400 });
  if (!address) return NextResponse.json({ error: "Please add a delivery address." }, { status: 422 });

  const lines = (Array.isArray(body.cart) ? body.cart : [])
    .filter((l) => l && typeof l.productId === "string")
    .map((l) => ({ productId: l.productId, qty: Math.max(1, Math.min(20, Number(l.qty) || 1)) }))
    .slice(0, 50);
  if (!lines.length) return NextResponse.json({ error: "Your cart is empty." }, { status: 422 });

  const products = await prisma.product.findMany({
    where: { id: { in: lines.map((l) => l.productId) }, locationId, active: true },
    select: { id: true, name: true, priceCents: true, price: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const items = lines
    .map((l) => {
      const p = byId.get(l.productId);
      if (!p) return null;
      const cents = typeof p.priceCents === "number" && p.priceCents > 0 ? p.priceCents : Math.round((p.price ?? 0) * 100);
      return { name: p.name, qty: l.qty, price: cents / 100 };
    })
    .filter(Boolean) as { name: string; qty: number; price: number }[];
  if (!items.length) return NextResponse.json({ error: "Items no longer available." }, { status: 422 });

  const total = items.reduce((sum, it) => sum + it.price * it.qty, 0);

  const order = await prisma.order.create({
    data: {
      locationId,
      status: "NEW",
      items,
      total,
      customerName: String(body.name ?? "").trim().slice(0, 120) || null,
      customerEmail: String(body.email ?? "").trim().slice(0, 160) || null,
      customerPhone: String(body.phone ?? "").trim().slice(0, 40) || null,
      deliveryAddress: address.slice(0, 500),
      source: "live-shop",
    },
    select: { id: true, number: true },
  });

  return NextResponse.json({ ok: true, orderId: order.id, number: order.number });
}
