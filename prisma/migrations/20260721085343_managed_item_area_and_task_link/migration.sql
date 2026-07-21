-- AlterTable
ALTER TABLE "ManagedItem" ADD COLUMN     "commonAreaId" TEXT;

-- AlterTable
ALTER TABLE "RecurringTask" ADD COLUMN     "managedItemId" TEXT;

-- CreateIndex
CREATE INDEX "ManagedItem_commonAreaId_idx" ON "ManagedItem"("commonAreaId");

-- CreateIndex
CREATE INDEX "RecurringTask_managedItemId_idx" ON "RecurringTask"("managedItemId");

-- AddForeignKey
ALTER TABLE "RecurringTask" ADD CONSTRAINT "RecurringTask_managedItemId_fkey" FOREIGN KEY ("managedItemId") REFERENCES "ManagedItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedItem" ADD CONSTRAINT "ManagedItem_commonAreaId_fkey" FOREIGN KEY ("commonAreaId") REFERENCES "CommonArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

