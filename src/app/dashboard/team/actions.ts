"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

async function requireSuperAdmin() {
  const user = await requireUser();
  if (user.globalRole !== "SUPER_ADMIN") {
    throw new Error("Only the account owner can manage the team.");
  }
  return user;
}

const addUserSchema = z.object({
  name: z.string().min(2, "Enter a name."),
  email: z.string().email("Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  globalRole: z.enum(["SUPER_ADMIN", "AGENCY_USER"]).default("AGENCY_USER"),
});

export async function addUserAction(_prev: unknown, formData: FormData) {
  const admin = await requireSuperAdmin();

  const parsed = addUserSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").toLowerCase().trim(),
    password: String(formData.get("password") ?? ""),
    globalRole: String(formData.get("globalRole") ?? "AGENCY_USER"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid details." };

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { error: "A user with that email already exists." };

  await prisma.user.create({
    data: {
      agencyId: admin.agencyId,
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      globalRole: parsed.data.globalRole,
    },
  });
  revalidatePath("/dashboard/team");
  return { error: "", ok: true };
}

export async function grantAccessAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const userId = String(formData.get("userId") ?? "");
  const locationId = String(formData.get("locationId") ?? "");
  const role = (String(formData.get("role") ?? "ADMIN") as "ADMIN" | "MEMBER");
  if (!userId || !locationId) return;

  // Confirm both belong to this agency.
  const [u, l] = await Promise.all([
    prisma.user.findFirst({ where: { id: userId, agencyId: admin.agencyId } }),
    prisma.location.findFirst({ where: { id: locationId, agencyId: admin.agencyId } }),
  ]);
  if (!u || !l) return;

  await prisma.membership.upsert({
    where: { userId_locationId: { userId, locationId } },
    update: { role },
    create: { userId, locationId, role },
  });
  revalidatePath("/dashboard/team");
}

export async function revokeAccessAction(formData: FormData) {
  await requireSuperAdmin();
  const userId = String(formData.get("userId") ?? "");
  const locationId = String(formData.get("locationId") ?? "");
  await prisma.membership.deleteMany({ where: { userId, locationId } });
  revalidatePath("/dashboard/team");
}

export async function removeUserAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (userId === admin.id) return; // never delete yourself

  // Don't allow removing the last super admin.
  const target = await prisma.user.findFirst({ where: { id: userId, agencyId: admin.agencyId } });
  if (!target) return;
  if (target.globalRole === "SUPER_ADMIN") {
    const superAdmins = await prisma.user.count({ where: { agencyId: admin.agencyId, globalRole: "SUPER_ADMIN" } });
    if (superAdmins <= 1) return;
  }
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/dashboard/team");
}
