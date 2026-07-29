"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { seedStorageDefaults, storageRef, storagePin, nextSpotLabel } from "@/lib/storage";
import type { StorageTerm, StorageBookingStatus, StorageRequestStatus } from "@prisma/client";

const path = (l: string) => `/dashboard/l/${l}/storage`;

export async function seedStorageAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);
  await seedStorageDefaults(locationId);
  revalidatePath(path(locationId));
}

export async function createStorageBookingAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);

  const productId = String(formData.get("productId") ?? "");
  const term = (String(formData.get("term") ?? "MONTHLY") as StorageTerm) || "MONTHLY";
  const startRaw = String(formData.get("startDate") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const openEnded = formData.get("openEnded") === "on";
  const endRaw = String(formData.get("endDate") ?? "").trim();
  const stored = String(formData.get("storedDescription") ?? "").trim();
  const vMake = String(formData.get("vehicleMake") ?? "").trim();
  const vModel = String(formData.get("vehicleModel") ?? "").trim();
  const vRego = String(formData.get("vehicleRego") ?? "").trim();

  const product = await prisma.storageProduct.findFirst({ where: { id: productId, locationId } });
  if (!product) return { error: "Pick a product." };
  if (!name || (!email && !phone)) return { error: "Enter the customer's name and email or phone." };

  const startDate = startRaw ? new Date(startRaw) : new Date();
  if (Number.isNaN(startDate.getTime())) return { error: "Invalid start date." };
  const endDate = !openEnded && endRaw ? new Date(endRaw) : null;

  const amountCents = term === "WEEKLY" ? product.priceWeeklyCents ?? product.priceMonthlyCents : product.priceMonthlyCents;
  const spotLabel = await nextSpotLabel(locationId, product.spotType);

  // Link (or create) the customer as a CRM contact.
  let contactId: string | null = null;
  const existing =
    (email ? await prisma.contact.findFirst({ where: { locationId, email } }) : null) ||
    (phone ? await prisma.contact.findFirst({ where: { locationId, phone } }) : null);
  if (existing) contactId = existing.id;
  else {
    const [first, ...rest] = name.split(" ");
    const c = await prisma.contact.create({
      data: { locationId, firstName: first || null, lastName: rest.join(" ") || null, email: email || null, phone: phone || null, source: "Storage" },
    });
    contactId = c.id;
  }

  await prisma.storageBooking.create({
    data: {
      locationId,
      ref: storageRef(),
      contactId,
      productId: product.id,
      spotType: product.spotType,
      term,
      startDate,
      endDate,
      openEnded,
      amountCents,
      status: "ACTIVE",
      spotLabel,
      pin: storagePin(),
      storedDescription: stored || null,
      vehicleMake: vMake || null,
      vehicleModel: vModel || null,
      vehicleRego: vRego || null,
    },
  });

  revalidatePath(path(locationId));
  return { error: "", ok: true };
}

export async function setStorageBookingStatusAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const bookingId = String(formData.get("bookingId") ?? "");
  const status = String(formData.get("status") ?? "") as StorageBookingStatus;
  await requireLocationAccess(locationId);
  if (!["PENDING_PAYMENT", "ACTIVE", "SUSPENDED", "CANCELLED", "ENDED", "WAITLISTED"].includes(status)) return;
  await prisma.storageBooking.update({ where: { id: bookingId, locationId }, data: { status } });
  revalidatePath(path(locationId));
}

export async function setStorageRequestStatusAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const requestId = String(formData.get("requestId") ?? "");
  const status = String(formData.get("status") ?? "") as StorageRequestStatus;
  await requireLocationAccess(locationId);
  if (!["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].includes(status)) return;
  await prisma.storageServiceRequest.update({ where: { id: requestId, locationId }, data: { status } });
  revalidatePath(path(locationId));
}

export async function updateStorageSettingsAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);
  const carCapacity = Math.max(Number(formData.get("carCapacity")) || 0, 0);
  const containerCapacity = Math.max(Number(formData.get("containerCapacity")) || 0, 0);
  const siteAddress = String(formData.get("siteAddress") ?? "").trim() || null;
  await prisma.storageSettings.update({
    where: { locationId },
    data: { carCapacity, containerCapacity, siteAddress },
  });
  revalidatePath(path(locationId));
}

/** Add or update a product/price. Blank id = create. */
export async function saveStorageProductAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);
  const id = String(formData.get("productId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const spotType = String(formData.get("spotType") ?? "CONTAINER") === "CAR" ? "CAR" : "CONTAINER";
  const monthly = Math.round((Number(formData.get("monthly")) || 0) * 100);
  const weeklyRaw = Number(formData.get("weekly"));
  const weekly = weeklyRaw > 0 ? Math.round(weeklyRaw * 100) : null;
  if (!name) return;

  if (id) {
    await prisma.storageProduct.update({
      where: { id, locationId },
      data: { name, spotType, priceMonthlyCents: monthly, priceWeeklyCents: weekly },
    });
  } else {
    const code = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `product_${Date.now()}`;
    const last = await prisma.storageProduct.findFirst({ where: { locationId }, orderBy: { sortOrder: "desc" } });
    await prisma.storageProduct.create({
      data: { locationId, code, name, spotType, priceMonthlyCents: monthly, priceWeeklyCents: weekly, sortOrder: (last?.sortOrder ?? -1) + 1 },
    });
  }
  revalidatePath(path(locationId));
  return { error: "", ok: true };
}

export async function deleteStorageProductAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const id = String(formData.get("productId") ?? "");
  await requireLocationAccess(locationId);
  await prisma.storageProduct.deleteMany({ where: { id, locationId } });
  revalidatePath(path(locationId));
}
