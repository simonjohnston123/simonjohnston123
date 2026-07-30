"use client";

import { useFormState } from "react-dom";
import { submitFormAction } from "@/app/sites/actions";

export type PublicField = {
  key: string;
  label: string;
  type: "text" | "email" | "phone" | "textarea" | "number" | "date" | "select" | "checkbox";
  required?: boolean;
  options?: string[];
  placeholder?: string;
};

type State = { ok?: boolean; error: string };
const INIT: State = { error: "" };

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400";

export function PublicForm({
  formId,
  fields,
  submitLabel,
  thankYou,
  primaryColor,
}: {
  formId: string;
  fields: PublicField[];
  submitLabel: string;
  thankYou: string;
  primaryColor: string;
}) {
  const [state, action] = useFormState(submitFormAction, INIT);

  if (state.ok) {
    return <p className="rounded-xl bg-green-50 px-4 py-4 text-green-800">{thankYou}</p>;
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="formId" value={formId} />
      {fields.map((f) => {
        const req = Boolean(f.required);
        const htmlType = f.type === "phone" ? "tel" : f.type;
        return (
          <div key={f.key}>
            {f.type === "checkbox" ? (
              <label className="flex items-center gap-2 text-slate-700">
                <input type="checkbox" name={f.key} value="Yes" className="h-4 w-4" />
                <span>{f.label}{req ? " *" : ""}</span>
              </label>
            ) : (
              <>
                <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor={f.key}>
                  {f.label}{req ? " *" : ""}
                </label>
                {f.type === "textarea" ? (
                  <textarea id={f.key} name={f.key} required={req} rows={4} placeholder={f.placeholder} className={inputCls} />
                ) : f.type === "select" ? (
                  <select id={f.key} name={f.key} required={req} className={inputCls} defaultValue="">
                    <option value="" disabled>Choose…</option>
                    {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input id={f.key} name={f.key} type={htmlType} required={req} placeholder={f.placeholder} className={inputCls} />
                )}
              </>
            )}
          </div>
        );
      })}

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <button
        className="w-full rounded-xl px-5 py-3 font-semibold text-white shadow-sm transition hover:brightness-95 sm:w-auto"
        style={{ background: primaryColor }}
      >
        {submitLabel || "Submit"}
      </button>
    </form>
  );
}
