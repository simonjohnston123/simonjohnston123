import "server-only";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// One ordering desk for every supplier.
//
// A customer order arrives from any channel (eBay, Shopify, our own site) and
// its lines may be fulfilled by different suppliers. This resolves each line to
// a catalogue product, groups the lines by supplier, and creates one
// SupplierOrder per supplier — which is what the desk works from. It replaces
// placing orders by hand from per-supplier CSVs.
// ---------------------------------------------------------------------------

export type OrderLine = { name?: string; qty?: number; price?: number; sku?: string };

export type ResolvedLine = {
  name: string;
  qty: number;
  sellCents: number;
  sku: string | null;
  productId: string | null;
  supplier: string | null;
  warehouse: string | null;
  costCents: number | null;
  /** How the product was identified — matters when a line can't be bought. */
  matchedBy: "sku" | "name" | null;
};

const UNKNOWN = "Unassigned";

function lines(order: { items: unknown }): OrderLine[] {
  return Array.isArray(order.items) ? (order.items as OrderLine[]) : [];
}

const PRODUCT_FIELDS = {
  id: true, name: true, sku: true, supplier: true, warehouse: true, costCents: true,
} as const;

/**
 * Resolve one order's lines to catalogue products.
 *
 * SKU is the reliable key. Historic orders were imported before we captured
 * SKU, so name is the fallback — exact first, then a contains match, because
 * marketplace titles get truncated.
 */
export async function resolveOrderLines(locationId: string, order: { items: unknown }): Promise<ResolvedLine[]> {
  const out: ResolvedLine[] = [];

  for (const l of lines(order)) {
    const name = (l.name ?? "").trim();
    const qty = Number(l.qty ?? 1) || 1;
    const sellCents = Math.round(Number(l.price ?? 0) * 100);

    let product = null as { id: string; name: string; sku: string | null; supplier: string | null; warehouse: string | null; costCents: number | null } | null;
    let matchedBy: ResolvedLine["matchedBy"] = null;

    if (l.sku) {
      product = await prisma.product.findFirst({ where: { locationId, sku: l.sku }, select: PRODUCT_FIELDS });
      if (product) matchedBy = "sku";
    }
    if (!product && name) {
      product = await prisma.product.findFirst({ where: { locationId, name }, select: PRODUCT_FIELDS });
      if (!product) {
        product = await prisma.product.findFirst({
          where: { locationId, name: { contains: name.slice(0, 40), mode: "insensitive" } },
          select: PRODUCT_FIELDS,
        });
      }
      if (product) matchedBy = "name";
    }

    out.push({
      name: name || product?.name || "(unnamed line)",
      qty,
      sellCents,
      sku: product?.sku ?? l.sku ?? null,
      productId: product?.id ?? null,
      supplier: product?.supplier ?? null,
      warehouse: product?.warehouse ?? null,
      costCents: product?.costCents ?? null,
      matchedBy,
    });
  }

  return out;
}

export type BuildResult = { created: number; updated: number; unresolved: number; duplicates: number };

/** Street line only — channels format city/country differently for the same address. */
function streetKey(address: string | null): string {
  return (address ?? "").replace(/\s+/g, " ").split(",")[0]!.trim().toLowerCase();
}

/**
 * Orders that are the same physical sale arriving twice.
 *
 * The Shopify store receives eBay sales as well, and the CRM syncs both eBay
 * directly and Shopify — so one sale lands as two orders. Buying against both
 * means buying the stock twice, so the later copy is suppressed here.
 *
 * Matched on street line + first item, because the channels disagree on
 * everything else: customer name gains a Shopify handle, and the address
 * country flips between code and name ("Nuuk, 3900, GL" vs "NUUK, 3900,
 * Greenland").
 */
