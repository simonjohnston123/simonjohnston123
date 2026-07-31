"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { createHomesteadBookingAction } from "../../actions";

/**
 * Public booking form.
 *
 * A room may be let weekly, nightly, or both. When it offers both, the guest
 * picks — and that choice changes the form: a nightly stay needs a departure
 * date and prices per night, a weekly stay is open-ended and charges upfront
 * weeks. When the room offers only one mode there's nothing to choose, so the
 * toggle is hidden rather than shown with a single dead option.
 */
export function BookingForm({
  slug, roomId, weeklyPrice, nightlyPrice, allowsWeekly, allowsNightly, minNights, depositWeeks, houseRules, contractText,
}: {
  slug: string;
  roomId: string;
  weeklyPrice: number;
  nightlyPrice: number;
  allowsWeekly: boolean;
  allowsNightly: boolean;
  minNights: number;
  depositWeeks: number;
  houseRules: string;
  contractText: string;
}) {
  const [state, action] = useFormState(createHomesteadBookingAction, { error: "" } as { error: string });
  const both = allowsWeekly && allowsNightly;
  const [stayType, setStayType] = useState<"WEEKLY" | "NIGHTLY">(allowsWeekly ? "WEEKLY" : "NIGHTLY");
  const nightly = stayType === "NIGHTLY";

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  // Live total so the guest sees the price before committing, not after.
  const nights =
    nightly && start && end
      ? Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000))
      : 0;

  return (
    <form action={action} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="roomId" value={roomId} />
      <input type="hidden" name="stayType" value={stayType} />

      {both ? (
        <div>
          <label className="label">How long are you staying?</label>
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {([["WEEKLY", "By the week"], ["NIGHTLY", "By the night"]] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStayType(value)}
                className={[
                  "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition",
                  stayType === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">Your name</label><input name="guestName" required className="input" /></div>
        <div><label className="label">Email</label><input name="guestEmail" type="email" required className="input" /></div>
        <div><label className="label">Phone</label><input name="guestPhone" className="input" /></div>
        <div>
          <label className="label">{nightly ? "Arrival" : "Preferred start date"}</label>
          <input name="startDate" type="date" required className="input" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        {nightly ? (
          <div>
            <label className="label">Departure</label>
            <input name="endDate" type="date" required className="input" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
          </div>
        ) : null}
      </div>

      <div className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">
        {nightly ? (
          nights > 0 ? (
            <>
              <b>{nights} night{nights === 1 ? "" : "s"}</b> at ${nightlyPrice.toLocaleString()}/night —
              total <b>${(nights * nightlyPrice).toLocaleString()}</b>.
              {minNights > 1 ? <> Minimum stay {minNights} nights.</> : null}
            </>
          ) : (
            <>
              <b>${nightlyPrice.toLocaleString()}/night</b>. Choose your dates to see the total.
              {minNights > 1 ? <> Minimum stay {minNights} nights.</> : null}
            </>
          )
        ) : (
          <>
            You&rsquo;ll be charged <b>${(weeklyPrice * depositWeeks).toLocaleString()}</b> to start ({depositWeeks} week{depositWeeks === 1 ? "" : "s"} upfront), then <b>${weeklyPrice.toLocaleString()}/week</b> automatically until you check out. Cancel anytime.
          </>
        )}
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
      <p className="text-center text-xs text-slate-400">
        {nightly ? "The host confirms your booking, then payment is taken." : "The host confirms your booking, then your weekly payment is set up."}
      </p>
    </form>
  );
}
