"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { rulebook, validateFields, type MarketplaceKey } from "@/lib/listing-marketplaces";

export type ActionResult = { ok: boolean; message: string };

const MAX_BATCH = 500;

/** Create a listing batch from a product selection, seeding each item from the
 *  chosen marketplace's rulebook, then open the batch editor. */
export async function createBatchAction(
  locationId: string,
  marketplace: string,
  name: string,
  productIds: string[],
): Promise<ActionResult | never> {
  await requireLocationAccess(locationId);
  const rb = rulebook(marketplace);
  if (!rb) return { ok: false, message: "Unknown marketplace." };
  const ids = Array.from(new Set(productIds.filter(Boolean))).slice(0, MAX_BATCH);
  if (!ids.length) return { ok: false, message: "Select at least one product first." };

  const products = await prisma.product.findMany({
    where: { locationId, id: { in: ids } },
    select: { id: true, name: true, description: true, priceCents: true, price: true, imageUrl: true, category: true },
  });
  if (!products.length) return { ok: false, message: "None of those products were found." };

  const batch = await prisma.listingBatch.create({
    data: { locationId, name: name.trim() || `${rb.label} batch`, marketplace: marketplace as MarketplaceKey },
  });
  await prisma.listingItem.createMany({
    data: products.map((p) => {
      const fields = rb.seed(p);
      return { batchId: batch.id, productId: p.id, fields: fields as object, validation: validateFields(marketplace, fields) as object };
    }),
  });

  revalidatePath(`/dashboard/l/${locationId}/listings`);
  redirect(`/dashboard/l/${locationId}/listings/${batch.id}`);
}

/** Save edited fields for one item, re-validating against the rulebook. */
export async function updateListingItemAction(
  locationId: string,
  itemId: string,
  fields: Record<string, unknown>,
): Promise<{ ok: boolean; violations: { field: string; message: string }[] }> {
  await requireLocationAccess(locationId);
  const item = await prisma.listingItem.findFirst({ where: { id: itemId, batch: { locationId } }, include: { batch: true } });
  if (!item) return { ok: false, violations: [] };
  const violations = validateFields(item.batch.marketplace, fields);
  await prisma.listingItem.update({
    where: { id: itemId },
    data: { fields: fields as object, validation: violations as object, publishStatus: item.publishStatus === "PUBLISHED" ? item.publishStatus : null },
  });
  revalidatePath(`/dashboard/l/${locationId}/listings/${item.batchId}`);
  return { ok: true, violations };
}

export async function removeListingItemAction(locationId: string, itemId: string): Promise<void> {
  await requireLocationAccess(locationId);
  const item = await prisma.listingItem.findFirst({ where: { id: itemId, batch: { locationId } } });
  if (!item) return;
  await prisma.listingItem.delete({ where: { id: itemId } });
  revalidatePath(`/dashboard/l/${locationId}/listings/${item.batchId}`);
}

export async function deleteBatchAction(locationId: string, batchId: string): Promise<void> {
  await requireLocationAccess(locationId);
  await prisma.listingBatch.deleteMany({ where: { id: batchId, locationId } });
  revalidatePath(`/dashboard/l/${locationId}/listings`);
  redirect(`/dashboard/l/${locationId}/listings`);
}

/** P1 stub: AI optimisation unlocks once credits are enabled (Phase 3). */
export async function optimiseItemAction(): Promise<ActionResult> {
  return { ok: false, message: "AI optimisation unlocks once AI credits are switched on (Phase 3)." };
}

/** Find or create the hidden business member that owns a location's Placid
 *  Connect listings. Password is un-loginnable by design (system account). */
async function businessMemberForLocation(locationId: string, locationName: string) {
  const email = `loc-${locationId}@business.placid`;
  const existing = await prisma.connectMember.findUnique({ where: { email } });
  if (existing) return existing;
  const baseHandle = slugify(locationName) || "business";
  let handle = baseHandle;
  for (let i = 2; await prisma.connectMember.findUnique({ where: { handle } }); i++) handle = `${baseHandle}-${i}`;
  return prisma.connectMember.create({
    data: { email, handle, name: locationName || "Business", passwordHash: `!nologin-${randomUUID()}` },
  });
}

/** Publish a batch to its marketplace. Placid Connect = native ConnectListing
 *  records under the location's business member. Other marketplaces: coming soon. */
export async function publishBatchAction(locationId: string, batchId: string): Promise<ActionResult> {
  await requireLocationAccess(locationId);
  const batch = await prisma.listingBatch.findFirst({ where: { id: batchId, locationId }, include: { items: true } });
  if (!batch) return { ok: false, message: "Batch not found." };
  const rb = rulebook(batch.marketplace);
  if (!rb?.available) return { ok: false, message: `Publishing to ${rb?.label ?? batch.marketplace} is coming soon.` };

  const location = await prisma.location.findUnique({ where: { id: locationId }, select: { name: true } });
  const member = await businessMemberForLocation(locationId, location?.name ?? "");

  let published = 0;
  let failed = 0;
  for (const item of batch.items) {
    if (item.publishStatus === "PUBLISHED") { published++; continue; }
    const f = (item.fields ?? {}) as Record<string, unknown>;
    const violations = validateFields(batch.marketplace, f);
    if (violations.length) {
      failed++;
      await prisma.listingItem.update({ where: { id: item.id }, data: { publishStatus: "FAILED", validation: violations as object } });
      continue;
    }
    try {
      const listing = await prisma.connectListing.create({
        data: {
          sellerId: member.id,
          title: String(f.title ?? "").slice(0, 140),
          description: String(f.description ?? ""),
          price: Math.max(0, Math.round(Number(f.price) || 0)),
          category: String(f.category ?? "General"),
          condition: f.condition ? String(f.condition) : null,
          imageUrl: f.imageUrl ? String(f.imageUrl) : null,
        },
      });
      published++;
      await prisma.listingItem.update({ where: { id: item.id }, data: { publishStatus: "PUBLISHED", externalId: listing.id, validation: [] as object } });
    } catch {
      failed++;
      await prisma.listingItem.update({ where: { id: item.id }, data: { publishStatus: "FAILED" } });
    }
  }

  const status = failed === 0 ? "PUBLISHED" : published > 0 ? "PARTIAL" : "DRAFT";
  await prisma.listingBatch.update({ where: { id: batchId }, data: { status } });
  revalidatePath(`/dashboard/l/${locationId}/listings/${batchId}`);
  revalidatePath(`/dashboard/l/${locationId}/listings`);
  return { ok: published > 0, message: `${published} published to Placid Connect${failed ? ` · ${failed} failed (fix the flagged fields)` : ""}` };
}
