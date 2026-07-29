"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";

export async function addRoomAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await prisma.homesteadRoom.create({
    data: {
      locationId, name,
      weeklyPrice: Math.max(0, Math.round(Number(formData.get("weeklyPrice")) || 0)),
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
      weeklyPrice: Math.max(0, Math.round(Number(formData.get("weeklyPrice")) || 0)),
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
  await prisma.homesteadBooking.update({ where: { id, locationId }, data: { status } });
  revalidatePath(`/dashboard/l/${locationId}/rooms`);
}
