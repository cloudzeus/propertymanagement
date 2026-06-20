-- AlterTable
ALTER TABLE "AssemblyParticipant" ADD COLUMN     "email" TEXT,
ADD COLUMN     "isHost" BOOLEAN NOT NULL DEFAULT false;
