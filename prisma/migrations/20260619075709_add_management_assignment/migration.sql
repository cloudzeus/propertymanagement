-- CreateTable
CREATE TABLE "ManagementAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT,
    "buildingId" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'PROPERTY_ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagementAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManagementAssignment_userId_idx" ON "ManagementAssignment"("userId");

-- CreateIndex
CREATE INDEX "ManagementAssignment_propertyId_idx" ON "ManagementAssignment"("propertyId");

-- CreateIndex
CREATE INDEX "ManagementAssignment_buildingId_idx" ON "ManagementAssignment"("buildingId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagementAssignment_userId_propertyId_buildingId_key" ON "ManagementAssignment"("userId", "propertyId", "buildingId");

-- AddForeignKey
ALTER TABLE "ManagementAssignment" ADD CONSTRAINT "ManagementAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementAssignment" ADD CONSTRAINT "ManagementAssignment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementAssignment" ADD CONSTRAINT "ManagementAssignment_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;
