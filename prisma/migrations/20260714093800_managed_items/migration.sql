-- CreateTable
CREATE TABLE "ManagedItem" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "floorLabel" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManagedItem_buildingId_idx" ON "ManagedItem"("buildingId");

-- AddForeignKey
ALTER TABLE "ManagedItem" ADD CONSTRAINT "ManagedItem_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

