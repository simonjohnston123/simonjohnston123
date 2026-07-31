import Link from "next/link";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { NewProduct } from "@/components/new-product";
import { ProductImportButton } from "@/components/product-import-button";
import { ProductListingTable } from "@/components/product-listing-table";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const PER_PAGE_OPTIONS = [25, 50, 100, 200];
const SORTS: Record<string, Prisma.ProductOrderByWithRelationInput> = {
  newest: { createdAt: "desc" },
  name: { name: "asc" },
  price_asc: { priceCents: "asc" },
  price_desc: { priceCents: "desc" },
  stock_desc: { inventory: "desc" },
};

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: { locationId: string };
  searchParams: Record<string, string | undefined>;
}) {
  const { locationId } = params;
  const { location } = await requireLocationAccess(locationId);

  const q = (searchParams.q || "").trim();
  const category = searchParams.category || undefined;
  const source = searchParams.source || undefined;
  const warehouse = searchParams.warehouse || undefined;
  const supplier = searchParams.supplier || undefined;
  const sort = searchParams.sort && searchParams.sort in SORTS ? searchParams.sort : "newest";
  const per = PER_PAGE_OPTIONS.includes(Number(searchParams.per)) ? Number(searchParams.per) : 50;
  const page = Math.max(1, Number(searchParams.page) || 1);

  const where: Prisma.ProductWhereInput = { locationId };
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }];
  if (category) where.category = category === "__none__" ? null : category;
  if (source) where.source = source === "manual" ? null : source;
  if (warehouse) where.warehouse = warehouse === "__none__" ? null : warehouse;
  if (supplier) where.supplier = supplier === "__none__" ? null : supplier;

  const [count, products, cats, sources, warehouses, suppliers] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({ where, orderBy: SORTS[sort], skip: (page - 1) * per, take: per }),
    prisma.product.groupBy({ by: ["category"], where: { locationId }, _count: { _all: true } }),
    prisma.product.groupBy({ by: ["source"], where: { locationId }, _count: { _all: true } }),
    prisma.product.groupBy({ by: ["warehouse"], where: { locationId }, _count: { _all: true } }),
    prisma.product.groupBy({ by: ["supplier"], where: { locationId }, _count: { _all: true } }),
  ]);

  const base = `/dashboard/l/${locationId}/products`;
  const pageCount = Math.max(1, Math.ceil(count / per));
  const startRow = count === 0 ? 0 : (page - 1) * per + 1;
  const endRow = Math.min(count, page * per);
  const hasShopify = sources.some((s) => s.source === "Shopify");

  const qs = (overrides: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | number | undefined> = { q, category, source, warehouse, supplier, sort, per, page, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "" && v !== null) p.set(k, String(v));
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };

  // Category chips (grouping) — sorted by count desc, only real categories.
  const catChips = cats
    .filter((c) => c.category)
    .sort((a, b) => b._count._all - a._count._all)
    .map((c) => ({ name: c.category as string, n: c._count._all }));
  const uncategorised = cats.find((c) => c.category === null)?._count._all ?? 0;

  const whChips = warehouses.filter((w) => w.warehouse).sort((a, b) => b._count._all - a._count._all).map((w) => ({ name: w.warehouse as string, n: w._count._all }));
  const supplierOpts = suppliers.filter((s) => s.supplier).sort((a, b) => b._count._all - a._count._all).map((s) => ({ name: s.supplier as string, n: s._count._all }));

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle={`${count} product${count === 1 ? "" : "s"} in your catalogue`}
        action={
          <div className="flex items-center gap-2">
            <ProductImportButton locationId={locationId} />
            <Link href={`/shop/${location.slug}`} target="_blank" className="btn-secondary text-sm">Open shop ↗</Link>
          </div>
        }
      />

      <div className="mb-4">
        <NewProduct locationId={locationId} />
      </div>

      {/* Category grouping chips — scrollable so a big taxonomy doesn't bury the table. */}
      {catChips.length > 0 || uncategorised > 0 ? (
        <div className="mb-3">
          <div className="mb-1 text-xs font-medium text-slate-400">Group by category ({catChips.length})</div>
          <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/40 p-2">
            <Link href={qs({ category: undefined, page: undefined })} className={!category ? "btn-primary text-xs" : "btn-secondary text-xs"}>All ({count})</Link>
            {catChips.map((c) => (
              <Link key={c.name} href={qs({ category: c.name, page: undefined })} className={category === c.name ? "btn-primary text-xs" : "btn-secondary text-xs"}>
                {c.name} ({c.n})
              </Link>
            ))}
            {uncategorised > 0 ? (
              <Link href={qs({ category: "__none__", page: undefined })} className={category === "__none__" ? "btn-primary text-xs" : "btn-secondary text-xs"}>Uncategorised ({uncategorised})</Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Shipping: warehouse chips (postage origin) */}
      {whChips.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400">📦 Ships from</span>
          <Link href={qs({ warehouse: undefined, page: undefined })} className={!warehouse ? "btn-primary text-xs" : "btn-secondary text-xs"}>Any warehouse</Link>
          {whChips.map((w) => (
            <Link key={w.name} href={qs({ warehouse: w.name, page: undefined })} className={warehouse === w.name ? "btn-primary text-xs" : "btn-secondary text-xs"}>
              {w.name} ({w.n})
            </Link>
          ))}
        </div>
      ) : null}

      {/* Filter bar */}
      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-3">
        {category ? <input type="hidden" name="category" value={category} /> : null}
        {warehouse ? <input type="hidden" name="warehouse" value={warehouse} /> : null}
        <label className="text-xs text-slate-500">Dropshipper
          <select name="supplier" defaultValue={supplier ?? ""} className="input mt-1 h-9 w-44 text-sm">
            <option value="">All suppliers</option>
            {supplierOpts.map((s) => <option key={s.name} value={s.name}>{s.name} ({s.n})</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500">Search
          <input type="text" name="q" defaultValue={q} placeholder="name or SKU" className="input mt-1 h-9 w-48 text-sm" />
        </label>
        <label className="text-xs text-slate-500">Source
          <select name="source" defaultValue={source ?? ""} className="input mt-1 h-9 w-32 text-sm">
            <option value="">All</option>
            <option value="Shopify">Shopify</option>
            <option value="eBay">eBay</option>
            <option value="manual">Manual</option>
          </select>
        </label>
        <label className="text-xs text-slate-500">Sort
          <select name="sort" defaultValue={sort} className="input mt-1 h-9 w-40 text-sm">
            <option value="newest">Newest</option>
            <option value="name">Name A–Z</option>
            <option value="price_asc">Price low → high</option>
            <option value="price_desc">Price high → low</option>
            <option value="stock_desc">Stock high → low</option>
          </select>
        </label>
        <label className="text-xs text-slate-500">Per page
          <select name="per" defaultValue={String(per)} className="input mt-1 h-9 w-20 text-sm">
            {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          <button className="btn-primary h-9 text-sm">Apply</button>
          <Link href={base} className="btn-secondary h-9 text-sm">Clear</Link>
        </div>
      </form>

      {products.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-base font-medium text-slate-800">No products match</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            {hasShopify ? "Try clearing filters." : "Import your catalogue from Shopify above, or add a product."}
          </p>
        </div>
      ) : (
        <>
          <ProductListingTable
            locationId={locationId}
            base={base}
            filter={{ q, category, source, warehouse, supplier }}
            count={count}
            products={products.map((p) => ({
              id: p.id,
              name: p.name,
              sku: p.sku,
              imageUrl: p.imageUrl,
              category: p.category,
              warehouse: p.warehouse,
              supplier: p.supplier,
              priceCents: p.priceCents,
              price: p.price,
              inventory: p.inventory,
              channels: Array.isArray(p.channels) ? (p.channels as string[]) : [],
            }))}
          />

          <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
            <span>Showing {startRow}–{endRow} of {count}</span>
            <span className="flex items-center gap-2">
              {page > 1 ? <Link href={qs({ page: page - 1 })} className="btn-secondary text-xs">← Prev</Link> : <span className="btn-secondary cursor-not-allowed text-xs opacity-40">← Prev</span>}
              <span className="text-xs">Page {page} of {pageCount}</span>
              {page < pageCount ? <Link href={qs({ page: page + 1 })} className="btn-secondary text-xs">Next →</Link> : <span className="btn-secondary cursor-not-allowed text-xs opacity-40">Next →</span>}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
