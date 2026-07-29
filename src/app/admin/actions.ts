"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { createBusiness } from "@/lib/provision";

export async function adminCreateBusinessAction(_prev: unknown, formData: FormData) {
  await requireSuperAdmin();
  const agencyId = String(formData.get("agencyId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Enter a business name." };

  const owner = await prisma.user.findFirst({ where: { agencyId }, orderBy: { createdAt: "asc" } });
  if (!owner) return { error: "That business has no owner user." };

  await createBusiness({ agencyId, ownerUserId: owner.id, name });
  revalidatePath(`/admin/businesses/${agencyId}`);
  return { error: "", ok: true };
}

export async function setAgencyStatusAction(formData: FormData) {
  await requireSuperAdmin();
  const agencyId = String(formData.get("agencyId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["ACTIVE", "SUSPENDED"].includes(status)) return;
  await prisma.agency.update({ where: { id: agencyId }, data: { status: status as "ACTIVE" | "SUSPENDED" } });
  revalidatePath("/admin/businesses");
  revalidatePath(`/admin/businesses/${agencyId}`);
}

export async function setAgencyPlanAction(formData: FormData) {
  await requireSuperAdmin();
  const agencyId = String(formData.get("agencyId") ?? "");
  const plan = String(formData.get("plan") ?? "free").trim() || "free";
  await prisma.agency.update({ where: { id: agencyId }, data: { plan } });
  revalidatePath(`/admin/businesses/${agencyId}`);
}
