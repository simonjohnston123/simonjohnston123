import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import type { StorageBookingStatus, StorageRequestStatus } from "@prisma/client";

// Native storage module — the Placid Storage yard, inside the CRM.

const OCCUPYING: StorageBookingStatus[] = ["ACTIVE", "SUSPENDED", "PENDING_PAYMENT"];
const OCCUPYING_STR: string[] = OCCUPYING;

export function storageRef(): string {
  return "PSS-" + crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
}

export function storagePin(): string {
  return String(crypto.randomInt(1000, 10000)); // 4-digit
}

export const SPOT_PREFIX: Record<"CAR" | "CONTAINER", string> = { CAR: "Bay", CONTAINER: "Unit" };

/** Next free spot label for a type (e.g. "Bay 3"), based on active bookings. */
export async function nextSpotLabel(locationId: string, spotType: "CAR" | "CONTAINER"): Promise<string> {
  const settings = await prisma.storageSettings.findUnique({ where: { locationId } });
  const cap = spotType === "CAR" ? settings?.carCapacity ?? 0 : settings?.containerCapacity ?? 0;
  const taken = new Set(
    (
      await prisma.storageBooking.findMany({
        where: { locationId, spotType, status: { in: OCCUPYING }, spotLabel: { not: null } },
        select: { spotLabel: true },
      })
    ).map((b) => b.spotLabel),
  );
  const prefix = SPOT_PREFIX[spotType];
  for (let n = 1; n <= Math.max(cap, 1); n++) {
    if (!taken.has(`${prefix} ${n}`)) return `${prefix} ${n}`;
  }
  return `${prefix} ${cap + 1}`;
}

/** A grid of every spot for a type with the active booking (if any) on it. */
export function buildGrid(
  spotType: "CAR" | "CONTAINER",
  capacity: number,
  bookings: { spotType: string; status: string; spotLabel: string | null; ref: string; contactId: string | null }[],
): { label: string; booking: { ref: string; contactId: string | null } | null }[] {
  const prefix = SPOT_PREFIX[spotType];
  const active = bookings.filter((b) => b.spotType === spotType && OCCUPYING_STR.includes(b.status));
  return Array.from({ length: capacity }, (_, i) => {
    const label = `${prefix} ${i + 1}`;
    const b = active.find((x) => x.spotLabel === label);
    return { label, booking: b ? { ref: b.ref, contactId: b.contactId } : null };
  });
}

export async function getYard(locationId: string) {
  const [settings, products, bookings, waitlist, requests] = await Promise.all([
    prisma.storageSettings.findUnique({ where: { locationId } }),
    prisma.storageProduct.findMany({ where: { locationId }, orderBy: { sortOrder: "asc" } }),
    prisma.storageBooking.findMany({ where: { locationId }, orderBy: { createdAt: "desc" }, take: 300, include: { product: true } }),
    prisma.storageWaitlist.findMany({ where: { locationId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.storageServiceRequest.findMany({ where: { locationId, status: { in: ["OPEN", "IN_PROGRESS"] as StorageRequestStatus[] } }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  const occ = (type: "CAR" | "CONTAINER") =>
    bookings.filter((b) => b.spotType === type && OCCUPYING.includes(b.status)).length;

  const carCap = settings?.carCapacity ?? 0;
  const containerCap = settings?.containerCapacity ?? 0;
  const occupancy = {
    car: { capacity: carCap, occupied: occ("CAR"), available: Math.max(carCap - occ("CAR"), 0) },
    container: { capacity: containerCap, occupied: occ("CONTAINER"), available: Math.max(containerCap - occ("CONTAINER"), 0) },
  };

  return { settings, products, bookings, waitlist, requests, occupancy };
}

const DEFAULT_PRODUCTS: {
  code: string; name: string; spotType: "CAR" | "CONTAINER"; sizeLabel: string | null; monthly: number; weekly: number | null; sort: number;
}[] = [
  { code: "car_parking", name: "Car parking — Secure bay", spotType: "CAR", sizeLabel: "Secure bay", monthly: 15000, weekly: 4000, sort: 0 },
  { code: "unit_20", name: "Storage unit / locker — 20ft", spotType: "CONTAINER", sizeLabel: "20ft (~13.8 m²)", monthly: 25000, weekly: null, sort: 1 },
  { code: "unit_10", name: "Storage unit / locker — 10ft", spotType: "CONTAINER", sizeLabel: "10ft (~6.7 m²)", monthly: 15000, weekly: null, sort: 2 },
  { code: "own_container_20", name: "Store your own container — 20ft", spotType: "CONTAINER", sizeLabel: "20ft (~13.8 m²)", monthly: 15000, weekly: null, sort: 3 },
  { code: "own_container_10", name: "Store your own container — 10ft", spotType: "CONTAINER", sizeLabel: "10ft (~6.7 m²)", monthly: 10000, weekly: null, sort: 4 },
];

/** Idempotently set up the yard for a location with Placid Storage defaults. */
export async function seedStorageDefaults(locationId: string): Promise<void> {
  const existing = await prisma.storageSettings.findUnique({ where: { locationId } });
  if (existing) return;

  await prisma.storageSettings.create({
    data: { locationId, carCapacity: 20, containerCapacity: 6, siteAddress: "27 Toolooa Street, South Gladstone QLD 4680" },
  });
  for (const p of DEFAULT_PRODUCTS) {
    await prisma.storageProduct.create({
      data: {
        locationId, code: p.code, name: p.name, spotType: p.spotType, sizeLabel: p.sizeLabel,
        priceMonthlyCents: p.monthly, priceWeeklyCents: p.weekly, sortOrder: p.sort,
      },
    });
  }
}
