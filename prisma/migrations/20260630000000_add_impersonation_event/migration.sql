-- CreateTable
CREATE TABLE "ImpersonationEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "targetRole" "UserRole" NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImpersonationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImpersonationEvent_actorId_idx" ON "ImpersonationEvent"("actorId");

-- CreateIndex
CREATE INDEX "ImpersonationEvent_targetUserId_idx" ON "ImpersonationEvent"("targetUserId");
