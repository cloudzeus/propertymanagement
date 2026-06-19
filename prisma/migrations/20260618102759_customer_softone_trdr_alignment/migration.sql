-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "code" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "fax" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "phone2" TEXT,
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "sodType" INTEGER NOT NULL DEFAULT 13,
ADD COLUMN     "softoneTrdr" INTEGER,
ADD COLUMN     "webpage" TEXT;

-- CreateIndex
CREATE INDEX "Customer_sodType_idx" ON "Customer"("sodType");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_companyId_softoneTrdr_key" ON "Customer"("companyId", "softoneTrdr");

