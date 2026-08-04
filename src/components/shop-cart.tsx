"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addToCartAction, setQtyAction, checkoutAction } from "@/app/shop/[slug]/actions";

export function AddToCart({
  slug, productId, destination, primary, large,
}: {
  slug: string; productId: string; destination: string; primary: string; large?: boolean;
}) {
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const [pending, start] = useTransition();

  return (
    <button
      onClick={() =>
        start(async () => {
          await addToCartAction(slug, productId, destination);
          setAdded(true);
          router.refresh();
          // Confirm, then return to the normal label so it can be pressed again.
          setTimeout(() => setAdded(false), 1800);
        })
      }
      disabled={pending}
      className={`rounded-xl text-center font-semibold text-white transition ${large ? "px-6 py-3 text-base" : "px-4 py-2.5 text-sm"} ${pending ? "opacity-70" : ""}`}
      style={{ backgroundColor: added ? "#059669" : primary }}
    >
      {added ? "✓ Added" : pending ? "Adding…" : "Add to basket"}
    </button>
  );
}

export function QtyControl({ slug, productId, qty }: { slug: string; productId: string; qty: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const set = (n: number) =>
    start(async () => {
      await setQtyAction(slug, productId, n);
      router.refresh();
    });

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => set(qty - 1)} disabled={pending} className="h-8 w-8 rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300" aria-label="Fewer">−</button>
      <span className="w-8 text-center text-sm font-semibold tabular-nums">{qty}</span>
      <button onClick={() => set(qty + 1)} disabled={pending} className="h-8 w-8 rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300" aria-label="More">+</button>
      <button onClick={() => set(0)} disabled={pending} className="ml-2 text-xs font-medium text-slate-400 hover:text-rose-600">Remove</button>
    </div>
  );
}

export function CheckoutBox({ slug, primary, disabled }: { slug: string; primary: string; disabled: boolean }) {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const [pending, start] = useTransition();

  const go = () =>
    start(async () => {
      const r = await checkoutAction(slug, email.trim());
      setErr(!r.ok);
      setMsg(r.message);
      // Stripe collects the card, address and phone — we never touch them.
      if (r.ok && r.url) window.location.href = r.url;
    });

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Email for your receipt</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400"
        />
      </div>
      <button
        onClick={go}
        disabled={pending || disabled}
        className="w-full rounded-xl px-6 py-3.5 text-base font-semibold text-white disabled:opacity-50"
        style={{ backgroundColor: primary }}
      >
        {pending ? "Starting secure checkout…" : "Checkout securely"}
      </button>
      <p className="text-center text-xs text-slate-400">
        Card details are handled by Stripe. Delivery address is collected at payment.
      </p>
      {msg ? <p className={`text-sm font-medium ${err ? "text-rose-600" : "text-emerald-600"}`}>{msg}</p> : null}
    </div>
  );
}
