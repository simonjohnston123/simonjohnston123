// D-1 boundary behaviour: 9998 -> 9999 -> 10000 -> 10001, plus low numbers.
// Models the two orderings and the two parsers exactly as the real code and
// the fix express them, so the failure is legible without a database.
// The DB-backed equivalent is d1-boundary.test.ts.

const oldOrder = (rows) => [...rows].sort().reverse()[0];                       // orderBy number desc (TEXT)
const newOrder = (rows) => [...rows].sort((a,b) => (a.length-b.length) || a.localeCompare(b)).reverse()[0];

const oldParse = (s) => Number(s.replace(/\D/g, ""));                           // strips every non-digit
const newParse = (s) => Number(s.match(/(\d+)\s*$/)[1]);                        // trailing run only

const fmt = (prefix, n) => `${prefix}${String(n).padStart(4, "0")}`;
const upTo = (prefix, n) => Array.from({length: n}, (_, i) => fmt(prefix, i + 1));

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); console.log("ok    " + name); pass++; }
  catch (e) { console.log("FAIL  " + name + " :: " + e.message); fail++; } };
const eq = (a, b, w) => { if (a !== b) throw new Error(`${w||""} ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); };

// next number under each implementation
const nextOld = (rows, p) => fmt(p, rows.length ? oldParse(oldOrder(rows)) + 1 : 1);
const nextNew = (rows, p) => fmt(p, rows.length ? newParse(newOrder(rows)) + 1 : 1);

for (const [label, prefix] of [["invoice", "INV-"], ["quote", "Q-"]]) {

  t(`${label}: CONTROL first ever document is ${prefix}0001`, () => {
    eq(nextNew([], prefix), fmt(prefix, 1), "first");
    eq(nextOld([], prefix), fmt(prefix, 1), "old agrees");
  });

  t(`${label}: CONTROL low numbers unchanged — both agree at 7 and 500`, () => {
    // Without this the suite could pass while breaking every normal business.
    for (const n of [7, 500]) {
      eq(nextNew(upTo(prefix, n), prefix), fmt(prefix, n + 1), `new at ${n}`);
      eq(nextOld(upTo(prefix, n), prefix), fmt(prefix, n + 1), `old at ${n}`);
    }
  });

  t(`${label}: 9998 -> 9999 (still inside four digits, both agree)`, () => {
    eq(nextNew(upTo(prefix, 9998), prefix), fmt(prefix, 9999));
    eq(nextOld(upTo(prefix, 9998), prefix), fmt(prefix, 9999));
  });

  t(`${label}: 9999 -> 10000 — the width boundary`, () => {
    const rows = upTo(prefix, 9999);
    eq(nextNew(rows, prefix), `${prefix}10000`, "fixed");
    eq(nextOld(rows, prefix), `${prefix}10000`, "old still ok here");
    // padStart(4) is a floor, not a cap — format is preserved, not changed.
    eq(`${prefix}10000`.length, prefix.length + 5, "five digits");
  });

  t(`${label}: 10000 -> 10001 — where the OLD code dies`, () => {
    const rows = upTo(prefix, 10000);
    // The defect: the text sort returns 9999, so it recomputes a taken number.
    eq(oldOrder(rows), fmt(prefix, 9999), "old read picks the wrong row");
    const collides = nextOld(rows, prefix);
    eq(collides, `${prefix}10000`, "old proposes a number that already exists");
    if (!rows.includes(collides)) throw new Error("reproduction is not measuring anything");
    // The fix reads the true maximum and moves on.
    eq(newOrder(rows), `${prefix}10000`, "new read picks the right row");
    eq(nextNew(rows, prefix), `${prefix}10001`, "fixed");
  });

  t(`${label}: 10001 -> 10002, and across the next boundary`, () => {
    eq(nextNew(upTo(prefix, 10001), prefix), `${prefix}10002`);
    const wide = [...upTo(prefix, 9999), `${prefix}10000`, `${prefix}99999`, `${prefix}100000`];
    eq(newOrder(wide), `${prefix}100000`, "correct at six digits too");
  });

  t(`${label}: parser takes the trailing digit run, not every digit`, () => {
    eq(newParse(`${prefix}2026-0001`), 1, "year-prefixed");
    eq(oldParse(`${prefix}2026-0001`), 20260001, "old parser reproduces the bug");
  });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
