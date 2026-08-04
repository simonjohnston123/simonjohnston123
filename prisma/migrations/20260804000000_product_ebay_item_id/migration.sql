-- Record the live eBay listing number against the product it was published
-- from, so a reply can offer the buyer an item number instead of a link that
-- would take them off eBay.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "ebayItemId" TEXT;

-- CreateIndex
CREATE INDEX "Product_locationId_ebayItemId_idx" ON "Product"("locationId", "ebayItemId");
