import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { cartCount } from "@/lib/cart";
import { AddToCart } from "@/components/shop-cart";
import { Discover } from "@/components/shop-discover";
import { productImage } from "@/lib/product-image";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Storefront.
//
// The front door is a sentence, not a category tree: you say what you're trying
// to do and the catalogue answers. Browsing still exists underneath for people
// who'd rather scroll, but it isn't the main event.
//
// Destination is chosen once and then ambient — nothing is ever shown that we
// can't actually deliver there, backed by the GIN index on shipCountries so the
// filter stays a lookup rather than a scan of 84k rows.
// ---------------------------------------------------------------------------

const PAGE_SIZE = 24;

const DESTINATIONS = [
  { code: "AU", label: "Australia", flag: "🇦🇺" },
  { code: "US", label: "United States", flag: "🇺🇸" },
  { code: "GB", label: "United Kingdom", flag: "🇬🇧" },
  { code: "DE", label: "Germany", flag: "🇩🇪" },
  { code: "ES", label: "Spain", flag: "🇪🇸" },
  { code: "CA", label: "Canada", flag: "🇨🇦" },
  { code: "NZ", label: "New Zealand", flag: "🇳🇿" },
];

/** CJ uses absurd placeholder prices for items it won't ship. */
const SENTINEL_PRICE_CENTS = 5_000_00;
const money = (c: number | null) => (c == null ? "—" : `$${(c / 100).toFixed(2)}`);

