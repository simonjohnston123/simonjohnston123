"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { pushAppointment, deleteAppointmentEvent } from "@/lib/google-calendar";

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

  const created = await prisma.appointment.create({
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
  // Mirror to the operator's Google Calendar if connected (fail-soft).
  await pushAppointment(locationId, created);
  revalidatePath(`/dashboard/l/${locationId}/calendar`);
  return { error: "", ok: true };
}

export async function setAppointmentStatusAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const status = String(formData.get("status") ?? "CONFIRMED") as "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  await requireLocationAccess(locationId);
  const appt = await prisma.appointment.update({ where: { id: appointmentId, locationId }, data: { status } });
  // A cancelled/no-show slot frees up — remove its Google event too.
  if ((status === "CANCELLED" || status === "NO_SHOW") && appt.externalEventId) {
    await deleteAppointmentEvent(locationId, appt.externalEventId);
  }
  revalidatePath(`/dashboard/l/${locationId}/calendar`);
}

export async function deleteAppointmentAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const appointmentId = String(formData.get("appointmentId") ?? "");
  await requireLocationAccess(locationId);
  const appt = await prisma.appointment.findFirst({ where: { id: appointmentId, locationId } });
  await prisma.appointment.delete({ where: { id: appointmentId, locationId } });
  if (appt?.externalEventId) await deleteAppointmentEvent(locationId, appt.externalEventId);
  revalidatePath(`/dashboard/l/${locationId}/calendar`);
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "calendar";
}

export async function createCalendarAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  await requireLocationAccess(locationId);
  if (!name) return { error: "Name the calendar." };

  let slug = slugify(name);
  let n = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.calendar.findFirst({ where: { locationId, slug } })) {
    n += 1;
    slug = `${slugify(name)}-${n}`;
  }
  await prisma.calendar.create({ data: { locationId, name, slug, durationMinutes: 30 } });
  revalidatePath(`/dashboard/l/${locationId}/calendar`);
  return { error: "", ok: true };
}

export async function updateCalendarAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const calendarId = String(formData.get("calendarId") ?? "");
  await requireLocationAccess(locationId);

  const durationMinutes = Math.min(Math.max(Number(formData.get("durationMinutes")) || 30, 5), 600);
  const bookingWindowDays = Math.min(Math.max(Number(formData.get("bookingWindowDays")) || 14, 1), 60);

  let availability: Record<string, [string, string][]> = {};
  try {
    const raw = JSON.parse(String(formData.get("availability") ?? "{}"));
    if (raw && typeof raw === "object") availability = raw;
  } catch {
    /* keep empty */
  }

  const priceRaw = String(formData.get("price") ?? "").trim();
  const price = priceRaw === "" ? null : Math.max(0, Math.round(Number(priceRaw) || 0));

  await prisma.calendar.update({
    where: { id: calendarId, locationId },
    data: {
      name: String(formData.get("name") ?? "").trim() || "Calendar",
      description: String(formData.get("description") ?? "").trim() || null,
      price,
      active: formData.get("active") === "on",
      durationMinutes,
      bookingWindowDays,
      availability: availability as any,
    },
  });
  revalidatePath(`/dashboard/l/${locationId}/calendar`);
  return { error: "", ok: true };
}
