-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "vivaApiKeyEnc",
DROP COLUMN "vivaEnabled",
DROP COLUMN "vivaMerchantId",
DROP COLUMN "vivaSourceCode",
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "vivaApiKeyEnc" TEXT,
ADD COLUMN     "vivaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vivaMerchantId" TEXT,
ADD COLUMN     "vivaSourceCode" TEXT;

