"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { addToCartAction } from "@/app/shop/[slug]/actions";

// ---------------------------------------------------------------------------
// Conversational storefront.
//
// The primary interface is a sentence, not a keyword box: you say what you're
// actually trying to do and the catalogue answers. Results stream in beneath
// the prompt so the page never navigates away — asking again is a continuation
// of the same conversation, not a fresh search.
// ---------------------------------------------------------------------------

type Item = {
  id: string;
  name: string;
  image: string | null;
  priceCents: number | null;
  stock: number | null;
  shipsFrom: string | null;
  delivery: { freeToDestination: boolean; note: string };
  attributes?: Record<string, unknown>;
};

type AskResponse = { understood?: string; total?: number; items?: Item[]; spoken?: string; widenedSearch?: boolean };

const money = (c: number | null) => (c == null ? "—" : `$${(c / 100).toFixed(2)}`);

/** Ask the supplier CDN for a sensible size rather than the multi-megabyte original. */
function sized(url: string | null, w = 500): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("cjdropshipping.com")) u.searchParams.set("x-oss-process", `image/resize,w_${w}`);
    else if (u.hostname.includes("cdn.shopify.com")) u.searchParams.set("width", String(w));
    return u.toString();
  } catch {
    return url;
  }
}

const PROMPTS = [
  "something to keep my dog from barking",
  "a gift under $50",
  "kit out my campsite",
  "make my bathroom nicer",
  "tools for the garage",
  "something for a 6 year old",
];

export function Discover({
  slug, destination, destinationLabel,
}: {
  slug: string; destination: string; destinationLabel: string;
}) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [placeholder, setPlaceholder] = useState(PROMPTS[0]!);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Cycle the placeholder so the box teaches you what it can do.
  useEffect(() => {
    if (q || res) return;
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % PROMPTS.length;
      setPlaceholder(PROMPTS[i]!);
    }, 2600);
    return () => clearInterval(t);
  }, [q, res]);

  async function ask(message: string) {
    if (!message.trim()) return;
    setQ(message);
    setLoading(true);
    setRes(null);
    try {
      const r = await fetch("/api/commerce/v1/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: destination, message, store: slug }),
      });
      setRes(await r.json());
    } catch {
      setRes({ spoken: "Something went wrong reaching the catalogue. Try again?" });
    } finally {
      setLoading(false);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }
  }

  return (
    <>
      {/* ---- Hero: the conversation is the front door -------------------- */}
      <section className="relative overflow-hidden bg-[#0B0D12]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(60rem 30rem at 15% -10%, rgba(124,58,237,.35), transparent 60%), radial-gradient(50rem 26rem at 90% 10%, rgba(16,185,129,.22), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-5 py-20 text-center sm:py-28">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Shopping, but you just say what you need
          </p>

          <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-6xl">
            Tell us what you&apos;re
            <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-emerald-300 bg-clip-text text-transparent"> actually trying to do.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/60">
            No categories to dig through. Describe it in a sentence and we&apos;ll search everything we can genuinely
            deliver to {destinationLabel}.
          </p>

          <form
            onSubmit={(e) => { e.preventDefault(); void ask(q); }}
            className="mx-auto mt-9 flex max-w-2xl items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.07] p-2 backdrop-blur transition focus-within:border-white/30 focus-within:bg-white/[0.1]"
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={placeholder}
              className="min-w-0 flex-1 bg-transparent px-4 py-3 text-base text-white outline-none placeholder:text-white/35"
              aria-label="Describe what you need"
            />
            <button
              type="submit"
              disabled={loading || !q.trim()}
              className="shrink-0 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#0B0D12] transition hover:bg-white/90 disabled:opacity-40"
            >
              {loading ? "Thinking…" : "Find it"}
            </button>
          </form>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {PROMPTS.slice(0, 4).map((p) => (
              <button
                key={p}
                onClick={() => void ask(p)}
                className="rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-1.5 text-xs text-white/70 transition hover:border-white/25 hover:text-white"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Trust strip — the three things a shopper actually worries about. */}
        <div className="relative border-t border-white/10 bg-black/20">
          <div className="mx-auto grid max-w-4xl grid-cols-1 divide-y divide-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {[
              ["Only what we can send you", `Filtered to ${destinationLabel} before you see it`],
              ["Real stock, real postage", "Live from the warehouse holding it"],
              ["Secure checkout", "Card handled by Stripe, never by us"],
            ].map(([h, s]) => (
              <div key={h} className="px-6 py-5 text-center">
                <p className="text-sm font-semibold text-white">{h}</p>
                <p className="mt-0.5 text-xs text-white/50">{s}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Answer ------------------------------------------------------ */}
      {(loading || res) && (
        <section ref={resultsRef} className="mx-auto max-w-6xl px-5 py-12">
          {loading ? (
            <div className="flex items-center gap-3 text-slate-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-violet-500" />
              Searching everything we can deliver to {destinationLabel}…
            </div>
          ) : res ? (
            <>
              <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">What I understood</p>
                <p className="mt-1 text-lg font-medium text-slate-900">{res.understood ?? q}</p>
                {res.widenedSearch ? (
                  <p className="mt-2 text-xs text-amber-700">
                    Nothing matched exactly, so I broadened it slightly.
                  </p>
                ) : null}
                <p className="mt-2 text-sm text-slate-500">
                  {res.total
                    ? `${res.total.toLocaleString()} option${res.total === 1 ? "" : "s"} we can deliver to ${destinationLabel}.`
                    : `Nothing we can deliver to ${destinationLabel} matches that yet.`}
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {(res.items ?? []).map((it) => (
                  <ProductCard key={it.id} item={it} slug={slug} destination={destination} />
                ))}
              </div>
            </>
          ) : null}
        </section>
      )}
    </>
  );
}

function ProductCard({ item, slug, destination }: { item: Item; slug: string; destination: string }) {
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  const img = sized(item.image);

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg">
      <Link href={`/shop/${slug}/p/${item.id}?to=${destination}`} className="relative block h-52 w-full overflow-hidden bg-slate-50">
        {img ? (
          <Image src={img} alt={item.name} fill sizes="(max-width:640px) 100vw, 25vw" unoptimized className="object-cover transition duration-500 group-hover:scale-[1.04]" />
        ) : (
          <div className="grid h-full place-items-center text-sm text-slate-400">No image</div>
        )}
        {item.delivery.freeToDestination ? (
          <span className="absolute left-3 top-3 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow">
            Free delivery
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link href={`/shop/${slug}/p/${item.id}?to=${destination}`} className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 group-hover:text-violet-700">
          {item.name}
        </Link>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-xl font-bold text-slate-900">{money(item.priceCents)}</span>
          {!item.delivery.freeToDestination ? <span className="text-[11px] text-slate-400">+ postage</span> : null}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
          {typeof item.stock === "number" && item.stock > 0 ? (
            <span className="font-medium text-emerald-600">In stock</span>
          ) : null}
          {item.shipsFrom ? <span>Ships from {item.shipsFrom}</span> : null}
        </div>

        <button
          onClick={async () => {
            setBusy(true);
            await addToCartAction(slug, item.id, destination);
            setBusy(false);
            setAdded(true);
            setTimeout(() => setAdded(false), 1800);
          }}
          disabled={busy}
          className={`mt-4 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition ${added ? "bg-emerald-600" : "bg-[#0B0D12] hover:bg-violet-700"}`}
        >
          {added ? "✓ Added" : busy ? "Adding…" : "Add to basket"}
        </button>
      </div>
    </article>
  );
}
