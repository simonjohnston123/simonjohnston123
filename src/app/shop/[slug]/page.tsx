import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Destination-aware storefront.
//
// The catalogue spans suppliers and warehouses across the world, so the first
// question isn't "what do you want" but "where are we sending it". Everything
// below is filtered on that: a shopper never sees a product we cannot actually
// deliver to them, which is the whole point of the thing.
//
// Backed by the GIN index on Product.shipCountries, so the filter stays an
// index lookup instead of a scan across 84k+ rows.
// ---------------------------------------------------------------------------

const PAGE_SIZE = 24;

/** Where we hold enough stock to be worth offering. */
const DESTINATIONS = [
  { code: "AU", label: "Australia" },
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "DE", label: "Germany" },
  { code: "ES", label: "Spain" },
  { code: "CA", label: "Canada" },
  { code: "NZ", label: "New Zealand" },
];

/** CJ uses absurd placeholder prices for items it won't actually ship. */
const SENTINEL_PRICE_CENTS = 5_000_00;

const money = (cents: number | null) => (cents == null ? null : `$${(cents / 100).toFixed(2)}`);

export default async function ShopPage({
  params, searchParams,
}: {
  params: { slug: string };
  searchParams: { to?: string; q?: string; page?: string };
}) {
  const location = await prisma.location.findUnique({
    where: { slug: params.slug },
    include: { site: true },
  });
  if (!location) notFound();

  const primary = location.site?.primaryColor || "#1d5df5";
  const to = (searchParams.to || "").toUpperCase();
  const q = (searchParams.q || "").trim();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const destination = DESTINATIONS.find((d) => d.code === to);
  const base = `/shop/${location.slug}`;

  const withParams = (next: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ to, q, page, ...next })) {
      if (v !== undefined && v !== "" && !(k === "page" && v === 1)) sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `${base}?${s}` : base;
  };

  // Nothing is shown until we know where it's going — otherwise we'd be
  // advertising products we can't deliver.
  if (!destination) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: primary }}>{location.name}</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Where are we sending it?</h1>
          <p className="mx-auto mt-3 max-w-md text-slate-600">
            We ship from warehouses around the world. Pick your country and you&apos;ll only see what we can actually get
            to you.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {DESTINATIONS.map((d) => (
              <Link
                key={d.code}
                href={`${base}?to=${d.code}`}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:shadow"
              >
                {d.label}
                <span className="ml-2 text-xs font-normal text-slate-400">{d.code}</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    );
  }

  const where: Prisma.ProductWhereInput = {
    locationId: location.id,
    active: true,
    // The destination gate.
    shipCountries: { array_contains: [destination.code] },
    // Never show something we can't price.
    priceCents: { not: null, lt: SENTINEL_PRICE_CENTS },
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
  };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: [{ inventory: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, name: true, imageUrl: true, priceCents: true, price: true,
        inventory: true, warehouse: true, freightCents: true,
      },
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: primary }}>{location.name}</p>
            <h1 className="text-2xl font-bold text-slate-900">Shop</h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <form action={base} method="get" className="flex items-center gap-2">
              <input type="hidden" name="to" value={destination.code} />
              <input
                name="q"
                defaultValue={q}
                placeholder="Search products…"
                className="w-52 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              />
              <button className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: primary }}>
                Search
              </button>
            </form>

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              <span className="text-slate-500">Delivering to</span>
              <span className="font-semibold text-slate-900">{destination.label}</span>
              <Link href={base} className="text-xs font-medium underline" style={{ color: primary }}>change</Link>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="mb-5 text-sm text-slate-500">
          <span className="font-semibold text-slate-900">{total.toLocaleString()}</span> product{total === 1 ? "" : "s"} we
          can deliver to {destination.label}
          {q ? <> matching &ldquo;{q}&rdquo;</> : null}
        </p>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            Nothing matches yet. Try a different search, or{" "}
            <Link href={`${base}?to=${destination.code}`} className="font-medium underline">clear it</Link>.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => {
              const freeDelivery = p.freightCents === 0;
              const inStock = typeof p.inventory === "number" ? p.inventory > 0 : null;
              return (
                <article key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} loading="lazy" className="h-48 w-full bg-slate-50 object-cover" />
                  ) : (
                    <div className="grid h-48 w-full place-items-center bg-slate-100 text-sm text-slate-400">No image</div>
                  )}
                  <div className="flex flex-1 flex-col p-4">
                    <h2 className="line-clamp-2 text-sm font-semibold text-slate-900">{p.name}</h2>

                    <div className="mt-2 flex flex-wrap items-baseline gap-2">
                      <span className="text-lg font-bold" style={{ color: primary }}>
                        {money(p.priceCents) ?? (p.price != null ? `$${p.price}` : "—")}
                      </span>
                      {freeDelivery ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          Free delivery
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">+ postage</span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      {p.warehouse ? <span className="rounded bg-slate-100 px-1.5 py-0.5">Ships from {p.warehouse}</span> : null}
                      {inStock === true ? <span className="font-medium text-emerald-600">In stock</span> : null}
                      {inStock === false ? <span className="font-medium text-amber-600">Out of stock</span> : null}
                    </div>

                    <Link
                      href={`/sites/${location.slug}#contact`}
                      className="mt-4 rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-white"
                      style={{ backgroundColor: primary }}
                    >
                      Enquire
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {pages > 1 ? (
          <nav className="mt-8 flex items-center justify-center gap-3 text-sm">
            {page > 1 ? (
              <Link href={withParams({ page: page - 1 })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium hover:border-slate-300">
                ← Previous
              </Link>
            ) : null}
            <span className="text-slate-500">Page {page.toLocaleString()} of {pages.toLocaleString()}</span>
            {page < pages ? (
              <Link href={withParams({ page: page + 1 })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium hover:border-slate-300">
                Next →
              </Link>
            ) : null}
          </nav>
        ) : null}

        <p className="mt-10 text-center text-xs text-slate-400">Powered by Placid Connect</p>
      </div>
    </main>
  );
}
