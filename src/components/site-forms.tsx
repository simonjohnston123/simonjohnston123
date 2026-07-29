"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { submitLeadAction, bookingRequestAction } from "@/app/sites/actions";

type DaySlots = { date: string; label: string; items: { iso: string; label: string }[] };

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
  const [days, setDays] = useState<DaySlots[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState(0);
  const [selected, setSelected] = useState("");

  useEffect(() => {
    if (!calendarId) return;
    let alive = true;
    fetch(`/api/booking/slots?slug=${encodeURIComponent(slug)}&calendarId=${encodeURIComponent(calendarId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setDays(Array.isArray(d.slots) ? d.slots : []);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [slug, calendarId]);

  if (state.ok) {
    return <p className="rounded-lg bg-green-50 px-4 py-3 text-green-800">{thankYou}</p>;
  }
  if (!calendarId) {
    return <p className="rounded-lg bg-amber-50 px-4 py-3 text-amber-800">Booking isn&rsquo;t configured yet.</p>;
  }

  const day = days[activeDay];

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="calendarId" value={calendarId} />
      <input type="hidden" name="when" value={selected} />

      <input name="name" placeholder="Your name" className="input" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input name="email" type="email" placeholder="Email" className="input" />
        <input name="phone" placeholder="Phone" className="input" />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Pick a time</p>
        {loading ? (
          <p className="text-sm text-slate-400">Loading available times…</p>
        ) : days.length === 0 ? (
          <p className="text-sm text-slate-500">No times available right now — please get in touch.</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              {days.map((d, i) => (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => { setActiveDay(i); setSelected(""); }}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${i === activeDay ? "border-transparent text-white" : "border-slate-200 text-slate-700"}`}
                  style={i === activeDay ? { background: primaryColor } : undefined}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {day?.items.map((s) => (
                <button
                  key={s.iso}
                  type="button"
                  onClick={() => setSelected(s.iso)}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${selected === s.iso ? "border-transparent text-white" : "border-slate-200 text-slate-700 hover:border-slate-300"}`}
                  style={selected === s.iso ? { background: primaryColor } : undefined}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        className="rounded-lg px-5 py-2.5 font-semibold text-white disabled:opacity-40"
        style={{ background: primaryColor }}
        disabled={!selected}
      >
        {submitLabel || "Request booking"}
      </button>
    </form>
  );
}
