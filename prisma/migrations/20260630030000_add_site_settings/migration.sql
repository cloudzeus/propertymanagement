-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "siteName" TEXT NOT NULL DEFAULT 'PropertyPro',
    "defaultOgImage" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "linkedinUrl" TEXT,
    "xUrl" TEXT,
    "youtubeUrl" TEXT,
    "tiktokUrl" TEXT,
    "googleAnalyticsId" TEXT,
    "googleTagManagerId" TEXT,
    "facebookPixelId" TEXT,
    "extraHeadHtml" TEXT,
    "extraBodyHtml" TEXT,
    "googleSiteVerification" TEXT,
    "bingSiteVerification" TEXT,
    "geoLat" DOUBLE PRECISION,
    "geoLng" DOUBLE PRECISION,
    "addrStreet" TEXT,
    "addrCity" TEXT,
    "addrPostal" TEXT,
    "addrCountry" TEXT,
    "telephone" TEXT,
    "openingHours" TEXT,
    "consentEnabled" BOOLEAN NOT NULL DEFAULT true,
    "consentConfig" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

