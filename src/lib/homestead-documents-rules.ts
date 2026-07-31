import { startOfDay } from "@/lib/homestead-dates";
import type { DocumentCategory } from "@prisma/client";

/**
 * Document expiry and compliance gaps.
 *
 * Pure — no database access — so the date arithmetic that decides whether a
 * certificate has lapsed can be exercised directly. Paperwork expiring quietly
 * is the risk this module exists to catch, and an off-by-one here means either
 * a false alarm or a real lapse going unreported.
 */

export type ExpiryState = "VALID" | "EXPIRING_SOON" | "EXPIRED" | "NO_EXPIRY";

export const EXPIRY_LABEL: Record<ExpiryState, string> = {
  VALID: "Valid",
  EXPIRING_SOON: "Expiring soon",
  EXPIRED: "Expired",
  NO_EXPIRY: "No expiry",
};

export const CATEGORY_LABEL: Record<DocumentCategory, string> = {
  AGREEMENT: "Agreement",
  IDENTITY: "Identity",
  BOND: "Bond",
  CONDITION_REPORT: "Condition report",
  COMPLIANCE: "Compliance",
  INSURANCE: "Insurance",
  REGISTRATION: "Registration",
  OTHER: "Other",
};

/** Default warning window. A month is enough notice to book a tradesperson. */
export const DEFAULT_WARN_DAYS = 30;

/**
 * Whole days from `asOf` until expiry. Negative once it's passed.
 * Day-grained: a certificate expiring today reads as 0, not a fraction.
 */
export function daysUntilExpiry(expiresAt: Date, asOf: Date): number {
  const ms = startOfDay(expiresAt).getTime() - startOfDay(asOf).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Where a document stands.
 *
 * A document expiring *today* is still valid — it lapses at the end of the day,
 * not the start. Treating day zero as expired would raise alarms a day early
 * and, worse, train people to ignore the warning.
 */
export function expiryState(
  expiresAt: Date | null | undefined,
  asOf: Date,
  warnDays: number = DEFAULT_WARN_DAYS
): ExpiryState {
  if (!expiresAt) return "NO_EXPIRY";
  const days = daysUntilExpiry(expiresAt, asOf);
  if (days < 0) return "EXPIRED";
  if (days <= warnDays) return "EXPIRING_SOON";
  return "VALID";
}

/** Sort order for lists — problems first, then whatever expires soonest. */
export const EXPIRY_RANK: Record<ExpiryState, number> = {
  EXPIRED: 0,
  EXPIRING_SOON: 1,
  VALID: 2,
  NO_EXPIRY: 3,
};

export type ComplianceItem = {
  key: string;
  label: string;
  category: DocumentCategory;
  hint: string;
};

/**
 * A starting checklist of paperwork accommodation businesses commonly keep.
 *
 * This is a prompt, not legal advice — requirements vary by state, council and
 * the kind of accommodation being run. Treat anything here as a reminder to
 * check, and ignore the rows that don't apply.
 */
export const COMMON_COMPLIANCE: ComplianceItem[] = [
  { key: "smoke-alarms", label: "Smoke alarm compliance", category: "COMPLIANCE", hint: "Usually re-checked annually." },
  { key: "electrical", label: "Electrical safety check", category: "COMPLIANCE", hint: "Safety switches and testing." },
  { key: "gas", label: "Gas safety certificate", category: "COMPLIANCE", hint: "Only if there's gas on site." },
  { key: "pool", label: "Pool safety certificate", category: "COMPLIANCE", hint: "Only if there's a pool or spa." },
  { key: "public-liability", label: "Public liability insurance", category: "INSURANCE", hint: "Check the sum insured each renewal." },
  { key: "building", label: "Building insurance", category: "INSURANCE", hint: "Landlord or building cover." },
  { key: "registration", label: "Council registration or licence", category: "REGISTRATION", hint: "Where the local council requires one." },
];

export type DocumentForCheck = {
  title: string;
  category: DocumentCategory;
  expiresAt: Date | null;
};

export type ComplianceRow = ComplianceItem & {
  state: ExpiryState | "MISSING";
  matched: DocumentForCheck | null;
  daysLeft: number | null;
};

/**
 * Match the checklist against what's actually on file.
 *
 * Matching is by keyword against the document title, because people name these
 * things in their own words — "Smoke Alarm Cert 2026" should satisfy the smoke
 * alarm row. When several match, the one expiring furthest out wins: that's the
 * current certificate, and an old superseded copy shouldn't make the row look
 * expired.
 */
export function complianceGaps(
  documents: DocumentForCheck[],
  asOf: Date,
  warnDays: number = DEFAULT_WARN_DAYS,
  checklist: ComplianceItem[] = COMMON_COMPLIANCE
): ComplianceRow[] {
  return checklist.map((item) => {
    const words = item.key.split("-");
    const candidates = documents.filter((d) => {
      if (d.category !== item.category) return false;
      const title = d.title.toLowerCase();
      return words.some((w) => title.includes(w));
    });

    if (candidates.length === 0) {
      return { ...item, state: "MISSING" as const, matched: null, daysLeft: null };
    }

    // Latest expiry wins — the newest certificate represents current standing.
    const best = candidates.reduce((a, b) => {
      const av = a.expiresAt ? startOfDay(a.expiresAt).getTime() : Number.POSITIVE_INFINITY;
      const bv = b.expiresAt ? startOfDay(b.expiresAt).getTime() : Number.POSITIVE_INFINITY;
      return bv > av ? b : a;
    });

    return {
      ...item,
      state: expiryState(best.expiresAt, asOf, warnDays),
      matched: best,
      daysLeft: best.expiresAt ? daysUntilExpiry(best.expiresAt, asOf) : null,
    };
  });
}
