"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { SubmitButton } from "@/components/submit-button";
import { createStorageBookingAction } from "@/app/dashboard/l/[locationId]/storage/actions";

export function StorageNewBooking({
  locationId,
  products,
}: {
  locationId: string;
  products: { id: string; name: string; spotType: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [openEnded, setOpenEnded] = useState(true);
  const [state, action] = useFormState(createStorageBookingAction, { error: "", ok: false } as { error: string; ok?: boolean });
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const isCar = products.find((p) => p.id === productId)?.spotType === "CAR";

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>+ New booking</button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4" onClick={() => setOpen(false)}>
          <div className="card my-8 w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">New storage booking</h2>
              <button className="btn-ghost" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
            <form action={action} className="space-y-4">
              <input type="hidden" name="locationId" value={locationId} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Product</label>
                  <select name="productId" value={productId} onChange={(e) => setProductId(e.target.value)} className="input">
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Term</label>
                  <select name="term" className="input" defaultValue="MONTHLY">
                    <option value="MONTHLY">Monthly</option>
                    <option value="WEEKLY">Weekly</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Customer name</label><input name="name" className="input" required /></div>
                <div><label className="label">Start date</label><input name="startDate" type="date" className="input" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Email</label><input name="email" type="email" className="input" /></div>
                <div><label className="label">Mobile</label><input name="phone" className="input" /></div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="openEnded" checked={openEnded} onChange={(e) => setOpenEnded(e.target.checked)} />
                Until further notice
              </label>
              {!openEnded ? <div><label className="label">End date</label><input name="endDate" type="date" className="input" /></div> : null}
              {isCar ? (
                <div className="grid grid-cols-3 gap-2">
                  <input name="vehicleMake" className="input" placeholder="Make" />
                  <input name="vehicleModel" className="input" placeholder="Model" />
                  <input name="vehicleRego" className="input" placeholder="Rego" />
                </div>
              ) : (
                <div><label className="label">What&rsquo;s stored</label><input name="storedDescription" className="input" /></div>
              )}
              {state?.ok ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">Booking created (PIN issued).</p> : null}
              {state?.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>{state?.ok ? "Done" : "Cancel"}</button>
                <SubmitButton className="btn-primary">Create booking</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
