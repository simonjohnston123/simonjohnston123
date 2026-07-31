import { startOfDay } from "@/lib/homestead-dates";
import type { StayType } from "@prisma/client";

/**
 * What a stay owes, and whether it's behind.
 *
 * Pure by design — arrears maths decides whether someone gets chased for money
 * they don't owe, so it's kept free of database access and exercised directly.
 *
 * The two stay types accrue completely differently:
 *
 *   NIGHTLY — the whole total is owed at booking. There's no schedule; a guest
 *   either has paid or hasn't.
 *
 *   WEEKLY — rent accrues one week at a time from the move-in date, and stops
 *   accruing when the resident moves out. `depositWeeks` is rent charged in
 *   advance, so a resident who is up to date sits permanently that many weeks
 *   ahead rather than level.
 */

export type BalanceStatus = "PAID" | "OWING" | "ARREARS" | "CREDIT" | "NOT_STARTED";

export type BookingForBalance = {
  stayType: StayType;
  startDate: Date;
  endDate: Date | null;
  weeklyPrice: number;
  totalPrice: number | null;
  status: string;
};

export type Balance = {
  expected: number;
  paid: number;
  /** Positive means money is owed; negative means they're in credit. */
  balance: number;
  status: BalanceStatus;
  /** WEEKLY only — how many whole weeks of rent are outstanding. */
  weeksBehind: number;
  /** WEEKLY only — weeks of rent accrued so far, excluding the advance. */
  weeksAccrued: number;
};

const WEEK_MS = 7 * 86_400_000;

/**
 * Whole weeks a residency has run by `asOf`, stopping at the move-out date.
 * Never negative — a stay that hasn't begun has accrued nothing.
 */
export function weeksElapsed(start: Date, asOf: Date, end: Date | null): number {
  const from = startOfDay(start).getTime();
  const to = startOfDay(end && startOfDay(end) < startOfDay(asOf) ? end : asOf).getTime();
  if (to <= from) return 0;
  return Math.floor((to - from) / WEEK_MS);
}

/**
 * Total owed by `asOf`.
 *
 * Cancelled stays owe nothing — the alternative is chasing people for rooms
 * they never occupied.
 */
export function expectedToDate(
  booking: BookingForBalance,
  asOf: Date,
  depositWeeks: number
): number {
  if (booking.status === "CANCELLED") return 0;

  if (booking.stayType === "NIGHTLY") {
    // The stay is owed in full once booked; nothing accrues over time.
    return booking.totalPrice ?? 0;
  }

  if (startOfDay(booking.startDate) > startOfDay(asOf)) {
    // Not moved in yet — only the advance is due.
    return Math.max(0, depositWeeks) * booking.weeklyPrice;
  }

  const accrued = weeksElapsed(booking.startDate, asOf, booking.endDate);
  return (accrued + Math.max(0, depositWeeks)) * booking.weeklyPrice;
}

/** Where a stay stands: what's owed, what's in, and how far behind. */
export function balanceFor(
  booking: BookingForBalance,
  payments: { amount: number }[],
  asOf: Date,
  depositWeeks: number
): Balance {
  const expected = expectedToDate(booking, asOf, depositWeeks);
  const paid = payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = expected - paid;

  const weeksAccrued =
    booking.stayType === "WEEKLY" && startOfDay(booking.startDate) <= startOfDay(asOf)
      ? weeksElapsed(booking.startDate, asOf, booking.endDate)
      : 0;

  // Only a weekly rate can be expressed as "weeks behind"; a nightly stay is
  // either settled or not.
  const weeksBehind =
    booking.stayType === "WEEKLY" && booking.weeklyPrice > 0 && balance > 0
      ? Math.floor(balance / booking.weeklyPrice)
      : 0;

  let status: BalanceStatus;
  if (booking.status === "CANCELLED") {
    status = paid > 0 ? "CREDIT" : "PAID";
  } else if (expected === 0 && paid === 0) {
    status = "NOT_STARTED";
  } else if (balance <= 0) {
    status = balance < 0 ? "CREDIT" : "PAID";
  } else if (weeksBehind >= 1) {
    status = "ARREARS";
  } else {
    status = "OWING";
  }

  return { expected, paid, balance, status, weeksBehind, weeksAccrued };
}

/**
 * Rent per week from residents currently in place — the recurring income line.
 * Nightly stays are excluded: they're one-off, not recurring.
 */
export function weeklyRentRoll(
  bookings: Array<{ stayType: StayType; status: string; weeklyPrice: number }>
): number {
  return bookings
    .filter((b) => b.stayType === "WEEKLY" && b.status === "ACTIVE")
    .reduce((sum, b) => sum + b.weeklyPrice, 0);
}

export const BALANCE_LABEL: Record<BalanceStatus, string> = {
  PAID: "Up to date",
  OWING: "Part week owing",
  ARREARS: "In arrears",
  CREDIT: "In credit",
  NOT_STARTED: "Not started",
};
