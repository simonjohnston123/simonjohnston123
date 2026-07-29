"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { createOrderAction } from "@/app/dashboard/l/[locationId]/orders/actions";
import { SubmitButton } from "@/components/submit-button";

type Item = { name: string; qty: string; price: string };

export function NewOrderButton({ locationId }: { locationId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(createOrderAction, { error: "" } as { error: string });
  const [type, setType] = useState("PRODUCT");
  const [items, setItems] = useState<Item[]>([{ name: "", qty: "1", price: "0" }]);

  const total = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  const setItem = (i: number, patch: Partial<Item>) => setItems((arr) => arr.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  const serialized = JSON.stringify(items.map((it) => ({ name: it.name, qty: Number(it.qty) || 0, price: Number(it.price) || 0 })));

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>+ New order</button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4" onClick={() => setOpen(false)}>
          <div className="card my-8 w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">New order</h2>
              <button className="btn-ghost" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
            <form action={formAction} className="space-y-4">
              <input type="hidden" name="locationId" value={locationId} />
              <input type="hidden" name="items" value={serialized} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Type</label>
                  <select name="type" value={type} onChange={(e) => setType(e.target.value)} className="input">
                    <option value="PRODUCT">Product order</option>
                    <option value="DELIVERY">Delivery</option>
                  </select>
                </div>
                <div>
                  <label className="label">Customer name</label>
                  <input name="customerName" className="input" placeholder="Jane Smith" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Phone</label>
                  <input name="customerPhone" className="input" placeholder="0400 000 000" />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input name="customerEmail" type="email" className="input" placeholder="jane@email.com" />
                </div>
              </div>

              {type === "DELIVERY" ? (
                <div>
                  <label className="label">Delivery address</label>
                  <input name="deliveryAddress" className="input" placeholder="27 Toolooa St, South Gladstone" />
                </div>
              ) : null}

              <div>
                <label className="label">Items</label>
                <div className="space-y-2">
                  {items.map((it, i) => (
                    <div key={i} className="flex gap-2">
                      <input className="input flex-1" placeholder="Item" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} />
                      <input className="input w-16" type="number" min="1" placeholder="Qty" value={it.qty} onChange={(e) => setItem(i, { qty: e.target.value })} />
                      <input className="input w-24" type="number" min="0" step="0.01" placeholder="Price" value={it.price} onChange={(e) => setItem(i, { price: e.target.value })} />
                      <button type="button" className="px-2 text-slate-400 hover:text-red-600" onClick={() => setItems((a) => a.filter((_, k) => k !== i))}>×</button>
                    </div>
                  ))}
                </div>
                <button type="button" className="mt-2 text-xs font-medium text-brand-600 hover:underline" onClick={() => setItems((a) => [...a, { name: "", qty: "1", price: "0" }])}>+ Add item</button>
                <div className="mt-2 text-right text-sm font-semibold text-slate-800">Total: ${total.toFixed(2)}</div>
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea name="notes" rows={2} className="input" />
              </div>

              {state?.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
                <SubmitButton className="btn-primary">Create order</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
