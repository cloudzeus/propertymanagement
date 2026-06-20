-- CreateEnum
CREATE TYPE "AssemblyStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED', 'TRANSCRIBING', 'DRAFT_READY', 'APPROVED', 'SENT', 'CANCELLED');

-- AlterTable
ALTER TABLE "APIUsageLog" ADD COLUMN     "assemblyId" TEXT,
ADD COLUMN     "buildingId" TEXT,
ADD COLUMN     "customerId" TEXT;

-- AlterTable
ALTER TABLE "Building" ADD COLUMN     "dailyRoomName" TEXT;

-- CreateTable
CREATE TABLE "Assembly" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "AssemblyStatus" NOT NULL DEFAULT 'SCHEDULED',
    "dailyRoomName" TEXT NOT NULL,
    "dailySessionId" TEXT,
    "transcriptRaw" TEXT,
    "minutesDraft" TEXT,
    "minutesFinal" TEXT,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assembly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssemblyParticipant" (
    "id" TEXT NOT NULL,
    "assemblyId" TEXT NOT NULL,
    "userId" TEXT,
    "unitId" TEXT,
    "displayName" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "invitedSentAt" TIMESTAMP(3),
    "momSentAt" TIMESTAMP(3),

    CONSTRAINT "AssemblyParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedWebhook" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'daily',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Assembly_buildingId_idx" ON "Assembly"("buildingId");

-- CreateIndex
CREATE INDEX "Assembly_status_idx" ON "Assembly"("status");

-- CreateIndex
CREATE INDEX "AssemblyParticipant_assemblyId_idx" ON "AssemblyParticipant"("assemblyId");

-- CreateIndex
CREATE INDEX "AssemblyParticipant_userId_idx" ON "AssemblyParticipant"("userId");

-- CreateIndex
CREATE INDEX "ProcessedWebhook_createdAt_idx" ON "ProcessedWebhook"("createdAt");

-- CreateIndex
CREATE INDEX "APIUsageLog_buildingId_idx" ON "APIUsageLog"("buildingId");

-- CreateIndex
CREATE INDEX "APIUsageLog_customerId_idx" ON "APIUsageLog"("customerId");

-- CreateIndex
CREATE INDEX "APIUsageLog_assemblyId_idx" ON "APIUsageLog"("assemblyId");

-- AddForeignKey
ALTER TABLE "Assembly" ADD CONSTRAINT "Assembly_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyParticipant" ADD CONSTRAINT "AssemblyParticipant_assemblyId_fkey" FOREIGN KEY ("assemblyId") REFERENCES "Assembly"("id") ON DELETE CASCADE ON UPDATE CASCADE;
