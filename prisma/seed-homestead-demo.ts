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
    // Payments cascade from their booking, but ops tasks only null out their
    // roomId — clear those explicitly so re-running doesn't leave orphans.
    const oldBookings = await prisma.homesteadBooking.findMany({
      where: { roomId: { in: oldIds } },
      select: { id: true },
    });
    const oldBookingIds = oldBookings.map((b) => b.id);
    if (oldBookingIds.length) {
      await prisma.homesteadOpsTask.deleteMany({ where: { bookingId: { in: oldBookingIds } } });
    }
    await prisma.homesteadOpsTask.deleteMany({ where: { roomId: { in: oldIds } } });
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

  // Payment history, so Finance shows a realistic spread rather than every
  // stay unpaid: one resident up to date, one deliberately behind, one guest
  // paid in full, the rest outstanding.
  const seeded = await prisma.homesteadBooking.findMany({
    where: { locationId: location.id, guestName: { in: ["Marcus Webb", "Aleisha Nguyen", "Priya Raman"] } },
    select: { id: true, guestName: true },
  });
  const byName = new Map(seeded.map((b) => [b.guestName, b.id]));

  const marcus = byName.get("Marcus Webb");
  const aleisha = byName.get("Aleisha Nguyen");
  const priya = byName.get("Priya Raman");

  const paymentRows = [
    // Marcus: 3 weeks elapsed + 1 in advance at $260 = $1,040. Fully paid.
    ...(marcus
      ? [
          { bookingId: marcus, amount: 520, paidAt: addDays(today, -21), method: "BANK_TRANSFER" as const, reference: "Move-in + bond week" },
          { bookingId: marcus, amount: 260, paidAt: addDays(today, -14), method: "BANK_TRANSFER" as const, reference: null },
          { bookingId: marcus, amount: 260, paidAt: addDays(today, -7), method: "BANK_TRANSFER" as const, reference: null },
        ]
      : []),
    // Aleisha: owes $680, has paid one week — leaves her a week behind.
    ...(aleisha ? [{ bookingId: aleisha, amount: 340, paidAt: addDays(today, -7), method: "CASH" as const, reference: null }] : []),
    // Priya: nightly stay settled up front.
    ...(priya ? [{ bookingId: priya, amount: 440, paidAt: addDays(today, -1), method: "CARD" as const, reference: "Card ending 4242" }] : []),
  ];

  if (paymentRows.length) {
    await prisma.homesteadPayment.createMany({
      data: paymentRows.map((p) => ({ ...p, locationId: location.id })),
    });
  }

  // Paperwork, spread deliberately across the expiry states so the checklist
  // shows something to act on: one lapsed, one closing in, two fine, and three
  // never filed at all.
  await prisma.homesteadDocument.deleteMany({
    where: { locationId: location.id, title: { startsWith: DEMO } },
  });

  await prisma.homesteadDocument.createMany({
    data: [
      {
        locationId: location.id, category: "COMPLIANCE",
        title: `${DEMO}Smoke alarm compliance certificate`,
        issuedAt: addDays(today, -165), expiresAt: addDays(today, 200),
        reference: "SA-2026-0417",
      },
      {
        locationId: location.id, category: "COMPLIANCE",
        title: `${DEMO}Electrical safety check`,
        issuedAt: addDays(today, -377), expiresAt: addDays(today, -12),
        reference: "EL-2025-1189",
      },
      {
        locationId: location.id, category: "INSURANCE",
        title: `${DEMO}Public liability insurance`,
        issuedAt: addDays(today, -347), expiresAt: addDays(today, 18),
        reference: "PL-889231",
      },
      {
        locationId: location.id, category: "INSURANCE",
        title: `${DEMO}Building insurance`,
        issuedAt: addDays(today, -65), expiresAt: addDays(today, 300),
        reference: "BLD-114906",
      },
      ...(marcus
        ? [{
            locationId: location.id, bookingId: marcus, category: "AGREEMENT" as const,
            title: `${DEMO}Residency agreement — Marcus Webb`,
            issuedAt: addDays(today, -21), expiresAt: null,
          }]
        : []),
      {
        locationId: location.id, roomId: weeklyOnly.id, category: "CONDITION_REPORT",
        title: `${DEMO}Entry condition report — Room 1`,
        issuedAt: addDays(today, -21), expiresAt: null,
      },
    ],
  });

  console.log(`\nSeeded 3 demo rooms, 5 bookings, ${paymentRows.length} payments and 6 documents into "${location.name}".`);
  console.log(failed === 0 ? "All interval checks passed.\n" : `${failed} interval check(s) FAILED.\n`);
  if (failed > 0) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
