"use client";

import { useMemo, useState, useTransition } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { startPaymentAction } from "@/app/dashboard/l/[locationId]/payments/connect-actions";

// Cache Stripe instances per (publishableKey, connectedAccount) so we don't
// re-load the SDK on every render.
const stripeCache = new Map<string, Promise<Stripe | null>>();
function stripeFor(pk: string, account: string): Promise<Stripe | null> {
  const key = `${pk}::${account}`;
  if (!stripeCache.has(key)) stripeCache.set(key, loadStripe(pk, { stripeAccount: account }));
  return stripeCache.get(key)!;
}

const appearance = {
  variables: {
    colorPrimary: "#c81fd6",
    colorText: "#0f172a",
    borderRadius: "10px",
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
} as const;

function CardForm({ amount, feeCents, onDone }: { amount: string; feeCents: number; onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  const pay = async () => {
    if (!stripe || !elements) return;
    setPending(true);
    setError(null);
    const { error: err, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    setPending(false);
    if (err) {
      setError(err.message || "Payment failed. Check the card details and try again.");
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      setPaid(true);
    } else {
      setError("Payment didn't complete. Please try again.");
    }
  };

  if (paid) {
    return (
      <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800">
        <p className="font-semibold">✓ Payment received — ${amount}</p>
        <p className="mt-1">Your fee on this payment: ${(feeCents / 100).toFixed(2)}.</p>
        <button type="button" onClick={onDone} className="btn-secondary mt-3 text-sm">
          Take another payment
        </button>
      </div>
    );
  }

  return (
    <div>
      <PaymentElement />
      {error ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <div className="mt-4 flex items-center gap-2">
        <button type="button" onClick={pay} disabled={!stripe || pending} className="btn-primary">
          {pending ? "Charging…" : `Charge $${amount}`}
        </button>
        <button type="button" onClick={onDone} className="btn-secondary text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}

export function TakePayment({ locationId, feePercent }: { locationId: string; feePercent: number }) {
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<
    { clientSecret: string; accountId: string; publishableKey: string; feeCents: number } | null
  >(null);

  const stripePromise = useMemo(
    () => (intent ? stripeFor(intent.publishableKey, intent.accountId) : null),
    [intent],
  );

  const begin = () =>
    start(async () => {
      setError(null);
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt < 0.5) {
        setError("Enter an amount of at least $0.50.");
        return;
      }
      const r = await startPaymentAction(locationId, amt, desc);
      if ("error" in r) setError(r.error);
      else setIntent(r);
    });

  const reset = () => {
    setIntent(null);
    setAmount("");
    setDesc("");
    setError(null);
  };

  return (
    <div className="card p-5">
      <h3 className="font-semibold text-slate-900">Take a payment</h3>
      <p className="mt-1 text-sm text-slate-500">
        Enter the amount, then key the card in below to charge it on the spot. Your {feePercent}% fee is applied
        automatically.
      </p>

      {!intent ? (
        <>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Amount (AUD)</label>
              <div className="flex items-center">
                <span className="mr-1 text-slate-500">$</span>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  type="number"
                  step="0.01"
                  min="0.5"
                  placeholder="1.00"
                  className="input w-28"
                />
              </div>
            </div>
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">What&apos;s it for? (optional)</label>
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Invoice #123" className="input w-full" />
            </div>
            <button type="button" onClick={begin} disabled={pending} className="btn-primary">
              {pending ? "Loading…" : "Enter card"}
            </button>
          </div>
          {error ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        </>
      ) : stripePromise ? (
        <div className="mt-4">
          <Elements stripe={stripePromise} options={{ clientSecret: intent.clientSecret, appearance }}>
            <CardForm amount={Number(amount).toFixed(2)} feeCents={intent.feeCents} onDone={reset} />
          </Elements>
        </div>
      ) : null}
    </div>
  );
}
