import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import type { StorageBookingStatus, StorageSpotType, StorageTerm } from "@prisma/client";

export const dynamic = "force-dynamic";

const SOURCE = "Storage site";

// The storage location is the (single) location with StorageSettings; the
// STORAGE_LOCATION_ID env var overrides if there are ever several yards.
async function storageLocationId(): Promise<string | null> {
  if (process.env.STORAGE_LOCATION_ID) return process.env.STORAGE_LOCATION_ID;
  const settings = await prisma.storageSettings.findMany({ select: { locationId: true }, take: 2 });
  return settings.length === 1 ? settings[0].locationId : null;
}

function authed(header: string | null): boolean {
  const expected = process.env.STORAGE_API_TOKEN;
  if (!expected || !header) return false;
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const a = Buffer.from(m[1]);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const STATUS_MAP: Record<string, StorageBookingStatus> = {
  pending_payment: "PENDING_PAYMENT",
  active: "ACTIVE",
  suspended: "SUSPENDED",
  cancelled: "CANCELLED",
  ended: "ENDED",
  waitlisted: "WAITLISTED",
};

// POST /api/storage/bookings — receive a booking from placidstoragesolutions.com.au.
// Idempotent by ref: upserts the CRM contact + StorageBooking so the yard tab
// mirrors the live site. Auth: Bearer STORAGE_API_TOKEN.
export async function POST(req: NextRequest) {
  if (!authed(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const locationId = await storageLocationId();
  if (!locationId) {
    return NextResponse.json(
      { error: "storage location not configured (seed the Storage tab or set STORAGE_LOCATION_ID)" },
      { status: 503 }
    );
  }

  let body: {
    bookingRef?: string;
    status?: string;
    product?: string;
    productCode?: string;
    spotType?: string;
    spot?: string | null;
    storedDescription?: string | null;
    pin?: string | null;
    term?: string;
    startDate?: string;
    endDate?: string | null;
    amountCents?: number;
    vehicle?: { make?: string | null; model?: string | null; rego?: string | null } | null;
    customer?: {
      name?: string;
      email?: string | null;
      phone?: string | null;
      company?: string | null;
      address?: string | null;
    };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "malformed request" }, { status: 400 });
  }

  const ref = String(body.bookingRef ?? "").trim();
  if (!ref) return NextResponse.json({ error: "bookingRef is required" }, { status: 422 });
  const cust = body.customer ?? {};
  const name = String(cust.name ?? "").trim() || "Storage customer";

  // Contact upsert (email first, then phone).
  let contactId: string | null = null;
  const existing =
    (cust.email
      ? await prisma.contact.findFirst({ where: { locationId, email: cust.email } })
      : null) ||
    (cust.phone
      ? await prisma.contact.findFirst({ where: { locationId, phone: cust.phone } })
      : null);
  if (existing) {
    contactId = existing.id;
    await prisma.contact.update({
      where: { id: existing.id },
      data: {
        email: cust.email ?? existing.email,
        phone: cust.phone ?? existing.phone,
        companyName: cust.company ?? existing.companyName,
      },
    });
  } else {
    const [first, ...rest] = name.split(" ");
    const created = await prisma.contact.create({
      data: {
        locationId,
        firstName: first || null,
        lastName: rest.join(" ") || null,
        email: cust.email || null,
        phone: cust.phone || null,
        companyName: cust.company || null,
        source: SOURCE,
        notes: cust.address ? `Address: ${cust.address}` : null,
      },
    });
    contactId = created.id;
  }

  // The live site's product codes → the CRM storage module's codes.
  const CODE_MAP: Record<string, string> = {
    container_hire_20: "unit_20",
    container_hire_10: "unit_10",
    container_store_20: "own_container_20",
    container_store_10: "own_container_10",
  };
  const code = body.productCode ? (CODE_MAP[body.productCode] ?? body.productCode) : null;
  const product = code
    ? await prisma.storageProduct.findFirst({ where: { locationId, code } })
    : null;
  const spotType: StorageSpotType =
    (body.spotType ?? product?.spotType ?? "car").toString().toUpperCase() === "CONTAINER"
      ? "CONTAINER"
      : "CAR";
  const term: StorageTerm = (body.term ?? "monthly").toLowerCase() === "weekly" ? "WEEKLY" : "MONTHLY";
  const status: StorageBookingStatus = STATUS_MAP[String(body.status ?? "active")] ?? "ACTIVE";
  const startDate = body.startDate ? new Date(body.startDate) : new Date();
  const endDate = body.endDate ? new Date(body.endDate) : null;

  const data = {
    locationId,
    contactId,
    productId: product?.id ?? null,
    spotType,
    term,
    startDate,
    endDate,
    openEnded: !endDate,
    amountCents: Number(body.amountCents) || 0,
    status,
    pin: body.pin ?? null,
    spotLabel: body.spot ?? null,
    storedDescription: body.storedDescription ?? null,
    vehicleMake: body.vehicle?.make ?? null,
    vehicleModel: body.vehicle?.model ?? null,
    vehicleRego: body.vehicle?.rego ?? null,
  };

  const booking = await prisma.storageBooking.upsert({
    where: { ref },
    update: data,
    create: { ref, ...data },
  });

  return NextResponse.json({ crmBookingId: booking.id, contactId, status: "received" });
}
