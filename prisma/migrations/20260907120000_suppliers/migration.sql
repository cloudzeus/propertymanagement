-- CreateEnum
CREATE TYPE "SupplierKind" AS ENUM ('SERVICES', 'PRODUCTS', 'BOTH');

-- AlterTable
ALTER TABLE "BuildingExpense" ADD COLUMN     "supplierId" TEXT;

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "supplierId" TEXT;

-- AlterTable
ALTER TABLE "MaintenanceRequest" ADD COLUMN     "supplierId" TEXT;

-- AlterTable
ALTER TABLE "RecurringTask" ADD COLUMN     "supplierId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSupplierAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supplierId" TEXT;

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "isPlatform" BOOLEAN NOT NULL DEFAULT false,
    "sodType" INTEGER NOT NULL DEFAULT 12,
    "softoneTrdr" INTEGER,
    "code" TEXT,
    "kind" "SupplierKind" NOT NULL DEFAULT 'SERVICES',
    "name" TEXT NOT NULL,
    "afm" TEXT,
    "doy" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "phone2" TEXT,
    "webpage" TEXT,
    "address" TEXT,
    "city" TEXT,
    "district" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "remarks" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "iban" TEXT,
    "bank" TEXT,
    "paymentTermsDays" INTEGER,
    "workingHours" JSONB,
    "emergency24h" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierCategory" (
    "supplierId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "SupplierCategory_pkey" PRIMARY KEY ("supplierId","categoryId")
);

-- CreateTable
CREATE TABLE "SupplierService" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "price" DECIMAL(10,2),
    "vatPct" INTEGER NOT NULL DEFAULT 24,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierProduct" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "price" DECIMAL(10,2),
    "vatPct" INTEGER NOT NULL DEFAULT 24,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Supplier_customerId_idx" ON "Supplier"("customerId");

-- CreateIndex
CREATE INDEX "Supplier_isPlatform_idx" ON "Supplier"("isPlatform");

-- CreateIndex
CREATE INDEX "Supplier_afm_idx" ON "Supplier"("afm");

-- CreateIndex
CREATE INDEX "Supplier_softoneTrdr_idx" ON "Supplier"("softoneTrdr");

-- CreateIndex
CREATE INDEX "SupplierCategory_categoryId_idx" ON "SupplierCategory"("categoryId");

-- CreateIndex
CREATE INDEX "SupplierService_supplierId_idx" ON "SupplierService"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierProduct_supplierId_idx" ON "SupplierProduct"("supplierId");

-- CreateIndex
CREATE INDEX "BuildingExpense_supplierId_idx" ON "BuildingExpense"("supplierId");

-- CreateIndex
CREATE INDEX "Contact_supplierId_idx" ON "Contact"("supplierId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_supplierId_idx" ON "MaintenanceRequest"("supplierId");

-- CreateIndex
CREATE INDEX "RecurringTask_supplierId_idx" ON "RecurringTask"("supplierId");

-- CreateIndex
CREATE INDEX "User_supplierId_idx" ON "User"("supplierId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTask" ADD CONSTRAINT "RecurringTask_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingExpense" ADD CONSTRAINT "BuildingExpense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCategory" ADD CONSTRAINT "SupplierCategory_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCategory" ADD CONSTRAINT "SupplierCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MaintenanceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierService" ADD CONSTRAINT "SupplierService_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

