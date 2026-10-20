-- AiActionLog: audit rows outlive their conversation (SetNull) + updatedAt for stuck-EXECUTING detection.
-- NOTE: the HNSW index "WikiChunk_embedding_idx" is not representable in schema.prisma; `migrate diff` will always propose
-- dropping it — never include that DROP in a migration.
-- DropForeignKey
ALTER TABLE "AiActionLog" DROP CONSTRAINT "AiActionLog_conversationId_fkey";

-- AlterTable
ALTER TABLE "AiActionLog" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AddForeignKey
ALTER TABLE "AiActionLog" ADD CONSTRAINT "AiActionLog_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

