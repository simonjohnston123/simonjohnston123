"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { SubmitButton } from "@/components/submit-button";
import { importContactsAction } from "@/app/dashboard/l/[locationId]/contacts/actions";

type State = { error: string; ok?: boolean; imported?: number; skipped?: number };
const INIT: State = { error: "" };

export function ImportContactsButton({ locationId }: { locationId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(importContactsAction, INIT);

  return (
    <>
      <button className="btn-secondary" onClick={() => setOpen(true)}>Import CSV</button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4" onClick={() => setOpen(false)}>
          <div className="card my-10 w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Import contacts</h2>
              <button className="btn-ghost" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
            <p className="mb-4 text-sm text-slate-500">
              Upload a CSV with a header row. We&rsquo;ll match columns named <span className="font-medium">name / first name / last name, email, phone, company</span>. Existing contacts (same email or phone) are updated, not duplicated.
            </p>
            <form action={action} className="space-y-4">
              <input type="hidden" name="locationId" value={locationId} />
              <input type="file" name="file" accept=".csv,text/csv" required className="input py-2" />
              {state?.ok ? (
                <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
                  Imported {state.imported} contact{state.imported === 1 ? "" : "s"}{state.skipped ? ` (${state.skipped} empty rows skipped)` : ""}.
                </p>
              ) : null}
              {state?.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>{state?.ok ? "Done" : "Cancel"}</button>
                <SubmitButton className="btn-primary">Import</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
