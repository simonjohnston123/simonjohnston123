import { addDays, startOfDay } from "@/lib/homestead-dates";
import type { HomesteadBookingStatus, StayType } from "@prisma/client";

/**
 * Availability strip — one row per room across a rolling window.
 *
 * This is the screen that makes mixed inventory legible: residents and nightly
 * guests compete for the same beds, and the only way to see a clash coming is
 * to draw them on one timeline. Residents render open-ended (no move-out date
 * yet) with a trailing arrow rather than a hard edge, because that's the truth
 * of the booking — it runs until someone ends it.
 */

type TimelineRoom = { id: string; name: string; allowsWeekly: boolean; allowsNightly: boolean };
type TimelineBooking = {
  id: string;
  roomId: string | null;
  guestName: string;
  stayType: StayType;
  status: HomesteadBookingStatus;
  startDate: Date;
  endDate: Date | null;
};

const DAY = 86_400_000;

export function HomesteadTimeline({
  rooms,
  bookings,
  days = 30,
}: {
  rooms: TimelineRoom[];
  bookings: TimelineBooking[];
  days?: number;
}) {
  const windowStart = startOfDay(new Date());
  const windowEnd = addDays(windowStart, days);
  const spanMs = windowEnd.getTime() - windowStart.getTime();

  // Only bookings that actually hold a bed appear — ENDED and CANCELLED don't.
  const live = bookings.filter((b) => b.status === "PENDING" || b.status === "ACTIVE");

  // Month/week gridlines every 7 days, labelled.
  const ticks = Array.from({ length: Math.floor(days / 7) + 1 }, (_, i) => {
    const d = addDays(windowStart, i * 7);
    return {
      left: ((d.getTime() - windowStart.getTime()) / spanMs) * 100,
      label: new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" }).format(d),
    };
  });

  if (rooms.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-slate-400">
        Add a room to see availability.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Scale */}
      <div className="flex border-b border-slate-100 bg-slate-50/60">
        <div className="w-40 shrink-0 border-r border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Room
        </div>
        <div className="relative h-8 flex-1">
          {ticks.map((t) => (
            <div
              key={t.label}
              className="absolute top-0 h-full border-l border-slate-200/70 pl-1 text-[10px] leading-8 text-slate-400"
              style={{ left: `${t.left}%` }}
            >
              {t.label}
            </div>
          ))}
        </div>
      </div>

      {/* One row per room */}
      {rooms.map((room) => {
        const bars = live
          .filter((b) => b.roomId === room.id)
          .map((b) => {
            const bStart = startOfDay(b.startDate);
            // An open-ended residency is clamped to the window edge for drawing.
            const bEnd = b.endDate ? startOfDay(b.endDate) : windowEnd;
            const from = Math.max(bStart.getTime(), windowStart.getTime());
            const to = Math.min(bEnd.getTime(), windowEnd.getTime());
            if (to <= from) return null;
            return {
              ...b,
              left: ((from - windowStart.getTime()) / spanMs) * 100,
              width: ((to - from) / spanMs) * 100,
              openEnded: !b.endDate,
              startsBefore: bStart.getTime() < windowStart.getTime(),
              nights: Math.round((bEnd.getTime() - bStart.getTime()) / DAY),
            };
          })
          .filter(Boolean) as Array<
          TimelineBooking & {
            left: number;
            width: number;
            openEnded: boolean;
            startsBefore: boolean;
            nights: number;
          }
        >;

        return (
          <div key={room.id} className="flex border-b border-slate-100 last:border-b-0">
            <div className="w-40 shrink-0 border-r border-slate-100 px-3 py-3">
              <div className="truncate text-sm font-medium text-slate-800">{room.name}</div>
              <div className="mt-0.5 flex gap-1 text-[10px] text-slate-400">
                {room.allowsWeekly ? <span>Weekly</span> : null}
                {room.allowsWeekly && room.allowsNightly ? <span>·</span> : null}
                {room.allowsNightly ? <span>Nightly</span> : null}
              </div>
            </div>

            <div className="relative h-14 flex-1 bg-[repeating-linear-gradient(90deg,transparent,transparent_calc(100%/30-1px),rgba(148,163,184,0.14)_calc(100%/30))]">
              {bars.length === 0 ? (
                <span className="absolute inset-y-0 left-2 flex items-center text-[11px] text-slate-300">
                  Free
                </span>
              ) : null}

              {bars.map((b) => {
                const nightly = b.stayType === "NIGHTLY";
                return (
                  <div
                    key={b.id}
                    title={`${b.guestName} — ${nightly ? `${b.nights} night${b.nights === 1 ? "" : "s"}` : "resident"}${
                      b.openEnded ? " (open-ended)" : ""
                    }`}
                    className={[
                      "absolute top-1/2 flex h-8 -translate-y-1/2 items-center gap-1 overflow-hidden px-2 text-[11px] font-medium text-white shadow-sm",
                      nightly
                        ? "bg-gradient-to-r from-accent-600 to-accent-500"
                        : "bg-brand-gradient",
                      b.startsBefore ? "rounded-r-lg" : "rounded-lg",
                      b.status === "PENDING" ? "opacity-70 ring-1 ring-inset ring-white/40" : "",
                    ].join(" ")}
                    style={{ left: `${b.left}%`, width: `calc(${b.width}% - 2px)` }}
                  >
                    <span className="truncate">{b.guestName}</span>
                    {b.openEnded ? <span className="ml-auto shrink-0 opacity-80">→</span> : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 bg-slate-50/60 px-3 py-2 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded bg-brand-gradient" /> Resident (weekly)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded bg-gradient-to-r from-accent-600 to-accent-500" /> Guest (nightly)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded bg-slate-300 opacity-70 ring-1 ring-inset ring-white/40" /> Not yet started
        </span>
        <span className="ml-auto">→ open-ended</span>
      </div>
    </div>
  );
}
