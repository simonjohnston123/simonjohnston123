"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { createOpportunityAction } from "@/app/dashboard/l/[locationId]/pipelines/actions";
import { SubmitButton } from "@/components/submit-button";

export function NewOpportunityButton({
  locationId,
  pipelineId,
  stages,
  contacts,
}: {
  locationId: string;
  pipelineId: string;
  stages: { id: string; name: string }[];
  contacts: { id: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(createOpportunityAction, { error: "", ok: false } as { error: string; ok?: boolean });

  if (state?.ok && open) {
    // close on success
    setTimeout(() => setOpen(false), 0);
  }

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>+ New opportunity</button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">New opportunity</h2>
            <form action={formAction} className="space-y-4">
              <input type="hidden" name="locationId" value={locationId} />
              <input type="hidden" name="pipelineId" value={pipelineId} />
              <div>
                <label className="label" htmlFor="title">Title</label>
                <input id="title" name="title" required className="input" placeholder="e.g. 10x10 unit — John Smith" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="value">Value (AUD)</label>
                  <input id="value" name="value" type="number" min="0" step="1" defaultValue="0" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="stageId">Stage</label>
                  <select id="stageId" name="stageId" className="input" required>
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="contactId">Contact (optional)</label>
                <select id="contactId" name="contactId" className="input">
                  <option value="">— None —</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              {state?.error ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
                <SubmitButton className="btn-primary">Create</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
