-- CreateTable
CREATE TABLE "CronRun" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'scheduler',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "ok" BOOLEAN,
    "result" JSONB,
    "error" TEXT,

    CONSTRAINT "CronRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CronRun_job_startedAt_idx" ON "CronRun"("job", "startedAt");

