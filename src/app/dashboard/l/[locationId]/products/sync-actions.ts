"use server";

import { revalidatePath } from "next/cache";
import { requireLocationAccess } from "@/lib/auth";
import { importShopifyProducts } from "@/lib/shopify-products";

export async function importShopifyProductsAction(locationId: string): Promise<{ ok: boolean; message: string }> {
  await requireLocationAccess(locationId);
  const r = await importShopifyProducts(locationId);
  revalidatePath(`/dashboard/l/${locationId}/products`);
  if (!r.ok) return { ok: false, message: r.reason || "Import failed." };
  if (r.imported === 0 && r.updated === 0) return { ok: true, message: "No products found to import." };
  const bits: string[] = [];
  if (r.imported) bits.push(`${r.imported} new`);
  if (r.updated) bits.push(`${r.updated} updated`);
  return { ok: true, message: `Imported ${r.fetched} Shopify products — ${bits.join(", ")}.` };
}
