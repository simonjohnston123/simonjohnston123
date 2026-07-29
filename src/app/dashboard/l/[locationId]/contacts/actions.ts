"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { fireTrigger } from "@/lib/automations";

const contactSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
});

function read(formData: FormData) {
  return {
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    companyName: String(formData.get("companyName") ?? "").trim(),
    source: String(formData.get("source") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

export async function createContactAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);

  const data = read(formData);
  const parsed = contactSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid contact." };
  if (!data.firstName && !data.lastName && !data.email && !data.phone) {
    return { error: "Enter at least a name, email or phone." };
  }

  const contact = await prisma.contact.create({
    data: {
      locationId,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      email: data.email || null,
      phone: data.phone || null,
      companyName: data.companyName || null,
      source: data.source || "Manual",
      notes: data.notes || null,
    },
  });
  // Fire any ACTIVE "Contact created" automations for this business.
  await fireTrigger(locationId, "CONTACT_CREATED", { contactId: contact.id });
  revalidatePath(`/dashboard/l/${locationId}/contacts`);
  redirect(`/dashboard/l/${locationId}/contacts/${contact.id}`);
}

export async function updateContactAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const contactId = String(formData.get("contactId") ?? "");
  await requireLocationAccess(locationId);

  const data = read(formData);
  const parsed = contactSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid contact." };

  await prisma.contact.update({
    where: { id: contactId, locationId },
    data: {
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      email: data.email || null,
      phone: data.phone || null,
      companyName: data.companyName || null,
      source: data.source || null,
      notes: data.notes || null,
    },
  });
  revalidatePath(`/dashboard/l/${locationId}/contacts/${contactId}`);
  return { error: "", ok: true };
}

export async function deleteContactAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const contactId = String(formData.get("contactId") ?? "");
  await requireLocationAccess(locationId);
  await prisma.contact.delete({ where: { id: contactId, locationId } });
  revalidatePath(`/dashboard/l/${locationId}/contacts`);
  redirect(`/dashboard/l/${locationId}/contacts`);
}

export async function addTagAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const contactId = String(formData.get("contactId") ?? "");
  const name = String(formData.get("tag") ?? "").trim();
  await requireLocationAccess(locationId);
  if (!name) return;

  const tag = await prisma.tag.upsert({
    where: { locationId_name: { locationId, name } },
    update: {},
    create: { locationId, name },
  });
  await prisma.contactTag.upsert({
    where: { contactId_tagId: { contactId, tagId: tag.id } },
    update: {},
    create: { contactId, tagId: tag.id },
  });
  revalidatePath(`/dashboard/l/${locationId}/contacts/${contactId}`);
}

export async function removeTagAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const contactId = String(formData.get("contactId") ?? "");
  const tagId = String(formData.get("tagId") ?? "");
  await requireLocationAccess(locationId);
  await prisma.contactTag.delete({ where: { contactId_tagId: { contactId, tagId } } });
  revalidatePath(`/dashboard/l/${locationId}/contacts/${contactId}`);
}

// ---- CSV import -----------------------------------------------------------

/** Minimal RFC-4180-ish CSV parser (handles quotes + embedded commas/newlines). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
      } else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function findCol(headers: string[], names: string[]): number {
  return headers.findIndex((h) => names.includes(h.trim().toLowerCase()));
}

export async function importContactsAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);

  const file = formData.get("file");
  if (!file || typeof file === "string") return { error: "Choose a CSV file." };

  const text = await (file as File).text();
  const rows = parseCsv(text);
  if (rows.length < 2) return { error: "That file has no rows to import." };

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const col = {
    first: findCol(headers, ["first name", "firstname", "first", "given name"]),
    last: findCol(headers, ["last name", "lastname", "last", "surname"]),
    name: findCol(headers, ["name", "full name", "contact", "contact name"]),
    email: findCol(headers, ["email", "e-mail", "email address"]),
    phone: findCol(headers, ["phone", "mobile", "phone number", "cell", "telephone", "contact number"]),
    company: findCol(headers, ["company", "business", "organisation", "organization", "company name"]),
  };
  if (col.email === -1 && col.phone === -1 && col.name === -1 && col.first === -1) {
    return { error: "Couldn't find name, email or phone columns. Add a header row with those." };
  }

  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
  let imported = 0;
  let skipped = 0;

  for (const r of rows.slice(1, 5001)) {
    let first = get(r, col.first);
    let last = get(r, col.last);
    const full = get(r, col.name);
    if (!first && full) {
      const parts = full.split(" ");
      first = parts[0];
      last = parts.slice(1).join(" ");
    }
    const email = get(r, col.email);
    const phone = get(r, col.phone);
    const company = get(r, col.company);

    if (!first && !last && !email && !phone) { skipped++; continue; }

    const existing = email
      ? await prisma.contact.findFirst({ where: { locationId, email } })
      : phone
      ? await prisma.contact.findFirst({ where: { locationId, phone } })
      : null;

    if (existing) {
      await prisma.contact.update({
        where: { id: existing.id },
        data: {
          firstName: existing.firstName || first || null,
          lastName: existing.lastName || last || null,
          phone: existing.phone || phone || null,
          companyName: existing.companyName || company || null,
        },
      });
    } else {
      await prisma.contact.create({
        data: {
          locationId,
          firstName: first || null,
          lastName: last || null,
          email: email || null,
          phone: phone || null,
          companyName: company || null,
          source: "CSV import",
        },
      });
    }
    imported++;
  }

  revalidatePath(`/dashboard/l/${locationId}/contacts`);
  return { error: "", ok: true, imported, skipped };
}
