-- CreateEnum
CREATE TYPE "InfraMediaType" AS ENUM ('IMAGE', 'VIDEO');

-- AlterTable
ALTER TABLE "InfraPoint" ADD COLUMN     "keyHolderUserId" TEXT;

-- CreateTable
CREATE TABLE "InfraAccess" (
    "id" TEXT NOT NULL,
    "infraPointId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "InfraAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfraMedia" (
    "id" TEXT NOT NULL,
    "infraPointId" TEXT NOT NULL,
    "type" "InfraMediaType" NOT NULL DEFAULT 'IMAGE',
    "url" TEXT NOT NULL,
    "cdnPath" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InfraMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InfraAccess_infraPointId_idx" ON "InfraAccess"("infraPointId");

-- CreateIndex
CREATE UNIQUE INDEX "InfraAccess_infraPointId_userId_key" ON "InfraAccess"("infraPointId", "userId");

-- CreateIndex
CREATE INDEX "InfraMedia_infraPointId_idx" ON "InfraMedia"("infraPointId");

-- AddForeignKey
ALTER TABLE "InfraPoint" ADD CONSTRAINT "InfraPoint_keyHolderUserId_fkey" FOREIGN KEY ("keyHolderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfraAccess" ADD CONSTRAINT "InfraAccess_infraPointId_fkey" FOREIGN KEY ("infraPointId") REFERENCES "InfraPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfraAccess" ADD CONSTRAINT "InfraAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfraMedia" ADD CONSTRAINT "InfraMedia_infraPointId_fkey" FOREIGN KEY ("infraPointId") REFERENCES "InfraPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
