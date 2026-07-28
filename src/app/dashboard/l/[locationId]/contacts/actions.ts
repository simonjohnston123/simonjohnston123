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
