"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { addUserAction } from "@/app/dashboard/team/actions";
import { SubmitButton } from "@/components/submit-button";

export function AddUserButton() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(addUserAction, { error: "", ok: false } as { error: string; ok?: boolean });

  if (state?.ok && open) setTimeout(() => setOpen(false), 0);

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>+ Add user</button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 text-lg font-semibold text-slate-900">Add a team member</h2>
            <p className="mb-4 text-sm text-slate-500">
              Create their login, then grant access to specific sub-accounts below.
            </p>
            <form action={formAction} className="space-y-4">
              <div>
                <label className="label" htmlFor="name">Name</label>
                <input id="name" name="name" required className="input" />
              </div>
              <div>
                <label className="label" htmlFor="email">Email</label>
                <input id="email" name="email" type="email" required className="input" />
              </div>
              <div>
                <label className="label" htmlFor="password">Temporary password</label>
                <input id="password" name="password" type="text" required minLength={8} className="input" placeholder="At least 8 characters" />
                <p className="mt-1 text-xs text-slate-400">Share this with them; they can change it after signing in.</p>
              </div>
              <div>
                <label className="label" htmlFor="globalRole">Role</label>
                <select id="globalRole" name="globalRole" className="input">
                  <option value="AGENCY_USER">Team member (access only granted sub-accounts)</option>
                  <option value="SUPER_ADMIN">Owner / admin (full access to everything)</option>
                </select>
              </div>
              {state?.error ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
                <SubmitButton className="btn-primary">Create user</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
