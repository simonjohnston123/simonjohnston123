"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { SubmitButton } from "@/components/submit-button";
import {
  createPipelineAction,
  suggestStagesAction,
  addStageAction,
  deleteStageAction,
} from "@/app/dashboard/l/[locationId]/pipelines/actions";

export function NewPipelineButton({ locationId }: { locationId: string }) {
  const [open, setOpen] = useState(false);
  const [stages, setStages] = useState("New Lead, Contacted, Quote Sent, Won");
  const [applied, setApplied] = useState(""); // last AI suggestion adopted into the field
  const [createState, createAction] = useFormState(createPipelineAction, { error: "", ok: false } as {
    error: string;
    ok?: boolean;
  });
  const [suggestState, suggestAction] = useFormState(suggestStagesAction, { error: "", stages: "" } as {
    error: string;
    stages: string;
  });

  // Adopt each fresh AI suggestion exactly once, so later manual edits stick.
  if (suggestState?.stages && suggestState.stages !== applied) {
    setTimeout(() => {
      setStages(suggestState.stages);
      setApplied(suggestState.stages);
    }, 0);
  }
  if (createState?.ok && open) {
    setTimeout(() => setOpen(false), 0);
  }

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>+ New track</button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 text-lg font-semibold text-slate-900">New Success Track</h2>
            <p className="mb-4 text-sm text-slate-500">Name it, then set the stages — or let AI draft them for you.</p>

            {/* AI drafting */}
            <form action={suggestAction} className="mb-4 rounded-xl bg-brand-50 p-3">
              <input type="hidden" name="locationId" value={locationId} />
              <label className="label" htmlFor="description">✨ Describe your business or sales process</label>
              <textarea
                id="description"
                name="description"
                rows={2}
                className="input"
                placeholder="e.g. Self-storage yard renting units and containers to local customers"
              />
              {suggestState?.error ? <p className="mt-1 text-xs text-red-600">{suggestState.error}</p> : null}
              <div className="mt-2 flex justify-end">
                <SubmitButton className="btn-secondary text-xs">Generate stages with AI</SubmitButton>
              </div>
            </form>

            {/* Create form */}
            <form action={createAction} className="space-y-4">
              <input type="hidden" name="locationId" value={locationId} />
              <div>
                <label className="label" htmlFor="name">Track name</label>
                <input id="name" name="name" required className="input" placeholder="e.g. Storage bookings" />
              </div>
              <div>
                <label className="label" htmlFor="stages">Stages (comma separated)</label>
                <textarea
                  id="stages"
                  name="stages"
                  rows={2}
                  className="input"
                  value={stages}
                  onChange={(e) => setStages(e.target.value)}
                />
              </div>
              {createState?.error ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{createState.error}</p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
                <SubmitButton className="btn-primary">Create track</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function StageEditor({
  locationId,
  pipelineId,
  stages,
}: {
  locationId: string;
  pipelineId: string;
  stages: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-secondary text-xs" onClick={() => setOpen(true)}>Edit stages</button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Edit stages</h2>
              <button className="text-slate-400 hover:text-slate-700" onClick={() => setOpen(false)}>✕</button>
            </div>

            <div className="space-y-2">
              {stages.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <span className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{s.name}</span>
                  {stages.length > 1 ? (
                    <form action={deleteStageAction}>
                      <input type="hidden" name="locationId" value={locationId} />
                      <input type="hidden" name="stageId" value={s.id} />
                      <button className="text-xs text-slate-400 hover:text-red-600" aria-label="Delete stage">Delete</button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>

            <form action={addStageAction} className="mt-4 flex gap-2">
              <input type="hidden" name="locationId" value={locationId} />
              <input type="hidden" name="pipelineId" value={pipelineId} />
              <input name="name" required className="input flex-1" placeholder="Add a stage…" />
              <SubmitButton className="btn-primary text-sm">Add</SubmitButton>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
