"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";

/** Retro-apply a rule: label existing conversations that match it. */
async function applyRule(locationId: string, name: string, matchField: string, matchValue: string) {
  const value = matchValue.trim();
  if (!value) return;
  const where =
    matchField === "SUBJECT"
      ? { locationId, subject: { contains: value, mode: "insensitive" as const } }
      : { locationId, contact: { email: { contains: value, mode: "insensitive" as const } } };
  await prisma.conversation.updateMany({ where, data: { sourceLabel: name } });
}

export async function createInboxFolderAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const matchField = String(formData.get("matchField") ?? "SENDER") === "SUBJECT" ? "SUBJECT" : "SENDER";
  const matchValue = String(formData.get("matchValue") ?? "").trim();
  await requireLocationAccess(locationId);
  if (!name || !matchValue) return;

  const count = await prisma.inboxFolder.count({ where: { locationId } });
  await prisma.inboxFolder.create({
    data: { locationId, name, matchField, matchValue, position: count },
  });
  await applyRule(locationId, name, matchField, matchValue);

  revalidatePath(`/dashboard/l/${locationId}/conversations`);
  redirect(`/dashboard/l/${locationId}/conversations/folders`);
}

export async function deleteInboxFolderAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const folderId = String(formData.get("folderId") ?? "");
  await requireLocationAccess(locationId);
  await prisma.inboxFolder.deleteMany({ where: { id: folderId, locationId } });
  revalidatePath(`/dashboard/l/${locationId}/conversations`);
  redirect(`/dashboard/l/${locationId}/conversations/folders`);
}

/** Seed common e-commerce folders (editable/removable afterward). */
export async function seedSuggestedFoldersAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);

  const suggested = [
    { name: "eBay", matchValue: "ebay" },
    { name: "Temu", matchValue: "temu" },
    { name: "Etsy", matchValue: "etsy" },
    { name: "Dropshipzone", matchValue: "dropshipzone" },
    { name: "Stripe", matchValue: "stripe.com" },
    { name: "Amazon", matchValue: "amazon" },
  ];
  const existing = await prisma.inboxFolder.findMany({ where: { locationId }, select: { name: true } });
  const have = new Set(existing.map((f) => f.name.toLowerCase()));
  let pos = existing.length;
  for (const s of suggested) {
    if (have.has(s.name.toLowerCase())) continue;
    await prisma.inboxFolder.create({
      data: { locationId, name: s.name, matchField: "SENDER", matchValue: s.matchValue, position: pos++ },
    });
    await applyRule(locationId, s.name, "SENDER", s.matchValue);
  }

  revalidatePath(`/dashboard/l/${locationId}/conversations`);
  redirect(`/dashboard/l/${locationId}/conversations/folders`);
}
