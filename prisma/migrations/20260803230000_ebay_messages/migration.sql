-- eBay buyer questions in the inbox.
--
-- Postgres allows ALTER TYPE ... ADD VALUE inside a transaction from v12, as
-- long as the new value isn't used in that same transaction. Nothing below
-- writes an EBAY row, so this is safe on the postgres:16 image we run.

-- AlterEnum
ALTER TYPE "Channel" ADD VALUE 'EBAY';

-- AlterTable: marketplace thread linkage + the AI draft awaiting approval.
ALTER TABLE "Conversation"
  ADD COLUMN "externalId" TEXT,
  ADD COLUMN "externalUser" TEXT,
  ADD COLUMN "draftReply" TEXT;

-- CreateIndex
CREATE INDEX "Conversation_locationId_externalId_idx" ON "Conversation"("locationId", "externalId");
