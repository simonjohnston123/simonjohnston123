"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { createBusinessAction } from "@/app/dashboard/actions";
import { SubmitButton } from "@/components/submit-button";

export function AddBusiness() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(createBusinessAction, { error: "" } as { error: string });

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>+ Add business</button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Add a business</h2>
              <button className="btn-ghost" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
            <p className="mb-4 text-sm text-slate-500">
              Creates a new sub-account with its own contacts, pipeline, calendar and website.
            </p>
            <form action={formAction} className="space-y-4">
              <div>
                <label className="label" htmlFor="name">Business name</label>
                <input id="name" name="name" required className="input" placeholder="Placid Homestead" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="industry">Industry</label>
                  <input id="industry" name="industry" className="input" placeholder="Self storage" />
                </div>
                <div>
                  <label className="label" htmlFor="phone">Phone</label>
                  <input id="phone" name="phone" className="input" placeholder="07 1234 5678" />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="email">Email</label>
                <input id="email" name="email" type="email" className="input" placeholder="hello@business.com" />
              </div>
              {state?.error ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
                <SubmitButton className="btn-primary">Create business</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
