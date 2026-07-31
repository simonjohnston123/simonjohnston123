"use client";

import { useFormState, useFormStatus } from "react-dom";
import { savePaymentSettingsAction, type SaveState } from "./actions";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? "Saving…" : "Save & go live"}
    </button>
  );
}

export function PaymentsForm({
  secretSet,
  publishableSet,
  feePercent,
}: {
  secretSet: boolean;
  publishableSet: boolean;
  feePercent: string;
}) {
  const [state, action] = useFormState<SaveState, FormData>(savePaymentSettingsAction, { error: "" });

  return (
    <form action={action} className="space-y-4">
      {state.ok ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">✓ Saved. Payments settings updated.</p>
      ) : null}
      {state.error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      ) : null}

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Secret key {secretSet ? <span className="text-xs font-normal text-green-600">· set ✓</span> : <span className="text-xs font-normal text-amber-600">· not set</span>}
        </label>
        <input
          name="secretKey"
          type="password"
          autoComplete="off"
          placeholder={secretSet ? "•••••••• (leave blank to keep current)" : "sk_live_… or rk_live_…"}
          className="input w-full font-mono"
        />
        <p className="mt-1 text-xs text-slate-500">Verified against Stripe when you save. Stored encrypted — never shown again.</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Publishable key {publishableSet ? <span className="text-xs font-normal text-green-600">· set ✓</span> : <span className="text-xs font-normal text-amber-600">· not set</span>}
        </label>
        <input
          name="publishableKey"
          type="text"
          autoComplete="off"
          placeholder={publishableSet ? "pk_live_… (leave blank to keep current)" : "pk_live_…"}
          className="input w-full font-mono"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Platform fee %</label>
        <input
          name="feePercent"
          type="number"
          step="0.1"
          min="0"
          max="100"
          defaultValue={feePercent}
          className="input w-32"
        />
        <p className="mt-1 text-xs text-slate-500">Your cut of every transaction, on top of Stripe&apos;s processing fee.</p>
      </div>

      <SaveButton />
    </form>
  );
}
