"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { publishPost, type SocialNetworkKey } from "@/lib/social";

const VALID_NETWORKS: SocialNetworkKey[] = ["facebook", "instagram", "youtube", "tiktok", "snapchat", "google_business"];

export type SaveResult = { ok?: true; error?: string; postId?: string };

export async function saveSocialPostAction(input: {
  locationId: string;
  body: string;
  mediaUrls: string[];
  mediaKind: "image" | "video" | null;
  networks: string[];
  mode: "now" | "schedule" | "draft";
  scheduledAt?: string; // ISO from datetime-local
  facebookPageIds?: string[]; // which Page(s) to post to when facebook is selected
}): Promise<SaveResult> {
  await requireLocationAccess(input.locationId);

  const body = String(input.body ?? "").trim().slice(0, 5000);
  const mediaUrls = (input.mediaUrls ?? []).filter((u) => /^https?:\/\//.test(u)).slice(0, 10);
  const networks = (input.networks ?? []).filter((n): n is SocialNetworkKey => (VALID_NETWORKS as string[]).includes(n));

  if (!body && mediaUrls.length === 0) return { error: "Write something or add media." };
  if (input.mode !== "draft" && networks.length === 0) return { error: "Pick at least one network." };

  let scheduledAt: Date | null = null;
  if (input.mode === "schedule") {
    scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    if (!scheduledAt || isNaN(+scheduledAt)) return { error: "Pick a valid schedule time." };
    if (+scheduledAt < Date.now() - 60_000) return { error: "That time is in the past." };
  }

  const post = await prisma.socialPost.create({
    data: {
      locationId: input.locationId,
      body,
      mediaUrls,
      mediaKind: mediaUrls.length ? input.mediaKind : null,
      networks,
      options: { facebookPageIds: (input.facebookPageIds ?? []).slice(0, 20) },
      scheduledAt,
      status: input.mode === "schedule" ? "SCHEDULED" : "DRAFT",
    },
  });

  if (input.mode === "now") await publishPost(post.id);
  revalidatePath(`/dashboard/l/${input.locationId}/social`);
  return { ok: true, postId: post.id };
}

export async function retrySocialPostAction(locationId: string, postId: string): Promise<SaveResult> {
  await requireLocationAccess(locationId);
  const post = await prisma.socialPost.findFirst({ where: { id: postId, locationId } });
  if (!post) return { error: "Post not found." };
  if (post.status === "PUBLISHING") await prisma.socialPost.update({ where: { id: postId }, data: { status: "FAILED" } }); // clear a stuck guard
  await publishPost(postId);
  revalidatePath(`/dashboard/l/${locationId}/social`);
  return { ok: true };
}

export async function deleteSocialPostAction(locationId: string, postId: string): Promise<SaveResult> {
  await requireLocationAccess(locationId);
  await prisma.socialPost.deleteMany({ where: { id: postId, locationId } });
  revalidatePath(`/dashboard/l/${locationId}/social`);
  return { ok: true };
}
