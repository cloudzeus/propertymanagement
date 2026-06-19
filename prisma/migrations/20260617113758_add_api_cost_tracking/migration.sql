-- CreateTable
CREATE TABLE "APIUsageLog" (
    "id" TEXT NOT NULL,
    "apiName" TEXT NOT NULL,
    "endpoint" TEXT,
    "model" TEXT,
    "requestCount" INTEGER NOT NULL DEFAULT 1,
    "tokensUsed" INTEGER,
    "bytesProcessed" INTEGER,
    "costPerUnit" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "companyId" TEXT,
    "userId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "APIUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "APICostConfig" (
    "id" TEXT NOT NULL,
    "apiName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "costModel" TEXT NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "freeQuota" INTEGER NOT NULL DEFAULT 0,
    "quotaResetDay" INTEGER NOT NULL DEFAULT 1,
    "monthlyBudgetLimit" DOUBLE PRECISION,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "documentationUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "APICostConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyCostSummary" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "apiName" TEXT NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "bytesProcessed" INTEGER NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyCostSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "APIUsageLog_apiName_idx" ON "APIUsageLog"("apiName");

-- CreateIndex
CREATE INDEX "APIUsageLog_companyId_idx" ON "APIUsageLog"("companyId");

-- CreateIndex
CREATE INDEX "APIUsageLog_userId_idx" ON "APIUsageLog"("userId");

-- CreateIndex
CREATE INDEX "APIUsageLog_createdAt_idx" ON "APIUsageLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "APICostConfig_apiName_key" ON "APICostConfig"("apiName");

-- CreateIndex
CREATE INDEX "APICostConfig_apiName_idx" ON "APICostConfig"("apiName");

-- CreateIndex
CREATE INDEX "MonthlyCostSummary_companyId_idx" ON "MonthlyCostSummary"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyCostSummary_year_month_apiName_companyId_key" ON "MonthlyCostSummary"("year", "month", "apiName", "companyId");

-- AddForeignKey
ALTER TABLE "APIUsageLog" ADD CONSTRAINT "APIUsageLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APIUsageLog" ADD CONSTRAINT "APIUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyCostSummary" ADD CONSTRAINT "MonthlyCostSummary_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
