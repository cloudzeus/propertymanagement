-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "dissolutionDate" TIMESTAMP(3),
ADD COLUMN     "distStats" TEXT,
ADD COLUMN     "employmentOrg" TEXT,
ADD COLUMN     "glnCode" TEXT,
ADD COLUMN     "registryNumber" TEXT,
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "tpte" TEXT,
ADD COLUMN     "tpteteka" TEXT,
ADD COLUMN     "vatStatus" TEXT;
