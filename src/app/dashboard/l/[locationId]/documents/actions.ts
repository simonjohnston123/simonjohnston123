"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { startOfDay } from "@/lib/homestead-dates";
import type { DocumentCategory } from "@prisma/client";

const CATEGORIES: DocumentCategory[] = [
  "AGREEMENT", "IDENTITY", "BOND", "CONDITION_REPORT",
  "COMPLIANCE", "INSURANCE", "REGISTRATION", "OTHER",
];

export async function addDocumentAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { message: "", error: "Give the document a name." };

  const rawCategory = String(formData.get("category") ?? "OTHER") as DocumentCategory;
  const roomId = String(formData.get("roomId") ?? "").trim();
  const bookingId = String(formData.get("bookingId") ?? "").trim();
  const issuedAt = String(formData.get("issuedAt") ?? "").trim();
  const expiresAt = String(formData.get("expiresAt") ?? "").trim();
  const fileUrl = String(formData.get("fileUrl") ?? "").trim();

  if (issuedAt && expiresAt && startOfDay(expiresAt) < startOfDay(issuedAt)) {
    return { message: "", error: "Expiry can't be before the issue date." };
  }

  // Scope both attachments to this location — a tampered form field must not be
  // able to file a document against another business's room or stay.
  let safeRoomId: string | null = null;
  if (roomId) {
    const room = await prisma.homesteadRoom.findFirst({ where: { id: roomId, locationId }, select: { id: true } });
    if (!room) return { message: "", error: "That room no longer exists." };
    safeRoomId = room.id;
  }

  let safeBookingId: string | null = null;
  if (bookingId) {
    const booking = await prisma.homesteadBooking.findFirst({ where: { id: bookingId, locationId }, select: { id: true } });
    if (!booking) return { message: "", error: "That stay no longer exists." };
    safeBookingId = booking.id;
  }

  await prisma.homesteadDocument.create({
    data: {
      locationId,
      roomId: safeRoomId,
      bookingId: safeBookingId,
      category: CATEGORIES.includes(rawCategory) ? rawCategory : "OTHER",
      title,
      fileUrl: fileUrl || null,
      issuedAt: issuedAt ? startOfDay(issuedAt) : null,
      expiresAt: expiresAt ? startOfDay(expiresAt) : null,
      reference: String(formData.get("reference") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });

  revalidatePath(`/dashboard/l/${locationId}/documents`);
  return { message: `Filed "${title}".`, error: "" };
}

export async function deleteDocumentAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);
  await prisma.homesteadDocument.deleteMany({
    where: { id: String(formData.get("documentId") ?? ""), locationId },
  });
  revalidatePath(`/dashboard/l/${locationId}/documents`);
}
