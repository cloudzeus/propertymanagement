-- CreateEnum
CREATE TYPE "ExpenseUtilityType" AS ENUM ('NONE', 'POWER', 'WATER', 'GAS');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "MeterType" AS ENUM ('POWER', 'WATER', 'GAS');

-- AlterEnum
ALTER TYPE "BuildingFileCategory" ADD VALUE 'RECEIPT';

-- AlterTable
ALTER TABLE "BuildingExpense" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "documentDate" TIMESTAMP(3),
ADD COLUMN     "documentNumber" TEXT,
ADD COLUMN     "netAmount" DECIMAL(10,2),
ADD COLUMN     "ocrConfidence" DOUBLE PRECISION,
ADD COLUMN     "ocrRaw" JSONB,
ADD COLUMN     "ownerPct" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "status" "ExpenseStatus" NOT NULL DEFAULT 'CONFIRMED',
ADD COLUMN     "supplierName" TEXT,
ADD COLUMN     "supplierVat" TEXT,
ADD COLUMN     "tenantPct" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vatAmount" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "utilityType" "ExpenseUtilityType" NOT NULL DEFAULT 'NONE',
    "defaultTenantPct" INTEGER NOT NULL DEFAULT 0,
    "defaultOwnerPct" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildingCategoryOverride" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "tenantPct" INTEGER NOT NULL,
    "ownerPct" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuildingCategoryOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeterReading" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "infraPointId" TEXT,
    "expenseId" TEXT,
    "meterType" "MeterType" NOT NULL,
    "meterNumber" TEXT,
    "periodFrom" TIMESTAMP(3),
    "periodTo" TIMESTAMP(3),
    "previousReading" DECIMAL(12,3),
    "currentReading" DECIMAL(12,3),
    "consumption" DECIMAL(12,3),
    "unit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeterReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseAllocation" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "unitShare" DECIMAL(10,2) NOT NULL,
    "tenantUserId" TEXT,
    "tenantAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "ownerUserId" TEXT,
    "ownerAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_code_key" ON "ExpenseCategory"("code");

-- CreateIndex
CREATE INDEX "BuildingCategoryOverride_buildingId_idx" ON "BuildingCategoryOverride"("buildingId");

-- CreateIndex
CREATE UNIQUE INDEX "BuildingCategoryOverride_buildingId_categoryId_key" ON "BuildingCategoryOverride"("buildingId", "categoryId");

-- CreateIndex
CREATE INDEX "MeterReading_buildingId_idx" ON "MeterReading"("buildingId");

-- CreateIndex
CREATE INDEX "MeterReading_infraPointId_idx" ON "MeterReading"("infraPointId");

-- CreateIndex
CREATE INDEX "ExpenseAllocation_expenseId_idx" ON "ExpenseAllocation"("expenseId");

-- CreateIndex
CREATE INDEX "ExpenseAllocation_unitId_idx" ON "ExpenseAllocation"("unitId");

-- CreateIndex
CREATE INDEX "BuildingExpense_categoryId_idx" ON "BuildingExpense"("categoryId");

-- AddForeignKey
ALTER TABLE "BuildingExpense" ADD CONSTRAINT "BuildingExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingCategoryOverride" ADD CONSTRAINT "BuildingCategoryOverride_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingCategoryOverride" ADD CONSTRAINT "BuildingCategoryOverride_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_infraPointId_fkey" FOREIGN KEY ("infraPointId") REFERENCES "InfraPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "BuildingExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "BuildingExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
