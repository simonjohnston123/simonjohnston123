"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { rulebook, validateFields, type MarketplaceKey } from "@/lib/listing-marketplaces";
import { optimiseListing } from "@/lib/ai";

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

export type OptimizeItemResult = { ok: boolean; message: string; fields?: Record<string, unknown>; priceSuggestion?: number | null };

/** Optimise ONE listing to its marketplace's saved AI rules + suggest a price. */
export async function optimiseItemAction(locationId: string, itemId: string): Promise<OptimizeItemResult> {
  await requireLocationAccess(locationId);
  const item = await prisma.listingItem.findFirst({ where: { id: itemId, batch: { locationId } }, include: { batch: true } });
  if (!item) return { ok: false, message: "Item not found." };
  const rb = rulebook(item.batch.marketplace);
  if (!rb) return { ok: false, message: "Unknown marketplace." };
  const product = await prisma.product.findFirst({
    where: { id: item.productId, locationId },
    select: { name: true, description: true, category: true, priceCents: true, price: true },
  });
  if (!product) return { ok: false, message: "Product not found." };

  const current = (item.fields ?? {}) as Record<string, unknown>;
  const result = await optimiseListing({
    marketplaceLabel: rb.label,
    aiRules: rb.aiRules,
    pricingHint: rb.pricingHint,
    fields: rb.fields.filter((f) => f.aiWritable).map((f) => ({ id: f.id, label: f.label, type: f.type, max: f.max })),
    current,
    product: {
      name: product.name,
      description: product.description,
      category: product.category,
      price: typeof product.priceCents === "number" ? product.priceCents / 100 : product.price ?? undefined,
    },
  });

  const merged = { ...current, ...result.fields };
  if (result.priceSuggestion != null) merged.price = result.priceSuggestion;
  const violations = validateFields(item.batch.marketplace, merged);
  await prisma.listingItem.update({
    where: { id: itemId },
    data: { fields: merged as object, validation: violations as object, aiStatus: "OPTIMISED", publishStatus: item.publishStatus === "PUBLISHED" ? item.publishStatus : null },
  });
  revalidatePath(`/dashboard/l/${locationId}/listings/${item.batchId}`);
  return { ok: true, message: result.note, fields: merged, priceSuggestion: result.priceSuggestion };
}

const MAX_OPTIMISE_RUN = 25;

/** Optimise every item in a batch (capped per run) to the marketplace rules. */
export async function optimiseBatchAction(locationId: string, batchId: string): Promise<ActionResult> {
  await requireLocationAccess(locationId);
  const batch = await prisma.listingBatch.findFirst({ where: { id: batchId, locationId }, include: { items: { take: MAX_OPTIMISE_RUN } } });
  if (!batch) return { ok: false, message: "Batch not found." };
  const rb = rulebook(batch.marketplace);
  if (!rb) return { ok: false, message: "Unknown marketplace." };
  const products = await prisma.product.findMany({
    where: { id: { in: batch.items.map((i) => i.productId) }, locationId },
    select: { id: true, name: true, description: true, category: true, priceCents: true, price: true },
  });
  const pmap = new Map(products.map((p) => [p.id, p]));
  const writable = rb.fields.filter((f) => f.aiWritable).map((f) => ({ id: f.id, label: f.label, type: f.type, max: f.max }));

  let done = 0;
  let ai = 0;
  for (const item of batch.items) {
    const p = pmap.get(item.productId);
    if (!p) continue;
    const current = (item.fields ?? {}) as Record<string, unknown>;
    const result = await optimiseListing({
      marketplaceLabel: rb.label,
      aiRules: rb.aiRules,
      pricingHint: rb.pricingHint,
      fields: writable,
      current,
      product: { name: p.name, description: p.description, category: p.category, price: typeof p.priceCents === "number" ? p.priceCents / 100 : p.price ?? undefined },
    });
    const merged = { ...current, ...result.fields };
    if (result.priceSuggestion != null) merged.price = result.priceSuggestion;
    await prisma.listingItem.update({
      where: { id: item.id },
      data: { fields: merged as object, validation: validateFields(batch.marketplace, merged) as object, aiStatus: "OPTIMISED", publishStatus: item.publishStatus === "PUBLISHED" ? item.publishStatus : null },
    });
    done++;
    if (result.ai) ai++;
  }
  await prisma.listingBatch.update({ where: { id: batchId }, data: { status: "OPTIMISED" } });
  revalidatePath(`/dashboard/l/${locationId}/listings/${batchId}`);
  const tail = ai === 0 && done > 0 ? " (basic tidy-up — enable AI credits for full optimisation)" : "";
  return { ok: done > 0, message: `Optimised ${done} listing${done === 1 ? "" : "s"}${tail}.` };
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
  return publishBatchCore(locationId, batchId);
}

/** Auth-free publish core (callable from an internal trigger). */
export async function publishBatchCore(locationId: string, batchId: string): Promise<ActionResult> {
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
