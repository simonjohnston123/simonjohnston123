import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { nextNumber } from "@/lib/next-number";

// Against the real staging Postgres, per docs/TESTING.md. The defect is in how
// Postgres orders a text column; a mocked client would order it in JavaScript
// and every case below would pass while production stayed broken.

const RUN = `d1_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
let locationId = "";
const agencyIds: string[] = [];

async function seedInvoices(numbers: number[]) {
  await prisma.invoice.createMany({
    data: numbers.map((n) => ({
      locationId,
      number: `INV-${String(n).padStart(4, "0")}`,
      lines: [], subtotalCents: 0, taxCents: 0, totalCents: 0, paidCents: 0,
    })),
  });
}

afterAll(async () => {
  if (locationId) await prisma.invoice.deleteMany({ where: { locationId } });
  for (const id of agencyIds) await prisma.agency.delete({ where: { id } }).catch(() => null);
});

describe("invoice numbering across the width boundary", () => {
  it("sets up an isolated business", async () => {
    // Its own fixtures, removed afterwards: no probe reads a row another made,
    // and a unique suffix means it passes on every run, not just the first.
    const agency = await prisma.agency.create({
      data: { name: `${RUN} agency`, locations: { create: { name: `${RUN} loc` } } },
      select: { id: true, locations: { select: { id: true } } },
    });
    agencyIds.push(agency.id);
    locationId = agency.locations[0]!.id;
    expect(locationId).toBeTruthy();
  });

  it("CONTROL: the first document is INV-0001", async () => {
    expect(await nextNumber("invoice", locationId, "INV-")).toBe("INV-0001");
  });

  it("CONTROL: low numbers are unaffected", async () => {
    await seedInvoices([1, 2, 3, 4, 5, 6, 7]);
    expect(await nextNumber("invoice", locationId, "INV-")).toBe("INV-0008");
  });

  it("9998 -> 9999, inside four digits", async () => {
    await seedInvoices([9998]);
    expect(await nextNumber("invoice", locationId, "INV-")).toBe("INV-9999");
  });

  it("9999 -> 10000, crossing the boundary", async () => {
    await seedInvoices([9999]);
    expect(await nextNumber("invoice", locationId, "INV-")).toBe("INV-10000");
  });

  it("10000 -> 10001 — where the old implementation returned a taken number", async () => {
    await seedInvoices([10000]);
    // The old code read INV-9999 as the maximum here and proposed INV-10000,
    // which already exists; the unique constraint rejected it and the retry
    // loop recomputed the same value until raiseInvoice returned null.
    expect(await nextNumber("invoice", locationId, "INV-")).toBe("INV-10001");
  });

  it("10001 -> 10002", async () => {
    await seedInvoices([10001]);
    expect(await nextNumber("invoice", locationId, "INV-")).toBe("INV-10002");
  });

  it("stays correct across the next boundary", async () => {
    await seedInvoices([99999]);
    expect(await nextNumber("invoice", locationId, "INV-")).toBe("INV-100000");
  });

  // Proves the ordering is the thing under test: with the old ordering the
  // same rows produce the wrong answer, so the assertions above measure it.
  it("CONTROL: the old ordering picks the wrong row from this same data", async () => {
    const rows = await prisma.invoice.findMany({
      where: { locationId }, orderBy: { number: "desc" }, select: { number: true }, take: 1,
    });
    expect(rows[0]!.number).not.toBe("INV-100000");
    expect(rows[0]!.number).toBe("INV-9999");
  });
});