export default async function ShopPage({
  params, searchParams,
}: {
  params: { slug: string };
  searchParams: { to?: string; q?: string; page?: string };
}) {
  const location = await prisma.location.findUnique({ where: { slug: params.slug }, include: { site: true } });
  if (!location) notFound();

  const to = (searchParams.to || "").toUpperCase();
  const q = (searchParams.q || "").trim();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const destination = DESTINATIONS.find((d) => d.code === to);
  const base = `/shop/${location.slug}`;
  const basket = cartCount();

  // ---- Choose where it's going, before anything is shown ------------------
  if (!destination) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0B0D12] px-5">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 opacity-70"
          style={{ background: "radial-gradient(60rem 30rem at 20% 0%, rgba(124,58,237,.35), transparent 60%), radial-gradient(50rem 26rem at 85% 20%, rgba(16,185,129,.2), transparent 60%)" }}
        />
        <div className="relative w-full max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">{location.name}</p>
          <h1 className="mt-4 text-balance text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
            Where are we sending it?
          </h1>
          <p className="mx-auto mt-4 max-w-md text-white/55">
            We ship from warehouses around the world. Pick your country and you&apos;ll only ever see what can actually
            reach you.
          </p>
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {DESTINATIONS.map((d) => (
              <Link
                key={d.code}
                href={`${base}?to=${d.code}`}
                className="group flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.04] px-5 py-4 text-left transition hover:border-white/30 hover:bg-white/[0.08]"
              >
                <span className="text-2xl">{d.flag}</span>
                <span className="font-semibold text-white">{d.label}</span>
                <span className="ml-auto text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white/70">→</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // ---- Browse ------------------------------------------------------------
  const where: Prisma.ProductWhereInput = {
    locationId: location.id,
    active: true,
    shipCountries: { array_contains: [destination.code] },
    priceCents: { not: null, lt: SENTINEL_PRICE_CENTS },
    NOT: [
      { name: { contains: "self-pickup", mode: "insensitive" } },
      { name: { contains: "only self", mode: "insensitive" } },
    ],
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
        id: true, name: true, imageUrl: true, priceCents: true,
        inventory: true, warehouse: true, freightCents: true,
      },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const withParams = (next: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ to: destination.code, q, page, ...next })) {
      if (v !== undefined && v !== "" && !(k === "page" && v === 1)) sp.set(k, String(v));
    }
    return `${base}?${sp.toString()}`;
  };

  return (
    <main className="min-h-screen bg-white">
      {/* Sticky bar — identity, destination, basket. */}
      <header className="sticky top-0 z-40 border-b border-slate-900/5 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3.5">
          <Link href={`${base}?to=${destination.code}`} className="font-semibold tracking-tight text-slate-900">
            {location.name}
          </Link>

          <form action={base} method="get" className="ml-auto hidden items-center gap-2 sm:flex">
            <input type="hidden" name="to" value={destination.code} />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search…"
              className="w-44 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none transition focus:w-56 focus:border-slate-400 focus:bg-white"
            />
          </form>

          <Link href={base} className="hidden items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 sm:flex">
            <span>{destination.flag}</span>{destination.code}
          </Link>

          <Link
            href={`${base}/cart`}
            className="relative rounded-full bg-[#0B0D12] px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
          >
            Basket
            {basket > 0 ? (
              <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-xs tabular-nums">{basket}</span>
            ) : null}
          </Link>
        </div>
      </header>

      <Discover slug={location.slug} destination={destination.code} destinationLabel={destination.label} />

      {/* ---- Browse everything ---------------------------------------- */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-12">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              {q ? <>Results for &ldquo;{q}&rdquo;</> : "Or browse everything"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              <span className="font-semibold text-slate-900">{total.toLocaleString()}</span> products we can deliver to{" "}
              {destination.label}
            </p>
          </div>
          {q ? (
            <Link href={`${base}?to=${destination.code}`} className="text-sm font-medium text-violet-700 underline">
              Clear search
            </Link>
          ) : null}
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-16 text-center text-slate-500">
            Nothing matches that yet.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => {
              const free = p.freightCents === 0;
              const inStock = typeof p.inventory === "number" ? p.inventory > 0 : null;
              return (
                <article key={p.id} className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg">
                  <Link href={`${base}/p/${p.id}?to=${destination.code}`} className="relative block h-52 w-full overflow-hidden bg-slate-50">
                    {p.imageUrl ? (
                      <Image
                        src={productImage(p.imageUrl, 500)!}
                        alt={p.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        unoptimized
                        className="object-cover transition duration-500 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-sm text-slate-400">No image</div>
                    )}
                    {free ? (
                      <span className="absolute left-3 top-3 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow">
                        Free delivery
                      </span>
                    ) : null}
                  </Link>

                  <div className="flex flex-1 flex-col p-4">
                    <Link href={`${base}/p/${p.id}?to=${destination.code}`} className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 transition group-hover:text-violet-700">
                      {p.name}
                    </Link>

                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-xl font-bold text-slate-900">{money(p.priceCents)}</span>
                      {!free ? <span className="text-[11px] text-slate-400">+ postage</span> : null}
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                      {inStock === true ? <span className="font-medium text-emerald-600">In stock</span> : null}
                      {p.warehouse ? <span>Ships from {p.warehouse}</span> : null}
                    </div>

                    <div className="mt-4">
                      <AddToCart slug={location.slug} productId={p.id} destination={destination.code} primary="#0B0D12" />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {pages > 1 ? (
          <nav className="mt-10 flex items-center justify-center gap-3 text-sm">
            {page > 1 ? (
              <Link href={withParams({ page: page - 1 })} className="rounded-full border border-slate-200 px-4 py-2 font-medium transition hover:border-slate-400">
                ← Previous
              </Link>
            ) : null}
            <span className="text-slate-500 tabular-nums">Page {page.toLocaleString()} of {pages.toLocaleString()}</span>
            {page < pages ? (
              <Link href={withParams({ page: page + 1 })} className="rounded-full border border-slate-200 px-4 py-2 font-medium transition hover:border-slate-400">
                Next →
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>

      <footer className="border-t border-slate-100 py-10 text-center text-xs text-slate-400">
        {location.name} · Secure checkout by Stripe
      </footer>
    </main>
  );
}
