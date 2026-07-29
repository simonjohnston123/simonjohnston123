"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";

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
