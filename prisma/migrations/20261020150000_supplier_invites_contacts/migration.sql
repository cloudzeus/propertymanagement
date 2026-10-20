-- CreateEnum
CREATE TYPE "SupplierInviteKind" AS ENUM ('RFQ_INVITE', 'CONTACT_ACTIVATION');

-- AlterTable
ALTER TABLE "RfqInvitation" ADD COLUMN     "emailCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastEmailAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "supplierAcceptedIp" TEXT,
ADD COLUMN     "supplierAcceptedName" TEXT,
ADD COLUMN     "supplierAcceptedUa" TEXT;

-- CreateTable
CREATE TABLE "SupplierContact" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "receivesRfq" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "userId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierInviteLink" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "kind" "SupplierInviteKind" NOT NULL,
    "supplierId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "rfqInvitationId" TEXT,
    "contactId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentCount" INTEGER NOT NULL DEFAULT 1,
    "openedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT,

    CONSTRAINT "SupplierInviteLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierContact_userId_key" ON "SupplierContact"("userId");

-- CreateIndex
CREATE INDEX "SupplierContact_supplierId_idx" ON "SupplierContact"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierContact_email_idx" ON "SupplierContact"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierInviteLink_tokenHash_key" ON "SupplierInviteLink"("tokenHash");

-- CreateIndex
CREATE INDEX "SupplierInviteLink_rfqInvitationId_idx" ON "SupplierInviteLink"("rfqInvitationId");

-- CreateIndex
CREATE INDEX "SupplierInviteLink_contactId_idx" ON "SupplierInviteLink"("contactId");

-- CreateIndex
CREATE INDEX "SupplierInviteLink_supplierId_email_idx" ON "SupplierInviteLink"("supplierId", "email");

-- AddForeignKey
ALTER TABLE "SupplierContact" ADD CONSTRAINT "SupplierContact_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierContact" ADD CONSTRAINT "SupplierContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInviteLink" ADD CONSTRAINT "SupplierInviteLink_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInviteLink" ADD CONSTRAINT "SupplierInviteLink_rfqInvitationId_fkey" FOREIGN KEY ("rfqInvitationId") REFERENCES "RfqInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInviteLink" ADD CONSTRAINT "SupplierInviteLink_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "SupplierContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: every existing COLLABORATOR login becomes a contact of its supplier
INSERT INTO "SupplierContact" ("id","supplierId","name","email","phone","mobile","isPrimary","receivesRfq","active","userId","createdAt","updatedAt")
SELECT 'sc_' || substr(md5(u."id"), 1, 24), u."supplierId", COALESCE(u."name", u."email"), u."email", u."phone", u."mobile", u."isSupplierAdmin", true, u."status" = 'ACTIVE', u."id", now(), now()
FROM "User" u WHERE u."role" = 'COLLABORATOR' AND u."supplierId" IS NOT NULL;
