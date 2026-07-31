"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { CHANNEL_BY_KEY, channelAllowsShipCountries } from "@/lib/channels";

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
