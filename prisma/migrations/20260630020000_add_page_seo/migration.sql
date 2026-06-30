-- CreateTable
CREATE TABLE "PageSeo" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "seo" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageSeo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PageSeo_slug_key" ON "PageSeo"("slug");
