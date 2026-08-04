"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { buildSupplierOrders } from "@/lib/fulfilment";

export type FulfilResult = { ok: boolean; message: string };

const path = (locationId: string) => `/dashboard/l/${locationId}/fulfilment`;

/** Re-scan open orders and (re)build what needs buying, per supplier. */
export async function rebuildAction(locationId: string): Promise<FulfilResult> {
  await requireLocationAccess(locationId);
  const r = await buildSupplierOrders(locationId);
  revalidatePath(path(locationId));

  const bits = [];
  if (r.created) bits.push(`${r.created} new`);
  if (r.updated) bits.push(`${r.updated} refreshed`);
  if (r.duplicates) bits.push(`${r.duplicates} duplicate${r.duplicates === 1 ? "" : "s"} removed (same sale on eBay + Shopify)`);
  if (r.unresolved) bits.push(`${r.unresolved} line${r.unresolved === 1 ? "" : "s"} with no supplier`);
  if (!bits.length) return { ok: true, message: "Nothing new to buy." };
  return { ok: true, message: bits.join(" · ") };
}

async function owned(locationId: string, id: string) {
  return prisma.supplierOrder.findFirst({ where: { id, locationId }, select: { id: true } });
}

/** Record that the purchase has been placed with the supplier. */
export async function markPlacedAction(locationId: string, id: string, supplierRef: string): Promise<FulfilResult> {
  await requireLocationAccess(locationId);
  if (!(await owned(locationId, id))) return { ok: false, message: "Not found." };

  await prisma.supplierOrder.update({
    where: { id },
    data: { status: "PLACED", supplierRef: supplierRef.trim() || null, placedAt: new Date(), error: null },
  });
  revalidatePath(path(locationId));
  return { ok: true, message: "Marked as placed." };
}

/** Record tracking, which is what the customer is actually waiting for. */
export async function recordTrackingAction(
  locationId: string,
  id: string,
  tracking: string,
  carrier: string,
): Promise<FulfilResult> {
  await requireLocationAccess(locationId);
  if (!(await owned(locationId, id))) return { ok: false, message: "Not found." };

  const t = tracking.trim();
  if (!t) return { ok: false, message: "Enter a tracking number." };

  await prisma.supplierOrder.update({
    where: { id },
    data: { tracking: t, carrier: carrier.trim() || null, status: "SHIPPED" },
  });
  revalidatePath(path(locationId));
  return { ok: true, message: "Tracking saved." };
}

export async function setStatusAction(
  locationId: string,
  id: string,
  status: "TO_PLACE" | "PLACED" | "SHIPPED" | "FAILED" | "CANCELLED",
): Promise<FulfilResult> {
  await requireLocationAccess(locationId);
  if (!(await owned(locationId, id))) return { ok: false, message: "Not found." };
  await prisma.supplierOrder.update({ where: { id }, data: { status } });
  revalidatePath(path(locationId));
  return { ok: true, message: `Moved to ${status.toLowerCase().replace("_", " ")}.` };
}
