import { startOfDay } from "@/lib/homestead-dates";
import type { OpsPriority, OpsTaskStatus, OpsTaskType, StayType } from "@prisma/client";

/**
 * The rules that turn bookings into work — pure, so they can be exercised
 * against real data without a server runtime. The queries that feed them live
 * in `homestead-ops.ts`.
 *
 * The judgement that matters here is priority. The availability engine allows a
 * departure and an arrival in the same room on the same day, because that's
 * normal practice. But it means the clean between them is the only thing
 * standing between two guests, and it has hours rather than days. Those are
 * URGENT; everything else grades down from there.
 */

export const OPS_TYPE_LABEL: Record<OpsTaskType, string> = {
  TURNOVER: "Turnover clean",
  CHANGEOVER: "Changeover clean",
  INSPECTION: "Room inspection",
  MAINTENANCE: "Maintenance",
};

export const OPS_STATUS_LABEL: Record<OpsTaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  DONE: "Done",
};

export const OPS_PRIORITY_LABEL: Record<OpsPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

/** Ordering for the queue — urgent first. */
export const PRIORITY_RANK: Record<OpsPriority, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

export type BookingForPlanning = {
  id: string;
  roomId: string | null;
  roomName?: string | null;
  guestName: string;
  stayType: StayType;
  startDate: Date;
  endDate: Date | null;
  status: string;
};

export type PlannedTask = {
  bookingId: string;
  roomId: string;
  type: OpsTaskType;
  priority: OpsPriority;
  title: string;
  dueAt: Date;
  notes: string | null;
  sameDay: boolean;
};

/** A nightly guest leaving is a turnover; a resident moving out, a changeover. */
export function taskTypeFor(stayType: StayType): OpsTaskType {
  return stayType === "NIGHTLY" ? "TURNOVER" : "CHANGEOVER";
}

/**
 * Which departures need a clean, of what kind, and how urgently.
 *
 * `today` is passed in rather than read from the clock so the result is
 * deterministic and testable.
 */
export function planTurnovers(
  bookings: BookingForPlanning[],
  today: Date,
  opts: { horizonDays?: number; lookbackDays?: number } = {}
): PlannedTask[] {
  const horizon = opts.horizonDays ?? 14;
  const lookback = opts.lookbackDays ?? 2;
  const start = startOfDay(today);
  const from = startOfDay(new Date(start.getTime() - lookback * 86_400_000));
  const to = startOfDay(new Date(start.getTime() + horizon * 86_400_000));

  // Arrivals indexed by room + day. A booking that has already ended can't be
  // the arrival side of a turnover, so it's excluded.
  const arrivals = new Set(
    bookings
      .filter((b) => b.roomId && b.status !== "ENDED" && b.status !== "CANCELLED")
      .map((b) => `${b.roomId}|${startOfDay(b.startDate).getTime()}`)
  );

  const planned: PlannedTask[] = [];

  for (const b of bookings) {
    // Open-ended residents have nothing to clean yet — there's no departure.
    if (!b.roomId || !b.endDate) continue;
    if (b.status === "CANCELLED") continue;

    const end = startOfDay(b.endDate);
    if (end.getTime() < from.getTime() || end.getTime() > to.getTime()) continue;

    const type = taskTypeFor(b.stayType);
    const sameDay = arrivals.has(`${b.roomId}|${end.getTime()}`);
    const priority: OpsPriority = sameDay
      ? "URGENT"
      : end.getTime() <= start.getTime()
        ? "HIGH"
        : "NORMAL";

    const roomName = b.roomName ?? "Room";
    planned.push({
      bookingId: b.id,
      roomId: b.roomId,
      type,
      priority,
      title: sameDay
        ? `${OPS_TYPE_LABEL[type]} — ${roomName} (same-day turnover after ${b.guestName})`
        : `${OPS_TYPE_LABEL[type]} — ${roomName} (after ${b.guestName})`,
      dueAt: end,
      notes: sameDay
        ? "A new guest arrives the same day — this room must be ready before they check in."
        : null,
      sameDay,
    });
  }

  return planned;
}
