import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { connectAuthed, CONNECT_MERCHANT_LOCATION_ID } from "@/lib/connect-api";

export const dynamic = "force-dynamic";

const SOURCE = "placid_connect";

type ConnectItem = { productId?: string; sku?: string; qty?: number; priceCents?: number; title?: string };

// POST /api/connect/orders — receive a paid Placid Connect order for fulfilment.
// Idempotent by orderId (== Idempotency-Key): a repeat returns the same crmOrderId.
export async function POST(req: NextRequest) {
  if (!(await connectAuthed(req.headers.get("authorization")))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    orderId?: string;
    placedAt?: string;
    amountCents?: number;
    paymentRef?: string;
    buyer?: { name?: string; email?: string };
    shipping?: {
      name?: string;
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postcode?: string;
      country?: string;
      phone?: string;
    };
    items?: ConnectItem[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "malformed request" }, { status: 400 });
  }

  const orderId = String(body.orderId ?? req.headers.get("idempotency-key") ?? "").trim();
  if (!orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 422 });
  }

  // Idempotency — same orderId returns the existing order, no duplicate.
  const existing = await prisma.order.findFirst({
    where: { locationId: CONNECT_MERCHANT_LOCATION_ID, source: SOURCE, externalId: orderId },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ crmOrderId: existing.id, status: "received" });
  }

  const buyer = body.buyer ?? {};
  const ship = body.shipping ?? {};
  const items = Array.isArray(body.items)
    ? body.items.map((i) => ({
        name: i.title || i.sku || "Item",
        qty: Number(i.qty) || 1,
        price: (Number(i.priceCents) || 0) / 100,
      }))
    : [];

  const deliveryAddress =
    [ship.line1, ship.line2, ship.city, ship.state, ship.postcode, ship.country]
      .map((s) => (s ? String(s).trim() : ""))
      .filter(Boolean)
      .join(", ") || null;

  // Find-or-create the buyer contact (by email within the Placid Deals location).
  let contactId: string | null = null;
  const email = buyer.email ? String(buyer.email).trim().toLowerCase() : null;
  if (email) {
    const found = await prisma.contact.findFirst({
      where: { locationId: CONNECT_MERCHANT_LOCATION_ID, email },
      select: { id: true },
    });
    if (found) {
      contactId = found.id;
    } else {
      const nameParts = String(buyer.name || ship.name || "").trim().split(/\s+/).filter(Boolean);
      const created = await prisma.contact.create({
        data: {
          locationId: CONNECT_MERCHANT_LOCATION_ID,
          firstName: nameParts[0] || "Customer",
          lastName: nameParts.slice(1).join(" ") || null,
          email,
          phone: ship.phone || null,
          source: SOURCE,
        },
        select: { id: true },
      });
      contactId = created.id;
    }
  }

  let placedAt: Date | null = null;
  if (body.placedAt) {
    const d = new Date(body.placedAt);
    if (!isNaN(d.getTime())) placedAt = d;
  }

  const order = await prisma.order.create({
    data: {
      locationId: CONNECT_MERCHANT_LOCATION_ID,
      contactId,
      status: "NEW",
      items,
      total: (Number(body.amountCents) || 0) / 100,
      customerName: buyer.name || ship.name || null,
      customerEmail: email,
      customerPhone: ship.phone || null,
      deliveryAddress,
      source: SOURCE,
      externalId: orderId,
      placedAt,
      notes: `Paid via Placid Connect${body.paymentRef ? ` — Stripe ${body.paymentRef}` : ""}`,
    },
    select: { id: true },
  });

  return NextResponse.json({ crmOrderId: order.id, status: "received" }, { status: 201 });
}
