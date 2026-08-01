"use client";

import { useMemo, useState, useTransition } from "react";
import { MARKETPLACE_LIST } from "@/lib/listing-marketplaces";
import { createBatchAction } from "@/app/dashboard/l/[locationId]/listings/actions";
import { cn } from "@/lib/utils";

type PickProduct = { id: string; name: string; price: number; imageUrl: string | null; category: string | null };

export function ListingBatchBuilder({ locationId, products }: { locationId: string; products: PickProduct[] }) {
  const [marketplace, setMarketplace] = useState("PLACID_CONNECT");
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const allOn = products.length > 0 && selected.size === products.length;
  const active = useMemo(() => MARKETPLACE_LIST.find((m) => m.key === marketplace), [marketplace]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const create = () => {
    setError("");
    if (selected.size === 0) { setError("Tick at least one product."); return; }
    start(async () => {
      const r = await createBatchAction(locationId, marketplace, name, Array.from(selected));
      // Success redirects; only a failure returns here.
      if (r && !r.ok) setError(r.message);
    });
  };

  return (
    <div className="space-y-4">
      {/* Marketplace + name */}
      <div className="card p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Marketplace</label>
            <div className="flex flex-wrap gap-1.5">
              {MARKETPLACE_LIST.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMarketplace(m.key)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    marketplace === m.key ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:bg-slate-50",
                  )}
                >
                  {m.label}
                  {!m.available ? <span className="ml-1 text-[9px] uppercase text-slate-400">draft now</span> : null}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="bname">Batch name (optional)</label>
            <input id="bname" value={name} onChange={(e) => setName(e.target.value)} placeholder={`${active?.label ?? ""} batch`} className="input h-9 text-sm" />
          </div>
        </div>
        {active ? (
          <p className="mt-2 text-xs text-slate-500">
            {active.blurb}
            {!active.available ? (
              <span className="ml-1 font-medium text-brand-600">Draft &amp; AI-optimise now — one-click publish to {active.label} is coming soon.</span>
            ) : null}
          </p>
        ) : null}
      </div>

      {/* Product picker */}
      <div className="card overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={allOn}
              onChange={(e) => setSelected(e.target.checked ? new Set(products.map((p) => p.id)) : new Set())}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Select all shown
          </label>
          <span className="text-xs text-slate-400">{selected.size} selected</span>
        </div>

        {products.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-slate-400">No products match — adjust the filter above.</p>
        ) : (
          <ul className="max-h-[52vh] divide-y divide-slate-50 overflow-y-auto">
            {products.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400">🛍</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-800">{p.name}</span>
                    <span className="text-[11px] text-slate-400">{p.category || "Uncategorised"}</span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-slate-500">${p.price.toFixed(2)}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="flex items-center gap-3">
        <button onClick={create} disabled={pending || selected.size === 0} className="btn-primary disabled:opacity-50">
          {pending ? "Creating…" : `Create batch (${selected.size})`}
        </button>
        <span className="text-xs text-slate-400">Drafts for any marketplace; publishing is live for Placid Connect.</span>
      </div>
    </div>
  );
}
