"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { createGroupAction } from "./actions";

export function NewGroup() {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(createGroupAction, { error: "" } as { error: string });
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white">+ Create group</button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-bold text-slate-900">Create a group</h2>
            <form action={action} className="space-y-3">
              <div><label className="label">Group name</label><input name="name" required className="input" placeholder="e.g. Gladstone Locals" /></div>
              <div><label className="label">What's it about?</label><textarea name="description" rows={3} className="input" placeholder="Describe your group" /></div>
              {state?.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
                <button className="rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white">Create</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
