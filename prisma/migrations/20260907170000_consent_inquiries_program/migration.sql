-- CreateEnum
CREATE TYPE "NewsletterStatus" AS ENUM ('PENDING', 'CONFIRMED', 'UNSUBSCRIBED');

-- CreateEnum
CREATE TYPE "SupplierInquiryKind" AS ENUM ('OFFER', 'APPOINTMENT');

-- CreateEnum
CREATE TYPE "SupplierInquiryStatus" AS ENUM ('SENT', 'ANSWERED', 'CLOSED');

-- AlterTable
ALTER TABLE "ContactMessage" ADD COLUMN     "consentText" TEXT,
ADD COLUMN     "consentedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DemoRequest" ADD COLUMN     "consentText" TEXT,
ADD COLUMN     "consentedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MaintenanceRequest" ADD COLUMN     "recurringTaskId" TEXT;

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "autoConfirmedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "NewsletterSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'el',
    "source" TEXT NOT NULL DEFAULT 'news',
    "status" "NewsletterStatus" NOT NULL DEFAULT 'PENDING',
    "consentText" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL DEFAULT 'v1',
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierInquiry" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "maintenanceRequestId" TEXT,
    "kind" "SupplierInquiryKind" NOT NULL,
    "status" "SupplierInquiryStatus" NOT NULL DEFAULT 'SENT',
    "message" TEXT NOT NULL,
    "preferredDates" JSONB,
    "sentTo" TEXT NOT NULL,
    "answer" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_email_key" ON "NewsletterSubscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_token_key" ON "NewsletterSubscriber"("token");

-- CreateIndex
CREATE INDEX "NewsletterSubscriber_status_idx" ON "NewsletterSubscriber"("status");

-- CreateIndex
CREATE INDEX "SupplierInquiry_customerId_idx" ON "SupplierInquiry"("customerId");

-- CreateIndex
CREATE INDEX "SupplierInquiry_supplierId_idx" ON "SupplierInquiry"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierInquiry_buildingId_idx" ON "SupplierInquiry"("buildingId");

-- CreateIndex
CREATE INDEX "SupplierInquiry_maintenanceRequestId_idx" ON "SupplierInquiry"("maintenanceRequestId");

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_recurringTaskId_fkey" FOREIGN KEY ("recurringTaskId") REFERENCES "RecurringTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInquiry" ADD CONSTRAINT "SupplierInquiry_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInquiry" ADD CONSTRAINT "SupplierInquiry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInquiry" ADD CONSTRAINT "SupplierInquiry_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInquiry" ADD CONSTRAINT "SupplierInquiry_maintenanceRequestId_fkey" FOREIGN KEY ("maintenanceRequestId") REFERENCES "MaintenanceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

