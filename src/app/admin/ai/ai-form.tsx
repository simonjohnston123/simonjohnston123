"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveAiKeyAction, type SaveState } from "./actions";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? "Saving…" : "Save key"}
    </button>
  );
}

export function AiForm({ keySet }: { keySet: boolean }) {
  const [state, action] = useFormState<SaveState, FormData>(saveAiKeyAction, { error: "" });
  return (
    <form action={action} className="space-y-3">
      {state.ok ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">✓ Saved. The AI assistant is now switched on for all businesses.</p> : null}
      {state.error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p> : null}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Anthropic (Claude) API key {keySet ? <span className="text-xs font-normal text-green-600">· set ✓</span> : <span className="text-xs font-normal text-amber-600">· not set</span>}
        </label>
        <input
          name="apiKey"
          type="password"
          autoComplete="off"
          placeholder={keySet ? "•••••••• (leave blank to keep current)" : "sk-ant-…"}
          className="input w-full font-mono"
        />
        <p className="mt-1 text-xs text-slate-500">
          From console.anthropic.com → API keys. Stored encrypted, used server-side only. Powers the in-CRM setup
          assistant + AI stage/form drafting for every business.
        </p>
      </div>
      <SaveButton />
    </form>
  );
}
