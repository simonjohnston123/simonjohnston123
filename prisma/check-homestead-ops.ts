/**
 * Exercises the operations rules against the real bookings in the database,
 * plus fixed cases for the judgements that are easy to get wrong.
 *
 * Reads only — it prints what would be generated and never writes.
 *
 *   npx tsx prisma/check-homestead-ops.ts
 */
import { PrismaClient } from "@prisma/client";
import { planTurnovers, type BookingForPlanning } from "../src/lib/homestead-ops-rules";
import { addDays, startOfDay } from "../src/lib/homestead-dates";

const prisma = new PrismaClient();

function fixedCases(): number {
  const today = startOfDay(new Date());
  const d = (n: number) => addDays(today, n);
  const base = (over: Partial<BookingForPlanning>): BookingForPlanning => ({
    id: "b", roomId: "r1", roomName: "Room 1", guestName: "Guest",
    stayType: "NIGHTLY", startDate: d(0), endDate: d(3), status: "PENDING", ...over,
  });

  const cases: Array<[string, boolean, boolean]> = [];

  // Departure with an arrival the same day, same room → URGENT.
  {
    const out = planTurnovers([
      base({ id: "out", startDate: d(1), endDate: d(4) }),
      base({ id: "in", startDate: d(4), endDate: d(6) }),
    ], today);
    const dep = out.find((p) => p.bookingId === "out");
    cases.push(["same-day arrival makes the clean URGENT", dep?.priority === "URGENT", true]);
    cases.push(["same-day flag is set", dep?.sameDay === true, true]);
  }

  // Same day but a *different* room → not urgent.
  {
    const out = planTurnovers([
      base({ id: "out", roomId: "r1", startDate: d(1), endDate: d(4) }),
      base({ id: "in", roomId: "r2", startDate: d(4), endDate: d(6) }),
    ], today);
    cases.push(["a different room the same day is not urgent", out.find((p) => p.bookingId === "out")?.priority === "NORMAL", true]);
  }

  // Open-ended resident → no task at all.
  {
    const out = planTurnovers([base({ stayType: "WEEKLY", endDate: null })], today);
    cases.push(["open-ended resident produces no clean", out.length === 0, true]);
  }

  // Resident with a move-out date → CHANGEOVER, not TURNOVER.
  {
    const out = planTurnovers([base({ stayType: "WEEKLY", endDate: d(5) })], today);
    cases.push(["resident move-out is a changeover", out[0]?.type === "CHANGEOVER", true]);
    cases.push(["nightly departure is a turnover", planTurnovers([base({ endDate: d(5) })], today)[0]?.type === "TURNOVER", true]);
  }

  // A departure already past → HIGH, because the room is out of service.
  {
    const out = planTurnovers([base({ endDate: d(-1) })], today);
    cases.push(["a departure already past is HIGH", out[0]?.priority === "HIGH", true]);
  }

  // Beyond the horizon → ignored.
  {
    const out = planTurnovers([base({ endDate: d(60) })], today, { horizonDays: 14 });
    cases.push(["departures beyond the horizon are skipped", out.length === 0, true]);
  }

  // Cancelled bookings never generate work, and never count as an arrival.
  {
    const out = planTurnovers([base({ status: "CANCELLED", endDate: d(3) })], today);
    cases.push(["cancelled bookings produce no clean", out.length === 0, true]);
    const out2 = planTurnovers([
      base({ id: "out", startDate: d(1), endDate: d(4) }),
      base({ id: "in", startDate: d(4), endDate: d(6), status: "CANCELLED" }),
    ], today);
    cases.push(["a cancelled arrival doesn't make it urgent", out2.find((p) => p.bookingId === "out")?.priority === "NORMAL", true]);
  }

  let failed = 0;
  console.log("\nOperations rules:");
  for (const [label, actual, expected] of cases) {
    const pass = actual === expected;
    if (!pass) failed++;
    console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}`);
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

  const bookings = await prisma.homesteadBooking.findMany({
    where: { locationId: location.id, status: { in: ["PENDING", "ACTIVE", "ENDED"] }, roomId: { not: null } },
    select: {
      id: true, roomId: true, guestName: true, stayType: true,
      startDate: true, endDate: true, status: true, room: { select: { name: true } },
    },
  });

  const planned = planTurnovers(
    bookings.map((b) => ({ ...b, roomName: b.room?.name ?? null })),
    new Date()
  );

  // Local, not toISOString() — these are local-midnight dates, and printing
  // them in UTC shows the day before for anywhere east of Greenwich.
  const fmt = (d: Date) => new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(d);
  console.log(`\nAgainst live data — ${bookings.length} bookings in "${location.name}":`);
  if (planned.length === 0) {
    console.log("  (no departures inside the horizon)");
  }
  for (const p of planned) {
    console.log(`  [${p.priority.padEnd(6)}] due ${fmt(p.dueAt)}  ${p.title}`);
  }

  console.log(
    failed === 0
      ? `\nAll rule checks passed. ${planned.length} task(s) would be generated.\n`
      : `\n${failed} rule check(s) FAILED.\n`
  );
  if (failed > 0) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
