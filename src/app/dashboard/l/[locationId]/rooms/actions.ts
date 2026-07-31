"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { checkAvailability, startOfDay } from "@/lib/homestead";
import { ensureTurnoverForBooking } from "@/lib/homestead-ops";
import type { StayType } from "@prisma/client";

const money = (v: FormDataEntryValue | null) => Math.max(0, Math.round(Number(v) || 0));

/** Letting modes off the form. A room with neither ticked falls back to weekly. */
function lettingModes(formData: FormData) {
  const allowsWeekly = formData.get("allowsWeekly") === "on";
  const allowsNightly = formData.get("allowsNightly") === "on";
  return {
    allowsWeekly: allowsWeekly || !allowsNightly,
    allowsNightly,
    weeklyPrice: money(formData.get("weeklyPrice")),
    nightlyPrice: money(formData.get("nightlyPrice")),
    minNights: Math.max(1, Math.round(Number(formData.get("minNights")) || 1)),
  };
}

export async function addRoomAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await prisma.homesteadRoom.create({
    data: {
      locationId, name,
      ...lettingModes(formData),
      imageUrl: String(formData.get("imageUrl") ?? "").trim() || null,
      description: String(formData.get("description") ?? "").trim() || null,
    },
  });
  revalidatePath(`/dashboard/l/${locationId}/rooms`);
}

export async function updateRoomAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const id = String(formData.get("roomId") ?? "");
  await requireLocationAccess(locationId);
  await prisma.homesteadRoom.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? "").trim() || "Room",
      ...lettingModes(formData),
      imageUrl: String(formData.get("imageUrl") ?? "").trim() || null,
      description: String(formData.get("description") ?? "").trim() || null,
      active: formData.get("active") === "on",
    },
  });
  revalidatePath(`/dashboard/l/${locationId}/rooms`);
}

export async function deleteRoomAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);
  await prisma.homesteadRoom.delete({ where: { id: String(formData.get("roomId") ?? "") } });
  revalidatePath(`/dashboard/l/${locationId}/rooms`);
}

export async function addClientAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!firstName && !lastName && !email && !phone) return;
  await prisma.contact.create({
    data: { locationId, firstName: firstName || null, lastName: lastName || null, email: email || null, phone: phone || null, source: "Rooms" },
  });
  revalidatePath(`/dashboard/l/${locationId}/rooms`);
}

export async function saveHomesteadSettingsAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);
  const data = {
    houseRules: String(formData.get("houseRules") ?? "").trim() || null,
    welcomeInfo: String(formData.get("welcomeInfo") ?? "").trim() || null,
    contractText: String(formData.get("contractText") ?? "").trim() || null,
    bookingWindowDays: Math.max(0, Math.round(Number(formData.get("bookingWindowDays")) || 21)),
    depositWeeks: Math.max(1, Math.round(Number(formData.get("depositWeeks")) || 1)),
  };
  await prisma.homesteadSettings.upsert({ where: { locationId }, create: { locationId, ...data }, update: data });
  revalidatePath(`/dashboard/l/${locationId}/rooms`);
}

export async function setBookingStatusAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);
  const id = String(formData.get("bookingId") ?? "");
  const status = String(formData.get("status") ?? "PENDING") as "PENDING" | "ACTIVE" | "ENDED" | "CANCELLED";

  const booking = await prisma.homesteadBooking.findFirst({
    where: { id, locationId },
    select: { stayType: true, endDate: true },
  });
  if (!booking) return;

  // A resident's stay is open-ended, so ending one has to record *when* — both
  // for the rent ledger and so the room reads as free from that date onward.
  const closesOpenResidency =
    status === "ENDED" && booking.stayType === "WEEKLY" && !booking.endDate;

  await prisma.homesteadBooking.update({
    where: { id },
    data: { status, ...(closesOpenResidency ? { endDate: startOfDay(new Date()) } : {}) },
  });

  // Checking someone out puts the room in the cleaning queue automatically —
  // nobody has to remember to raise it.
  if (status === "ENDED") await ensureTurnoverForBooking(id);

  revalidatePath(`/dashboard/l/${locationId}/rooms`);
  revalidatePath(`/dashboard/l/${locationId}/operations`);
}

/**
 * Staff-side booking entry — walk-ins and phone bookings. Goes through the same
 * availability gate as the public form so the dashboard can't create the
 * double-booking the public site refuses.
 */
export async function addBookingAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);

  const roomId = String(formData.get("roomId") ?? "");
  const guestName = String(formData.get("guestName") ?? "").trim();
  const guestEmail = String(formData.get("guestEmail") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "");
  const endDateRaw = String(formData.get("endDate") ?? "").trim();
  const stayType: StayType = formData.get("stayType") === "NIGHTLY" ? "NIGHTLY" : "WEEKLY";

  if (!roomId) return { error: "Pick a room." };
  if (!guestName) return { error: "Enter the guest's name." };
  if (!startDate) return { error: "Choose a start date." };

  const room = await prisma.homesteadRoom.findFirst({ where: { id: roomId, locationId } });
  if (!room) return { error: "That room no longer exists." };

  const availability = await checkAvailability({
    roomId,
    stayType,
    start: startDate,
    end: endDateRaw || null,
  });
  if (!availability.ok) return { error: availability.reason };

  await prisma.homesteadBooking.create({
    data: {
      locationId,
      roomId,
      stayType,
      guestName,
      guestEmail,
      guestPhone: String(formData.get("guestPhone") ?? "").trim() || null,
      startDate: startOfDay(startDate),
      endDate: endDateRaw ? startOfDay(endDateRaw) : null,
      weeklyPrice: stayType === "WEEKLY" ? room.weeklyPrice : 0,
      nightlyPrice: stayType === "NIGHTLY" ? room.nightlyPrice : 0,
      totalPrice: stayType === "NIGHTLY" ? availability.totalPrice : null,
      status: "PENDING",
    },
  });

  revalidatePath(`/dashboard/l/${locationId}/rooms`);
  return { error: "" };
}
