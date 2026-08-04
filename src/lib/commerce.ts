import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// The commerce core.
//
// One query layer serving every surface: the website, a voice assistant, and
// somebody else's AI agent all call the same thing. If the storefront had its
// own private query path, every new channel would be a rebuild — which is the
// opposite of what we're aiming for.
//
// Two rules hold everywhere:
//   1. Destination first. Nothing is returned that we cannot deliver to the
//      address in question. An agent should never be able to buy the undeliverable.
//   2. Never assert what we don't know. Stock and postage are returned with
//      their confidence, not smoothed over.
// ---------------------------------------------------------------------------

/** CJ uses absurd placeholder prices for items it will not ship. */
const SENTINEL_PRICE_CENTS = 5_000_00;
const MAX_PAGE_SIZE = 60;

export type CatalogueQuery = {
  locationId: string;
  /** ISO-2 destination. Required — everything is filtered by deliverability. */
  destination: string;
  text?: string;
  minCents?: number;
  maxCents?: number;
  inStockOnly?: boolean;
  freeDeliveryOnly?: boolean;
  /** Structured filters, e.g. { brand: "Devanti" } or { maxWeightKg: 5 }. */
  brand?: string;
  maxWeightKg?: number;
  hasBarcode?: boolean;
  page?: number;
  pageSize?: number;
};

export type CatalogueItem = {
  id: string;
  name: string;
  sku: string | null;
  image: string | null;
  priceCents: number | null;
  currency: "AUD";
  /** null = we genuinely don't know, which is not the same as zero. */
  stock: number | null;
  shipsFrom: string | null;
  delivery: { freeToDestination: boolean; note: string };
  supplier: string | null;
  category: string | null;
  /** Only what the supplier actually publishes — absent keys mean unknown. */
  attributes: Record<string, unknown>;
};

export type CatalogueResult = {
  destination: string;
  total: number;
  page: number;
  pageSize: number;
  items: CatalogueItem[];
};

function buildWhere(q: CatalogueQuery): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {
    locationId: q.locationId,
    active: true,
    // The destination gate — the one non-negotiable filter.
    shipCountries: { array_contains: [q.destination.toUpperCase()] },
    priceCents: { not: null, lt: SENTINEL_PRICE_CENTS },
    // Collection-only stock can't be delivered to anyone, so it has no place in
    // a destination-filtered catalogue however well it matches.
    NOT: [
      { name: { contains: "self-pickup", mode: "insensitive" } },
      { name: { contains: "self pickup", mode: "insensitive" } },
      { name: { contains: "only self", mode: "insensitive" } },
    ],
  };

  if (q.text) where.name = { contains: q.text, mode: "insensitive" };
  if (q.inStockOnly) where.inventory = { gt: 0 };
  if (q.freeDeliveryOnly) where.freightCents = 0;

  // Attribute filters. These are what a comparison or an agent actually needs —
  // "under 5kg", "this brand", "has a real barcode" — and they only became
  // possible once specs were captured rather than discarded.
  const attrFilters: Prisma.ProductWhereInput[] = [];
  if (q.brand) attrFilters.push({ attributes: { path: ["brand"], equals: q.brand } });
  if (q.hasBarcode) attrFilters.push({ NOT: { attributes: { path: ["barcode"], equals: Prisma.DbNull } } });
  if (q.maxWeightKg != null) attrFilters.push({ attributes: { path: ["weightKg"], lte: q.maxWeightKg } });
  if (attrFilters.length) where.AND = attrFilters;

  if (q.minCents != null || q.maxCents != null) {
    where.priceCents = {
      not: null,
      lt: Math.min(q.maxCents ?? SENTINEL_PRICE_CENTS, SENTINEL_PRICE_CENTS),
      ...(q.minCents != null ? { gte: q.minCents } : {}),
    };
  }

  return where;
}

function toItem(p: {
  id: string; name: string; sku: string | null; imageUrl: string | null;
  priceCents: number | null; inventory: number | null; warehouse: string | null;
  freightCents: number | null; supplier: string | null; category: string | null;
  attributes?: unknown;
}): CatalogueItem {
  const free = p.freightCents === 0;
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    image: p.imageUrl,
    priceCents: p.priceCents,
    currency: "AUD",
    stock: p.inventory,
    shipsFrom: p.warehouse,
    delivery: {
      freeToDestination: free,
      note: free ? "Free delivery" : "Postage calculated at checkout",
    },
    supplier: p.supplier,
    category: p.category,
    attributes: (p.attributes && typeof p.attributes === "object" ? p.attributes : {}) as Record<string, unknown>,
  };
}

/** Search the catalogue for one destination. */
export async function searchCatalogue(q: CatalogueQuery): Promise<CatalogueResult> {
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(Math.max(1, q.pageSize ?? 24), MAX_PAGE_SIZE);
  const where = buildWhere(q);

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      // Things we can actually send, first.
      orderBy: [{ inventory: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, name: true, sku: true, imageUrl: true, priceCents: true,
        inventory: true, warehouse: true, freightCents: true, supplier: true, category: true,
        attributes: true,
      },
    }),
  ]);

  return {
    destination: q.destination.toUpperCase(),
    total,
    page,
    pageSize,
    items: rows.map(toItem),
  };
}

/** One product, with everything a buyer or an agent needs to decide. */
export async function getCatalogueItem(
  locationId: string,
  productId: string,
  destination: string,
): Promise<(CatalogueItem & { description: string | null; deliverable: boolean; images: string[] }) | null> {
  const p = await prisma.product.findFirst({
    where: { id: productId, locationId },
    select: {
      id: true, name: true, sku: true, imageUrl: true, images: true, priceCents: true,
      inventory: true, warehouse: true, freightCents: true, supplier: true, category: true,
      description: true, shipCountries: true, attributes: true,
    },
  });
  if (!p) return null;

  const ships = Array.isArray(p.shipCountries) ? (p.shipCountries as string[]) : [];
  const gallery = Array.isArray(p.images) ? (p.images as string[]) : [];

  return {
    ...toItem(p),
    description: p.description ? p.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : null,
    images: gallery.length ? gallery : p.imageUrl ? [p.imageUrl] : [],
    deliverable: ships.includes(destination.toUpperCase()),
  };
}

/** Destinations we hold real stock for, with counts — useful to agents. */
export async function availableDestinations(locationId: string): Promise<{ code: string; products: number }[]> {
  const rows = await prisma.$queryRaw<{ code: string; products: bigint }[]>`
    SELECT c AS code, count(*) AS products
    FROM "Product", jsonb_array_elements_text("shipCountries") AS c
    WHERE "locationId" = ${locationId}
      AND active = true
      AND "priceCents" IS NOT NULL
      AND "priceCents" < ${SENTINEL_PRICE_CENTS}
    GROUP BY c
    HAVING count(*) > 50
    ORDER BY count(*) DESC
  `;
  return rows.map((r) => ({ code: r.code, products: Number(r.products) }));
}
