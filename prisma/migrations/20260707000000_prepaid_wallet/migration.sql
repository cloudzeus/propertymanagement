-- CreateEnum
CREATE TYPE "WalletOwnerType" AS ENUM ('COMPANY', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "WalletStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "WalletTxnType" AS ENUM ('ALLOWANCE', 'TOPUP', 'DEBIT', 'ADJUSTMENT', 'RESET');

-- AlterTable
ALTER TABLE "APICostConfig" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'api',
ADD COLUMN     "unitLabel" TEXT NOT NULL DEFAULT 'units';

-- AlterTable
ALTER TABLE "APIUsageLog" ADD COLUMN     "billedCostEur" DOUBLE PRECISION,
ADD COLUMN     "customerChargeEur" DOUBLE PRECISION,
ADD COLUMN     "walletTxnCompanyId" TEXT,
ADD COLUMN     "walletTxnCustomerId" TEXT;

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "ownerType" "WalletOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "balanceEur" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "lowBalanceEur" DECIMAL(12,4),
    "status" "WalletStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "WalletTxnType" NOT NULL,
    "amountEur" DECIMAL(12,4) NOT NULL,
    "balanceAfter" DECIMAL(12,4) NOT NULL,
    "description" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerMeteredPlan" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "monthlyAllowanceEur" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "rollover" BOOLEAN NOT NULL DEFAULT false,
    "adminMarkupPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerMeteredPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Wallet_ownerType_idx" ON "Wallet"("ownerType");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_ownerType_ownerId_key" ON "Wallet"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_idx" ON "WalletTransaction"("walletId");

-- CreateIndex
CREATE INDEX "WalletTransaction_refType_refId_idx" ON "WalletTransaction"("refType", "refId");

-- CreateIndex
CREATE INDEX "WalletTransaction_createdAt_idx" ON "WalletTransaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerMeteredPlan_customerId_key" ON "CustomerMeteredPlan"("customerId");

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMeteredPlan" ADD CONSTRAINT "CustomerMeteredPlan_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

