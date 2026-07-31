"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { checkAvailability, startOfDay } from "@/lib/homestead";
import type { StayType } from "@prisma/client";

export async function createHomesteadBookingAction(_prev: unknown, formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const roomId = String(formData.get("roomId") ?? "");
  const guestName = String(formData.get("guestName") ?? "").trim();
  const guestEmail = String(formData.get("guestEmail") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "");
  const endDateRaw = String(formData.get("endDate") ?? "").trim();
  const signature = String(formData.get("signature") ?? "").trim();
  const guestPhone = String(formData.get("guestPhone") ?? "").trim() || null;
  const accepted = formData.get("accept") === "on";
  const stayType: StayType = formData.get("stayType") === "NIGHTLY" ? "NIGHTLY" : "WEEKLY";

  if (!guestName || !guestEmail) return { error: "Enter your name and email." };
  if (!startDate) return { error: stayType === "NIGHTLY" ? "Choose an arrival date." : "Choose a start date." };
  if (stayType === "NIGHTLY" && !endDateRaw) return { error: "Choose a departure date." };
  if (!accepted || !signature) return { error: "Please read and accept the agreement, and sign your name." };

  const location = await prisma.location.findUnique({ where: { slug } });
  if (!location) return { error: "Business not found." };

  const room = await prisma.homesteadRoom.findFirst({
    where: { id: roomId, locationId: location.id, active: true },
  });
  if (!room) return { error: "That room is no longer available." };

  // The gate. Validates stay type, dates and minimum stay, and — the reason it
  // exists — that no resident or guest already holds the bed for those nights.
  const availability = await checkAvailability({
    roomId: room.id,
    stayType,
    start: startDate,
    end: endDateRaw || null,
  });
  if (!availability.ok) return { error: availability.reason };

  const booking = await prisma.homesteadBooking.create({
    data: {
      locationId: location.id,
      roomId: room.id,
      stayType,
      guestName,
      guestEmail,
      guestPhone,
      startDate: startOfDay(startDate),
      endDate: endDateRaw ? startOfDay(endDateRaw) : null,
      weeklyPrice: stayType === "WEEKLY" ? room.weeklyPrice : 0,
      nightlyPrice: stayType === "NIGHTLY" ? room.nightlyPrice : 0,
      totalPrice: stayType === "NIGHTLY" ? availability.totalPrice : null,
      contractAccepted: true,
      signature,
      status: "PENDING",
    },
  });

  // Drop the guest into the business's CRM contacts too.
  const [firstName, ...rest] = guestName.split(" ");
  await prisma.contact
    .create({
      data: {
        locationId: location.id,
        firstName,
        lastName: rest.join(" ") || null,
        email: guestEmail,
        phone: guestPhone,
        source: stayType === "NIGHTLY" ? "Homestead stay" : "Homestead booking",
      },
    })
    .catch(() => {});

  redirect(`/homestead/${slug}/welcome/${booking.id}`);
}
