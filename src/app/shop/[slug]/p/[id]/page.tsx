import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { quoteFreight } from "@/lib/freight";
import { AddToCart } from "@/components/shop-cart";

export const dynamic = "force-dynamic";

const money = (c: number | null) => (c == null ? null : `$${(c / 100).toFixed(2)}`);

/** Turn the supplier's spec blob into rows a person can read. */
function specRows(attributes: Record<string, unknown>): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const push = (label: string, v: unknown, suffix = "") => {
    if (v === null || v === undefined || v === "") return;
    rows.push({ label, value: `${v}${suffix}` });
  };

  push("Brand", attributes.brand);
  push("Colour", attributes.colour);
  push("Weight", attributes.weightKg, " kg");

  const l = attributes.lengthMm, w = attributes.widthMm, h = attributes.heightMm;
  if (l && w && h) rows.push({ label: "Dimensions", value: `${l} × ${w} × ${h} mm` });

  push("Barcode", attributes.barcode);
  push("Dispatch", attributes.dispatchEta);

  // DZ stores variants as [{name,value}] — usually the size options.
  const spec = attributes.spec;
  if (typeof spec === "string" && spec.startsWith("[")) {
    try {
      for (const s of JSON.parse(spec) as { name?: string; value?: string }[]) {
        if (s?.name && s?.value) {
          rows.push({ label: s.name.replace(/^./, (c) => c.toUpperCase()), value: s.value });
        }
      }
    } catch {
      /* leave it out rather than show raw JSON */
    }
  }
  return rows;
}

export default async function ProductPage({
  params, searchParams,
}: {
  params: { slug: string; id: string };
  searchParams: { to?: string };
}) {
  const location = await prisma.location.findUnique({
    where: { slug: params.slug },
    include: { site: true },
  });
  if (!location) notFound();

  const product = await prisma.product.findFirst({
    where: { id: params.id, locationId: location.id, active: true },
    select: {
      id: true, name: true, description: true, imageUrl: true, images: true,
      priceCents: true, price: true, inventory: true, warehouse: true,
      freightCents: true, shipCountries: true, attributes: true, category: true,
    },
  });
  if (!product) notFound();

  const primary = location.site?.primaryColor || "#1d5df5";
  const to = (searchParams.to || "AU").toUpperCase();
  const base = `/shop/${location.slug}`;

  const ships = Array.isArray(product.shipCountries) ? (product.shipCountries as string[]) : [];
  const deliverable = ships.includes(to);
  const attributes = (product.attributes ?? {}) as Record<string, unknown>;
  const rows = specRows(attributes);

  const gallery = (Array.isArray(product.images) ? (product.images as string[]) : []).filter(Boolean);
  const images = gallery.length ? gallery.slice(0, 5) : product.imageUrl ? [product.imageUrl] : [];

  // Real postage for this destination, not a guess.
  const freight = deliverable
    ? await quoteFreight({ locationId: location.id, productId: product.id, countryCode: to })
    : null;

  const unit = product.priceCents ?? (product.price != null ? Math.round(product.price * 100) : 0);
  const inStock = typeof product.inventory === "number" ? product.inventory > 0 : null;

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link href={`${base}?to=${to}`} className="text-sm font-medium text-slate-500 hover:text-slate-800">
            ← Back to shop
          </Link>
          <Link href={`${base}/cart`} className="text-sm font-semibold" style={{ color: primary }}>
            Basket →
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-2">
        <div>
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {images[0] ? (
              <Image src={images[0]} alt={product.name} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-contain p-4" />
            ) : (
              <div className="grid h-full place-items-center text-slate-400">No image</div>
            )}
          </div>
          {images.length > 1 ? (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {images.slice(1).map((src, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <Image src={src} alt="" fill sizes="120px" className="object-contain p-1" />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          {product.category ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{product.category}</p>
          ) : null}
          <h1 className="mt-1 text-2xl font-bold leading-snug text-slate-900">{product.name}</h1>

          <div className="mt-4 flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-bold" style={{ color: primary }}>{money(unit)}</span>
            {freight?.cents === 0 ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Free delivery</span>
            ) : freight?.exact && freight.cents != null ? (
              <span className="text-sm text-slate-500">+ {money(freight.cents)} postage</span>
            ) : (
              <span className="text-sm text-slate-500">+ postage at checkout</span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            {inStock === true ? <span className="font-medium text-emerald-600">In stock</span> : null}
            {inStock === false ? <span className="font-medium text-amber-600">Currently out of stock</span> : null}
            {product.warehouse ? <span className="text-slate-500">Ships from {product.warehouse}</span> : null}
          </div>

          <div className="mt-6">
            {deliverable ? (
              <AddToCart slug={location.slug} productId={product.id} destination={to} primary={primary} large />
            ) : (
              <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                We can&apos;t deliver this one to {to}.{" "}
                <Link href={base} className="font-semibold underline">Change destination</Link>
              </div>
            )}
          </div>

          {rows.length ? (
            <div className="mt-8">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Specifications</h2>
              <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                {rows.map((r, i) => (
                  <div key={i} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                    <dt className="text-slate-500">{r.label}</dt>
                    <dd className="text-right font-medium text-slate-900">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          {product.description ? (
            <div className="mt-8">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Description</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
                {product.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000)}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
