-- CreateEnum
CREATE TYPE "SoftoneSyncStatus" AS ENUM ('DRY_RUN', 'OK', 'ERROR', 'SKIPPED');

-- AlterTable
ALTER TABLE "Building" ADD COLUMN     "softonePrjc" INTEGER;

-- AlterTable
ALTER TABLE "BuildingExpense" ADD COLUMN     "softoneFindoc" INTEGER;

-- AlterTable
ALTER TABLE "PropertyService" ADD COLUMN     "softoneCntr" INTEGER;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "softoneMtrl" INTEGER;

-- AlterTable
ALTER TABLE "ServiceCatalogItem" ADD COLUMN     "softoneMtrl" INTEGER;

-- AlterTable
ALTER TABLE "ServiceInvoice" ADD COLUMN     "softoneFindoc" INTEGER;

-- AlterTable
ALTER TABLE "SupplierProduct" ADD COLUMN     "softoneMtrl" INTEGER;

-- AlterTable
ALTER TABLE "SupplierService" ADD COLUMN     "softoneMtrl" INTEGER;

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "softoneCntrA" INTEGER,
ADD COLUMN     "softoneCntrB" INTEGER;

-- CreateTable
CREATE TABLE "SoftoneSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "company" INTEGER,
    "branch" INTEGER,
    "countryGr" INTEGER,
    "currencyEur" INTEGER,
    "vatMap" JSONB,
    "unitMap" JSONB,
    "paymentDefault" INTEGER,
    "cntrTypeCustomer" INTEGER,
    "cntrTypeSupplier" INTEGER,
    "cntrTypeManaged" INTEGER,
    "cntrType1Default" INTEGER,
    "visitUnitMonths" INTEGER,
    "seriesSales" INTEGER,
    "seriesPurchase" INTEGER,
    "prjType" INTEGER,
    "codePrefixCustomer" TEXT NOT NULL DEFAULT 'PM-C-',
    "codePrefixSupplier" TEXT NOT NULL DEFAULT 'PM-S-',
    "codePrefixProject" TEXT NOT NULL DEFAULT 'PM-B-',
    "codePrefixService" TEXT NOT NULL DEFAULT 'PM-SRV-',
    "clientId" TEXT,
    "clientIdDate" TEXT,
    "lastPingAt" TIMESTAMP(3),
    "lastPingOk" BOOLEAN,
    "lastPingMessage" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoftoneSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoftoneSyncLog" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "object" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" "SoftoneSyncStatus" NOT NULL,
    "softoneKey" INTEGER,
    "payload" JSONB,
    "response" JSONB,
    "error" TEXT,
    "byUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoftoneSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SoftoneSyncLog_entity_entityId_idx" ON "SoftoneSyncLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "SoftoneSyncLog_createdAt_idx" ON "SoftoneSyncLog"("createdAt");

