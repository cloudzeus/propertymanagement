-- AlterEnum
ALTER TYPE "ServicePricingModel" ADD VALUE 'PER_ZONE';

-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "distanceZones" JSONB;

-- AlterTable
ALTER TABLE "Building" ADD COLUMN     "distanceAt" TIMESTAMP(3),
ADD COLUMN     "distanceBaseKey" TEXT,
ADD COLUMN     "distanceKm" DOUBLE PRECISION,
ADD COLUMN     "distanceMethod" TEXT,
ADD COLUMN     "distanceMinutes" INTEGER;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "zonePrices" JSONB;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "surveyZoneFees" JSONB;

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "travelFee" DECIMAL(10,2),
ADD COLUMN     "travelKm" DOUBLE PRECISION,
ADD COLUMN     "travelZone" TEXT;

-- CreateTable
CREATE TABLE "DistanceCache" (
    "id" TEXT NOT NULL,
    "fromLat4" INTEGER NOT NULL,
    "fromLng4" INTEGER NOT NULL,
    "toLat4" INTEGER NOT NULL,
    "toLng4" INTEGER NOT NULL,
    "km" DOUBLE PRECISION NOT NULL,
    "minutes" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistanceCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DistanceCache_fromLat4_fromLng4_toLat4_toLng4_key" ON "DistanceCache"("fromLat4", "fromLng4", "toLat4", "toLng4");

