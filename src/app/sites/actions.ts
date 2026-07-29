"use server";

import { prisma } from "@/lib/db";
import { fireTrigger } from "@/lib/automations";

type Result = { ok?: boolean; error: string };

/** Match or create a contact for this location by email/phone. */
async function upsertLeadContact(
  locationId: string,
  data: { name?: string; email?: string; phone?: string; company?: string; source: string; note?: string },
) {
  const [firstName, ...rest] = (data.name ?? "").trim().split(" ");
  const existing =
    (data.email ? await prisma.contact.findFirst({ where: { locationId, email: data.email } }) : null) ||
    (data.phone ? await prisma.contact.findFirst({ where: { locationId, phone: data.phone } }) : null);

  if (existing) {
    if (data.note) {
      await prisma.contact.update({
        where: { id: existing.id },
        data: { notes: `${existing.notes ? existing.notes + "\n" : ""}${data.note}` },
      });
    }
    return existing;
  }
  return prisma.contact.create({
    data: {
      locationId,
      firstName: firstName || null,
      lastName: rest.join(" ") || null,
      email: data.email || null,
      phone: data.phone || null,
      companyName: data.company || null,
      source: data.source,
      notes: data.note || null,
    },
  });
}

/** Public website form submission → contact + fires FORM_SUBMITTED automations. */
export async function submitLeadAction(_prev: unknown, formData: FormData): Promise<Result> {
  const slug = String(formData.get("slug") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!slug) return { error: "Something went wrong." };
  if (!email && !phone) return { error: "Please add an email or phone so we can reply." };

  const location = await prisma.location.findUnique({ where: { slug } });
  if (!location) return { error: "Something went wrong." };

  const contact = await upsertLeadContact(location.id, {
    name,
    email,
    phone,
    company,
    source: "Website",
    note: message ? `Website enquiry: ${message}` : "Website enquiry",
  });

  await fireTrigger(location.id, "FORM_SUBMITTED", { contactId: contact.id, triggerLabel: "Website form" });
  return { ok: true, error: "" };
}

/** Public website booking request → contact + appointment + fires automations. */
export async function bookingRequestAction(_prev: unknown, formData: FormData): Promise<Result> {
  const slug = String(formData.get("slug") ?? "");
  const calendarId = String(formData.get("calendarId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const when = String(formData.get("when") ?? "").trim();

  if (!slug || !calendarId) return { error: "Booking isn't set up correctly." };
  if (!email && !phone) return { error: "Please add an email or phone so we can confirm." };
  if (!when) return { error: "Please pick a preferred time." };

  const location = await prisma.location.findUnique({ where: { slug } });
  if (!location) return { error: "Something went wrong." };
  const calendar = await prisma.calendar.findFirst({ where: { id: calendarId, locationId: location.id } });
  if (!calendar) return { error: "That calendar is unavailable." };

  const startAt = new Date(when);
  if (Number.isNaN(startAt.getTime())) return { error: "That time doesn't look right." };
  const endAt = new Date(startAt.getTime() + calendar.durationMinutes * 60 * 1000);

  const contact = await upsertLeadContact(location.id, {
    name,
    email,
    phone,
    source: "Booking",
    note: "Requested a booking via the website",
  });

  await prisma.appointment.create({
    data: {
      locationId: location.id,
      calendarId: calendar.id,
      contactId: contact.id,
      title: `Booking request — ${name || email || phone}`,
      startAt,
      endAt,
      status: "CONFIRMED",
      notes: "Requested via website booking block",
    },
  });

  await fireTrigger(location.id, "FORM_SUBMITTED", { contactId: contact.id, triggerLabel: "Website booking" });
  return { ok: true, error: "" };
}
