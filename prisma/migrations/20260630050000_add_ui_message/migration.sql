-- CreateTable
CREATE TABLE "UiMessage" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "el" TEXT NOT NULL,
    "en" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UiMessage_key_key" ON "UiMessage"("key");

