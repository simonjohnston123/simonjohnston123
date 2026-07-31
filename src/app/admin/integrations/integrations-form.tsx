"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveEbayCertAction, type SaveState } from "./actions";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? "Saving…" : "Save Cert ID"}
    </button>
  );
}

export function EbayCertForm({ certSet }: { certSet: boolean }) {
  const [state, action] = useFormState<SaveState, FormData>(saveEbayCertAction, { error: "" });
  return (
    <form action={action} className="space-y-3">
      {state.ok ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">✓ Saved. eBay is now connectable in every business&apos;s Integrations.</p>
      ) : null}
      {state.error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p> : null}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          eBay Cert ID (Client Secret) {certSet ? <span className="text-xs font-normal text-green-600">· set ✓</span> : <span className="text-xs font-normal text-amber-600">· not set</span>}
        </label>
        <input
          name="certId"
          type="password"
          autoComplete="off"
          placeholder={certSet ? "•••••••• (leave blank to keep current)" : "PRD-…"}
          className="input w-full font-mono"
        />
        <p className="mt-1 text-xs text-slate-500">
          From developer.ebay.com/my/keys → Production → &ldquo;Cert ID (Client Secret)&rdquo;. Stored encrypted, used
          server-side only.
        </p>
      </div>
      <SaveButton />
    </form>
  );
}
