-- Structured specifications per product.
--
-- A name and a price is enough for a person scrolling a grid, but every 2030
-- capability — AI comparison, compatibility, bundles, semantic search, agents
-- deciding on a buyer's behalf — needs real attributes. The suppliers already
-- publish weight, dimensions, barcodes, brand and dispatch times; we were
-- throwing all of it away on import.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "attributes" JSONB NOT NULL DEFAULT '{}';

-- Queryable: "under 5kg", "has a barcode", "brand = X" should be index lookups.
CREATE INDEX IF NOT EXISTS "Product_attributes_gin_idx" ON "Product" USING GIN ("attributes");
