"use client";

import { useFormState } from "react-dom";
import { SubmitButton } from "@/components/submit-button";
import { recordPaymentAction } from "@/app/dashboard/l/[locationId]/finance/actions";

type Payer = { id: string; label: string; suggested: number };

const EMPTY = { message: "", error: "" };

/**
 * Records money in. The amount pre-fills with what the selected stay currently
 * owes, because the common case by a wide margin is someone paying exactly
 * their balance — but it stays editable for part payments.
 */
export function RecordPayment({
  locationId,
  payers,
}: {
  locationId: string;
  payers: Payer[];
}) {
  const [state, action] = useFormState(recordPaymentAction, EMPTY);

  if (payers.length === 0) {
    return <p className="card p-4 text-sm text-slate-400">No active stays to record a payment against.</p>;
  }

  return (
    <form action={action} className="card space-y-3 p-4">
      <input type="hidden" name="locationId" value={locationId} />

      <div>
        <label className="label">Who paid?</label>
        <select name="bookingId" className="input" defaultValue={payers[0]?.id}>
          {payers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Amount (AUD)</label>
          <input name="amount" type="number" min="1" required className="input" defaultValue={payers[0]?.suggested || undefined} placeholder="260" />
        </div>
        <div>
          <label className="label">Method</label>
          <select name="method" className="input" defaultValue="BANK_TRANSFER">
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="STRIPE">Stripe</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div><label className="label">Date paid</label><input name="paidAt" type="date" className="input" /></div>
        <div><label className="label">Reference</label><input name="reference" className="input" placeholder="Receipt or transfer ref" /></div>
      </div>

      {state.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      {state.message ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{state.message}</p> : null}

      <SubmitButton className="btn-primary">Record payment</SubmitButton>
    </form>
  );
}
