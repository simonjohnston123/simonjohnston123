/**
 * Exercises document expiry and the compliance checklist.
 *
 * Reads only — never writes. The boundaries matter: warning a day early trains
 * people to ignore the alert, and warning a day late means a certificate has
 * already lapsed by the time anyone hears about it.
 *
 *   npx tsx prisma/check-homestead-documents.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  expiryState,
  daysUntilExpiry,
  complianceGaps,
  COMMON_COMPLIANCE,
  DEFAULT_WARN_DAYS,
  type DocumentForCheck,
} from "../src/lib/homestead-documents-rules";
import { addDays, startOfDay } from "../src/lib/homestead-dates";

const prisma = new PrismaClient();

function fixedCases(): number {
  const today = startOfDay(new Date());
  const d = (n: number) => addDays(today, n);
  const cases: Array<[string, unknown, unknown]> = [];

  // --- day counting ------------------------------------------------------
  cases.push(["expiry today counts as zero days", daysUntilExpiry(today, today), 0]);
  cases.push(["a week out counts as seven", daysUntilExpiry(d(7), today), 7]);
  cases.push(["a lapsed date counts negative", daysUntilExpiry(d(-3), today), -3]);

  // --- state boundaries --------------------------------------------------
  // A certificate lapses at the end of its final day, not the start of it.
  cases.push(["expiring today is still valid, not expired", expiryState(today, today), "EXPIRING_SOON"]);
  cases.push(["yesterday is expired", expiryState(d(-1), today), "EXPIRED"]);
  cases.push(["the last day of the warning window still warns", expiryState(d(DEFAULT_WARN_DAYS), today), "EXPIRING_SOON"]);
  cases.push(["one day past the window is simply valid", expiryState(d(DEFAULT_WARN_DAYS + 1), today), "VALID"]);
  cases.push(["no expiry date is not a problem", expiryState(null, today), "NO_EXPIRY"]);
  cases.push(["a custom warning window is respected", expiryState(d(60), today, 90), "EXPIRING_SOON"]);

  // --- checklist matching ------------------------------------------------
  const docs: DocumentForCheck[] = [
    { title: "Smoke Alarm Cert 2026", category: "COMPLIANCE", expiresAt: d(200) },
    { title: "Public Liability Policy", category: "INSURANCE", expiresAt: d(-5) },
  ];
  const rows = complianceGaps(docs, today);
  const byKey = (k: string) => rows.find((r) => r.key === k);

  cases.push(["checklist covers every common item", rows.length, COMMON_COMPLIANCE.length]);
  cases.push(["a freely-named certificate still matches", byKey("smoke-alarms")?.state, "VALID"]);
  cases.push(["a lapsed policy reads as expired", byKey("public-liability")?.state, "EXPIRED"]);
  cases.push(["nothing on file reads as missing", byKey("gas")?.state, "MISSING"]);
  cases.push(["a missing row has no matched document", byKey("gas")?.matched, null]);

  // Category must agree — an insurance policy shouldn't satisfy a compliance row.
  const miscategorised = complianceGaps(
    [{ title: "Smoke alarm inspection", category: "INSURANCE", expiresAt: d(100) }],
    today
  );
  cases.push([
    "a document in the wrong category doesn't satisfy the row",
    miscategorised.find((r) => r.key === "smoke-alarms")?.state,
    "MISSING",
  ]);

  // Superseded copies must not drag the row back to expired.
  const renewed = complianceGaps(
    [
      { title: "Smoke alarm certificate (old)", category: "COMPLIANCE", expiresAt: d(-100) },
      { title: "Smoke alarm certificate", category: "COMPLIANCE", expiresAt: d(300) },
    ],
    today
  );
  cases.push(["the newest certificate wins over a superseded one", renewed.find((r) => r.key === "smoke-alarms")?.state, "VALID"]);

  let failed = 0;
  console.log("\nDocument rules:");
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

  const documents = await prisma.homesteadDocument.findMany({
    where: { locationId: location.id },
    select: { title: true, category: true, expiresAt: true },
  });

  const asOf = new Date();
  console.log(`\nAgainst live data — "${location.name}", ${documents.length} document(s):`);
  for (const row of complianceGaps(documents, asOf)) {
    const detail =
      row.state === "MISSING"
        ? "nothing on file"
        : `${row.matched?.title}${row.daysLeft !== null ? ` · ${row.daysLeft}d` : ""}`;
    console.log(`  ${String(row.state).padEnd(14)} ${row.label.padEnd(32)} ${detail}`);
  }

  console.log(failed === 0 ? "\nAll document checks passed.\n" : `\n${failed} document check(s) FAILED.\n`);
  if (failed > 0) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
