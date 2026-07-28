"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { createContactAction } from "@/app/dashboard/l/[locationId]/contacts/actions";
import { SubmitButton } from "@/components/submit-button";

export function NewContactButton({ locationId }: { locationId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(createContactAction, { error: "" } as { error: string });

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>+ New contact</button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">New contact</h2>
            <form action={formAction} className="space-y-4">
              <input type="hidden" name="locationId" value={locationId} />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="firstName">First name</label>
                  <input id="firstName" name="firstName" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="lastName">Last name</label>
                  <input id="lastName" name="lastName" className="input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="email">Email</label>
                  <input id="email" name="email" type="email" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="phone">Phone</label>
                  <input id="phone" name="phone" className="input" />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="companyName">Company</label>
                <input id="companyName" name="companyName" className="input" />
              </div>
              {state?.error ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
                <SubmitButton className="btn-primary">Create contact</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
