"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { startOfDay } from "@/lib/homestead-dates";
import type { HomesteadPaymentMethod } from "@prisma/client";

const METHODS: HomesteadPaymentMethod[] = ["CASH", "BANK_TRANSFER", "CARD", "STRIPE", "OTHER"];

export async function recordPaymentAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);

  const bookingId = String(formData.get("bookingId") ?? "");
  const amount = Math.round(Number(formData.get("amount")) || 0);
  const paidAt = String(formData.get("paidAt") ?? "").trim();
  const rawMethod = String(formData.get("method") ?? "BANK_TRANSFER") as HomesteadPaymentMethod;

  if (!bookingId) return { message: "", error: "Choose who paid." };
  if (amount <= 0) return { message: "", error: "Enter an amount greater than zero." };

  // Scope the booking to this location — a payment must never be attached to
  // another business's stay via a tampered form field.
  const booking = await prisma.homesteadBooking.findFirst({
    where: { id: bookingId, locationId },
    select: { id: true, guestName: true },
  });
  if (!booking) return { message: "", error: "That booking no longer exists." };

  await prisma.homesteadPayment.create({
    data: {
      locationId,
      bookingId: booking.id,
      amount,
      method: METHODS.includes(rawMethod) ? rawMethod : "BANK_TRANSFER",
      paidAt: paidAt ? startOfDay(paidAt) : new Date(),
      reference: String(formData.get("reference") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });

  revalidatePath(`/dashboard/l/${locationId}/finance`);
  return { message: `Recorded $${amount.toLocaleString()} from ${booking.guestName}.`, error: "" };
}

export async function deletePaymentAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);
  await prisma.homesteadPayment.deleteMany({
    where: { id: String(formData.get("paymentId") ?? ""), locationId },
  });
  revalidatePath(`/dashboard/l/${locationId}/finance`);
}
