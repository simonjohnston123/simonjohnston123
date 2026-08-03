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

export async function syncReviewsAction(locationId: string): Promise<{ imported?: number; error?: string }> {
  await requireLocationAccess(locationId);
  const { syncReviews } = await import("@/lib/google-business");
  const r = await syncReviews(locationId);
  revalidatePath(`/dashboard/l/${locationId}/google`);
  revalidatePath(`/dashboard/l/${locationId}/conversations`);
  return r;
}

export async function syncCalendarAction(locationId: string): Promise<{ ok?: boolean; error?: string }> {
  await requireLocationAccess(locationId);
  const { syncBusy } = await import("@/lib/google-calendar");
  const ok = await syncBusy(locationId, { force: true });
  revalidatePath(`/dashboard/l/${locationId}/calendar`);
  return ok ? { ok: true } : { error: "Couldn't reach Google Calendar — check the connection." };
}
