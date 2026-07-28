"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { SubmitButton } from "@/components/submit-button";
import {
  ACTIONS,
  TRIGGERS,
  ACTION_KEYS,
  TRIGGER_KEYS,
  type ActionKey,
} from "@/lib/automation-catalog";
import {
  createWorkflowAction,
  addStepAction,
  testRunAction,
} from "@/app/dashboard/l/[locationId]/automations/actions";

type FormState = { error: string; ok?: boolean; message?: string };
const INIT: FormState = { error: "", ok: false };

/** Create-automation card (name + trigger). */
export function NewWorkflowForm({ locationId }: { locationId: string }) {
  const [state, formAction] = useFormState(createWorkflowAction, INIT);
  return (
    <form action={formAction} className="card space-y-4 p-6">
      <input type="hidden" name="locationId" value={locationId} />
      <div>
        <label className="label" htmlFor="name">Automation name</label>
        <input id="name" name="name" required className="input" placeholder="New lead welcome" />
      </div>
      <div>
        <label className="label" htmlFor="triggerType">When this happens…</label>
        <select id="triggerType" name="triggerType" className="input" defaultValue="CONTACT_CREATED">
          {TRIGGER_KEYS.map((k) => (
            <option key={k} value={k}>
              {TRIGGERS[k].label}
              {TRIGGERS[k].live ? "" : " (coming soon)"}
            </option>
          ))}
        </select>
      </div>
      {state?.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}
      <SubmitButton className="btn-primary w-full">Create automation →</SubmitButton>
    </form>
  );
}

/** Add-a-step form with fields that change per selected action. */
export function AddStepForm({ locationId, workflowId }: { locationId: string; workflowId: string }) {
  const [state, formAction] = useFormState(addStepAction, INIT);
  const [action, setAction] = useState<ActionKey>("SEND_EMAIL");
  const def = ACTIONS[action];

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locationId" value={locationId} />
      <input type="hidden" name="workflowId" value={workflowId} />
      <div>
        <label className="label" htmlFor="actionType">Action</label>
        <select
          id="actionType"
          name="actionType"
          className="input"
          value={action}
          onChange={(e) => setAction(e.target.value as ActionKey)}
        >
          {ACTION_KEYS.map((k) => (
            <option key={k} value={k}>
              {ACTIONS[k].icon}  {ACTIONS[k].label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">{def.description}</p>
      </div>

      {def.fields.map((f) => (
        <div key={f.key}>
          <label className="label" htmlFor={f.key}>
            {f.label}
            {f.optional ? <span className="text-slate-400"> (optional)</span> : null}
          </label>
          {f.type === "textarea" ? (
            <textarea id={f.key} name={f.key} rows={3} className="input" placeholder={f.placeholder} />
          ) : (
            <input id={f.key} name={f.key} type={f.type === "number" ? "number" : "text"} className="input" placeholder={f.placeholder} />
          )}
        </div>
      ))}

      {def.note ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{def.note}</p> : null}
      <p className="text-xs text-slate-400">
        Tip: use <code className="rounded bg-slate-100 px-1">{"{{firstName}}"}</code>,{" "}
        <code className="rounded bg-slate-100 px-1">{"{{company}}"}</code> — they fill in from the contact.
      </p>
      {state?.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}
      <SubmitButton className="btn-primary w-full">+ Add step</SubmitButton>
    </form>
  );
}

/** Test-run form — pick a contact and fire the workflow now. */
export function TestRunForm({
  locationId,
  workflowId,
  contacts,
}: {
  locationId: string;
  workflowId: string;
  contacts: { id: string; label: string }[];
}) {
  const [state, formAction] = useFormState(testRunAction, INIT);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="locationId" value={locationId} />
      <input type="hidden" name="workflowId" value={workflowId} />
      <div>
        <label className="label" htmlFor="contactId">Run against contact</label>
        <select id="contactId" name="contactId" className="input">
          <option value="">— No contact (test structure only) —</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>
      {state?.message ? (
        <p className={`rounded-lg px-3 py-2 text-sm ${state.ok ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800"}`}>
          {state.message}
        </p>
      ) : null}
      {state?.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}
      <SubmitButton className="btn-secondary w-full">▶ Test run now</SubmitButton>
    </form>
  );
}
