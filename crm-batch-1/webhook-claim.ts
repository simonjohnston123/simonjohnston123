import "server-only";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Claiming a Stripe event, in a way that survives a failed attempt.
//
// THE BUG THIS REPLACES. The id was claimed by INSERT before the handler ran,
// and on a paid-event failure the route returned 500 so Stripe would retry.
// Nothing released the claim, so the retry hit the dedup and was acknowledged
// as a duplicate. The order was never recorded. The 500 could only ever fire
// on the first delivery, and the retry it asked for was always swallowed.
//
// WHY NOT JUST DELETE THE CLAIM ON FAILURE. A handler can fail halfway. If
// applyTopup granted credits and a later step threw, deleting the claim lets
// the retry grant them a second time — the double-spend the credit tests exist
// to prevent, reintroduced at the webhook layer. Losing money quietly is bad;
// handing it out twice is worse.
//
// SO: claim, then COMPLETE. A row without completedAt is an attempt that did
// not finish, not a duplicate.
//
// THE RACE THIS STILL HAS TO WIN. Stripe can deliver the same event twice at
// once. "No completedAt, therefore retry me" would let both copies run
// together — which is exactly what claim-by-INSERT was protecting against. So
// an incomplete row is only taken over once its lease has expired, and the
// takeover is a conditional UPDATE whose row count decides the winner. The
// database arbitrates; nothing here reads-then-writes.
// ---------------------------------------------------------------------------

/**
 * How long an in-flight attempt is presumed alive.
 *
 * Longer than any handler should take, shorter than Stripe's retry backoff.
 * A crashed process holds its claim this long and no longer.
 */
export const LEASE_MS = 5 * 60_000;

export type Claim =
  /** Nobody has handled this. Process it. */
  | "claimed"
  /** A previous attempt died and its lease expired. Process it. */
  | "recovered"
  /** Already completed successfully. Acknowledge and do nothing. */
  | "duplicate"
  /** Another attempt is running right now. Ask Stripe to come back later. */
  | "in_flight";

export async function claimEvent(id: string, type: string, now = new Date()): Promise<Claim> {
  try {
    await prisma.stripeEvent.create({
      data: { id, type, startedAt: now, completedAt: null },
    });
    return "claimed";
  } catch {
    // Unique violation: somebody got here first. WHO, and did they finish?
  }

  const row = await prisma.stripeEvent.findUnique({
    where: { id },
    select: { completedAt: true, startedAt: true },
  });
  if (!row) return "in_flight"; // deleted between insert and read; let Stripe retry
  if (row.completedAt) return "duplicate";

  const cutoff = new Date(now.getTime() - LEASE_MS);
  if (row.startedAt > cutoff) return "in_flight";

  // Stale. Take it over — but only if we are the one who moves the lease.
  // Two recoverers race here and updateMany's count picks exactly one.
  const { count } = await prisma.stripeEvent.updateMany({
    where: { id, completedAt: null, startedAt: { lte: cutoff } },
    data: { startedAt: now },
  });
  return count === 1 ? "recovered" : "in_flight";
}

/** Mark the event done. Only after the handler has fully succeeded. */
export async function completeEvent(id: string, now = new Date()): Promise<void> {
  await prisma.stripeEvent.update({ where: { id }, data: { completedAt: now } });
}
