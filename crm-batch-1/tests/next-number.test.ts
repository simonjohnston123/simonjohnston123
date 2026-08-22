import { describe, it, expect } from "vitest";

// Pure-function mirrors of the two orderings, so the defect can be reproduced
// without a database. The SQL equivalents are asserted against Postgres in
// next-number.db.test.ts; this file exists so the failure mode is legible.
const lexicographic = (rows: string[]) => [...rows].sort().reverse()[0];
const widthThenLex = (rows: string[]) =>
  [...rows].sort((a, b) => (a.length - b.length) || a.localeCompare(b)).reverse()[0];

const trailingDigits = (s: string) => Number(s.match(/(\d+)\s*$/)![1]);
const seq = (n: number, width = 4) =>
  Array.from({ length: n }, (_, i) => `INV-${String(i + 1).padStart(width, "0")}`);

describe("document numbering", () => {
  it("CONTROL: below the width boundary, both orderings agree", () => {
    // Without this the suite could pass because nothing was measured.
    const rows = seq(500);
    expect(lexicographic(rows)).toBe("INV-0500");
    expect(widthThenLex(rows)).toBe("INV-0500");
  });

  it("reproduces the defect: lexicographic order breaks at the 10,000th", () => {
    const rows = seq(10_000);
    expect(rows).toContain("INV-10000");
    // The old read returns the wrong row...
    expect(lexicographic(rows)).toBe("INV-9999");
    // ...so the number it computes is one that already exists.
    const next = `INV-${String(trailingDigits(lexicographic(rows)) + 1).padStart(4, "0")}`;
    expect(next).toBe("INV-10000");
    expect(rows).toContain(next); // unique violation -> retry -> same value -> null
  });

  it("width-then-lexicographic order stays correct across the boundary", () => {
    const rows = seq(10_000);
    expect(widthThenLex(rows)).toBe("INV-10000");
    const next = `INV-${String(trailingDigits(widthThenLex(rows)) + 1).padStart(4, "0")}`;
    expect(next).toBe("INV-10001");
    expect(rows).not.toContain(next);
  });

  it("stays correct across a second width boundary", () => {
    const rows = [...seq(9_999), "INV-10000", "INV-99999", "INV-100000"];
    expect(widthThenLex(rows)).toBe("INV-100000");
  });

  it("takes the trailing digit run, not every digit in the string", () => {
    // Stripping all non-digits turns this into 20260001.
    expect(trailingDigits("INV-2026-0001")).toBe(1);
    expect(trailingDigits("INV-0007")).toBe(7);
  });
});
