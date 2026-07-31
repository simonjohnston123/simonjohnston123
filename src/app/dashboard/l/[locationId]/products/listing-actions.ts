"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { CHANNEL_BY_KEY, channelAllowsShipCountries } from "@/lib/channels";
import { getValidToken, resolveListingContext, pushProductToEbay } from "@/lib/ebay-listing";

export type ProductFilter = {
  q?: string;
  category?: string;
  source?: string;
  warehouse?: string;
  supplier?: string;
};

// Rebuild the same WHERE the Products page uses, so "all matching" targets exactly
// what the user is looking at.
function buildWhere(locationId: string, f: ProductFilter): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { locationId };
  if (f.q) where.OR = [{ name: { contains: f.q, mode: "insensitive" } }, { sku: { contains: f.q, mode: "insensitive" } }];
  if (f.category) where.category = f.category === "__none__" ? null : f.category;
  if (f.source) where.source = f.source === "manual" ? null : f.source;
  if (f.warehouse) where.warehouse = f.warehouse === "__none__" ? null : f.warehouse;
  if (f.supplier) where.supplier = f.supplier === "__none__" ? null : f.supplier;
  return where;
}

export type MarketResult = { ok: boolean; message: string; marketed: number; skipped: number };

/** Add a channel to products (by explicit ids, or everything matching a filter),
 *  honouring the geo-gate: a product is only marketed where its ship country is
 *  served by the channel. Bulk-appends to the channels array in one query. */
export async function marketToChannelAction(
  locationId: string,
  channelKey: string,
  target: { ids?: string[]; allMatching?: ProductFilter },
): Promise<MarketResult> {
  await requireLocationAccess(locationId);
  const channel = CHANNEL_BY_KEY[channelKey];
  if (!channel) return { ok: false, message: "Unknown channel.", marketed: 0, skipped: 0 };

  const where: Prisma.ProductWhereInput = target.ids?.length
    ? { locationId, id: { in: target.ids } }
    : buildWhere(locationId, target.allMatching ?? {});

  // Pull the minimal fields needed to apply the geo-gate.
  const products = await prisma.product.findMany({
    where,
    select: { id: true, shipCountries: true, channels: true },
    take: 20000,
  });

  const eligibleIds: string[] = [];
  let skipped = 0;
  for (const p of products) {
    const ship = Array.isArray(p.shipCountries) ? (p.shipCountries as string[]) : [];
    const current = Array.isArray(p.channels) ? (p.channels as string[]) : [];
    if (current.includes(channelKey)) continue; // already listed
    if (!channelAllowsShipCountries(channel, ship)) {
      skipped++;
      continue;
    }
    eligibleIds.push(p.id);
  }

  // One bulk append of the channel to the jsonb array for every eligible product.
  for (let i = 0; i < eligibleIds.length; i += 5000) {
    const chunk = eligibleIds.slice(i, i + 5000);
    await prisma.$executeRaw`
      UPDATE "Product"
      SET channels = channels || ${JSON.stringify(channelKey)}::jsonb
      WHERE id = ANY(${chunk})`;
  }

  revalidatePath(`/dashboard/l/${locationId}/products`);
  const bits = [`${eligibleIds.length} marked for ${channel.label}`];
  if (skipped) bits.push(`${skipped} skipped (doesn't ship to a ${channel.label} country)`);
  return { ok: true, message: bits.join(" · "), marketed: eligibleIds.length, skipped };
}

const EBAY_PUSH_CAP = 25; // keep first runs small — eBay rate-limits + we validate as we go

/** Actually create live eBay listings for the selected products (inventory→offer→publish).
 *  Untested against live eBay yet — only geo-eligible products are attempted. */
export async function publishToEbayAction(locationId: string, ids: string[]): Promise<MarketResult> {
  await requireLocationAccess(locationId);
  if (!ids.length) return { ok: false, message: "Select products first.", marketed: 0, skipped: 0 };

  const token = await getValidToken(locationId);
  if (!token) return { ok: false, message: "eBay isn't connected.", marketed: 0, skipped: 0 };
  const resolved = await resolveListingContext(token);
  if (!resolved.ok || !resolved.ctx) return { ok: false, message: resolved.reason || "eBay setup incomplete.", marketed: 0, skipped: 0 };

  const ebay = CHANNEL_BY_KEY.ebay;
  const products = await prisma.product.findMany({
    where: { locationId, id: { in: ids.slice(0, EBAY_PUSH_CAP) } },
    select: { id: true, externalId: true, name: true, description: true, imageUrl: true, priceCents: true, inventory: true, sku: true, category: true, shipCountries: true },
  });

  let published = 0;
  let failed = 0;
  let firstError = "";
  for (const p of products) {
    const ship = Array.isArray(p.shipCountries) ? (p.shipCountries as string[]) : [];
    if (!channelAllowsShipCountries(ebay, ship)) { failed++; continue; }
    const r = await pushProductToEbay(locationId, p, resolved.ctx, token);
    if (r.ok) {
      published++;
      await prisma.$executeRaw`UPDATE "Product" SET channels = (CASE WHEN channels @> '"ebay"'::jsonb THEN channels ELSE channels || '"ebay"'::jsonb END) WHERE id = ${p.id}`;
    } else {
      failed++;
      if (!firstError) firstError = r.reason || "unknown error";
    }
  }

  revalidatePath(`/dashboard/l/${locationId}/products`);
  const msg = `${published} published to eBay${failed ? ` · ${failed} failed${firstError ? ` (${firstError})` : ""}` : ""}${ids.length > EBAY_PUSH_CAP ? ` — capped at ${EBAY_PUSH_CAP}/run` : ""}`;
  return { ok: published > 0 || failed === 0, message: msg, marketed: published, skipped: failed };
}

/** Remove a channel from selected products. */
export async function unmarketChannelAction(locationId: string, channelKey: string, ids: string[]): Promise<MarketResult> {
  await requireLocationAccess(locationId);
  if (!ids.length) return { ok: true, message: "Nothing selected.", marketed: 0, skipped: 0 };
  for (let i = 0; i < ids.length; i += 5000) {
    const chunk = ids.slice(i, i + 5000);
    await prisma.$executeRaw`
      UPDATE "Product"
      SET channels = (SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(channels) e WHERE e <> ${JSON.stringify(channelKey)}::jsonb)
      WHERE id = ANY(${chunk})`;
  }
  revalidatePath(`/dashboard/l/${locationId}/products`);
  return { ok: true, message: `Removed from ${ids.length} product(s).`, marketed: 0, skipped: 0 };
}
