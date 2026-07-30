"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { SubmitButton } from "@/components/submit-button";
import { createFormAction } from "@/app/dashboard/l/[locationId]/forms/actions";

type State = { error: string };
const INIT: State = { error: "" };

export function NewForm({ locationId, defaultType = "FORM" }: { locationId: string; defaultType?: "FORM" | "SURVEY" }) {
  const [state, action] = useFormState(createFormAction, INIT);
  const [type, setType] = useState<"FORM" | "SURVEY">(defaultType);

  return (
    <form action={action} className="card space-y-3 p-5">
      <input type="hidden" name="locationId" value={locationId} />
      <div className="flex flex-wrap items-center gap-2">
        <input name="name" placeholder={type === "SURVEY" ? "Survey name (e.g. Post-service feedback)" : "Form name (e.g. Quote request)"} className="input h-10 flex-1" />
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200">
          {(["FORM", "SURVEY"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`px-3 py-2 text-sm ${type === t ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}
            >
              {t === "FORM" ? "Form" : "Survey"}
            </button>
          ))}
        </div>
        <input type="hidden" name="type" value={type} />
      </div>

      <div>
        <label className="label flex items-center gap-2">
          <span>✨ Describe it and AI will build the fields</span>
          <span className="text-xs font-normal text-slate-400">optional</span>
        </label>
        <textarea
          name="description"
          rows={2}
          placeholder={
            type === "SURVEY"
              ? "e.g. A short feedback survey after a roadworthy inspection — rating, what went well, and any suggestions."
              : "e.g. A quote request for mobile car detailing — name, phone, suburb, car type, and preferred date."
          }
          className="input"
        />
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <div className="flex justify-end">
        <SubmitButton className="btn-primary">Create {type === "SURVEY" ? "survey" : "form"}</SubmitButton>
      </div>
    </form>
  );
}
