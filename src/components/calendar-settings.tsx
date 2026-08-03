"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { SubmitButton } from "@/components/submit-button";
import { updateCalendarAction, createCalendarAction } from "@/app/dashboard/l/[locationId]/calendar/actions";

const DAYS: { key: string; label: string }[] = [
  { key: "1", label: "Mon" },
  { key: "2", label: "Tue" },
  { key: "3", label: "Wed" },
  { key: "4", label: "Thu" },
  { key: "5", label: "Fri" },
  { key: "6", label: "Sat" },
  { key: "0", label: "Sun" },
];

type Availability = Record<string, [string, string][]>;
type DayState = { on: boolean; start: string; end: string };

function initDays(avail: Availability): Record<string, DayState> {
  const hasAny = avail && Object.keys(avail).length > 0;
  const out: Record<string, DayState> = {};
  for (const d of DAYS) {
    const win = avail?.[d.key]?.[0];
    if (win) out[d.key] = { on: true, start: win[0], end: win[1] };
    else out[d.key] = { on: !hasAny && ["1", "2", "3", "4", "5"].includes(d.key), start: "09:00", end: "17:00" };
  }
  return out;
}

export function CalendarSettings({
  locationId,
  calendar,
}: {
  locationId: string;
  calendar: {
    id: string; name: string; description: string | null; price: number | null; active: boolean;
    durationMinutes: number; bookingWindowDays: number; availability: unknown;
    calloutFeeCents?: number | null; travelFeeCents?: number | null;
    travelPerKmCents?: number | null; travelFreeKm?: number | null;
  };
}) {
  const [state, formAction] = useFormState(updateCalendarAction, { error: "", ok: false } as { error: string; ok?: boolean });
  const [days, setDays] = useState<Record<string, DayState>>(() => initDays((calendar.availability as Availability) ?? {}));

  const availability: Availability = {};
  for (const d of DAYS) {
    const s = days[d.key];
    if (s.on) availability[d.key] = [[s.start, s.end]];
  }

  const set = (key: string, patch: Partial<DayState>) =>
    setDays((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <input type="hidden" name="locationId" value={locationId} />
      <input type="hidden" name="calendarId" value={calendar.id} />
      <input type="hidden" name="availability" value={JSON.stringify(availability)} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="label">Service / calendar name</label>
          <input name="name" defaultValue={calendar.name} className="input" />
        </div>
        <div>
          <label className="label">Price (AUD, optional)</label>
          <input name="price" type="number" min="0" step="1" defaultValue={calendar.price ?? ""} placeholder="e.g. 120" className="input" />
        </div>
        <div>
          <label className="label">Slot length (min)</label>
          <input name="durationMinutes" type="number" defaultValue={calendar.durationMinutes} className="input" />
        </div>

        {/* Mobile / on-site charges. Leave blank for services done at your premises. */}
        <div className="sm:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Mobile service fees <span className="font-normal normal-case text-slate-400">— leave blank if the customer comes to you</span></div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className="label">Call-out fee ($)</label>
                <input name="calloutFee" type="number" min="0" step="0.01" defaultValue={calendar.calloutFeeCents != null ? (calendar.calloutFeeCents / 100).toFixed(2) : ""} placeholder="e.g. 80" className="input" />
              </div>
              <div>
                <label className="label">Travel fee ($)</label>
                <input name="travelFee" type="number" min="0" step="0.01" defaultValue={calendar.travelFeeCents != null ? (calendar.travelFeeCents / 100).toFixed(2) : ""} placeholder="flat" className="input" />
              </div>
              <div>
                <label className="label">Per km ($)</label>
                <input name="travelPerKm" type="number" min="0" step="0.01" defaultValue={calendar.travelPerKmCents != null ? (calendar.travelPerKmCents / 100).toFixed(2) : ""} placeholder="e.g. 1.10" className="input" />
              </div>
              <div>
                <label className="label">Free within (km)</label>
                <input name="travelFreeKm" type="number" min="0" step="1" defaultValue={calendar.travelFreeKm ?? ""} placeholder="e.g. 20" className="input" />
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">Call-out is charged once per booking. Travel is a flat fee and/or per-km beyond the free radius.</p>
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Description (shown to customers)</label>
          <input name="description" defaultValue={calendar.description ?? ""} placeholder="What this booking / service includes" className="input" />
        </div>
        <div>
          <label className="label">Book up to (days ahead)</label>
          <input name="bookingWindowDays" type="number" defaultValue={calendar.bookingWindowDays} className="input" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="active" defaultChecked={calendar.active} />
        Bookable — customers can book this service online
      </label>

      <div>
        <label className="label">Weekly availability</label>
        <div className="space-y-1.5">
          {DAYS.map((d) => {
            const s = days[d.key];
            return (
              <div key={d.key} className="flex items-center gap-2">
                <label className="flex w-16 items-center gap-1.5 text-sm text-slate-700">
                  <input type="checkbox" checked={s.on} onChange={(e) => set(d.key, { on: e.target.checked })} />
                  {d.label}
                </label>
                {s.on ? (
                  <>
                    <input type="time" value={s.start} onChange={(e) => set(d.key, { start: e.target.value })} className="input h-9 w-32 py-1" />
                    <span className="text-slate-400">–</span>
                    <input type="time" value={s.end} onChange={(e) => set(d.key, { end: e.target.value })} className="input h-9 w-32 py-1" />
                  </>
                ) : (
                  <span className="text-sm text-slate-400">Closed</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton className="btn-primary">Save availability</SubmitButton>
        {state?.ok ? <span className="text-sm text-green-600">Saved.</span> : null}
        {state?.error ? <span className="text-sm text-red-600">{state.error}</span> : null}
      </div>
    </form>
  );
}

export function NewCalendarForm({ locationId }: { locationId: string }) {
  const [state, formAction] = useFormState(createCalendarAction, { error: "", ok: false } as { error: string; ok?: boolean });
  return (
    <form action={formAction} className="flex gap-2">
      <input type="hidden" name="locationId" value={locationId} />
      <input name="name" placeholder="New calendar name" className="input h-9 py-1 text-sm" />
      <button className="btn-secondary text-sm">Add calendar</button>
      {state?.error ? <span className="self-center text-xs text-red-600">{state.error}</span> : null}
    </form>
  );
}
