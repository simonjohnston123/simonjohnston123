"use client";

import { useMemo, useState, useTransition } from "react";
import { rulebook, feePct, type ListingField } from "@/lib/listing-marketplaces";
import {
  updateListingItemAction,
  removeListingItemAction,
  publishBatchAction,
  optimiseItemAction,
  optimiseBatchAction,
  deleteBatchAction,
} from "@/app/dashboard/l/[locationId]/listings/actions";
import { cn } from "@/lib/utils";

type Violation = { field: string; message: string };
type ItemData = {
  id: string;
  productName: string;
  productImage: string | null;
  cost: number | null;
  freight: number | null;
  fields: Record<string, unknown>;
  validation: Violation[];
  publishStatus: string | null;
  externalId: string | null;
};
type BatchData = { id: string; name: string; marketplace: string; status: string };

export function ListingBatchEditor({ locationId, batch, items }: { locationId: string; batch: BatchData; items: ItemData[] }) {
  const rb = rulebook(batch.marketplace);
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<null | "publish" | "delete">(null);
  const [pending, start] = useTransition();

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? items.filter((i) => i.productName.toLowerCase().includes(s)) : items;
  }, [q, items]);

  if (!rb) return <p className="text-sm text-rose-600">Unknown marketplace.</p>;

  const publish = () => {
    setConfirm(null);
    start(async () => setMsg((await publishBatchAction(locationId, batch.id)).message));
  };
  const optimiseAll = () =>
    start(async () => {
      const r = await optimiseBatchAction(locationId, batch.id);
      setMsg(r.message);
      if (r.ok && typeof window !== "undefined") window.location.reload();
    });
  const del = () => start(async () => { await deleteBatchAction(locationId, batch.id); });

  return (
    <div className="space-y-4">
      <div className="card sticky top-2 z-10 flex flex-wrap items-center gap-2 p-3">
        <div className="mr-auto">
          <div className="font-semibold text-slate-900">{batch.name}</div>
          <div className="text-xs text-brand-600">{rb.label} · {items.length} item{items.length === 1 ? "" : "s"}</div>
        </div>
        {confirm === "publish" ? (
          <>
            <span className="text-sm text-slate-600">Publish {items.length} to {rb.label}?</span>
            <button onClick={publish} disabled={pending} className="btn-primary text-sm disabled:opacity-50">{pending ? "Publishing…" : "Confirm"}</button>
            <button onClick={() => setConfirm(null)} disabled={pending} className="btn-secondary text-sm">Cancel</button>
          </>
        ) : confirm === "delete" ? (
          <>
            <span className="text-sm text-slate-600">Delete this batch?</span>
            <button onClick={del} disabled={pending} className="rounded-lg bg-rose-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50">{pending ? "…" : "Delete"}</button>
            <button onClick={() => setConfirm(null)} disabled={pending} className="btn-secondary text-sm">Cancel</button>
          </>
        ) : (
          <>
            <button onClick={optimiseAll} disabled={pending} className="btn-secondary text-sm disabled:opacity-50" title="AI-optimise every listing to the marketplace rules">
              {pending ? "Optimising…" : "✨ Optimise all"}
            </button>
            <button
              onClick={() => (rb.available ? setConfirm("publish") : setMsg(`Publishing to ${rb.label} is coming soon — you can still draft and optimise here.`))}
              disabled={pending}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {rb.available ? `⬆ Publish to ${rb.label}` : "Publish (soon)"}
            </button>
            <button onClick={() => setConfirm("delete")} disabled={pending} className="text-sm text-slate-400 hover:text-rose-600" title="Delete batch">🗑</button>
          </>
        )}
      </div>

      {/* Saved marketplace rules the AI follows */}
      <details className="card p-3 text-sm">
        <summary className="cursor-pointer font-medium text-slate-700">✨ {rb.label} optimisation rules (what the AI applies)</summary>
        <p className="mt-2 whitespace-pre-line text-slate-600">{rb.aiRules}</p>
        <p className="mt-2 text-slate-500"><span className="font-medium text-slate-700">Pricing:</span> {rb.pricingHint}</p>
      </details>

      {msg ? <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{msg}</p> : null}

      {items.length > 4 ? (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search listings by product…"
          className="input h-9 text-sm"
        />
      ) : null}

      <div className="space-y-3">
        {shown.map((it) => (
          <ListingItemCard key={it.id} locationId={locationId} rb={rb.fields} item={it} fee={feePct(batch.marketplace)} marketplaceLabel={rb.label} onMsg={setMsg} />
        ))}
        {shown.length === 0 ? <p className="px-3 py-6 text-center text-sm text-slate-400">No listings match "{q}".</p> : null}
      </div>
    </div>
  );
}

