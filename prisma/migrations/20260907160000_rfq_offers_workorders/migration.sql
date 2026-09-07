-- CreateEnum
CREATE TYPE "RfqStatus" AS ENUM ('OPEN', 'OFFERED', 'FORWARDED', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('SUBMITTED', 'WITHDRAWN', 'SELECTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('PENDING_CUSTOMER', 'ACCEPTED', 'DECLINED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CONFIRMED', 'DISPUTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "offerMarkupPct" DECIMAL(5,2) NOT NULL DEFAULT 15,
ADD COLUMN     "silentAcceptDays" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "warrantyMonths" INTEGER NOT NULL DEFAULT 6;

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "maintenanceRequestId" TEXT,
    "categoryId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "RfqStatus" NOT NULL DEFAULT 'OPEN',
    "deadlineAt" TIMESTAMP(3),
    "surveyRequired" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqInvitation" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewedAt" TIMESTAMP(3),
    "declineReason" TEXT,

    CONSTRAINT "RfqInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierOffer" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "vatPct" INTEGER NOT NULL DEFAULT 24,
    "surveyFee" DECIMAL(10,2),
    "surveyWaived" BOOLEAN NOT NULL DEFAULT true,
    "lines" JSONB,
    "description" TEXT,
    "estimatedMinutes" INTEGER,
    "earliestDate" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "status" "OfferStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "maintenanceRequestId" TEXT,
    "rfqId" TEXT,
    "offerId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "covered" BOOLEAN NOT NULL DEFAULT false,
    "supplierPrice" DECIMAL(10,2) NOT NULL,
    "customerPrice" DECIMAL(10,2) NOT NULL,
    "vatPct" INTEGER NOT NULL DEFAULT 24,
    "markupPct" DECIMAL(5,2),
    "surveyFee" DECIMAL(10,2),
    "surveyWaived" BOOLEAN NOT NULL DEFAULT true,
    "warrantyMonths" INTEGER,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'PENDING_CUSTOMER',
    "customerMessage" TEXT,
    "earliestDate" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "customerAcceptedAt" TIMESTAMP(3),
    "customerAcceptedById" TEXT,
    "customerAcceptedIp" TEXT,
    "customerAcceptedUa" TEXT,
    "customerDeclinedAt" TIMESTAMP(3),
    "customerDeclineReason" TEXT,
    "supplierAcceptedAt" TIMESTAMP(3),
    "supplierAcceptedById" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completionNote" TEXT,
    "completionMediaIds" JSONB,
    "customerConfirmedAt" TIMESTAMP(3),
    "customerConfirmedById" TEXT,
    "disputeNote" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceRequest_buildingId_idx" ON "ServiceRequest"("buildingId");

-- CreateIndex
CREATE INDEX "ServiceRequest_maintenanceRequestId_idx" ON "ServiceRequest"("maintenanceRequestId");

-- CreateIndex
CREATE INDEX "ServiceRequest_status_idx" ON "ServiceRequest"("status");

-- CreateIndex
CREATE INDEX "RfqInvitation_supplierId_idx" ON "RfqInvitation"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "RfqInvitation_rfqId_supplierId_key" ON "RfqInvitation"("rfqId", "supplierId");

-- CreateIndex
CREATE INDEX "SupplierOffer_rfqId_idx" ON "SupplierOffer"("rfqId");

-- CreateIndex
CREATE INDEX "SupplierOffer_supplierId_idx" ON "SupplierOffer"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_number_key" ON "WorkOrder"("number");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_offerId_key" ON "WorkOrder"("offerId");

-- CreateIndex
CREATE INDEX "WorkOrder_buildingId_idx" ON "WorkOrder"("buildingId");

-- CreateIndex
CREATE INDEX "WorkOrder_customerId_idx" ON "WorkOrder"("customerId");

-- CreateIndex
CREATE INDEX "WorkOrder_supplierId_idx" ON "WorkOrder"("supplierId");

-- CreateIndex
CREATE INDEX "WorkOrder_status_idx" ON "WorkOrder"("status");

-- CreateIndex
CREATE INDEX "WorkOrder_maintenanceRequestId_idx" ON "WorkOrder"("maintenanceRequestId");

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_maintenanceRequestId_fkey" FOREIGN KEY ("maintenanceRequestId") REFERENCES "MaintenanceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MaintenanceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqInvitation" ADD CONSTRAINT "RfqInvitation_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqInvitation" ADD CONSTRAINT "RfqInvitation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOffer" ADD CONSTRAINT "SupplierOffer_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOffer" ADD CONSTRAINT "SupplierOffer_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_maintenanceRequestId_fkey" FOREIGN KEY ("maintenanceRequestId") REFERENCES "MaintenanceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "SupplierOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

