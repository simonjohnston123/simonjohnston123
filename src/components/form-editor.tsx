"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { SubmitButton } from "@/components/submit-button";
import { updateFormAction } from "@/app/dashboard/l/[locationId]/forms/actions";

type Field = { key: string; label: string; type: string; required?: boolean; options?: string[]; placeholder?: string };

const TYPES = ["text", "email", "phone", "textarea", "number", "date", "select", "checkbox"];
const INIT = { error: "", ok: false as boolean | undefined };

function slugKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "field";
}

export function FormEditor({
  locationId,
  formId,
  name: initialName,
  fields: initialFields,
  submitLabel: initialSubmit,
  thankYou: initialThankYou,
}: {
  locationId: string;
  formId: string;
  name: string;
  fields: Field[];
  submitLabel: string;
  thankYou: string;
}) {
  const [state, action] = useFormState(updateFormAction, INIT);
  const [name, setName] = useState(initialName);
  const [fields, setFields] = useState<Field[]>(initialFields.length ? initialFields : [{ key: "name", label: "Your name", type: "text", required: true }]);
  const [submitLabel, setSubmitLabel] = useState(initialSubmit);
  const [thankYou, setThankYou] = useState(initialThankYou);

  const update = (i: number, patch: Partial<Field>) => setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const remove = (i: number) => setFields((fs) => fs.filter((_, j) => j !== i));
  const add = () => setFields((fs) => [...fs, { key: `field_${fs.length + 1}`, label: "New field", type: "text", required: false }]);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locationId" value={locationId} />
      <input type="hidden" name="formId" value={formId} />
      <input type="hidden" name="fields" value={JSON.stringify(fields.map((f) => ({ ...f, key: f.key || slugKey(f.label) })))} />

      <div>
        <label className="label">Name</label>
        <input name="name" value={name} onChange={(e) => setName(e.target.value)} className="input" />
      </div>

      <div>
        <label className="label">Fields</label>
        <div className="space-y-2">
          {fields.map((f, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={f.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                  placeholder="Question / label"
                  className="input h-9 flex-1 py-1 text-sm"
                />
                <select value={f.type} onChange={(e) => update(i, { type: e.target.value })} className="input h-9 w-32 py-1 text-sm">
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <label className="flex items-center gap-1 text-xs text-slate-600">
                  <input type="checkbox" checked={Boolean(f.required)} onChange={(e) => update(i, { required: e.target.checked })} />
                  Required
                </label>
                <button type="button" onClick={() => remove(i)} className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:text-red-600" title="Remove">✕</button>
              </div>
              {f.type === "select" ? (
                <input
                  value={(f.options ?? []).join(", ")}
                  onChange={(e) => update(i, { options: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })}
                  placeholder="Options, comma separated"
                  className="input mt-2 h-9 py-1 text-sm"
                />
              ) : null}
            </div>
          ))}
        </div>
        <button type="button" onClick={add} className="btn-secondary mt-2 text-sm">+ Add field</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Submit button label</label>
          <input name="submitLabel" value={submitLabel} onChange={(e) => setSubmitLabel(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">Thank-you message</label>
          <input name="thankYou" value={thankYou} onChange={(e) => setThankYou(e.target.value)} className="input" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton className="btn-primary">Save form</SubmitButton>
        {state.ok ? <span className="text-sm text-green-600">Saved ✓</span> : null}
        {state.error ? <span className="text-sm text-red-600">{state.error}</span> : null}
      </div>
    </form>
  );
}
