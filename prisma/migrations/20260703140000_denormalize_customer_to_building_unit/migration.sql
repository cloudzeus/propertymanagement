-- Denormalize owning customer onto Building and Unit for per-customer data isolation.

-- Building.customerId (= property.customerId)
ALTER TABLE "Building" ADD COLUMN "customerId" TEXT;
UPDATE "Building" b SET "customerId" = p."customerId" FROM "Property" p WHERE b."propertyId" = p."id";
ALTER TABLE "Building" ALTER COLUMN "customerId" SET NOT NULL;
ALTER TABLE "Building" ADD CONSTRAINT "Building_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Building_customerId_idx" ON "Building"("customerId");

-- Unit.customerId (= building.property.customerId)
ALTER TABLE "Unit" ADD COLUMN "customerId" TEXT;
UPDATE "Unit" u SET "customerId" = p."customerId" FROM "Building" b, "Property" p WHERE u."buildingId" = b."id" AND b."propertyId" = p."id";
ALTER TABLE "Unit" ALTER COLUMN "customerId" SET NOT NULL;
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Unit_customerId_idx" ON "Unit"("customerId");
