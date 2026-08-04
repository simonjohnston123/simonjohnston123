"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  rebuildAction,
  markPlacedAction,
  recordTrackingAction,
  setStatusAction,
} from "@/app/dashboard/l/[locationId]/fulfilment/actions";

export type DeskItem = { sku: string | null; name: string; qty: number; costCents: number | null; sellCents: number | null; warehouse: string | null };

export type DeskRow = {
  id: string;
  supplier: string;
  status: string;
  items: DeskItem[];
  costCents: number | null;
  sellCents: number;
  supplierRef: string | null;
  tracking: string | null;
  carrier: string | null;
  orderNumber: number;
  channel: string;
  customerName: string | null;
  deliveryAddress: string | null;
  placedAt: string | null;
  automation: { auto: boolean; note: string };
};

const money = (c: number | null | undefined) => (typeof c === "number" ? `$${(c / 100).toFixed(2)}` : "—");

const STATUS_STYLE: Record<string, string> = {
  TO_PLACE: "bg-amber-100 text-amber-800",
  PLACED: "bg-blue-100 text-blue-800",
  SHIPPED: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-rose-100 text-rose-800",
  CANCELLED: "bg-slate-100 text-slate-600",
};

export function RebuildButton({ locationId }: { locationId: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => start(async () => { const r = await rebuildAction(locationId); setMsg(r.message); router.refresh(); })}
        disabled={pending}
        className="btn-secondary text-sm"
      >
        {pending ? "Scanning…" : "↻ Scan orders"}
      </button>
      {msg ? <span className="text-xs font-medium text-slate-500">{msg}</span> : null}
    </div>
  );
}

export function SupplierOrderCard({ locationId, row }: { locationId: string; row: DeskRow }) {
  const router = useRouter();
  const [ref, setRef] = useState(row.supplierRef ?? "");
  const [tracking, setTracking] = useState(row.tracking ?? "");
  const [carrier, setCarrier] = useState(row.carrier ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      const r = await fn();
      setErr(!r.ok);
      setMsg(r.message);
      router.refresh();
    });

  const margin = row.costCents != null ? row.sellCents - row.costCents : null;
  const marginPct = margin != null && row.sellCents > 0 ? Math.round((margin / row.sellCents) * 100) : null;

  return (
    <div className="card p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[row.status] ?? "bg-slate-100"}`}>
            {row.status.replace("_", " ")}
          </span>
          <span className="font-semibold text-slate-900">#{row.orderNumber}</span>
          <span className="text-xs text-slate-500">{row.channel}</span>
        </div>
        <div className="text-right text-xs">
          <div className="text-slate-500">
            sell {money(row.sellCents)} · cost {money(row.costCents)}
          </div>
          {margin != null ? (
            <div className={`font-semibold ${margin > 0 ? "text-emerald-600" : "text-rose-600"}`}>
              margin {money(margin)}{marginPct != null ? ` (${marginPct}%)` : ""}
            </div>
          ) : (
            <div className="font-semibold text-amber-600">cost unknown</div>
          )}
        </div>
      </div>

      {row.customerName || row.deliveryAddress ? (
        <div className="mb-2 text-xs text-slate-600">
          <span className="font-medium">{row.customerName ?? "—"}</span>
          {row.deliveryAddress ? <span className="text-slate-500"> · {row.deliveryAddress}</span> : null}
        </div>
      ) : null}

      <ul className="mb-3 space-y-1">
        {row.items.map((it, i) => (
          <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-medium text-slate-700">{it.qty}×</span>
            <span className="min-w-0 flex-1 truncate text-slate-700">{it.name}</span>
            {it.sku ? <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">{it.sku}</code> : <span className="text-[11px] font-semibold text-amber-600">no SKU</span>}
            {it.warehouse ? <span className="text-[11px] text-slate-500">{it.warehouse}</span> : null}
          </li>
        ))}
      </ul>

      {!row.automation.auto ? (
        <p className="mb-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">{row.automation.note}</p>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        {row.status === "TO_PLACE" ? (
          <>
            <div className="min-w-[150px] flex-1">
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Supplier reference</label>
              <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="their order number" className="input w-full text-sm" />
            </div>
            <button onClick={() => run(() => markPlacedAction(locationId, row.id, ref))} disabled={pending} className="btn-primary text-sm">
              Mark placed
            </button>
          </>
        ) : (
          <>
            <div className="min-w-[140px] flex-1">
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Tracking</label>
              <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="tracking number" className="input w-full text-sm" />
            </div>
            <div className="w-32">
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Carrier</label>
              <input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="AusPost" className="input w-full text-sm" />
            </div>
            <button onClick={() => run(() => recordTrackingAction(locationId, row.id, tracking, carrier))} disabled={pending} className="btn-primary text-sm">
              Save tracking
            </button>
            {row.status !== "TO_PLACE" ? (
              <button onClick={() => run(() => setStatusAction(locationId, row.id, "TO_PLACE"))} disabled={pending} className="text-xs font-medium text-slate-400 hover:text-slate-600">
                Reopen
              </button>
            ) : null}
          </>
        )}
        {msg ? <span className={`text-xs font-semibold ${err ? "text-rose-600" : "text-emerald-600"}`}>{msg}</span> : null}
      </div>
    </div>
  );
}
