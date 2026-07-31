"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { SubmitButton } from "@/components/submit-button";
import { addBookingAction } from "@/app/dashboard/l/[locationId]/rooms/actions";

type Room = {
  id: string;
  name: string;
  allowsWeekly: boolean;
  allowsNightly: boolean;
  weeklyPrice: number;
  nightlyPrice: number;
  minNights: number;
};

/**
 * Staff-side booking entry for walk-ins and phone bookings.
 *
 * The stay type drives the whole form: a resident needs only a move-in date,
 * a guest needs arrival *and* departure. Picking a room narrows the available
 * stay types to what that room actually offers, so you can't get as far as
 * submitting a nightly booking for a weekly-only room.
 */
export function HomesteadNewBooking({
  locationId,
  rooms,
}: {
  locationId: string;
  rooms: Room[];
}) {
  const [state, action] = useFormState(addBookingAction, { error: "" } as { error: string });
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const room = rooms.find((r) => r.id === roomId);

  const canWeekly = room?.allowsWeekly ?? true;
  const canNightly = room?.allowsNightly ?? false;
  const [stayType, setStayType] = useState<"WEEKLY" | "NIGHTLY">("WEEKLY");

  // Keep the selected stay type honest when the room changes.
  const effectiveStay = stayType === "NIGHTLY" && !canNightly ? "WEEKLY" : stayType === "WEEKLY" && !canWeekly ? "NIGHTLY" : stayType;
  const nightly = effectiveStay === "NIGHTLY";

  if (rooms.length === 0) {
    return <p className="card p-4 text-sm text-slate-400">Add a room first.</p>;
  }

  return (
    <form action={action} className="card space-y-3 p-4">
      <input type="hidden" name="locationId" value={locationId} />
      <input type="hidden" name="stayType" value={effectiveStay} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Room</label>
          <select name="roomId" className="input" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Stay type</label>
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {([
              ["WEEKLY", "Resident", canWeekly],
              ["NIGHTLY", "Guest", canNightly],
            ] as const).map(([value, label, enabled]) => (
              <button
                key={value}
                type="button"
                disabled={!enabled}
                onClick={() => setStayType(value)}
                className={[
                  "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  effectiveStay === value
                    ? "bg-white text-slate-900 shadow-sm"
                    : enabled
                      ? "text-slate-500 hover:text-slate-800"
                      : "cursor-not-allowed text-slate-300",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Guest name</label>
          <input name="guestName" required className="input" placeholder="Jane Doe" />
        </div>
        <div>
          <label className="label">Email</label>
          <input name="guestEmail" type="email" className="input" placeholder="jane@example.com" />
        </div>
        <div>
          <label className="label">Phone</label>
          <input name="guestPhone" className="input" placeholder="04xx xxx xxx" />
        </div>
        <div>
          <label className="label">{nightly ? "Arrival" : "Move-in date"}</label>
          <input name="startDate" type="date" required className="input" />
        </div>
        {nightly ? (
          <div>
            <label className="label">Departure</label>
            <input name="endDate" type="date" required className="input" />
          </div>
        ) : null}
      </div>

      {room ? (
        <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-800">
          {nightly ? (
            <>
              <b>${room.nightlyPrice.toLocaleString()}</b> per night
              {room.minNights > 1 ? <> · {room.minNights}-night minimum</> : null}
            </>
          ) : (
            <>
              <b>${room.weeklyPrice.toLocaleString()}</b> per week · open-ended until you end the stay
            </>
          )}
        </p>
      ) : null}

      {state?.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}

      <SubmitButton className="btn-primary">Add booking</SubmitButton>
    </form>
  );
}
