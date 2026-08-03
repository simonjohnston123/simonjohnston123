"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sourcingSearchAction, sourcingImportAction } from "@/app/dashboard/l/[locationId]/sourcing/actions";
import type { DzItem } from "@/lib/dropshipzone";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

// Placid Sourcing — browse the supplier catalogue (white-labelled), tick
// products, import into this business's catalogue with market stamping.
export function SourcingBrowser({ locationId, ready }: { locationId: string; ready: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<"au" | "us">("au");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<DzItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [sel, setSel] = useState<Record<string, DzItem>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(newPage = 1) {
    setPage(newPage); setMsg(null);
    start(async () => {
      const r = await sourcingSearchAction(locationId, q, newPage);
      if (r.error) setMsg(r.error);
      setItems(r.items as DzItem[]);
      setTotalPages(r.totalPages || 1);
    });
  }

  useEffect(() => { if (ready) run(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ready, locationId]);

  const selected = Object.values(sel);
  function toggle(it: DzItem) {
    setSel((s) => { const n = { ...s }; if (n[it.sku]) delete n[it.sku]; else n[it.sku] = it; return n; });
  }

  function importSelected() {
    start(async () => {
      const r = await sourcingImportAction(locationId, selected);
      if (r.error) { setMsg(r.error); return; }
      setMsg(`✓ Imported ${r.imported} product${r.imported === 1 ? "" : "s"}${r.skipped ? ` (${r.skipped} already in your catalogue)` : ""} — they're in Products now, stamped ships-AU.`);
      setSel({});
      router.refresh();
    });
  }

  return (
    <div>
      {/* Market tabs */}
      <div className="mb-3 inline-flex rounded-xl bg-slate-100 p-1 text-sm font-semibold">
        <button onClick={() => setTab("au")} className={`rounded-lg px-4 py-2 ${tab === "au" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>🇦🇺 Australia range</button>
        <button onClick={() => setTab("us")} className={`rounded-lg px-4 py-2 ${tab === "us" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>🇺🇸 US range</button>
      </div>

      {tab === "us" ? (
        <div className="card p-8 text-center text-sm text-slate-500">
          🇺🇸 The US range (ships from US warehouses) is being connected — your 2,870 already-sourced US products will appear here first.
        </div>
      ) : !ready ? (
        <div className="card p-8 text-center text-sm text-slate-500">Sourcing supplier isn&apos;t connected on the platform yet.</div>
      ) : (
        <>
          <div className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(1)} placeholder="Search the sourcing range… e.g. air fryer, desk, dog bed" className="flex-1 rounded-full border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand-400" />
            <button onClick={() => run(1)} disabled={pending} className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{pending ? "…" : "Search"}</button>
          </div>
          <p className="mt-1 text-xs text-slate-400">Ships within Australia · imports are stamped <strong>ships-AU</strong> automatically · retail auto-priced at 1.7× cost (editable after import)</p>

          {msg ? <p className={`mt-2 text-sm font-semibold ${msg.startsWith("✓") ? "text-emerald-600" : "text-red-600"}`}>{msg}</p> : null}

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((it) => {
              const retail = Math.round((it.costCents * 1.7) / 100) * 100;
              const on = !!sel[it.sku];
              return (
                <button key={it.sku} onClick={() => toggle(it)} className={`relative overflow-hidden rounded-xl border text-left transition ${on ? "border-transparent ring-2 ring-brand-400" : "border-slate-200 hover:border-slate-300"}`}>
                  {on ? <span className="absolute right-2 top-2 z-10 grid h-6 w-6 place-items-center rounded-full bg-brand-gradient text-xs font-bold text-white">✓</span> : null}
                  {it.image ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={it.image} alt="" className="h-32 w-full object-cover" />) : <div className="grid h-32 w-full place-items-center bg-slate-100 text-2xl">📦</div>}
                  <div className="p-2">
                    <div className="line-clamp-2 text-xs font-medium text-slate-800">{it.title}</div>
                    <div className="mt-1 flex items-baseline justify-between text-xs">
                      <span className="text-slate-400">cost {money(it.costCents)}</span>
                      <span className="font-bold text-slate-900">sell {money(retail)}</span>
                    </div>
                    <div className="flex items-baseline justify-between text-[11px]">
                      <span className="text-emerald-600">margin {money(retail - it.costCents)}</span>
                      <span className="text-slate-400">{it.stock} in stock</span>
                    </div>
                  </div>
                </button>
              );
            })}
            {!items.length && !pending ? <p className="col-span-full py-10 text-center text-sm text-slate-400">No results — try another search.</p> : null}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-2">
              <button onClick={() => run(Math.max(1, page - 1))} disabled={pending || page <= 1} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40">‹ Prev</button>
              <span className="py-1.5 text-sm text-slate-500">Page {page}{totalPages > 1 ? ` / ${totalPages}` : ""}</span>
              <button onClick={() => run(page + 1)} disabled={pending || page >= totalPages} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40">Next ›</button>
            </div>
            <button onClick={importSelected} disabled={pending || !selected.length} className="rounded-xl bg-brand-gradient px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">
              ⬇ Import {selected.length || ""} selected
            </button>
          </div>
        </>
      )}
    </div>
  );
}
