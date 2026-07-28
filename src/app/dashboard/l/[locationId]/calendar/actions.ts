"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";

const schema = z.object({
  title: z.string().min(1, "Enter a title."),
  calendarId: z.string().min(1),
  contactId: z.string().optional(),
  startAt: z.string().min(1, "Choose a start time."),
  durationMinutes: z.coerce.number().min(5).max(600).default(30),
  notes: z.string().optional(),
});

export async function createAppointmentAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);

  const parsed = schema.safeParse({
    title: String(formData.get("title") ?? "").trim(),
    calendarId: String(formData.get("calendarId") ?? ""),
    contactId: String(formData.get("contactId") ?? ""),
    startAt: String(formData.get("startAt") ?? ""),
    durationMinutes: String(formData.get("durationMinutes") ?? "30"),
    notes: String(formData.get("notes") ?? "").trim(),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid appointment." };

  const calendar = await prisma.calendar.findFirst({
    where: { id: parsed.data.calendarId, locationId },
  });
  if (!calendar) return { error: "Invalid calendar." };

  const start = new Date(parsed.data.startAt);
  if (Number.isNaN(start.getTime())) return { error: "Invalid start time." };
  const end = new Date(start.getTime() + parsed.data.durationMinutes * 60000);

  await prisma.appointment.create({
    data: {
      locationId,
      calendarId: parsed.data.calendarId,
      contactId: parsed.data.contactId || null,
      title: parsed.data.title,
      startAt: start,
      endAt: end,
      notes: parsed.data.notes || null,
    },
  });
  revalidatePath(`/dashboard/l/${locationId}/calendar`);
  return { error: "", ok: true };
}

export async function setAppointmentStatusAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const status = String(formData.get("status") ?? "CONFIRMED") as "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  await requireLocationAccess(locationId);
  await prisma.appointment.update({ where: { id: appointmentId, locationId }, data: { status } });
  revalidatePath(`/dashboard/l/${locationId}/calendar`);
}

export async function deleteAppointmentAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const appointmentId = String(formData.get("appointmentId") ?? "");
  await requireLocationAccess(locationId);
  await prisma.appointment.delete({ where: { id: appointmentId, locationId } });
  revalidatePath(`/dashboard/l/${locationId}/calendar`);
}