function ListingItemCard({
  locationId,
  rb,
  item,
  fee,
  marketplaceLabel,
  onMsg,
}: {
  locationId: string;
  rb: ListingField[];
  item: ItemData;
  fee: number;
  marketplaceLabel: string;
  onMsg: (m: string) => void;
}) {
  const [fields, setFields] = useState<Record<string, unknown>>(item.fields);
  const [violations, setViolations] = useState<Violation[]>(item.validation);
  const [status, setStatus] = useState<string | null>(item.publishStatus);
  const [saved, setSaved] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [pending, start] = useTransition();

  if (removed) return null;

  const set = (k: string, v: unknown) => {
    setFields((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };
  const save = () =>
    start(async () => {
      const r = await updateListingItemAction(locationId, item.id, fields);
      if (r.ok) {
        setViolations(r.violations);
        setSaved(true);
        if (status !== "PUBLISHED") setStatus(null);
      }
    });
  const remove = () =>
    start(async () => {
      await removeListingItemAction(locationId, item.id);
      setRemoved(true);
    });
  const optimise = () =>
    start(async () => {
      const r = await optimiseItemAction(locationId, item.id);
      if (r.ok && r.fields) {
        setFields(r.fields);
        setViolations([]);
        setSaved(true);
        if (status !== "PUBLISHED") setStatus(null);
      }
      onMsg(r.message + (r.priceSuggestion != null ? ` · Suggested price $${r.priceSuggestion.toFixed(2)}` : ""));
    });

  const vFor = (id: string) => violations.find((v) => v.field === id)?.message;

  // Live profit maths — updates as the price is edited.
  const price = Number((fields as Record<string, unknown>).price) || 0;
  const cost = item.cost;
  const freight = item.freight ?? 0;
  const feeAmt = price * (fee / 100);
  const profit = cost != null ? price - cost - freight - feeAmt : null;
  const margin = profit != null && price > 0 ? (profit / price) * 100 : null;

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-3">
        {item.productImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.productImage} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400">🛍</span>
        )}
        <span className="min-w-0 flex-1 truncate text-sm text-slate-500">{item.productName}</span>
        {status === "PUBLISHED" ? (
          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">✓ Live</span>
        ) : status === "FAILED" ? (
          <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">Failed</span>
        ) : null}
      </div>

      {/* Profit after cost + freight + marketplace fee (updates as you edit the price) */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        {cost != null ? (
          <>
            <span>Cost <b className="font-mono text-slate-800">${cost.toFixed(2)}</b></span>
            {freight ? <span>Freight <b className="font-mono text-slate-800">${freight.toFixed(2)}</b></span> : null}
            <span>{marketplaceLabel} fee {fee}% <b className="font-mono text-slate-800">${feeAmt.toFixed(2)}</b></span>
            <span className={cn("ml-auto font-semibold", (profit ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600")}>
              Profit <b className="font-mono">${(profit ?? 0).toFixed(2)}</b>{margin != null ? ` · ${margin.toFixed(0)}% margin` : ""}
            </span>
          </>
        ) : (
          <span className="text-slate-400">Cost not synced for this product yet — profit will show once cost is available.</span>
        )}
      </div>

      <div className="grid gap-3">
        {rb.map((f) => {
          const raw = fields[f.id];
          const v = vFor(f.id);
          const strVal = f.type === "list" ? (Array.isArray(raw) ? (raw as string[]).join("\n") : "") : raw == null ? "" : String(raw);
          const counter = f.max && (f.type === "text" || f.type === "textarea") ? `${strVal.length}/${f.max}` : null;
          return (
            <div key={f.id}>
              <div className="flex items-baseline justify-between">
                <label className="label">{f.label}{f.required ? <span className="text-rose-500"> *</span> : null}</label>
                {counter ? (
                  <span className={cn("font-mono text-[10px]", f.max && strVal.length > f.max ? "text-rose-500" : "text-slate-400")}>{counter}</span>
                ) : null}
              </div>
              {f.type === "textarea" || f.type === "list" ? (
                <textarea
                  rows={f.type === "list" ? 5 : 3}
                  value={strVal}
                  onChange={(e) => set(f.id, f.type === "list" ? e.target.value.split("\n").filter(Boolean) : e.target.value)}
                  placeholder={f.type === "list" ? "One per line…" : undefined}
                  className="input resize-y text-sm"
                />
              ) : f.type === "price" || f.type === "number" ? (
                <input
                  type="number"
                  step={f.type === "price" ? "0.01" : "1"}
                  min="0"
                  value={raw == null ? "" : String(raw)}
                  onChange={(e) => set(f.id, e.target.value === "" ? "" : Number(e.target.value))}
                  className="input h-9 w-40 text-sm"
                />
              ) : (
                <input value={strVal} onChange={(e) => set(f.id, e.target.value)} className="input h-9 text-sm" />
              )}
              {v ? <p className="mt-0.5 text-[11px] text-rose-500">{v}</p> : null}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button onClick={save} disabled={pending} className="btn-primary text-xs disabled:opacity-50">
          {pending ? "…" : saved ? "Saved ✓" : "Save"}
        </button>
        <button onClick={optimise} disabled={pending} className="btn-secondary text-xs disabled:opacity-50" title="AI-optimise this listing to the marketplace rules">
          ✨ AI optimise
        </button>
        <button onClick={remove} disabled={pending} className="ml-auto text-xs text-slate-400 hover:text-rose-600">
          Remove
        </button>
      </div>
    </div>
  );
}
