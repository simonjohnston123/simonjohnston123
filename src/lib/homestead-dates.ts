import type { HomesteadBookingStatus, StayType } from "@prisma/client";

/**
 * Pure date and interval logic for Homestead availability.
 *
 * Deliberately free of `server-only` and of any database import, so the same
 * rules can run in a server component, a seed script, or a test. The stateful
 * half — the queries that ask what's actually booked — lives in `homestead.ts`.
 *
 * Intervals are half-open, [start, end):
 *   - A guest departing on the 14th frees the bed *on* the 14th, so an arrival
 *     that day is not a clash. Same-day turnover is normal, and a naive
 *     `start <= otherEnd && end >= otherStart` test wrongly blocks it.
 *   - A resident with no end date is open-ended: they hold the room from their
 *     start date until someone ends the stay.
 */

/** Midnight local — bookings are day-grained, not time-grained. */
export function startOfDay(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Whole nights between arrival and departure. */
export function nightsBetween(start: Date | string, end: Date | string): number {
  const ms = startOfDay(end).getTime() - startOfDay(start).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/**
 * Do [aStart, aEnd) and [bStart, bEnd) share any night?
 * A null end means open-ended.
 */
export function intervalsOverlap(
  aStart: Date,
  aEnd: Date | null,
  bStart: Date,
  bEnd: Date | null
): boolean {
  const aStarts = startOfDay(aStart).getTime();
  const bStarts = startOfDay(bStart).getTime();
  const aEnds = aEnd ? startOfDay(aEnd).getTime() : Number.POSITIVE_INFINITY;
  const bEnds = bEnd ? startOfDay(bEnd).getTime() : Number.POSITIVE_INFINITY;
  return aStarts < bEnds && bStarts < aEnds;
}

/** Human label for a status — residents move in, guests check in. */
export function statusLabel(status: HomesteadBookingStatus, stayType: StayType): string {
  const nightly = stayType === "NIGHTLY";
  switch (status) {
    case "PENDING":
      return nightly ? "Booked" : "Starting";
    case "ACTIVE":
      return nightly ? "Checked in" : "In residence";
    case "ENDED":
      return nightly ? "Checked out" : "Moved out";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}
