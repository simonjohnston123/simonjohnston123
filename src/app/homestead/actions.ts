"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export async function createHomesteadBookingAction(_prev: unknown, formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const roomId = String(formData.get("roomId") ?? "");
  const guestName = String(formData.get("guestName") ?? "").trim();
  const guestEmail = String(formData.get("guestEmail") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "");
  const signature = String(formData.get("signature") ?? "").trim();
  const accepted = formData.get("accept") === "on";

  if (!guestName || !guestEmail) return { error: "Enter your name and email." };
  if (!startDate) return { error: "Choose a start date." };
  if (!accepted || !signature) return { error: "Please read and accept the agreement, and sign your name." };

  const location = await prisma.location.findUnique({ where: { slug } });
  if (!location) return { error: "Business not found." };
  const room = await prisma.homesteadRoom.findFirst({ where: { id: roomId, locationId: location.id, active: true } });
  if (!room) return { error: "That room is no longer available." };

  const booking = await prisma.homesteadBooking.create({
    data: {
      locationId: location.id, roomId: room.id, guestName, guestEmail,
      guestPhone: String(formData.get("guestPhone") ?? "").trim() || null,
      startDate: new Date(startDate), weeklyPrice: room.weeklyPrice,
      contractAccepted: true, signature, status: "PENDING",
    },
  });

  // Drop the guest into the business's CRM contacts too.
  const [firstName, ...rest] = guestName.split(" ");
  await prisma.contact.create({
    data: { locationId: location.id, firstName, lastName: rest.join(" ") || null, email: guestEmail, phone: String(formData.get("guestPhone") ?? "").trim() || null, source: "Homestead booking" },
  }).catch(() => {});

  redirect(`/homestead/${slug}/welcome/${booking.id}`);
}
