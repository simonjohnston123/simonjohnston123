"use client";

import { useFormState } from "react-dom";
import { createHomesteadBookingAction } from "../../actions";

export function BookingForm({
  slug, roomId, weeklyPrice, depositWeeks, houseRules, contractText,
}: {
  slug: string; roomId: string; weeklyPrice: number; depositWeeks: number; houseRules: string; contractText: string;
}) {
  const [state, action] = useFormState(createHomesteadBookingAction, { error: "" } as { error: string });
  return (
    <form action={action} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="roomId" value={roomId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">Your name</label><input name="guestName" required className="input" /></div>
        <div><label className="label">Email</label><input name="guestEmail" type="email" required className="input" /></div>
        <div><label className="label">Phone</label><input name="guestPhone" className="input" /></div>
        <div><label className="label">Preferred start date</label><input name="startDate" type="date" required className="input" /></div>
      </div>

      <div className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">
        You&rsquo;ll be charged <b>${(weeklyPrice * depositWeeks).toLocaleString()}</b> to start ({depositWeeks} week{depositWeeks === 1 ? "" : "s"} upfront), then <b>${weeklyPrice.toLocaleString()}/week</b> automatically until you check out. Cancel anytime.
      </div>

      {(contractText || houseRules) && (
        <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          {contractText ? <><p className="mb-1 font-semibold text-slate-700">Agreement</p><p className="mb-3 whitespace-pre-line">{contractText}</p></> : null}
          {houseRules ? <><p className="mb-1 font-semibold text-slate-700">House rules</p><p className="whitespace-pre-line">{houseRules}</p></> : null}
        </div>
      )}

      <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" name="accept" className="mt-1" /> I have read and accept the agreement and house rules.</label>
      <div><label className="label">Sign (type your full name)</label><input name="signature" className="input" placeholder="Your full name" /></div>

      {state?.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <button className="w-full rounded-lg bg-brand-gradient py-3 font-semibold text-white">Request booking</button>
      <p className="text-center text-xs text-slate-400">The host confirms your booking, then your weekly payment is set up.</p>
    </form>
  );
}
