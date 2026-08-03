"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { dzSearch, dzReady, type DzItem } from "@/lib/dropshipzone";

const MARKUP = 1.7; // retail = supplier cost × markup (matches the store's rule)

export async function sourcingSearchAction(locationId: string, keywords: string, page: number) {
  await requireLocationAccess(locationId);
  if (!dzReady()) return { error: "Sourcing supplier not connected on the platform yet.", items: [], totalPages: 0 };
  try {
    const r = await dzSearch({ keywords, page });
    return { items: r.items, totalPages: r.totalPages };
  } catch (e) {
    return { error: String(e instanceof Error ? e.message : e).slice(0, 160), items: [], totalPages: 0 };
  }
}

export type ImportResult = { ok?: true; imported?: number; skipped?: number; error?: string };

/** Import selected supplier products into this business's catalogue —
 *  stamped with supplier/warehouse/ship-country so market rules hold. */
export async function sourcingImportAction(locationId: string, items: DzItem[]): Promise<ImportResult> {
  await requireLocationAccess(locationId);
  const list = (items ?? []).slice(0, 60);
  if (!list.length) return { error: "Select at least one product." };

  let imported = 0, skipped = 0;
  for (const it of list) {
    const sku = String(it.sku).slice(0, 80);
    if (!sku) { skipped++; continue; }
    const exists = await prisma.product.findFirst({ where: { locationId, sku }, select: { id: true } });
    if (exists) { skipped++; continue; }
    const priceCents = Math.round((it.costCents * MARKUP) / 100) * 100 || 100; // round to the dollar
    await prisma.product.create({
      data: {
        locationId,
        name: String(it.title).slice(0, 250),
        sku,
        description: it.desc || null,
        imageUrl: it.image,
        images: it.gallery ?? [],
        priceCents,
        price: Math.round(priceCents / 100),
        costCents: it.costCents,
        inventory: it.stock,
        category: it.category?.split(">").pop()?.trim() || null,
        supplier: "Dropshipzone",
        warehouse: "AU",
        shipCountries: ["AU"],
        source: "sourcing",
        externalId: sku,
        active: true,
      },
    }).then(() => { imported++; }).catch(() => { skipped++; });
  }
  revalidatePath(`/dashboard/l/${locationId}/sourcing`);
  revalidatePath(`/dashboard/l/${locationId}/products`);
  return { ok: true, imported, skipped };
}
