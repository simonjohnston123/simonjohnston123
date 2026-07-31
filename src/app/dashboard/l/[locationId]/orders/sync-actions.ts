"use server";

import { revalidatePath } from "next/cache";
import { requireLocationAccess } from "@/lib/auth";
import { syncShopifyOrders } from "@/lib/shopify-sync";
import { syncEbayOrders } from "@/lib/ebay-sync";

export async function syncShopifyOrdersAction(locationId: string): Promise<{ ok: boolean; message: string }> {
  await requireLocationAccess(locationId);
  const r = await syncShopifyOrders(locationId);
  revalidatePath(`/dashboard/l/${locationId}/orders`);
  if (!r.ok) return { ok: false, message: r.reason || "Sync failed." };
  if (r.imported === 0 && r.updated === 0) return { ok: true, message: "No orders found to sync." };
  const bits: string[] = [];
  if (r.imported) bits.push(`${r.imported} new`);
  if (r.updated) bits.push(`${r.updated} updated`);
  return { ok: true, message: `Synced ${r.fetched} Shopify orders — ${bits.join(", ")}.` };
}

export async function syncEbayOrdersAction(locationId: string): Promise<{ ok: boolean; message: string }> {
  await requireLocationAccess(locationId);
  const r = await syncEbayOrders(locationId);
  revalidatePath(`/dashboard/l/${locationId}/orders`);
  if (!r.ok) return { ok: false, message: r.reason || "Sync failed." };
  if (r.imported === 0 && r.updated === 0) return { ok: true, message: "No eBay orders found to sync." };
  const bits: string[] = [];
  if (r.imported) bits.push(`${r.imported} new`);
  if (r.updated) bits.push(`${r.updated} updated`);
  return { ok: true, message: `Synced ${r.fetched} eBay orders — ${bits.join(", ")}.` };
}
