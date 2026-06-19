-- CreateEnum
CREATE TYPE "OccupancyRole" AS ENUM ('OWNER', 'RESIDENT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mobile" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "UnitOccupancy" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OccupancyRole" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnitOccupancy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnitOccupancy_unitId_idx" ON "UnitOccupancy"("unitId");

-- CreateIndex
CREATE INDEX "UnitOccupancy_userId_idx" ON "UnitOccupancy"("userId");

-- CreateIndex
CREATE INDEX "UnitOccupancy_unitId_role_endDate_idx" ON "UnitOccupancy"("unitId", "role", "endDate");

-- AddForeignKey
ALTER TABLE "UnitOccupancy" ADD CONSTRAINT "UnitOccupancy_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitOccupancy" ADD CONSTRAINT "UnitOccupancy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
