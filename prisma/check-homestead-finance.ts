/**
 * Exercises the arrears maths against fixed cases and the real database.
 *
 * Reads only — it never writes. Arrears decides whether someone gets chased for
 * money they don't owe, so the edges are worth pinning down explicitly.
 *
 *   npx tsx prisma/check-homestead-finance.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  balanceFor,
  expectedToDate,
  weeksElapsed,
  weeklyRentRoll,
  type BookingForBalance,
} from "../src/lib/homestead-finance-rules";
import { addDays, startOfDay } from "../src/lib/homestead-dates";

const prisma = new PrismaClient();

function fixedCases(): number {
  const today = startOfDay(new Date());
  const d = (n: number) => addDays(today, n);

  const resident = (over: Partial<BookingForBalance> = {}): BookingForBalance => ({
    stayType: "WEEKLY", startDate: d(-21), endDate: null,
    weeklyPrice: 200, totalPrice: null, status: "ACTIVE", ...over,
  });
  const guest = (over: Partial<BookingForBalance> = {}): BookingForBalance => ({
    stayType: "NIGHTLY", startDate: d(2), endDate: d(5),
    weeklyPrice: 0, totalPrice: 400, status: "PENDING", ...over,
  });

  const cases: Array<[string, unknown, unknown]> = [];

  // --- accrual -----------------------------------------------------------
  cases.push(["3 weeks in place accrues 3 weeks", weeksElapsed(d(-21), today, null), 3]);
  cases.push(["a part week doesn't accrue", weeksElapsed(d(-10), today, null), 1]);
  cases.push(["a stay starting today has accrued nothing", weeksElapsed(today, today, null), 0]);
  cases.push(["a future move-in never accrues negatively", weeksElapsed(d(14), today, null), 0]);
  cases.push(["accrual stops at move-out", weeksElapsed(d(-70), today, d(-42)), 4]);

  // --- what's owed -------------------------------------------------------
  // 3 weeks elapsed + 1 week in advance, at $200.
  cases.push(["resident owes elapsed weeks plus the advance", expectedToDate(resident(), today, 1), 800]);
  cases.push(["no advance configured means elapsed weeks only", expectedToDate(resident(), today, 0), 600]);
  cases.push(["a resident not yet moved in owes only the advance", expectedToDate(resident({ startDate: d(7) }), today, 2), 400]);
  cases.push(["a nightly stay owes its full total up front", expectedToDate(guest(), today, 1), 400]);
  cases.push(["a cancelled stay owes nothing", expectedToDate(resident({ status: "CANCELLED" }), today, 1), 0]);

  // --- standing ----------------------------------------------------------
  const paidUp = balanceFor(resident(), [{ amount: 800 }], today, 1);
  cases.push(["paying the full expected amount reads as up to date", paidUp.status, "PAID"]);
  cases.push(["and leaves a zero balance", paidUp.balance, 0]);

  const behind = balanceFor(resident(), [{ amount: 400 }], today, 1);
  cases.push(["being two weeks short is arrears", behind.status, "ARREARS"]);
  cases.push(["and reports the weeks behind", behind.weeksBehind, 2]);

  const partial = balanceFor(resident({ weeklyPrice: 200 }), [{ amount: 750 }], today, 1);
  cases.push(["less than a full week short is owing, not arrears", partial.status, "OWING"]);
  cases.push(["and is not counted as a week behind", partial.weeksBehind, 0]);

  const ahead = balanceFor(resident(), [{ amount: 1000 }], today, 1);
  cases.push(["overpaying reads as in credit", ahead.status, "CREDIT"]);
  cases.push(["with a negative balance", ahead.balance, -200]);

  const unpaidGuest = balanceFor(guest(), [], today, 1);
  cases.push(["an unpaid nightly stay owes its total", unpaidGuest.balance, 400]);
  cases.push(["but is never described in weeks behind", unpaidGuest.weeksBehind, 0]);

  const movedOut = balanceFor(resident({ endDate: d(-7) }), [{ amount: 600 }], today, 1);
  cases.push(["a resident who moved out stops accruing", movedOut.status, "PAID"]);

  // --- rent roll ---------------------------------------------------------
  const roll = weeklyRentRoll([
    { stayType: "WEEKLY", status: "ACTIVE", weeklyPrice: 200 },
    { stayType: "WEEKLY", status: "ACTIVE", weeklyPrice: 340 },
    { stayType: "WEEKLY", status: "ENDED", weeklyPrice: 500 },
    { stayType: "NIGHTLY", status: "ACTIVE", weeklyPrice: 0 },
  ]);
  cases.push(["rent roll counts only residents in place", roll, 540]);

  let failed = 0;
  console.log("\nFinance rules:");
  for (const [label, actual, expected] of cases) {
    const pass = actual === expected;
    if (!pass) failed++;
    console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${pass ? "" : ` — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
  }
  return failed;
}

async function main() {
  const failed = fixedCases();

  const locations = await prisma.location.findMany({ select: { id: true, name: true } });
  const location = locations.find((l) => /home\s*stead|accommodation/i.test(l.name));
  if (!location) {
    console.log("\nNo Homestead location — skipping the live-data pass.\n");
    process.exitCode = failed > 0 ? 1 : 0;
    return;
  }

  const [bookings, payments, settings] = await Promise.all([
    prisma.homesteadBooking.findMany({
      where: { locationId: location.id, status: { not: "CANCELLED" } },
      include: { room: { select: { name: true } } },
      orderBy: { startDate: "asc" },
    }),
    prisma.homesteadPayment.findMany({ where: { locationId: location.id } }),
    prisma.homesteadSettings.findUnique({ where: { locationId: location.id } }),
  ]);

  const depositWeeks = settings?.depositWeeks ?? 1;
  const byBooking = new Map<string, { amount: number }[]>();
  for (const p of payments) {
    const l = byBooking.get(p.bookingId) ?? [];
    l.push({ amount: p.amount });
    byBooking.set(p.bookingId, l);
  }

  const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
  console.log(`\nAgainst live data — "${location.name}", ${depositWeeks} week(s) in advance:`);
  let owed = 0;
  for (const b of bookings) {
    const bal = balanceFor(b, byBooking.get(b.id) ?? [], new Date(), depositWeeks);
    owed += Math.max(0, bal.balance);
    console.log(
      `  ${bal.status.padEnd(11)} ${b.guestName.padEnd(18)} ${b.stayType.padEnd(7)} expected ${money(bal.expected).padStart(7)}  paid ${money(bal.paid).padStart(7)}  balance ${money(bal.balance).padStart(7)}`
    );
  }
  console.log(`  Weekly rent roll: ${money(weeklyRentRoll(bookings))} · outstanding: ${money(owed)}`);

  console.log(failed === 0 ? "\nAll finance checks passed.\n" : `\n${failed} finance check(s) FAILED.\n`);
  if (failed > 0) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
