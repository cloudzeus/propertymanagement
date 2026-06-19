-- CreateEnum
CREATE TYPE "BuildingFileCategory" AS ENUM ('PLANS', 'PHOTOS', 'DOCUMENTS', 'CERTIFICATES', 'OTHER');

-- CreateEnum
CREATE TYPE "InfraType" AS ENUM ('ELECTRICITY', 'OTE', 'ROOF', 'ANTENNA', 'BOILER', 'PUMP', 'FIRE', 'WATER', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'PENDING', 'OVERDUE');

-- CreateTable
CREATE TABLE "BuildingFile" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "category" "BuildingFileCategory" NOT NULL DEFAULT 'OTHER',
    "name" TEXT NOT NULL,
    "cdnPath" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildingFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfraPoint" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "InfraType" NOT NULL DEFAULT 'OTHER',
    "floorLabel" TEXT,
    "location" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "accessNotes" TEXT,
    "keyHolder" TEXT,
    "photoUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfraPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringTask" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "frequency" "TaskFrequency" NOT NULL DEFAULT 'MONTHLY',
    "nextDueDate" TIMESTAMP(3),
    "lastDoneDate" TIMESTAMP(3),
    "vendor" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildingExpense" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "category" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "receiptFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildingExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitPayment" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BuildingFile_buildingId_idx" ON "BuildingFile"("buildingId");

-- CreateIndex
CREATE INDEX "BuildingFile_buildingId_category_idx" ON "BuildingFile"("buildingId", "category");

-- CreateIndex
CREATE INDEX "InfraPoint_buildingId_idx" ON "InfraPoint"("buildingId");

-- CreateIndex
CREATE INDEX "Contact_buildingId_idx" ON "Contact"("buildingId");

-- CreateIndex
CREATE INDEX "RecurringTask_buildingId_idx" ON "RecurringTask"("buildingId");

-- CreateIndex
CREATE INDEX "BuildingExpense_buildingId_idx" ON "BuildingExpense"("buildingId");

-- CreateIndex
CREATE INDEX "BuildingExpense_buildingId_month_idx" ON "BuildingExpense"("buildingId", "month");

-- CreateIndex
CREATE INDEX "UnitPayment_unitId_idx" ON "UnitPayment"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "UnitPayment_unitId_month_key" ON "UnitPayment"("unitId", "month");

-- AddForeignKey
ALTER TABLE "BuildingFile" ADD CONSTRAINT "BuildingFile_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfraPoint" ADD CONSTRAINT "InfraPoint_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTask" ADD CONSTRAINT "RecurringTask_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingExpense" ADD CONSTRAINT "BuildingExpense_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingExpense" ADD CONSTRAINT "BuildingExpense_receiptFileId_fkey" FOREIGN KEY ("receiptFileId") REFERENCES "BuildingFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitPayment" ADD CONSTRAINT "UnitPayment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
