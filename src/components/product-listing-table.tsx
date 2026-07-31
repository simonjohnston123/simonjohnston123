"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CHANNELS } from "@/lib/channels";
import { marketToChannelAction, type ProductFilter } from "@/app/dashboard/l/[locationId]/products/listing-actions";

export type ListingProduct = {
  id: string;
  name: string;
  sku: string | null;
  imageUrl: string | null;
  category: string | null;
  warehouse: string | null;
  supplier: string | null;
  priceCents: number | null;
  price: number | null;
  inventory: number | null;
  channels: string[];
};

const CHANNEL_LABEL: Record<string, string> = Object.fromEntries(CHANNELS.map((c) => [c.key, c.label]));

function money(cents: number | null, dollars: number | null): string {
  if (cents != null) return `$${(cents / 100).toFixed(2)}`;
  if (dollars != null) return `$${dollars}`;
  return "—";
}

export function ProductListingTable({
  locationId,
  base,
  products,
  filter,
  count,
}: {
  locationId: string;
  base: string;
  products: ListingProduct[];
  filter: ProductFilter;
  count: number;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  const pageIds = products.map((p) => p.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const activeCount = allMatching ? count : selected.size;

  const toggle = (id: string) => {
    setAllMatching(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const togglePage = () => {
    setAllMatching(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPage) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };
  const clearSel = () => { setSelected(new Set()); setAllMatching(false); };

  const market = (channelKey: string) => {
    start(async () => {
      setMsg(null);
      const target = allMatching ? { allMatching: filter } : { ids: Array.from(selected) };
      const r = await marketToChannelAction(locationId, channelKey, target);
      setMsg(r.message);
      if (r.ok) { clearSel(); router.refresh(); }
    });
  };

  return (
    <>
      {/* Bulk market-to-channel bar */}
      {activeCount > 0 ? (
        <div className="sticky top-2 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50/80 p-3 shadow-sm backdrop-blur">
          <span className="text-sm font-semibold text-brand-800">{activeCount} selected</span>
          {!allMatching && count > products.length ? (
            <button onClick={() => setAllMatching(true)} className="text-xs text-brand-600 underline">Select all {count} matching</button>
          ) : null}
          <span className="text-sm text-slate-500">→ Market to:</span>
          {CHANNELS.filter((c) => c.key !== "shopify").map((c) => (
            <button key={c.key} disabled={pending} onClick={() => market(c.key)} className="btn-secondary text-xs disabled:opacity-50">
              {c.icon} {c.label}
            </button>
          ))}
          <button onClick={clearSel} className="ml-auto text-xs text-slate-400 hover:text-slate-600">Clear</button>
          {msg ? <span className="w-full text-xs text-slate-600">{msg}</span> : null}
        </div>
      ) : msg ? (
        <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{msg}</p>
      ) : null}

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
              <th className="w-8 px-3 py-2">
                <input type="checkbox" checked={allOnPage} onChange={togglePage} aria-label="Select page" />
              </th>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Ships from</th>
              <th className="px-3 py-2 font-medium">Price</th>
              <th className="px-3 py-2 font-medium">Stock</th>
              <th className="px-3 py-2 font-medium">Channels</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const isSel = allMatching || selected.has(p.id);
              return (
                <tr key={p.id} className={`border-b border-slate-50 last:border-0 ${isSel ? "bg-brand-50/40" : "hover:bg-slate-50/60"}`}>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={isSel} disabled={allMatching} onChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} />
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`${base}/${p.id}`} className="flex items-center gap-3">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                      ) : (
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded bg-slate-100 text-xs text-slate-400">—</span>
                      )}
                      <span className="min-w-0">
                        <span className="block max-w-[320px] truncate font-medium text-slate-800">{p.name}</span>
                        {p.sku ? <span className="block truncate font-mono text-[11px] text-slate-400">{p.sku}</span> : null}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{p.category || <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-2">
                    {p.warehouse ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">{p.warehouse}</span>
                        {p.supplier ? <span className="max-w-[110px] truncate text-[11px] text-slate-400">{p.supplier}</span> : null}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2 font-semibold text-slate-900">{money(p.priceCents, p.price)}</td>
                  <td className="px-3 py-2 text-slate-600">{p.inventory ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap gap-1">
                      {p.channels.length === 0 ? <span className="text-xs text-slate-300">none</span> : p.channels.map((ch) => (
                        <span key={ch} className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">{CHANNEL_LABEL[ch] ?? ch}</span>
                      ))}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
