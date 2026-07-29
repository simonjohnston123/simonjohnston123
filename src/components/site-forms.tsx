"use client";

import { useFormState } from "react-dom";
import { submitLeadAction, bookingRequestAction } from "@/app/sites/actions";

type State = { ok?: boolean; error: string };
const INIT: State = { error: "" };

function Btn({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <button className="rounded-lg px-5 py-2.5 font-semibold text-white" style={{ background: color }}>
      {children}
    </button>
  );
}

export function LeadForm({
  slug,
  primaryColor,
  fields,
  submitLabel,
  thankYou,
}: {
  slug: string;
  primaryColor: string;
  fields: string[];
  submitLabel: string;
  thankYou: string;
}) {
  const [state, action] = useFormState(submitLeadAction, INIT);
  if (state.ok) {
    return <p className="rounded-lg bg-green-50 px-4 py-3 text-green-800">{thankYou}</p>;
  }
  const has = (f: string) => fields.includes(f);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      {has("name") ? <input name="name" placeholder="Your name" className="input" /> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {has("email") ? <input name="email" type="email" placeholder="Email" className="input" /> : null}
        {has("phone") ? <input name="phone" placeholder="Phone" className="input" /> : null}
      </div>
      {has("company") ? <input name="company" placeholder="Company" className="input" /> : null}
      {has("message") ? <textarea name="message" rows={3} placeholder="How can we help?" className="input" /> : null}
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Btn color={primaryColor}>{submitLabel || "Send"}</Btn>
    </form>
  );
}

export function BookingForm({
  slug,
  primaryColor,
  calendarId,
  submitLabel,
  thankYou,
}: {
  slug: string;
  primaryColor: string;
  calendarId: string;
  submitLabel: string;
  thankYou: string;
}) {
  const [state, action] = useFormState(bookingRequestAction, INIT);
  if (state.ok) {
    return <p className="rounded-lg bg-green-50 px-4 py-3 text-green-800">{thankYou}</p>;
  }
  if (!calendarId) {
    return <p className="rounded-lg bg-amber-50 px-4 py-3 text-amber-800">Booking isn&rsquo;t configured yet.</p>;
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="calendarId" value={calendarId} />
      <input name="name" placeholder="Your name" className="input" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input name="email" type="email" placeholder="Email" className="input" />
        <input name="phone" placeholder="Phone" className="input" />
      </div>
      <label className="block text-sm text-slate-600">
        Preferred time
        <input name="when" type="datetime-local" className="input mt-1" required />
      </label>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Btn color={primaryColor}>{submitLabel || "Request booking"}</Btn>
    </form>
  );
}
