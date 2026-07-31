import Link from "next/link";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ListingBatchBuilder } from "@/components/listing-batch-builder";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const PICK_LIMIT = 100;

export default async function NewBatchPage({
  params,
  searchParams,
}: {
  params: { locationId: string };
  searchParams: { q?: string; category?: string };
}) {
  await requireLocationAccess(params.locationId);
  const locationId = params.locationId;
  const base = `/dashboard/l/${locationId}/listings`;
  const q = (searchParams.q ?? "").trim();
  const category = (searchParams.category ?? "").trim();

  const where: Prisma.ProductWhereInput = { locationId };
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }];
  if (category) where.category = category;

  const [products, total, categoriesRaw] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PICK_LIMIT,
      select: { id: true, name: true, priceCents: true, price: true, imageUrl: true, category: true },
    }),
    prisma.product.count({ where }),
    prisma.product.findMany({ where: { locationId }, select: { category: true }, distinct: ["category"], take: 300 }),
  ]);

  const categories = Array.from(new Set(categoriesRaw.map((c) => c.category).filter(Boolean) as string[])).sort();

  const items = products.map((p) => ({
    id: p.id,
    name: p.name,
    price: typeof p.priceCents === "number" ? p.priceCents / 100 : p.price ?? 0,
    imageUrl: p.imageUrl,
    category: p.category,
  }));

  return (
    <div>
      <PageHeader
        title="New listing batch"
        subtitle="Pick a marketplace and the products to prepare for it."
        action={
          <Link href={base} className="btn-secondary">
            ← Back
          </Link>
        }
      />

      {/* Product filter */}
      <form className="card mb-4 flex flex-wrap items-end gap-2 p-3" method="get">
        <div className="flex-1 min-w-[180px]">
          <label className="label" htmlFor="q">Search products</label>
          <input id="q" name="q" defaultValue={q} placeholder="name or SKU…" className="input h-9 text-sm" />
        </div>
        <div className="min-w-[180px]">
          <label className="label" htmlFor="category">Category</label>
          <select id="category" name="category" defaultValue={category} className="input h-9 text-sm">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <button className="btn-secondary h-9">Filter</button>
        <span className="ml-auto self-center text-xs text-slate-500">
          Showing {items.length} of {total.toLocaleString()} — narrow the filter, then tick the ones to list.
        </span>
      </form>

      <ListingBatchBuilder locationId={locationId} products={items} />
    </div>
  );
}
