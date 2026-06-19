-- AlterTable
ALTER TABLE "ExpenseAllocation" ADD COLUMN     "ownerPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ownerPaidAt" TIMESTAMP(3),
ADD COLUMN     "ownerPaymentMethod" "ExpensePaymentMethod",
ADD COLUMN     "tenantPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tenantPaidAt" TIMESTAMP(3),
ADD COLUMN     "tenantPaymentMethod" "ExpensePaymentMethod";
