-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "emailPreview" TEXT,
ADD COLUMN     "emailSubject" TEXT,
ADD COLUMN     "origin" TEXT NOT NULL DEFAULT 'STAFF',
ADD COLUMN     "senderName" TEXT,
ADD COLUMN     "senderReplyTo" TEXT,
ALTER COLUMN "buildingId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AnnouncementTarget" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,

    CONSTRAINT "AnnouncementTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnnouncementTarget_announcementId_idx" ON "AnnouncementTarget"("announcementId");

-- CreateIndex
CREATE INDEX "AnnouncementTarget_scopeType_scopeId_idx" ON "AnnouncementTarget"("scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "Announcement_customerId_idx" ON "Announcement"("customerId");

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementTarget" ADD CONSTRAINT "AnnouncementTarget_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

