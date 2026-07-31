/**
 * Demo data for the Homestead mixed-inventory build, plus a check of the
 * interval rule the availability gate is built on.
 *
 * Creates a realistic picture: a room let weekly only, one let both ways, one
 * nightly only; a resident already in place open-ended; a resident with a
 * move-out date; a nightly guest; and a same-day turnover that proves checkout
 * frees the bed.
 *
 * Safe to re-run — it clears only its own demo rows, matched by name prefix.
 *
 *   npx tsx prisma/seed-homestead-demo.ts
 */
import { PrismaClient } from "@prisma/client";
import { addDays, startOfDay, intervalsOverlap, nightsBetween } from "../src/lib/homestead-dates";

const prisma = new PrismaClient();
const DEMO = "Demo · ";

/** The rule the whole gate rests on, checked against the cases that matter. */
function checkIntervalRule(): number {
  const d = (n: number) => addDays(startOfDay(new Date()), n);
  const cases: Array<[string, boolean, boolean]> = [
    ["same-day turnover — depart the 7th, arrive the 7th", intervalsOverlap(d(3), d(7), d(7), d(10)), false],
    ["genuine overlap — 5th–9th against 3rd–7th", intervalsOverlap(d(3), d(7), d(5), d(9)), true],
    ["fully contained — 4th–6th inside 3rd–7th", intervalsOverlap(d(3), d(7), d(4), d(6)), true],
    ["adjacent before — 1st–3rd against 3rd–7th", intervalsOverlap(d(3), d(7), d(1), d(3)), false],
    ["clear gap — 20th–22nd against 3rd–7th", intervalsOverlap(d(3), d(7), d(20), d(22)), false],
    ["open-ended resident blocks a stay a year out", intervalsOverlap(d(-21), null, d(365), d(367)), true],
    ["open-ended resident vs a stay before they arrived", intervalsOverlap(d(10), null, d(1), d(5)), false],
    ["two open-ended residents in one room", intervalsOverlap(d(-21), null, d(30), null), true],
    ["nights are counted exclusive of departure", nightsBetween(d(3), d(7)) === 4, true],
  ];

  let failed = 0;
  console.log("\nInterval rule:");
  for (const [label, actual, expected] of cases) {
    const pass = actual === expected;
    if (!pass) failed++;
    console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}`);
  }
  return failed;
}

async function main() {
  const failed = checkIntervalRule();

  // The slug has varied ("placid-homestead" vs "placid-home-stead"), so match
  // on the name the way the sidebar does rather than pinning an exact slug.
  const locations = await prisma.location.findMany({ select: { id: true, name: true, slug: true } });
  const location = locations.find((l) => /home\s*stead|accommodation/i.test(l.name));
  if (!location) {
    throw new Error(
      `No Homestead location found. Existing: ${locations.map((l) => l.name).join(", ") || "none"}`
    );
  }

  // Clear previous demo rows only.
  const old = await prisma.homesteadRoom.findMany({
    where: { locationId: location.id, name: { startsWith: DEMO } },
    select: { id: true },
  });
  const oldIds = old.map((r) => r.id);
  if (oldIds.length) {
    await prisma.homesteadBooking.deleteMany({ where: { roomId: { in: oldIds } } });
    await prisma.homesteadRoom.deleteMany({ where: { id: { in: oldIds } } });
  }

  const today = startOfDay(new Date());

  const weeklyOnly = await prisma.homesteadRoom.create({
    data: {
      locationId: location.id, name: `${DEMO}Room 1 — long stay`,
      description: "Furnished single, all bills included. Residents only.",
      weeklyPrice: 260, allowsWeekly: true, allowsNightly: false,
    },
  });

  const both = await prisma.homesteadRoom.create({
    data: {
      locationId: location.id, name: `${DEMO}Room 2 — flexible`,
      description: "Queen with ensuite. Let weekly or by the night.",
      weeklyPrice: 340, nightlyPrice: 95, allowsWeekly: true, allowsNightly: true, minNights: 2,
    },
  });

  const nightlyOnly = await prisma.homesteadRoom.create({
    data: {
      locationId: location.id, name: `${DEMO}Room 3 — nightly`,
      description: "Twin room kept free for short stays.",
      nightlyPrice: 110, allowsWeekly: false, allowsNightly: true, minNights: 1,
    },
  });

  await prisma.homesteadBooking.createMany({
    data: [
      // Resident who moved in three weeks ago, no end date — open-ended.
      {
        locationId: location.id, roomId: weeklyOnly.id, stayType: "WEEKLY",
        guestName: "Marcus Webb", guestEmail: "marcus.webb@example.com",
        startDate: addDays(today, -21), endDate: null,
        weeklyPrice: 260, status: "ACTIVE", contractAccepted: true, signature: "Marcus Webb",
      },
      // Resident in the flexible room, moving out in twelve days.
      {
        locationId: location.id, roomId: both.id, stayType: "WEEKLY",
        guestName: "Aleisha Nguyen", guestEmail: "aleisha.n@example.com",
        startDate: addDays(today, -7), endDate: addDays(today, 12),
        weeklyPrice: 340, status: "ACTIVE", contractAccepted: true, signature: "Aleisha Nguyen",
      },
      // Nightly guest, arriving in three days for four nights.
      {
        locationId: location.id, roomId: nightlyOnly.id, stayType: "NIGHTLY",
        guestName: "Priya Raman", guestEmail: "priya.raman@example.com",
        startDate: addDays(today, 3), endDate: addDays(today, 7),
        nightlyPrice: 110, totalPrice: 440, status: "PENDING", contractAccepted: true, signature: "Priya Raman",
      },
      // Same-day turnover — arrives the exact day Priya departs.
      {
        locationId: location.id, roomId: nightlyOnly.id, stayType: "NIGHTLY",
        guestName: "Tom Halloran", guestEmail: "t.halloran@example.com",
        startDate: addDays(today, 7), endDate: addDays(today, 10),
        nightlyPrice: 110, totalPrice: 330, status: "PENDING", contractAccepted: true, signature: "Tom Halloran",
      },
      // Guest booked into the flexible room after Aleisha moves out.
      {
        locationId: location.id, roomId: both.id, stayType: "NIGHTLY",
        guestName: "Dana Whitfield", guestEmail: "dana.w@example.com",
        startDate: addDays(today, 14), endDate: addDays(today, 18),
        nightlyPrice: 95, totalPrice: 380, status: "PENDING", contractAccepted: true, signature: "Dana Whitfield",
      },
    ],
  });

  console.log(`\nSeeded 3 demo rooms and 5 bookings into "${location.name}".`);
  console.log(failed === 0 ? "All interval checks passed.\n" : `${failed} interval check(s) FAILED.\n`);
  if (failed > 0) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
