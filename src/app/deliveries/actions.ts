"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { setDriverSession, clearDriverSession, requireDriver } from "@/lib/driver-auth";

export async function signupDriverAction(_prev: unknown, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const vehicle = String(formData.get("vehicle") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!name || !email || password.length < 8) {
    return { error: "Enter your name, email and a password (8+ characters)." };
  }
  const existing = await prisma.driver.findUnique({ where: { email } });
  if (existing) return { error: "An account with that email already exists — try logging in." };

  const driver = await prisma.driver.create({
    data: { name, email, phone: phone || null, vehicle: vehicle || null, passwordHash: await hashPassword(password), status: "APPROVED" },
  });
  await setDriverSession(driver.id);
  redirect("/deliveries/jobs");
}

export async function loginDriverAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const driver = await prisma.driver.findUnique({ where: { email } });
  if (!driver || !(await verifyPassword(password, driver.passwordHash))) {
    return { error: "Wrong email or password." };
  }
  await setDriverSession(driver.id);
  redirect("/deliveries/jobs");
}

export async function logoutDriverAction() {
  clearDriverSession();
  redirect("/deliveries");
}

export async function acceptJobAction(formData: FormData) {
  const driver = await requireDriver();
  const jobId = String(formData.get("jobId") ?? "");
  // Only claim if still available (guards against two drivers accepting at once).
  const res = await prisma.deliveryJob.updateMany({
    where: { id: jobId, status: "POSTED", driverId: null },
    data: { driverId: driver.id, status: "ACCEPTED", acceptedAt: new Date() },
  });
  revalidatePath("/deliveries/jobs");
  revalidatePath("/deliveries/my");
  if (res.count === 0) return; // someone else got it
  redirect("/deliveries/my");
}

export async function updateJobStatusAction(formData: FormData) {
  const driver = await requireDriver();
  const jobId = String(formData.get("jobId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["PICKED_UP", "DELIVERED", "CANCELLED"].includes(status)) return;

  const job = await prisma.deliveryJob.findFirst({ where: { id: jobId, driverId: driver.id } });
  if (!job) return;

  await prisma.deliveryJob.update({
    where: { id: jobId },
    data: {
      status: status as "PICKED_UP" | "DELIVERED" | "CANCELLED",
      deliveredAt: status === "DELIVERED" ? new Date() : job.deliveredAt,
      // Releasing a job (cancel) puts it back on the board.
      ...(status === "CANCELLED" ? { status: "POSTED", driverId: null, acceptedAt: null } : {}),
    },
  });
  revalidatePath("/deliveries/my");
  revalidatePath("/deliveries/jobs");
}
