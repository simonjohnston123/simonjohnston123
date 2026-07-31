"use server";

import { revalidatePath } from "next/cache";
import { requireLocationAccess } from "@/lib/auth";
import { importShopifyProducts } from "@/lib/shopify-products";

export type ImportBatch = { ok: boolean; message: string; imported: number; updated: number; lastId: number | null; done: boolean };

/** Import one batch of Shopify products; the client loops passing back `lastId`. */
export async function importShopifyProductsAction(locationId: string, sinceId = 0): Promise<ImportBatch> {
  await requireLocationAccess(locationId);
  const r = await importShopifyProducts(locationId, sinceId);
  if (r.done) revalidatePath(`/dashboard/l/${locationId}/products`);
  if (!r.ok) return { ok: false, message: r.reason || "Import failed.", imported: 0, updated: 0, lastId: null, done: true };
  return { ok: true, message: "", imported: r.imported, updated: r.updated, lastId: r.lastId, done: r.done };
}
