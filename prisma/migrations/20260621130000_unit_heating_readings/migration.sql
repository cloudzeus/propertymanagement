-- AlterTable
ALTER TABLE "Building" ADD COLUMN     "heatingMeterUnit" TEXT;

-- CreateTable
CREATE TABLE "UnitHeatingReading" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "previousReading" DECIMAL(12,3),
    "currentReading" DECIMAL(12,3),
    "consumption" DECIMAL(12,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitHeatingReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnitHeatingReading_buildingId_period_idx" ON "UnitHeatingReading"("buildingId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "UnitHeatingReading_unitId_period_key" ON "UnitHeatingReading"("unitId", "period");

-- AddForeignKey
ALTER TABLE "UnitHeatingReading" ADD CONSTRAINT "UnitHeatingReading_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitHeatingReading" ADD CONSTRAINT "UnitHeatingReading_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

