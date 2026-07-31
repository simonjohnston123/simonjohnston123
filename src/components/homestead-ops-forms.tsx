"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { SubmitButton } from "@/components/submit-button";
import {
  addOpsTaskAction,
  generateTurnoversAction,
} from "@/app/dashboard/l/[locationId]/operations/actions";

type Result = { message: string; error: string };
const EMPTY: Result = { message: "", error: "" };

/**
 * Pulls cleaning tasks out of the booking calendar. Idempotent server-side, so
 * the button is safe to press repeatedly — it reports what it found rather than
 * silently doing nothing.
 */
export function GenerateTurnovers({ locationId }: { locationId: string }) {
  const [state, action] = useFormState(generateTurnoversAction, EMPTY);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="locationId" value={locationId} />
      <SubmitButton className="btn-secondary text-sm">Generate from departures</SubmitButton>
      {state.message ? <span className="text-xs text-slate-500">{state.message}</span> : null}
      {state.error ? <span className="text-xs text-red-600">{state.error}</span> : null}
    </form>
  );
}

export function NewOpsTask({
  locationId,
  rooms,
}: {
  locationId: string;
  rooms: { id: string; name: string }[];
}) {
  const [state, action] = useFormState(addOpsTaskAction, EMPTY);
  const [type, setType] = useState("MAINTENANCE");
  const isMaintenance = type === "MAINTENANCE";

  return (
    <form action={action} className="card space-y-3 p-4">
      <input type="hidden" name="locationId" value={locationId} />

      <div><label className="label">What needs doing?</label><input name="title" required className="input" placeholder="Shower mixer dripping in Room 2" /></div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Type</label>
          <select name="type" className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="TURNOVER">Turnover clean</option>
            <option value="CHANGEOVER">Changeover clean</option>
            <option value="INSPECTION">Room inspection</option>
          </select>
        </div>
        <div>
          <label className="label">Priority</label>
          <select name="priority" className="input" defaultValue="NORMAL">
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
        <div>
          <label className="label">Room</label>
          <select name="roomId" className="input" defaultValue="">
            <option value="">Whole property</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div><label className="label">Due</label><input name="dueAt" type="date" className="input" /></div>
        {isMaintenance ? (
          <div className="sm:col-span-2">
            <label className="label">Estimated cost (AUD)</label>
            <input name="cost" type="number" min="0" className="input" placeholder="120" />
          </div>
        ) : null}
      </div>

      <div><label className="label">Notes</label><input name="notes" className="input" placeholder="Anything the cleaner or tradesperson needs to know" /></div>

      {state.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      {state.message ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{state.message}</p> : null}

      <SubmitButton className="btn-primary">Add task</SubmitButton>
    </form>
  );
}
