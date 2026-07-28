"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { createTaskAction } from "@/app/dashboard/l/[locationId]/tasks/actions";
import { SubmitButton } from "@/components/submit-button";

export function NewTaskButton({
  locationId,
  contacts,
  members,
  compact,
  defaultContactId,
}: {
  locationId: string;
  contacts: { id: string; label: string }[];
  members: { id: string; label: string }[];
  compact?: boolean;
  defaultContactId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(createTaskAction, { error: "", ok: false } as { error: string; ok?: boolean });

  if (state?.ok && open) setTimeout(() => setOpen(false), 0);

  return (
    <>
      <button className={compact ? "btn-secondary text-sm" : "btn-primary"} onClick={() => setOpen(true)}>
        + New task
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">New task</h2>
            <form action={formAction} className="space-y-4">
              <input type="hidden" name="locationId" value={locationId} />
              <div>
                <label className="label" htmlFor="title">Task</label>
                <input id="title" name="title" required className="input" placeholder="Call back about a 3x3 unit" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="dueAt">Due</label>
                  <input id="dueAt" name="dueAt" type="datetime-local" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="assigneeId">Assign to</label>
                  <select id="assigneeId" name="assigneeId" className="input">
                    <option value="">— Unassigned —</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="contactId">Related contact</label>
                <select id="contactId" name="contactId" className="input" defaultValue={defaultContactId ?? ""}>
                  <option value="">— None —</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="notes">Notes</label>
                <textarea id="notes" name="notes" rows={2} className="input" />
              </div>
              {state?.error ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
                <SubmitButton className="btn-primary">Create task</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
