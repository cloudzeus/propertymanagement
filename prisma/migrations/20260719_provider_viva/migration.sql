-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "providerVivaApiKeyEnc" TEXT,
ADD COLUMN     "providerVivaClientId" TEXT,
ADD COLUMN     "providerVivaClientSecretEnc" TEXT,
ADD COLUMN     "providerVivaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "providerVivaMerchantId" TEXT,
ADD COLUMN     "providerVivaSourceCode" TEXT;

