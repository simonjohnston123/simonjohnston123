import "server-only";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// The next document number for a business.
//
// Replaces four copies of the same eight lines — lib/invoicing.ts,
// lib/quotes.ts, app/dashboard/l/[locationId]/orders/actions.ts and
// lib/storefront-order.ts — which all carried the same defect.
//
// THE DEFECT. Each did:
//
//     findFirst({ where: { locationId }, orderBy: { number: "desc" } })
//
// `number` is text, so that is a LEXICOGRAPHIC sort. It agrees with numeric
// order only while every value is the same width. At the 10,000th document the
// padding grows from four digits to five and the two orders diverge:
// "INV-9999" sorts above "INV-10000", because '9' > '1' at the fifth
// character.
//
// The read then returns INV-9999, the next number computes to INV-10000, and
// INV-10000 already exists. The unique constraint rejects it, the retry loop
// recomputes the identical value five times, and raiseInvoice returns null.
// Invoicing stops permanently for that business, silently, with no error to
// the caller — at 10,000 documents, which an established business reaches.
//
// THE FIX. Order by width first, then lexicographically within a width. For
// zero-padded values that is numeric order at every width.
//
// This deliberately avoids a schema change. The clean fix is a numeric column
// or a counter table, but that means backfilling existing rows on live money
// records, which is a decision rather than a defect fix. This is correct
// without touching a single stored value.
// ---------------------------------------------------------------------------

/** Document families that carry a per-location sequence. */
export type NumberedModel = "invoice" | "quote" | "order";

const TABLE: Record<NumberedModel, string> = {
  invoice: "Invoice",
  quote: "Quote",
  order: "Order",
};

/**
 * The highest number in use for this business, or null if there are none.
 *
 * Raw SQL because Prisma cannot express `ORDER BY length(x), x`, and ordering
 * by `createdAt` instead would be wrong: a backdated or imported record breaks
 * the assumption that creation order matches numbering order.
 */
async function highestNumber(model: NumberedModel, locationId: string): Promise<string | null> {
  const table = TABLE[model]; // never interpolated from caller input
  const rows = await prisma.$queryRawUnsafe<Array<{ number: string }>>(
    `SELECT "number" FROM "${table}"
      WHERE "locationId" = $1
      ORDER BY length("number") DESC, "number" DESC
      LIMIT 1`,
    locationId,
  );
  return rows[0]?.number ?? null;
}

/**
 * Next number for a business, e.g. `INV-0007`.
 *
 * Sequential and gap-free per business: an invoice sequence with holes in it
 * is the first thing an auditor asks about.
 *
 * Still racy by design, and still safe: two callers can compute the same value,
 * the unique constraint rejects the loser, and the caller retries. Unlike the
 * old loop that retry now makes progress, because the winner's row is visible
 * to the next read AND the read is correctly ordered.
 */
export async function nextNumber(
  model: NumberedModel,
  locationId: string,
  prefix: string,
  width = 4,
): Promise<string> {
  const last = await highestNumber(model, locationId);
  // Take the trailing digit run, not every digit anywhere in the string:
  // stripping all non-digits turns "INV-2026-0001" into 20260001.
  const trailing = last?.match(/(\d+)\s*$/)?.[1];
  const n = trailing ? Number(trailing) + 1 : 1;
  return `${prefix}${String(n).padStart(width, "0")}`;
}