export async function duplicateOrderIds(locationId: string): Promise<Set<string>> {
  const orders = await prisma.order.findMany({
    where: { locationId },
    select: { id: true, source: true, items: true, deliveryAddress: true, placedAt: true, createdAt: true },
  });

  const seen = new Map<string, { id: string; when: number; source: string }>();
  const dupes = new Set<string>();

  for (const o of orders) {
    const first = (Array.isArray(o.items) ? (o.items as OrderLine[])[0]?.name : null) ?? "";
    const street = streetKey(o.deliveryAddress);
    if (!first || !street) continue;

    const key = `${street}::${first.toLowerCase()}`;
    const when = (o.placedAt ?? o.createdAt).getTime();
    const source = o.source ?? "";
    const prev = seen.get(key);

    if (!prev) {
      seen.set(key, { id: o.id, when, source });
      continue;
    }
    // Same sale on two channels. Keep the earliest; that is the original.
    if (prev.source !== source) {
      if (when < prev.when) {
        dupes.add(prev.id);
        seen.set(key, { id: o.id, when, source });
      } else {
        dupes.add(o.id);
      }
    }
  }

  return dupes;
}

/**
 * Create/refresh SupplierOrders for orders that still need buying.
 *
 * Only touches rows still TO_PLACE — once something has been ordered with a
 * supplier we never rewrite it from the sales order, or a re-sync could
 * duplicate a real purchase.
 */
export async function buildSupplierOrders(locationId: string, limit = 200): Promise<BuildResult> {
  const orders = await prisma.order.findMany({
    where: { locationId, status: { in: ["NEW", "CONFIRMED"] } },
    orderBy: { placedAt: "desc" },
    take: limit,
    select: { id: true, items: true },
  });

  const res: BuildResult = { created: 0, updated: 0, unresolved: 0, duplicates: 0 };

  // The same sale arrives from both eBay and Shopify. Buying against both would
  // buy the stock twice, so the duplicate copies never reach the desk — and any
  // that were created before this check are cleared out.
  const dupes = await duplicateOrderIds(locationId);
  if (dupes.size) {
    const removed = await prisma.supplierOrder.deleteMany({
      where: { locationId, status: "TO_PLACE", orderId: { in: [...dupes] } },
    });
    res.duplicates = removed.count;
  }

  for (const order of orders) {
    if (dupes.has(order.id)) continue;

    const resolved = await resolveOrderLines(locationId, order);
    if (!resolved.length) continue;

    const bySupplier = new Map<string, ResolvedLine[]>();
    for (const line of resolved) {
      const key = line.supplier ?? UNKNOWN;
      if (key === UNKNOWN) res.unresolved++;
      const list = bySupplier.get(key) ?? [];
      list.push(line);
      bySupplier.set(key, list);
    }

    for (const [supplier, group] of bySupplier) {
      const costCents = group.reduce((sum, l) => sum + (l.costCents ?? 0) * l.qty, 0) || null;
      const items = group.map((l) => ({
        sku: l.sku, name: l.name, qty: l.qty, costCents: l.costCents,
        productId: l.productId, warehouse: l.warehouse, sellCents: l.sellCents,
      }));

      const existing = await prisma.supplierOrder.findUnique({
        where: { orderId_supplier: { orderId: order.id, supplier } },
        select: { id: true, status: true },
      });

      if (!existing) {
        await prisma.supplierOrder.create({
          data: { locationId, orderId: order.id, supplier, items, costCents },
        });
        res.created++;
      } else if (existing.status === "TO_PLACE") {
        await prisma.supplierOrder.update({ where: { id: existing.id }, data: { items, costCents } });
        res.updated++;
      }
    }
  }

  return res;
}

/** Which suppliers can be ordered from automatically today. */
export function supplierAutomation(supplier: string): { auto: boolean; note: string } {
  switch (supplier) {
    case "CJ Dropshipping":
      return { auto: false, note: "Needs the CJ API key + wallet balance before orders can be placed automatically." };
    case "Dropshipzone":
      return { auto: false, note: "Place on the Dropshipzone portal, then record the reference and tracking here." };
    default:
      return { auto: false, note: "Place with the supplier, then record the reference and tracking here." };
  }
}
