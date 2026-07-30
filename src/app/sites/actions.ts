"use server";

import { prisma } from "@/lib/db";
import { fireTrigger } from "@/lib/automations";
import { pushAppointment, externalBusyForCalendar } from "@/lib/google-calendar";

type Result = { ok?: boolean; error: string };

/** Drop a website enquiry/booking into the sub-account's Conversations inbox. */
async function logToInbox(locationId: string, contactId: string, body: string) {
  let convo = await prisma.conversation.findFirst({
    where: { locationId, contactId, channel: "WEBCHAT" },
    orderBy: { lastMessageAt: "desc" },
  });
  if (!convo) {
    convo = await prisma.conversation.create({
      data: { locationId, contactId, channel: "WEBCHAT", subject: "Website enquiry" },
    });
  }
  await prisma.message.create({
    data: { conversationId: convo.id, direction: "INBOUND", channel: "WEBCHAT", body },
  });
  await prisma.conversation.update({
    where: { id: convo.id },
    data: { lastMessageAt: new Date(), unread: true },
  });
}

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

  const summary = [
    `📝 Website enquiry`,
    name ? `From: ${name}` : null,
    email ? `Email: ${email}` : null,
    phone ? `Phone: ${phone}` : null,
    company ? `Company: ${company}` : null,
    message ? `\n${message}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  await logToInbox(location.id, contact.id, summary);

  await fireTrigger(location.id, "FORM_SUBMITTED", { contactId: contact.id, triggerLabel: "Website form" });
  return { ok: true, error: "" };
}

/** Standalone form/survey submission (shared /f/[id] link) → contact + inbox. */
export async function submitFormAction(_prev: unknown, formData: FormData): Promise<Result> {
  const formId = String(formData.get("formId") ?? "");
  if (!formId) return { error: "Something went wrong." };

  const form = await prisma.form.findUnique({ where: { id: formId } });
  if (!form) return { error: "This form is no longer available." };

  const fields = (Array.isArray(form.fields) ? form.fields : []) as Array<Record<string, unknown>>;
  const data: Record<string, string> = {};
  for (const f of fields) {
    const key = String(f.key ?? "");
    if (!key) continue;
    const val = String(formData.get(key) ?? "").trim();
    if (f.required && !val) return { error: `Please complete: ${String(f.label ?? key)}` };
    if (val) data[key] = val;
  }

  const pick = (...keys: string[]) => {
    for (const k of keys) if (data[k]) return data[k];
    return "";
  };
  const name = pick("name", "your_name", "full_name", "first_name");
  const email = pick("email", "email_address");
  const phone = pick("phone", "phone_number", "mobile", "contact_number");

  const isSurvey = form.type === "SURVEY";
  const contact = await upsertLeadContact(form.locationId, {
    name,
    email,
    phone,
    source: isSurvey ? "Survey" : "Form",
    note: `${isSurvey ? "Survey" : "Form"}: ${form.name}`,
  });

  await prisma.formSubmission.create({
    data: { formId: form.id, locationId: form.locationId, contactId: contact.id, data },
  });

  const summary = [
    `${isSurvey ? "📋 Survey" : "📝 Form"}: ${form.name}`,
    ...fields.map((f) => {
      const v = data[String(f.key ?? "")];
      return v ? `${String(f.label ?? f.key)}: ${v}` : null;
    }),
  ]
    .filter(Boolean)
    .join("\n");
  await logToInbox(form.locationId, contact.id, summary);

  await fireTrigger(form.locationId, "FORM_SUBMITTED", { contactId: contact.id, triggerLabel: form.name });
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

  // Prevent double-booking: reject if it clashes with an existing appointment
  // OR with a busy block synced in from the operator's Google Calendar.
  const clash = await prisma.appointment.findFirst({
    where: {
      calendarId: calendar.id,
      status: "CONFIRMED",
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
  });
  if (clash) return { error: "Sorry, that time was just taken — please pick another." };

  const externalClash = (await externalBusyForCalendar(location.id, startAt, endAt)).some(
    (b) => b.startAt < endAt && b.endAt > startAt,
  );
  if (externalClash) return { error: "Sorry, that time was just taken — please pick another." };

  const contact = await upsertLeadContact(location.id, {
    name,
    email,
    phone,
    source: "Booking",
    note: "Requested a booking via the website",
  });

  const appt = await prisma.appointment.create({
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
  // Push to the operator's Google Calendar so it lands on their phone (fail-soft).
  await pushAppointment(location.id, appt);

  await logToInbox(
    location.id,
    contact.id,
    `📅 Booking request\n${name || email || phone}\nPreferred time: ${startAt.toLocaleString("en-AU")}`,
  );

  await fireTrigger(location.id, "FORM_SUBMITTED", { contactId: contact.id, triggerLabel: "Website booking" });
  return { ok: true, error: "" };
}
