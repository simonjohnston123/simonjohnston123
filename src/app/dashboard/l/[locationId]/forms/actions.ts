"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { generateFormFields, type FormFieldSpec } from "@/lib/ai";

const CONTACT_DEFAULT: FormFieldSpec[] = [
  { key: "name", label: "Your name", type: "text", required: true },
  { key: "email", label: "Email", type: "email", required: true },
  { key: "phone", label: "Phone", type: "phone", required: false },
  { key: "message", label: "Message", type: "textarea", required: false },
];

/** Create a form/survey. If a description is given, AI drafts the fields. */
export async function createFormAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);

  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "FORM") === "SURVEY" ? "SURVEY" : "FORM";
  const description = String(formData.get("description") ?? "").trim();
  if (!name) return { error: `Give your ${type === "SURVEY" ? "survey" : "form"} a name.` };

  const fields = description ? await generateFormFields(description, type) : CONTACT_DEFAULT;

  const form = await prisma.form.create({
    data: {
      locationId,
      name,
      type,
      description: description || null,
      fields: fields as object,
      thankYou: type === "SURVEY" ? "Thanks for your feedback!" : "Thanks — we'll be in touch shortly.",
    },
  });

  redirect(`/dashboard/l/${locationId}/forms/${form.id}`);
}

/** Rewrite the field list from the description using AI. */
export async function regenerateFieldsAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const formId = String(formData.get("formId") ?? "");
  await requireLocationAccess(locationId);

  const form = await prisma.form.findFirst({ where: { id: formId, locationId } });
  if (!form) return;
  const desc = String(formData.get("description") ?? form.description ?? "").trim();
  if (!desc) return;

  const fields = await generateFormFields(desc, form.type);
  await prisma.form.update({
    where: { id: formId },
    data: { description: desc, fields: fields as object },
  });
  revalidatePath(`/dashboard/l/${locationId}/forms/${formId}`);
}

/** Save edited fields + settings. `fields` arrives as a JSON string. */
export async function updateFormAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const formId = String(formData.get("formId") ?? "");
  await requireLocationAccess(locationId);

  let fields: unknown = [];
  try {
    fields = JSON.parse(String(formData.get("fields") ?? "[]"));
  } catch {
    return { error: "Couldn't read the fields." };
  }
  if (!Array.isArray(fields) || fields.length === 0) return { error: "Add at least one field." };

  await prisma.form.update({
    where: { id: formId, locationId },
    data: {
      name: String(formData.get("name") ?? "").trim() || "Untitled form",
      fields: fields as object,
      submitLabel: String(formData.get("submitLabel") ?? "").trim() || "Submit",
      thankYou: String(formData.get("thankYou") ?? "").trim() || "Thanks — we'll be in touch shortly.",
    },
  });
  revalidatePath(`/dashboard/l/${locationId}/forms/${formId}`);
  return { error: "", ok: true };
}

export async function deleteFormAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const formId = String(formData.get("formId") ?? "");
  await requireLocationAccess(locationId);
  await prisma.form.delete({ where: { id: formId, locationId } });
  redirect(`/dashboard/l/${locationId}/forms`);
}
