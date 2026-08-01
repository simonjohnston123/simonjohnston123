"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type LiveProduct = { id: string; name: string; priceCents: number; imageUrl: string | null; description: string | null; channel: string; stock: number | null };
type Channel = { slug: string; label: string; count: number; icon?: string };
type CartLine = { p: LiveProduct; qty: number };
type Msg = { role: "you" | "host"; text: string };
type Show = { day: number; name: string; emoji: string; color: string; tag: string };

const money = (cents: number) => (cents === 0 ? "Free" : `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`);

// One themed live show per night — all at 6:00 PM. getDay(): 0=Sun … 6=Sat.
const SHOWS: Show[] = [
  { day: 1, name: "Mad Mondays", emoji: "🤪", color: "#ef4444", tag: "Doorbuster deals to kick off the week" },
  { day: 2, name: "Terrific Tuesdays", emoji: "🎉", color: "#f59e0b", tag: "Top picks at terrific prices" },
  { day: 3, name: "Wild Wednesday", emoji: "🐯", color: "#10b981", tag: "Wild bundles & surprise drops" },
  { day: 4, name: "Thrilling Thursday", emoji: "⚡", color: "#3b82f6", tag: "Flash deals every few minutes" },
  { day: 5, name: "Freaky Fridays", emoji: "👻", color: "#8b5cf6", tag: "Freakishly good weekend savings" },
  { day: 6, name: "Sharp Saturdays", emoji: "🔪", color: "#ec4899", tag: "Sharpest prices of the week" },
  { day: 0, name: "Slow Sundays", emoji: "🌙", color: "#14b8a6", tag: "Slow down & shop the calm deals" },
];
const DAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function SiteLiveShopping({ locationId, primaryColor }: { locationId: string; primaryColor: string }) {
  const accent = primaryColor || "#7c3aed";
  const [data, setData] = useState<{ channels: Channel[]; products: LiveProduct[] } | null>(null);
  const [view, setView] = useState<"schedule" | "live" | "shop">("schedule");
  const [show, setShow] = useState<Show | null>(null);
  const [searchResults, setSearchResults] = useState<LiveProduct[] | null>(null);
  const [searchShow, setSearchShow] = useState<Show | null>(null);
  const [searching, setSearching] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [placed, setPlaced] = useState<{ number: number } | null>(null);
  const [checkoutErr, setCheckoutErr] = useState("");

  useEffect(() => {
    setNow(new Date());
    fetch(`/api/live/products?locationId=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((j) => setData({ channels: j.channels ?? [], products: j.products ?? [] }))
      .catch(() => setData({ channels: [], products: [] }));
    try { const raw = localStorage.getItem(`pd_live_cart_${locationId}`); if (raw) setCart(JSON.parse(raw)); } catch {}
  }, [locationId]);
  useEffect(() => { try { localStorage.setItem(`pd_live_cart_${locationId}`, JSON.stringify(cart)); } catch {} }, [cart, locationId]);

  const products = data?.products ?? [];
  const cartArr = Object.values(cart);
  const cartCount = cartArr.reduce((n, l) => n + l.qty, 0);
  const cartTotal = cartArr.reduce((n, l) => n + l.p.priceCents * l.qty, 0);

  const addToCart = (p: LiveProduct) => setCart((c) => ({ ...c, [p.id]: { p, qty: (c[p.id]?.qty ?? 0) + 1 } }));
  const setQty = (id: string, qty: number) => setCart((c) => { const n = { ...c }; if (qty <= 0) delete n[id]; else if (n[id]) n[id] = { ...n[id], qty }; return n; });

  async function checkout(form: HTMLFormElement) {
    setCheckoutErr("");
    const fd = new FormData(form);
    const res = await fetch("/api/live/order", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ locationId, cart: cartArr.map((l) => ({ productId: l.p.id, qty: l.qty })), name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone"), address: fd.get("address") }),
    });
    const j = await res.json();
    if (!res.ok) { setCheckoutErr(j.error || "Something went wrong."); return; }
    setPlaced({ number: j.number ?? 0 }); setCart({});
  }

  async function runSearch(q: string) {
    const query = q.trim();
    if (query.length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/live/search?locationId=${encodeURIComponent(locationId)}&q=${encodeURIComponent(query)}`);
      const j = await res.json();
      setSearchResults(j.products ?? []);
      setSearchShow({ day: -1, name: query, emoji: "🔎", color: accent, tag: `Live results for "${query}"` });
      setShow(null);
      setView("live");
    } catch { setSearchResults([]); }
    setSearching(false);
  }
  const clearSearch = () => { setSearchResults(null); setSearchShow(null); };

  const todayDay = now ? now.getDay() : -1;
  const hour = now ? now.getHours() : 0;
  const isLiveNow = (s: Show) => s.day === todayDay && hour >= 18;
  const isTonight = (s: Show) => s.day === todayDay && hour < 18;
  const tonights = SHOWS.find((s) => s.day === todayDay) ?? null;

  const cartButton = (
    <button onClick={() => setCartOpen(true)} className="relative rounded-full bg-white/10 px-3 py-2 text-sm text-white backdrop-blur hover:bg-white/20">🛒
      {cartCount > 0 ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold text-white" style={{ background: accent }}>{cartCount}</span> : null}
    </button>
  );

  return (
    <div className="w-full bg-slate-950 text-white">
      {view === "schedule" ? (
        <ScheduleView shows={SHOWS} isLiveNow={isLiveNow} isTonight={isTonight} tonights={tonights} accent={accent}
          onWatch={(s) => { clearSearch(); setShow(s); setView("live"); }} onShop={() => setView("shop")} onSearch={runSearch} searching={searching} cartButton={cartButton} />
      ) : view === "shop" ? (
        <ShopView products={products} channels={data?.channels ?? []} accent={accent} loading={!data}
          addToCart={addToCart} openCart={() => setCartOpen(true)} onBack={() => setView("schedule")} onLive={() => setView(show || searchShow ? "live" : "schedule")} cartButton={cartButton} />
      ) : (
        <LivePlayer products={searchResults ?? products} channels={data?.channels ?? []} show={searchShow ?? show} live={searchResults ? true : show ? isLiveNow(show) : false} accent={accent}
          addToCart={addToCart} openCart={() => setCartOpen(true)} onSchedule={() => { clearSearch(); setView("schedule"); }} onShop={() => setView("shop")} onSearch={runSearch} searching={searching} cartButton={cartButton} locationId={locationId} />
      )}

      {cartOpen ? (
        <Drawer title={placed ? "Order placed 🎉" : `Your cart · ${cartCount} item${cartCount === 1 ? "" : "s"}`} onClose={() => { setCartOpen(false); setPlaced(null); }}>
          {placed ? (
            <div className="py-6 text-center"><div className="text-4xl">🎉</div>
              <p className="mt-3 text-sm text-slate-200">Thanks! Your order is in{placed.number ? ` (#${placed.number})` : ""}. We&apos;ll confirm delivery &amp; payment shortly.</p>
              <button onClick={() => { setCartOpen(false); setPlaced(null); }} className="mt-4 rounded-full px-5 py-2 text-sm font-semibold text-white" style={{ background: accent }}>Keep shopping</button>
            </div>
          ) : cartCount === 0 ? <p className="py-10 text-center text-sm text-slate-400">Your cart is empty.</p> : (
            <>
              <div className="space-y-2">
                {cartArr.map(({ p, qty }) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2">
                    {p.imageUrl ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={p.imageUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />) : null}
                    <div className="min-w-0 flex-1"><div className="truncate text-sm">{p.name}</div><div className="text-sm font-semibold" style={{ color: accent }}>{money(p.priceCents)}</div></div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setQty(p.id, qty - 1)} className="grid h-7 w-7 place-items-center rounded-full bg-white/10">–</button>
                      <span className="w-5 text-center text-sm tabular-nums">{qty}</span>
                      <button onClick={() => setQty(p.id, qty + 1)} className="grid h-7 w-7 place-items-center rounded-full bg-white/10">+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-sm"><span className="text-slate-300">Total</span><span className="text-lg font-bold">{money(cartTotal)}</span></div>
              <form onSubmit={(e) => { e.preventDefault(); checkout(e.currentTarget); }} className="mt-3 space-y-2">
                <input name="name" placeholder="Full name" className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm outline-none placeholder:text-slate-400" />
                <div className="grid grid-cols-2 gap-2">
                  <input name="email" type="email" placeholder="Email" className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm outline-none placeholder:text-slate-400" />
                  <input name="phone" placeholder="Phone (optional)" className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm outline-none placeholder:text-slate-400" />
                </div>
                <textarea name="address" rows={2} placeholder="Delivery address" className="w-full resize-none rounded-lg bg-white/10 px-3 py-2 text-sm outline-none placeholder:text-slate-400" />
                {checkoutErr ? <p className="text-xs text-red-400">{checkoutErr}</p> : null}
                <button className="w-full rounded-xl py-3 text-sm font-bold text-white" style={{ background: accent }}>Place order · {money(cartTotal)}</button>
                <p className="text-center text-[11px] text-slate-400">Secure card payment is being switched on — your order is reserved and confirmed by the store.</p>
              </form>
            </>
          )}
        </Drawer>
      ) : null}
    </div>
  );
}

/* ---------------- Schedule (TV guide) ---------------- */
function ScheduleView({ shows, isLiveNow, isTonight, tonights, accent, onWatch, onShop, onSearch, searching, cartButton }: {
  shows: Show[]; isLiveNow: (s: Show) => boolean; isTonight: (s: Show) => boolean; tonights: Show | null; accent: string;
  onWatch: (s: Show) => void; onShop: () => void; onSearch: (q: string) => void; searching: boolean; cartButton: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><span className="animate-pulse rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold">● LIVE</span><span className="text-xs text-slate-400">A different show every night · 6:00 PM</span></div>
          <h2 className="mt-1 text-3xl font-extrabold sm:text-4xl">Placid Deals Live</h2>
        </div>
        <div className="flex items-center gap-2">
          {cartButton}
          <button onClick={onShop} className="rounded-full px-4 py-2 text-sm font-bold text-white" style={{ background: accent }}>🛍 Shop now →</button>
        </div>
      </div>

      {/* Intent search — spin up a live channel of exactly what they want */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-2 text-sm font-semibold">🔎 What are you shopping for? <span className="font-normal text-slate-400">We&apos;ll play it live.</span></div>
        <SearchBar accent={accent} searching={searching} onSearch={onSearch} big />
      </div>

      {tonights ? (
        <button onClick={() => onWatch(tonights)} className="mb-6 block w-full overflow-hidden rounded-2xl border border-white/10 text-left" style={{ background: `linear-gradient(135deg, ${tonights.color}33, #0f172a)` }}>
          <div className="flex items-center gap-4 p-5">
            <div className="text-5xl">{tonights.emoji}</div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: tonights.color }}>{isLiveNow(tonights) ? "● Live now" : "Tonight · 6:00 PM"}</div>
              <div className="truncate text-2xl font-bold">{tonights.name}</div>
              <div className="truncate text-sm text-slate-300">{tonights.tag}</div>
            </div>
            <span className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-900">{isLiveNow(tonights) ? "Watch now" : "Preview"}</span>
          </div>
        </button>
      ) : null}

      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">This week&apos;s line-up</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shows.map((s) => {
          const live = isLiveNow(s); const tonight = isTonight(s);
          return (
            <button key={s.day} onClick={() => onWatch(s)} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:bg-white/[0.06]">
              <div className="flex items-center justify-between">
                <span className="text-3xl">{s.emoji}</span>
                {live ? <span className="animate-pulse rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold">● LIVE</span>
                  : tonight ? <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: s.color }}>TONIGHT</span>
                  : <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-300">{DAY_LABEL[s.day]}</span>}
              </div>
              <div className="mt-2 text-lg font-bold">{s.name}</div>
              <div className="text-xs text-slate-400">{s.tag}</div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">🕕 6:00 PM</span>
                <span className="rounded-full px-3 py-1 text-xs font-bold text-white transition group-hover:brightness-110" style={{ background: s.color }}>{live ? "Watch" : "Set reminder"}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Shop (normal storefront) ---------------- */
function ShopView({ products, channels, accent, loading, addToCart, openCart, onBack, onLive, cartButton }: {
  products: LiveProduct[]; channels: Channel[]; accent: string; loading: boolean;
  addToCart: (p: LiveProduct) => void; openCart: () => void; onBack: () => void; onLive: () => void; cartButton: React.ReactNode;
}) {
  const [cat, setCat] = useState("all");
  const list = cat === "all" ? products : products.filter((p) => p.channel === cat);
  return (
    <div className="min-h-[70vh] bg-white text-slate-900">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <button onClick={onBack} className="text-sm font-medium text-slate-500 hover:text-slate-900">‹ Live shows</button>
          <div className="font-extrabold" style={{ color: accent }}>Shop Placid Deals</div>
          <div className="flex items-center gap-2">
            <button onClick={onLive} className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">📺 Watch live</button>
            <div className="[&_button]:bg-slate-100 [&_button]:text-slate-900 [&_button:hover]:bg-slate-200">{cartButton}</div>
          </div>
        </div>
        <div className="mx-auto -mt-1 flex max-w-6xl gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[{ slug: "all", label: "All", count: products.length } as Channel, ...channels].map((c) => (
            <button key={c.slug} onClick={() => setCat(c.slug)} className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${cat === c.slug ? "border-transparent text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`} style={cat === c.slug ? { background: accent } : undefined}>{c.icon ? `${c.icon} ` : ""}{c.label}</button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {loading ? <p className="py-16 text-center text-slate-400">Loading products…</p> : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {list.map((p) => (
              <div key={p.id} className="flex flex-col overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
                {p.imageUrl ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={p.imageUrl} alt={p.name} className="h-40 w-full object-cover" />) : <div className="grid h-40 w-full place-items-center bg-slate-100 text-2xl">🛍</div>}
                <div className="flex flex-1 flex-col p-3">
                  <div className="line-clamp-2 text-sm font-medium">{p.name}</div>
                  <div className="mt-1 text-base font-bold" style={{ color: accent }}>{money(p.priceCents)}</div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button onClick={() => addToCart(p)} className="rounded-lg py-2 text-xs font-semibold text-white" style={{ background: accent }}>Add to cart</button>
                    <button onClick={() => { addToCart(p); openCart(); }} className="rounded-lg border py-2 text-xs font-semibold" style={{ borderColor: accent, color: accent }}>Buy now</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Live player (immersive) ---------------- */
function LivePlayer({ products, channels, show, live, accent, addToCart, openCart, onSchedule, onShop, onSearch, searching, cartButton }: {
  products: LiveProduct[]; channels: Channel[]; show: Show | null; live: boolean; accent: string;
  addToCart: (p: LiveProduct) => void; openCart: () => void; onSchedule: () => void; onShop: () => void; onSearch: (q: string) => void; searching: boolean; cartButton: React.ReactNode; locationId: string;
}) {
  const [activeCh, setActiveCh] = useState("all");
  const [idx, setIdx] = useState(0);
  const [panel, setPanel] = useState<null | "shelf" | "ai">(null);
  const [added, setAdded] = useState(false);
  const [viewers, setViewers] = useState(0);
  const [ai, setAi] = useState<{ msgs: Msg[]; input: string; loading: boolean }>({ msgs: [], input: "", loading: false });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => setViewers(80 + Math.floor(Math.random() * 900)), []);

  const list = useMemo(() => (activeCh === "all" ? products : products.filter((p) => p.channel === activeCh)), [activeCh, products]);
  const current = list[Math.min(idx, Math.max(0, list.length - 1))] ?? null;
  useEffect(() => setIdx(0), [activeCh]);
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (panel === null && list.length > 1) timer.current = setInterval(() => setIdx((p) => (p + 1) % list.length), 9000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [panel, list.length]);

  function add(p: LiveProduct) { addToCart(p); setAdded(true); setTimeout(() => setAdded(false), 1100); }
  async function askAI(q: string) {
    const question = q.trim(); if (!question || !current) return;
    setAi((a) => ({ ...a, msgs: [...a.msgs, { role: "you", text: question }], input: "", loading: true }));
    try { const res = await fetch("/api/live/qa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId: current.id, question }) }); const j = await res.json();
      setAi((a) => ({ ...a, msgs: [...a.msgs, { role: "host", text: j.answer || "Let me get back to you!" }], loading: false })); }
    catch { setAi((a) => ({ ...a, msgs: [...a.msgs, { role: "host", text: "Connection hiccup — try again." }], loading: false })); }
  }

  if (!current)
    return (
      <div className="grid h-[70vh] place-items-center bg-slate-950 px-6 text-center text-slate-300">
        <div className="w-full max-w-md">
          <div className="text-4xl">{searching ? "⏳" : "🔎"}</div>
          <p className="mt-3 text-sm">
            {searching ? "Finding live deals…" : show && show.day < 0 ? `Nothing matched “${show.name}” — try another word.` : "No products in this channel yet."}
          </p>
          {!searching ? (
            <>
              <div className="mt-4"><SearchBar accent={accent} searching={searching} onSearch={onSearch} big /></div>
              <button onClick={onSchedule} className="mt-4 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20">‹ Back to shows</button>
            </>
          ) : null}
        </div>
      </div>
    );
  const present = new Set(products.map((p) => p.channel));
  const pills = [{ slug: "all", label: "All", count: products.length } as Channel, ...channels.filter((c) => present.has(c.slug))];

  return (
    <div className="relative flex h-[88vh] min-h-[600px] w-full select-none flex-col overflow-hidden bg-slate-950 text-white">
      {current.imageUrl ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={current.imageUrl} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-2xl" />) : null}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between gap-2 px-4 pt-3">
        <div className="flex items-center gap-2">
          <button onClick={onSchedule} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur hover:bg-white/20">‹ Shows</button>
          {live ? <span className="animate-pulse rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold">● LIVE</span> : <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold">PREVIEW</span>}
          <span className="hidden rounded-full bg-black/40 px-2.5 py-0.5 text-xs backdrop-blur sm:inline">👁 {viewers.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onShop} className="rounded-full bg-white/10 px-3 py-2 text-sm backdrop-blur hover:bg-white/20">🛍</button>
          {cartButton}
        </div>
      </div>

      {/* Show + search + channels */}
      <div className="relative z-10 px-4 pt-2">
        {show ? <div className="flex items-center gap-2"><span className="text-base">{show.emoji}</span><span className="truncate text-sm font-bold" style={{ color: show.color }}>{show.name}</span>{!live && show.day >= 0 ? <span className="shrink-0 text-[11px] text-slate-400">· airs {DAY_LABEL[show.day]} 6:00 PM</span> : null}</div> : null}
        <div className="mt-2"><SearchBar accent={accent} searching={searching} onSearch={onSearch} /></div>
        <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {pills.map((c) => <button key={c.slug} onClick={() => setActiveCh(c.slug)} className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur transition ${activeCh === c.slug ? "border-white/0 bg-white text-slate-900" : "border-white/15 bg-black/30 text-white hover:bg-black/50"}`}>{c.icon ? `${c.icon} ` : ""}{c.label}</button>)}
        </div>
      </div>

      {/* Stage — image contained in the remaining space */}
      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-4 py-3">
        {current.imageUrl ? (/* eslint-disable-next-line @next/next/no-img-element */ <img key={current.id} src={current.imageUrl} alt={current.name} className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl" />) : <div className="grid h-48 w-48 place-items-center rounded-2xl bg-white/5 text-6xl">🛍</div>}
      </div>

      {/* Bottom — product + actions (always visible) */}
      <div className="relative z-10 px-4 pb-4">
        <div className="mb-2 flex justify-center gap-1">{list.slice(0, 12).map((_, j) => <span key={j} className={`h-1 rounded-full transition-all ${j === Math.min(idx, 11) ? "w-6 bg-white" : "w-1.5 bg-white/30"}`} />)}</div>
        <div className="mx-auto max-w-xl">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold leading-tight">{current.name}</h2>
              <div className="flex items-center gap-2"><span className="text-2xl font-extrabold" style={{ color: accent }}>{money(current.priceCents)}</span>{current.stock != null && current.stock <= 5 ? <span className="rounded-full bg-orange-500/90 px-2 py-0.5 text-[11px] font-semibold">Only {current.stock} left</span> : null}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 text-xs text-slate-300">
              <button onClick={() => setIdx((p) => (p - 1 + list.length) % list.length)} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 hover:bg-white/20">‹</button>
              <span className="tabular-nums">{Math.min(idx + 1, list.length)}/{list.length}</span>
              <button onClick={() => setIdx((p) => (p + 1) % list.length)} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 hover:bg-white/20">›</button>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button onClick={() => add(current)} className="flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white transition" style={{ background: added ? "#22c55e" : accent }}>{added ? "✓ Added" : "🛒 Add to cart"}</button>
            <button onClick={() => { addToCart(current); openCart(); }} className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100">Buy now</button>
            <button onClick={() => setPanel("ai")} aria-label="Ask AI" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-lg hover:bg-white/20">💬</button>
            <button onClick={() => setPanel("shelf")} aria-label="Shop channel" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-lg hover:bg-white/20">🛍</button>
          </div>
        </div>
      </div>

      {panel === "shelf" ? (
        <Drawer title={`Shop the ${pills.find((c) => c.slug === activeCh)?.label} channel`} onClose={() => setPanel(null)}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {list.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                <button onClick={() => { const i = list.findIndex((x) => x.id === p.id); if (i >= 0) setIdx(i); setPanel(null); }} className="block w-full">
                  {p.imageUrl ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={p.imageUrl} alt={p.name} className="h-28 w-full object-cover" />) : <div className="grid h-28 w-full place-items-center bg-white/5 text-2xl">🛍</div>}
                </button>
                <div className="p-2"><div className="line-clamp-2 text-[11px] font-medium text-slate-200">{p.name}</div>
                  <div className="mt-1 flex items-center justify-between"><span className="text-xs font-bold" style={{ color: accent }}>{money(p.priceCents)}</span><button onClick={() => add(p)} className="rounded-full px-2 py-1 text-[11px] font-semibold text-white" style={{ background: accent }}>+ Cart</button></div>
                </div>
              </div>
            ))}
          </div>
        </Drawer>
      ) : null}

      {panel === "ai" ? (
        <Drawer title="Ask about this product" onClose={() => setPanel(null)}>
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2">
            {current.imageUrl ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={current.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />) : null}
            <div className="min-w-0"><div className="truncate text-sm">{current.name}</div><div className="text-xs" style={{ color: accent }}>{money(current.priceCents)}</div></div>
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {ai.msgs.length === 0 ? <div className="space-y-2"><p className="text-xs text-slate-400">Ask anything — try one:</p>{["What are the dimensions?", "Does it ship to me?", "Is it in stock?"].map((s) => <button key={s} onClick={() => askAI(s)} className="mr-2 mb-2 rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs hover:bg-white/10">{s}</button>)}</div>
              : ai.msgs.map((m, i) => <div key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === "you" ? "ml-auto text-white" : "bg-white/10"}`} style={m.role === "you" ? { background: accent } : undefined}>{m.text}</div>)}
            {ai.loading ? <div className="w-16 rounded-2xl bg-white/10 px-3 py-2 text-sm">…</div> : null}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); askAI(ai.input); }} className="mt-3 flex gap-2">
            <input value={ai.input} onChange={(e) => setAi((a) => ({ ...a, input: e.target.value }))} placeholder="Type your question…" className="flex-1 rounded-full bg-white/10 px-4 py-2.5 text-sm outline-none placeholder:text-slate-400" />
            <button className="rounded-full px-4 py-2.5 text-sm font-semibold text-white" style={{ background: accent }}>Ask</button>
          </form>
        </Drawer>
      ) : null}
    </div>
  );
}

function SearchBar({ accent, searching, onSearch, big }: { accent: string; searching: boolean; onSearch: (q: string) => void; big?: boolean }) {
  const [q, setQ] = useState("");
  const chips = ["Earbuds", "Air fryer", "Dog bed", "Coffee", "Kids toys", "Power tools", "Skincare", "Camping"];
  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); onSearch(q); }} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. earbuds, air fryer, dog bed…" className={`min-w-0 flex-1 rounded-full bg-white/10 px-4 ${big ? "py-3" : "py-2"} text-sm text-white outline-none placeholder:text-slate-400`} />
        <button className="shrink-0 rounded-full px-4 py-2 text-sm font-bold text-white" style={{ background: accent }}>{searching ? "…" : "Play live"}</button>
      </form>
      {big ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {chips.map((c) => <button key={c} type="button" onClick={() => onSearch(c)} className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1 text-xs text-slate-200 hover:bg-white/10">{c}</button>)}
        </div>
      ) : null}
    </div>
  );
}

function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative z-10 max-h-[82vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-950 p-4 pb-8 text-white shadow-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div className="mb-3 flex items-center justify-between"><h3 className="text-base font-bold">{title}</h3><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 hover:bg-white/20">✕</button></div>
        {children}
      </div>
    </div>
  );
}
