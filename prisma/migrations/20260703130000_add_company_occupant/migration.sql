-- AlterTable: company-occupant fields on User (TRDR-compatible for future SoftOne sync)
ALTER TABLE "User" ADD COLUMN "isCompany" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "afm" TEXT;
ALTER TABLE "User" ADD COLUMN "doy" TEXT;
ALTER TABLE "User" ADD COLUMN "contactName" TEXT;
ALTER TABLE "User" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "User" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "User" ADD COLUMN "softoneTrdr" INTEGER;
