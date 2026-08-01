"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type LiveProduct = { id: string; name: string; priceCents: number; imageUrl: string | null; description: string | null; channel: string; stock: number | null };
type Channel = { slug: string; label: string; count: number };
type CartLine = { p: LiveProduct; qty: number };
type Msg = { role: "you" | "host"; text: string };

const money = (cents: number) => (cents === 0 ? "Free" : `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`);

export function SiteLiveShopping({ locationId, primaryColor }: { locationId: string; primaryColor: string }) {
  const accent = primaryColor || "#7c3aed";
  const [data, setData] = useState<{ channels: Channel[]; products: LiveProduct[] } | null>(null);
  const [active, setActive] = useState("all");
  const [idx, setIdx] = useState(0);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [panel, setPanel] = useState<null | "shelf" | "cart" | "ai">(null);
  const [added, setAdded] = useState(false);
  const [viewers, setViewers] = useState(0);
  const [placed, setPlaced] = useState<{ number: number } | null>(null);
  const [checkoutErr, setCheckoutErr] = useState("");
  const [ai, setAi] = useState<{ msgs: Msg[]; input: string; loading: boolean }>({ msgs: [], input: "", loading: false });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch(`/api/live/products?locationId=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((j) => setData({ channels: j.channels ?? [], products: j.products ?? [] }))
      .catch(() => setData({ channels: [], products: [] }));
    try {
      const raw = localStorage.getItem(`pd_live_cart_${locationId}`);
      if (raw) setCart(JSON.parse(raw));
    } catch {}
    setViewers(80 + Math.floor(Math.random() * 900));
  }, [locationId]);

  useEffect(() => {
    try {
      localStorage.setItem(`pd_live_cart_${locationId}`, JSON.stringify(cart));
    } catch {}
  }, [cart, locationId]);

  const products = data?.products ?? [];
  const list = useMemo(() => (active === "all" ? products : products.filter((p) => p.channel === active)), [active, products]);
  const current = list[Math.min(idx, Math.max(0, list.length - 1))] ?? null;
  const cartArr = Object.values(cart);
  const cartCount = cartArr.reduce((n, l) => n + l.qty, 0);
  const cartTotal = cartArr.reduce((n, l) => n + l.p.priceCents * l.qty, 0);

  useEffect(() => setIdx(0), [active]);
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (panel === null && list.length > 1) timer.current = setInterval(() => setIdx((p) => (p + 1) % list.length), 9000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [panel, list.length]);

  function addToCart(p: LiveProduct) {
    setCart((c) => ({ ...c, [p.id]: { p, qty: (c[p.id]?.qty ?? 0) + 1 } }));
    setAdded(true);
    setTimeout(() => setAdded(false), 1100);
  }
  const setQty = (id: string, qty: number) => setCart((c) => { const n = { ...c }; if (qty <= 0) delete n[id]; else if (n[id]) n[id] = { ...n[id], qty }; return n; });
  function jumpTo(p: LiveProduct) { const i = list.findIndex((x) => x.id === p.id); if (i >= 0) setIdx(i); setPanel(null); }

  async function askAI(q: string) {
    const question = q.trim();
    if (!question || !current) return;
    setAi((a) => ({ ...a, msgs: [...a.msgs, { role: "you", text: question }], input: "", loading: true }));
    try {
      const res = await fetch("/api/live/qa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId: current.id, question }) });
      const j = await res.json();
      setAi((a) => ({ ...a, msgs: [...a.msgs, { role: "host", text: j.answer || "Let me get back to you!" }], loading: false }));
    } catch {
      setAi((a) => ({ ...a, msgs: [...a.msgs, { role: "host", text: "Connection hiccup — try again." }], loading: false }));
    }
  }

  async function checkout(form: HTMLFormElement) {
    setCheckoutErr("");
    const fd = new FormData(form);
    const res = await fetch("/api/live/order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        locationId,
        cart: cartArr.map((l) => ({ productId: l.p.id, qty: l.qty })),
        name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone"), address: fd.get("address"),
      }),
    });
    const j = await res.json();
    if (!res.ok) { setCheckoutErr(j.error || "Something went wrong."); return; }
    setPlaced({ number: j.number ?? 0 });
    setCart({});
  }

  if (!data) return <div className="grid h-[70vh] place-items-center bg-slate-950 text-slate-400">Loading the live channel…</div>;
  if (!current)
    return (
      <div className="grid h-[70vh] place-items-center bg-slate-950 text-center text-slate-300">
        <div><div className="text-4xl">📺</div><p className="mt-3 text-sm">No products in this channel yet.</p>
          {active !== "all" ? <button onClick={() => setActive("all")} className="mt-4 rounded-full px-5 py-2 text-sm font-semibold text-white" style={{ background: accent }}>All channels</button> : null}
        </div>
      </div>
    );

  const pills = [{ slug: "all", label: "All", count: products.length }, ...(data.channels ?? [])];

  return (
    <div className="relative h-[86vh] min-h-[560px] w-full select-none overflow-hidden bg-black text-white">
      {current.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={current.imageUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-2xl" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/90" />

      <div className="relative z-10 grid h-full place-items-center px-4 pt-28 pb-56">
        {current.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={current.id} src={current.imageUrl} alt={current.name} className="max-h-full w-auto max-w-full rounded-2xl object-contain shadow-2xl" />
        ) : <div className="grid h-64 w-64 place-items-center rounded-2xl bg-white/5 text-6xl">🛍</div>}
      </div>

      {/* Top */}
      <div className="absolute inset-x-0 top-0 z-20 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="animate-pulse rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold">● LIVE</span>
            <span className="rounded-full bg-black/40 px-2.5 py-0.5 text-xs backdrop-blur">👁 {viewers.toLocaleString()} watching</span>
          </div>
          <button onClick={() => setPanel("cart")} className="relative rounded-full bg-white/10 px-3 py-2 text-sm backdrop-blur hover:bg-white/20">🛒
            {cartCount > 0 ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold" style={{ background: accent }}>{cartCount}</span> : null}
          </button>
        </div>
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {pills.map((c) => (
            <button key={c.slug} onClick={() => setActive(c.slug)} className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur transition ${active === c.slug ? "border-white/0 bg-white text-slate-900" : "border-white/15 bg-black/30 text-white hover:bg-black/50"}`}>{c.label}</button>
          ))}
        </div>
      </div>

      {/* Bottom */}
      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/80 to-transparent p-4 pb-6">
        <div className="mb-3 flex justify-center gap-1">
          {list.slice(0, 12).map((_, j) => <span key={j} className={`h-1 rounded-full transition-all ${j === Math.min(idx, 11) ? "w-6 bg-white" : "w-1.5 bg-white/30"}`} />)}
        </div>
        <div className="mx-auto max-w-xl">
          <h2 className="text-lg font-bold leading-tight drop-shadow">{current.name}</h2>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-2xl font-extrabold drop-shadow" style={{ color: accent }}>{money(current.priceCents)}</span>
            {current.stock != null && current.stock <= 5 ? <span className="rounded-full bg-orange-500/90 px-2 py-0.5 text-[11px] font-semibold">Only {current.stock} left</span> : null}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => addToCart(current)} className="flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white transition" style={{ background: added ? "#22c55e" : accent }}>{added ? "✓ Added to cart" : "🛒 Add to cart"}</button>
            <button onClick={() => { addToCart(current); setPanel("cart"); }} className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100">Buy now</button>
            <button onClick={() => setPanel("ai")} aria-label="Ask AI" className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-lg backdrop-blur hover:bg-white/20">💬</button>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
            <button onClick={() => setPanel("shelf")} className="rounded-full bg-white/10 px-3 py-1.5 font-medium backdrop-blur hover:bg-white/20">🛍 Shop this channel</button>
            <div className="flex items-center gap-2">
              <button onClick={() => setIdx((p) => (p - 1 + list.length) % list.length)} aria-label="Prev" className="grid h-8 w-8 place-items-center rounded-full bg-white/10 backdrop-blur hover:bg-white/20">‹</button>
              <span className="tabular-nums">{Math.min(idx + 1, list.length)}/{list.length}</span>
              <button onClick={() => setIdx((p) => (p + 1) % list.length)} aria-label="Next" className="grid h-8 w-8 place-items-center rounded-full bg-white/10 backdrop-blur hover:bg-white/20">›</button>
            </div>
          </div>
        </div>
      </div>

      {panel === "shelf" ? (
        <Drawer title={`Shop the ${pills.find((c) => c.slug === active)?.label} channel`} onClose={() => setPanel(null)}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {list.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                <button onClick={() => jumpTo(p)} className="block w-full">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} className="h-28 w-full object-cover" />
                  ) : <div className="grid h-28 w-full place-items-center bg-white/5 text-2xl">🛍</div>}
                </button>
                <div className="p-2">
                  <div className="line-clamp-2 text-[11px] font-medium text-slate-200">{p.name}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: accent }}>{money(p.priceCents)}</span>
                    <button onClick={() => addToCart(p)} className="rounded-full px-2 py-1 text-[11px] font-semibold text-white" style={{ background: accent }}>+ Cart</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Drawer>
      ) : null}

      {panel === "cart" ? (
        <Drawer title={placed ? "Order placed 🎉" : `Your cart · ${cartCount} item${cartCount === 1 ? "" : "s"}`} onClose={() => { setPanel(null); setPlaced(null); }}>
          {placed ? (
            <div className="py-6 text-center">
              <div className="text-4xl">🎉</div>
              <p className="mt-3 text-sm text-slate-200">Thanks! Your order is in{placed.number ? ` (#${placed.number})` : ""}. We&apos;ll be in touch to confirm delivery and payment.</p>
              <button onClick={() => { setPanel(null); setPlaced(null); }} className="mt-4 rounded-full px-5 py-2 text-sm font-semibold text-white" style={{ background: accent }}>Keep watching</button>
            </div>
          ) : cartCount === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Your cart is empty. Tap “Add to cart” on anything you like.</p>
          ) : (
            <>
              <div className="space-y-2">
                {cartArr.map(({ p, qty }) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
                    ) : null}
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
                <p className="text-center text-[11px] text-slate-400">Secure card payment is being switched on — your order is reserved now and confirmed by the store.</p>
              </form>
            </>
          )}
        </Drawer>
      ) : null}

      {panel === "ai" ? (
        <Drawer title="Ask about this product" onClose={() => setPanel(null)}>
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2">
            {current.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
            ) : null}
            <div className="min-w-0"><div className="truncate text-sm">{current.name}</div><div className="text-xs" style={{ color: accent }}>{money(current.priceCents)}</div></div>
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {ai.msgs.length === 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-400">Ask anything — try one:</p>
                {["What are the dimensions?", "Does it ship to me?", "Is it in stock?", "How do I care for it?"].map((s) => (
                  <button key={s} onClick={() => askAI(s)} className="mr-2 mb-2 rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs hover:bg-white/10">{s}</button>
                ))}
              </div>
            ) : ai.msgs.map((m, i) => (
              <div key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === "you" ? "ml-auto text-white" : "bg-white/10"}`} style={m.role === "you" ? { background: accent } : undefined}>{m.text}</div>
            ))}
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
