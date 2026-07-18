-- AlterTable
ALTER TABLE "ManagedItem" DROP COLUMN "name",
ADD COLUMN     "itemTypeId" TEXT NOT NULL,
ADD COLUMN     "photoCdnPath" TEXT,
ADD COLUMN     "photoUrl" TEXT;

-- CreateTable
CREATE TABLE "ManagedItemType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedItemType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManagedItemType_name_key" ON "ManagedItemType"("name");

-- CreateIndex
CREATE INDEX "ManagedItem_itemTypeId_idx" ON "ManagedItem"("itemTypeId");

-- AddForeignKey
ALTER TABLE "ManagedItem" ADD CONSTRAINT "ManagedItem_itemTypeId_fkey" FOREIGN KEY ("itemTypeId") REFERENCES "ManagedItemType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

