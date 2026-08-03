"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { syncGmailForLocation } from "@/lib/gmail";

export async function disconnectGoogleAction(locationId: string): Promise<{ ok: true }> {
  await requireLocationAccess(locationId);
  await prisma.connection.deleteMany({ where: { locationId, provider: "GOOGLE" } });
  revalidatePath(`/dashboard/l/${locationId}/google`);
  return { ok: true };
}

export async function syncGmailAction(locationId: string): Promise<{ imported?: number; error?: string }> {
  await requireLocationAccess(locationId);
  const r = await syncGmailForLocation(locationId);
  revalidatePath(`/dashboard/l/${locationId}/google`);
  revalidatePath(`/dashboard/l/${locationId}/conversations`);
  return r;
}
