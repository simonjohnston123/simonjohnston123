-- One ordering desk across every supplier. A customer order can split across
-- suppliers, so the purchase is its own row rather than a status on Order.

-- CreateEnum
CREATE TYPE "SupplierOrderStatus" AS ENUM ('TO_PLACE', 'PLACED', 'SHIPPED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "SupplierOrder" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "status" "SupplierOrderStatus" NOT NULL DEFAULT 'TO_PLACE',
    "items" JSONB NOT NULL DEFAULT '[]',
    "costCents" INTEGER,
    "supplierRef" TEXT,
    "tracking" TEXT,
    "carrier" TEXT,
    "error" TEXT,
    "placedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierOrder_orderId_supplier_key" ON "SupplierOrder"("orderId", "supplier");
CREATE INDEX "SupplierOrder_locationId_status_idx" ON "SupplierOrder"("locationId", "status");
CREATE INDEX "SupplierOrder_locationId_supplier_idx" ON "SupplierOrder"("locationId", "supplier");

-- AddForeignKey
ALTER TABLE "SupplierOrder" ADD CONSTRAINT "SupplierOrder_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierOrder" ADD CONSTRAINT "SupplierOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
