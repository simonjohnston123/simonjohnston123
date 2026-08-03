"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { publishPost, type SocialNetworkKey } from "@/lib/social";
import { generateReelScript, type ReelScript } from "@/lib/reels";

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

/* ---------------- 🎬 Reel Studio ---------------- */

export async function searchReelProductsAction(locationId: string, q: string) {
  await requireLocationAccess(locationId);
  const query = q.trim();
  // Empty query = auto-feed the newest products so the picker is never blank.
  const rows = await prisma.product.findMany({
    where: {
      locationId, active: true, imageUrl: { not: null },
      ...(query.length >= 2 ? { name: { contains: query, mode: "insensitive" as const } } : {}),
    },
    orderBy: query.length >= 2 ? { inventory: "desc" } : { updatedAt: "desc" },
    take: 18,
    select: { id: true, name: true, imageUrl: true, priceCents: true },
  });
  return rows.map((p) => ({ id: p.id, name: p.name, imageUrl: p.imageUrl!, priceCents: p.priceCents ?? 0 }));
}

export async function generateReelScriptAction(locationId: string, productId: string) {
  await requireLocationAccess(locationId);
  return generateReelScript(locationId, productId);
}

export type CreateReelResult = { ok?: true; jobId?: string; error?: string };

export async function createRenderJobAction(input: {
  locationId: string; productId: string; productName: string; presenter: string; script: ReelScript;
}): Promise<CreateReelResult> {
  await requireLocationAccess(input.locationId);
  const presenter = input.presenter === "dick" ? "dick" : "dave";
  const chunks = (input.script?.chunks ?? []).map((c) => String(c).trim()).filter(Boolean).slice(0, 3);
  if (!chunks.length) return { error: "The script needs at least one spoken part." };

  const priceCents = parseInt(process.env.REEL_RATE_CENTS ?? "", 10) || 1500; // $15 retail per reel
  const job = await prisma.renderJob.create({
    data: {
      locationId: input.locationId,
      productId: input.productId,
      productName: input.productName.slice(0, 180),
      presenter,
      script: { ...input.script, chunks },
      status: "QUEUED",
      note: "Queued — renders on the Placid video factory (~15 min once picked up).",
      priceCents,
    },
  });
  // Bill it — every render pays, including our own businesses (dog-fooding).
  await prisma.usageEvent.create({
    data: { locationId: input.locationId, kind: "reel", qty: 1, unitCents: priceCents, totalCents: priceCents, ref: job.id },
  }).catch(() => {});
  revalidatePath(`/dashboard/l/${input.locationId}/social`);
  return { ok: true, jobId: job.id };
}
