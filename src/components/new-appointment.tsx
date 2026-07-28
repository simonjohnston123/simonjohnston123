"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { createAppointmentAction } from "@/app/dashboard/l/[locationId]/calendar/actions";
import { SubmitButton } from "@/components/submit-button";

export function NewAppointmentButton({
  locationId,
  calendars,
  contacts,
}: {
  locationId: string;
  calendars: { id: string; name: string; durationMinutes: number }[];
  contacts: { id: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(createAppointmentAction, { error: "", ok: false } as { error: string; ok?: boolean });

  if (state?.ok && open) setTimeout(() => setOpen(false), 0);

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>+ New appointment</button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">New appointment</h2>
            <form action={formAction} className="space-y-4">
              <input type="hidden" name="locationId" value={locationId} />
              <div>
                <label className="label" htmlFor="title">Title</label>
                <input id="title" name="title" required className="input" placeholder="Site tour" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="calendarId">Calendar</label>
                  <select id="calendarId" name="calendarId" className="input" required>
                    {calendars.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="durationMinutes">Duration (min)</label>
                  <input id="durationMinutes" name="durationMinutes" type="number" min="5" step="5" defaultValue={calendars[0]?.durationMinutes ?? 30} className="input" />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="startAt">Start</label>
                <input id="startAt" name="startAt" type="datetime-local" required className="input" />
              </div>
              <div>
                <label className="label" htmlFor="contactId">Contact (optional)</label>
                <select id="contactId" name="contactId" className="input">
                  <option value="">— None —</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              {state?.error ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
                <SubmitButton className="btn-primary">Create</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
