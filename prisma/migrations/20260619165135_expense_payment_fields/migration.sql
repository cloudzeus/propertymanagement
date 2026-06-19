-- CreateEnum
CREATE TYPE "ExpensePaymentMethod" AS ENUM ('CARD', 'CASH', 'VIVA', 'BANK_TRANSFER', 'CHECK', 'OTHER');

-- AlterEnum
ALTER TYPE "BuildingFileCategory" ADD VALUE 'PAYMENT';

-- AlterTable
ALTER TABLE "BuildingExpense" ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentFileId" TEXT,
ADD COLUMN     "paymentMethod" "ExpensePaymentMethod";

-- AddForeignKey
ALTER TABLE "BuildingExpense" ADD CONSTRAINT "BuildingExpense_paymentFileId_fkey" FOREIGN KEY ("paymentFileId") REFERENCES "BuildingFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
