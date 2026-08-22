-- Make a claimed-but-incomplete Stripe event retryable.
--
-- Additive only: two new columns, no existing value altered in place.
--
-- BACKFILL, and why it is not a no-op. Every existing row was written by the
-- old code, which claimed the id and then processed. Leaving completedAt NULL
-- would mark all of history "incomplete" and therefore reprocessable — so a
-- late replay of a months-old event would be handled again rather than
-- deduplicated. Stamping them complete preserves exactly today's behaviour for
-- everything already recorded. New rows start NULL and earn their timestamp.

ALTER TABLE "StripeEvent" ADD COLUMN IF NOT EXISTS "startedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "StripeEvent" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

UPDATE "StripeEvent" SET "completedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP)
 WHERE "completedAt" IS NULL;

-- Finding stale in-flight claims without a sequential scan.
CREATE INDEX IF NOT EXISTS "StripeEvent_incomplete_idx"
  ON "StripeEvent" ("startedAt") WHERE "completedAt" IS NULL;
