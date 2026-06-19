-- AlterEnum
ALTER TYPE "ExpenseStatus" ADD VALUE 'ISSUED';

-- AlterTable
ALTER TABLE "BuildingExpense" ADD COLUMN     "issuedMonth" TEXT;
