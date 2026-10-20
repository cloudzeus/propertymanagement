-- CreateEnum
CREATE TYPE "SoftoneSyncDirection" AS ENUM ('PUSH', 'PULL');

-- AlterTable
ALTER TABLE "SoftoneSettings" ADD COLUMN     "appId" TEXT,
ADD COLUMN     "lastMasterSyncAt" TIMESTAMP(3),
ADD COLUMN     "module" INTEGER,
ADD COLUMN     "passwordEnc" TEXT,
ADD COLUMN     "refid" INTEGER,
ADD COLUMN     "serial" TEXT,
ADD COLUMN     "syncEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "syncHour" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "username" TEXT;

-- AlterTable
ALTER TABLE "SoftoneSyncLog" ADD COLUMN     "counts" JSONB,
ADD COLUMN     "direction" "SoftoneSyncDirection" NOT NULL DEFAULT 'PUSH',
ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "trigger" TEXT;

-- CreateTable
CREATE TABLE "SoftoneVat" (
    "id" TEXT NOT NULL,
    "s1Key" INTEGER NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "percent" DECIMAL(6,2) NOT NULL,
    "myDataCode" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "raw" JSONB,
    "source" TEXT NOT NULL DEFAULT 'softone',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoftoneVat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoftoneUnit" (
    "id" TEXT NOT NULL,
    "s1Key" INTEGER NOT NULL,
    "code" TEXT,
    "shortcut" TEXT,
    "name" TEXT NOT NULL,
    "qDecimals" INTEGER,
    "myDataCode" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "raw" JSONB,
    "source" TEXT NOT NULL DEFAULT 'softone',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoftoneUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoftoneIrsData" (
    "id" TEXT NOT NULL,
    "s1Key" INTEGER NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "raw" JSONB,
    "source" TEXT NOT NULL DEFAULT 'softone',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoftoneIrsData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoftoneSeries" (
    "id" TEXT NOT NULL,
    "s1Key" INTEGER NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "sosource" INTEGER,
    "sosourceLabel" TEXT,
    "fprms" INTEGER,
    "tfprms" INTEGER,
    "tfprmsName" TEXT,
    "branch" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "raw" JSONB,
    "source" TEXT NOT NULL DEFAULT 'softone',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoftoneSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoftoneDistrict" (
    "id" TEXT NOT NULL,
    "s1Key" INTEGER NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "country" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "raw" JSONB,
    "source" TEXT NOT NULL DEFAULT 'softone',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoftoneDistrict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoftoneZip" (
    "id" TEXT NOT NULL,
    "s1Key" INTEGER NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "district" INTEGER,
    "country" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "raw" JSONB,
    "source" TEXT NOT NULL DEFAULT 'softone',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoftoneZip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SoftoneVat_s1Key_key" ON "SoftoneVat"("s1Key");

-- CreateIndex
CREATE INDEX "SoftoneVat_isActive_idx" ON "SoftoneVat"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SoftoneUnit_s1Key_key" ON "SoftoneUnit"("s1Key");

-- CreateIndex
CREATE INDEX "SoftoneUnit_isActive_idx" ON "SoftoneUnit"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SoftoneIrsData_s1Key_key" ON "SoftoneIrsData"("s1Key");

-- CreateIndex
CREATE INDEX "SoftoneIrsData_isActive_idx" ON "SoftoneIrsData"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SoftoneSeries_s1Key_key" ON "SoftoneSeries"("s1Key");

-- CreateIndex
CREATE INDEX "SoftoneSeries_isActive_idx" ON "SoftoneSeries"("isActive");

-- CreateIndex
CREATE INDEX "SoftoneSeries_sosource_idx" ON "SoftoneSeries"("sosource");

-- CreateIndex
CREATE UNIQUE INDEX "SoftoneDistrict_s1Key_key" ON "SoftoneDistrict"("s1Key");

-- CreateIndex
CREATE UNIQUE INDEX "SoftoneZip_s1Key_key" ON "SoftoneZip"("s1Key");

-- CreateIndex
CREATE INDEX "SoftoneZip_code_idx" ON "SoftoneZip"("code");

-- CreateIndex
CREATE INDEX "SoftoneZip_name_idx" ON "SoftoneZip"("name");

-- CreateIndex
CREATE INDEX "SoftoneSyncLog_direction_createdAt_idx" ON "SoftoneSyncLog"("direction", "createdAt");
