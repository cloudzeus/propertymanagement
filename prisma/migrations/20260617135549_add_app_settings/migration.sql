-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "companyName" TEXT NOT NULL DEFAULT 'PropertyPro',
    "logoUrl" TEXT,
    "logoSquareUrl" TEXT,
    "colorPrimary" TEXT NOT NULL DEFAULT '#0078D4',
    "colorPrimaryDk" TEXT NOT NULL DEFAULT '#005A9E',
    "colorAccent" TEXT NOT NULL DEFAULT '#E31E2A',
    "colorSuccess" TEXT NOT NULL DEFAULT '#107C10',
    "colorWarning" TEXT NOT NULL DEFAULT '#CA5D00',
    "colorDanger" TEXT NOT NULL DEFAULT '#A4262C',
    "colorPurple" TEXT NOT NULL DEFAULT '#8764B8',
    "colorTeal" TEXT NOT NULL DEFAULT '#038387',
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "contactAddress" TEXT,
    "websiteUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);
