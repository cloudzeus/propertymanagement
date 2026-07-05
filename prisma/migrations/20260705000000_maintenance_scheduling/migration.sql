-- CreateEnum
CREATE TYPE "MaintenanceKind" AS ENUM ('GENERAL', 'ELEVATOR', 'BOILER', 'FIRE_SAFETY', 'HVAC', 'ELECTRICAL', 'PLUMBING', 'OTHER');

-- AlterEnum
ALTER TYPE "BuildingFileCategory" ADD VALUE 'MAINTENANCE';

-- AlterTable
ALTER TABLE "RecurringTask" ADD COLUMN     "inServicePackage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kind" "MaintenanceKind" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "reminderDaysBefore" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MaintenanceLog" (
    "id" TEXT NOT NULL,
    "recurringTaskId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "performedById" TEXT,
    "cost" DECIMAL(10,2),
    "notes" TEXT,
    "documentFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaintenanceLog_recurringTaskId_idx" ON "MaintenanceLog"("recurringTaskId");

-- CreateIndex
CREATE INDEX "MaintenanceLog_buildingId_idx" ON "MaintenanceLog"("buildingId");

-- AddForeignKey
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_recurringTaskId_fkey" FOREIGN KEY ("recurringTaskId") REFERENCES "RecurringTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_documentFileId_fkey" FOREIGN KEY ("documentFileId") REFERENCES "BuildingFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

