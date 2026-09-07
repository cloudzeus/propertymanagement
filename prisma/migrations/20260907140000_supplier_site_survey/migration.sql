-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "siteSurveyFee" DECIMAL(10,2),
ADD COLUMN     "siteSurveyFeeWaived" BOOLEAN NOT NULL DEFAULT true;

