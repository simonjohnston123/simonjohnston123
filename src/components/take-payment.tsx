"use client";

import { useState, useTransition } from "react";
import { createPaymentLinkAction } from "@/app/dashboard/l/[locationId]/payments/connect-actions";

export function TakePayment({ locationId, feePercent }: { locationId: string; feePercent: number }) {
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [fee, setFee] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const create = () =>
    start(async () => {
      setError(null);
      setLink(null);
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt < 0.5) {
        setError("Enter an amount of at least $0.50.");
        return;
      }
      const r = await createPaymentLinkAction(locationId, amt, desc);
      if ("error" in r) {
        setError(r.error);
      } else {
        setLink(r.url);
        setFee(r.feeCents);
      }
    });

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="card p-5">
      <h3 className="font-semibold text-slate-900">Take a payment</h3>
      <p className="mt-1 text-sm text-slate-500">
        Create a secure payment link to send a customer. Your {feePercent}% fee is applied automatically.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Amount (AUD)</label>
          <div className="flex items-center">
            <span className="mr-1 text-slate-500">$</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              step="0.01"
              min="0.5"
              placeholder="1.00"
              className="input w-28"
            />
          </div>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="mb-1 block text-xs font-medium text-slate-600">What&apos;s it for? (optional)</label>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Invoice #123" className="input w-full" />
        </div>
        <button type="button" onClick={create} disabled={pending} className="btn-primary">
          {pending ? "Creating…" : "Create link"}
        </button>
      </div>

      {error ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      {link ? (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="text-sm font-medium text-green-800">
            ✓ Payment link ready{fee !== null ? ` — your fee on this: $${(fee / 100).toFixed(2)}` : ""}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <input readOnly value={link} className="input flex-1 text-xs" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" onClick={copy} className="btn-secondary shrink-0 text-sm">
              {copied ? "Copied!" : "Copy"}
            </button>
            <a href={link} target="_blank" rel="noreferrer" className="btn-secondary shrink-0 text-sm">
              Open
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
