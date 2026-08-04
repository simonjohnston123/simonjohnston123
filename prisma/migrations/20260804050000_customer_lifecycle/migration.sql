-- An order is not a customer.
--
-- The same person is a username on eBay and an email on Shopify. Treated as two
-- contacts, every lifetime value is halved and no segment can be trusted, so
-- marketplace identity becomes its own record hanging off one person.

-- AlterTable: derived lifecycle profile, rebuilt by the profile job.
ALTER TABLE "Contact"
  ADD COLUMN "lifetimeValueCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "profitCents"        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "orderCount"         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "avgOrderValueCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "firstPurchaseAt"    TIMESTAMP(3),
  ADD COLUMN "lastPurchaseAt"     TIMESTAMP(3),
  ADD COLUMN "interests"          JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "behaviourTags"      JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "healthScore"        TEXT;

-- Segments filter on these constantly.
CREATE INDEX IF NOT EXISTS "Contact_locationId_lastPurchaseAt_idx" ON "Contact"("locationId", "lastPurchaseAt");
CREATE INDEX IF NOT EXISTS "Contact_locationId_lifetimeValueCents_idx" ON "Contact"("locationId", "lifetimeValueCents");
CREATE INDEX IF NOT EXISTS "Contact_interests_gin_idx" ON "Contact" USING GIN ("interests");
CREATE INDEX IF NOT EXISTS "Contact_behaviourTags_gin_idx" ON "Contact" USING GIN ("behaviourTags");

-- CreateTable
CREATE TABLE "CustomerAccount" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "marketplace" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CustomerAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerAccount_locationId_marketplace_handle_key" ON "CustomerAccount"("locationId", "marketplace", "handle");
CREATE INDEX "CustomerAccount_contactId_idx" ON "CustomerAccount"("contactId");

ALTER TABLE "CustomerAccount" ADD CONSTRAINT "CustomerAccount_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
