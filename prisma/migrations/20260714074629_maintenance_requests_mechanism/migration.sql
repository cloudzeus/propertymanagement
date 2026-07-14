-- AlterTable
ALTER TABLE "MaintenanceRequest" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "estimatedMinutes" INTEGER,
ADD COLUMN     "firstResponseAt" TIMESTAMP(3),
ADD COLUMN     "handledBy" TEXT NOT NULL DEFAULT 'PROPERTY_ADMIN',
ADD COLUMN     "managerPresence" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "restrictedAccess" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slaDueAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MaintenanceCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "slaHours" INTEGER,
    "companyResponsible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceCoverageRule" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT,
    "categoryId" TEXT,
    "elementLabel" TEXT,
    "covered" BOOLEAN NOT NULL DEFAULT true,
    "quantityLimit" INTEGER,
    "periodMonths" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceCoverageRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceAttachment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "cdnPath" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'IMAGE',
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceStatusEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "note" TEXT,
    "byUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceComment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceSlot" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "offeredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceAppointment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "managerPresence" BOOLEAN NOT NULL DEFAULT false,
    "bookedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'GENERAL',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "requestId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaintenanceCoverageRule_propertyId_idx" ON "MaintenanceCoverageRule"("propertyId");

-- CreateIndex
CREATE INDEX "MaintenanceCoverageRule_categoryId_idx" ON "MaintenanceCoverageRule"("categoryId");

-- CreateIndex
CREATE INDEX "MaintenanceAttachment_requestId_idx" ON "MaintenanceAttachment"("requestId");

-- CreateIndex
CREATE INDEX "MaintenanceStatusEvent_requestId_idx" ON "MaintenanceStatusEvent"("requestId");

-- CreateIndex
CREATE INDEX "MaintenanceComment_requestId_idx" ON "MaintenanceComment"("requestId");

-- CreateIndex
CREATE INDEX "MaintenanceSlot_requestId_idx" ON "MaintenanceSlot"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceSlot_requestId_side_startAt_key" ON "MaintenanceSlot"("requestId", "side", "startAt");

-- CreateIndex
CREATE INDEX "MaintenanceAppointment_requestId_idx" ON "MaintenanceAppointment"("requestId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_categoryId_idx" ON "MaintenanceRequest"("categoryId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_handledBy_idx" ON "MaintenanceRequest"("handledBy");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_slaDueAt_idx" ON "MaintenanceRequest"("slaDueAt");

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MaintenanceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceCoverageRule" ADD CONSTRAINT "MaintenanceCoverageRule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceCoverageRule" ADD CONSTRAINT "MaintenanceCoverageRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MaintenanceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceAttachment" ADD CONSTRAINT "MaintenanceAttachment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceStatusEvent" ADD CONSTRAINT "MaintenanceStatusEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceStatusEvent" ADD CONSTRAINT "MaintenanceStatusEvent_byUserId_fkey" FOREIGN KEY ("byUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceComment" ADD CONSTRAINT "MaintenanceComment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceComment" ADD CONSTRAINT "MaintenanceComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceSlot" ADD CONSTRAINT "MaintenanceSlot_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceSlot" ADD CONSTRAINT "MaintenanceSlot_offeredById_fkey" FOREIGN KEY ("offeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceAppointment" ADD CONSTRAINT "MaintenanceAppointment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceAppointment" ADD CONSTRAINT "MaintenanceAppointment_bookedById_fkey" FOREIGN KEY ("bookedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

