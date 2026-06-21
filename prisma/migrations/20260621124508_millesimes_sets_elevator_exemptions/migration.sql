-- CreateEnum
CREATE TYPE "MillesimeSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "DistributionBasis" AS ENUM ('GENERAL_MILLESIMES', 'ELEVATOR_MILLESIMES', 'HEATING_MILLESIMES', 'EQUAL_PER_UNIT', 'METERED_70_30');

-- AlterTable
ALTER TABLE "Building" ADD COLUMN     "elevatorExemptGroundFloor" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "elevatorSurchargePerFloor" DOUBLE PRECISION NOT NULL DEFAULT 0.10;

-- AlterTable
ALTER TABLE "BuildingCategoryOverride" ADD COLUMN     "distributionBasis" "DistributionBasis";

-- AlterTable
ALTER TABLE "ExpenseAllocation" ADD COLUMN     "breakdownNote" TEXT;

-- AlterTable
ALTER TABLE "ExpenseCategory" ADD COLUMN     "defaultBasis" "DistributionBasis" NOT NULL DEFAULT 'GENERAL_MILLESIMES';

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "millesimesElevator" DOUBLE PRECISION,
ADD COLUMN     "millesimesElevatorSource" "MillesimeSource" NOT NULL DEFAULT 'AUTO',
ADD COLUMN     "millesimesHeating" DOUBLE PRECISION,
ADD COLUMN     "millesimesHeatingSource" "MillesimeSource" NOT NULL DEFAULT 'AUTO',
ADD COLUMN     "millesimesSource" "MillesimeSource" NOT NULL DEFAULT 'AUTO';

-- CreateTable
CREATE TABLE "UnitCategoryExclusion" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnitCategoryExclusion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnitCategoryExclusion_unitId_idx" ON "UnitCategoryExclusion"("unitId");

-- CreateIndex
CREATE INDEX "UnitCategoryExclusion_categoryId_idx" ON "UnitCategoryExclusion"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "UnitCategoryExclusion_unitId_categoryId_key" ON "UnitCategoryExclusion"("unitId", "categoryId");

-- AddForeignKey
ALTER TABLE "UnitCategoryExclusion" ADD CONSTRAINT "UnitCategoryExclusion_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitCategoryExclusion" ADD CONSTRAINT "UnitCategoryExclusion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

