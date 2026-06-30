# Site Settings & Consent/Tags (Sub-project B) — Design

**Ημερομηνία:** 2026-06-30
**Κατάσταση:** Approved (architecture pre-approved με τα A/B/C/D)
**Μέρος του:** Front-end CMS expansion. Ακολουθεί το A (i18n+SEO foundation). Μετά: C (Pages), D (Translation tooling).

## Στόχος

Site-wide ρυθμίσεις διαχειριζόμενες από super admin: social links, analytics/marketing tags (GA4, GTM, Facebook Pixel) με **GDPR-σωστό consent gating**, search-engine verification tags, GEO/LocalBusiness δεδομένα, default SEO/OG, και παραμετροποιήσιμο **consent window** (per-locale κείμενα). Τα structured data (Organization/LocalBusiness) και τα meta γεμίζουν με πραγματικά δεδομένα.

## Πλαίσιο

- `AppSettings` singleton (id="singleton") = brand/theme (logos, colors) + contact (email/phone/address/websiteUrl). Το κρατάμε — δεν διπλώνουμε.
- `CookieConsent` (client) έχει prefs essential/analytics/marketing/functional, σώζει στο `cookieConsent` table μέσω `/api/cookie-consent`, καλεί `window.gtag('consent','update',…)`. Αλλά τα tags ΔΕΝ φορτώνονται από config.
- `lib/seo/*` (από το A): `buildMetadata`, schema builders, `<JsonLd>`. Το landing βγάζει Organization+WebSite με placeholder data.

## Ενότητα 1 — `SiteSettings` model + accessor

Νέο Prisma singleton `SiteSettings` (id="singleton"):
- **SEO defaults:** `siteName String @default("PropertyPro")`, `defaultOgImage String?`.
- **Social (→ sameAs):** `facebookUrl, instagramUrl, linkedinUrl, xUrl, youtubeUrl, tiktokUrl String?`.
- **Tags:** `googleAnalyticsId String?` (G-…), `googleTagManagerId String?` (GTM-…), `facebookPixelId String?`, `extraHeadHtml String? @db.Text`, `extraBodyHtml String? @db.Text`.
- **Verification:** `googleSiteVerification String?`, `bingSiteVerification String?`.
- **GEO/LocalBusiness:** `geoLat Float?`, `geoLng Float?`, `addrStreet, addrCity, addrPostal, addrCountry String?`, `telephone String?`, `openingHours String?`.
- **Consent:** `consentEnabled Boolean @default(true)`, `consentConfig Json` (translatable: banner τίτλος/κείμενο, labels/descriptions ανά κατηγορία, policyLink).
- `updatedAt`, `updatedById String?`.

Migration (diff+deploy). Seed ένα default singleton row.

`lib/cms/site-settings.ts`: `getSiteSettings()` → singleton + defaults (server-only).

## Ενότητα 2 — Tag injection + consent gating (GDPR)

- **Consent Mode v2:** GA4/GTM/Facebook Pixel φορτώνονται με default **denied** (`analytics_storage`/`ad_storage` = denied) στο `<head>` πριν από οποιοδήποτε tag. Μετά το consent, `gtag('consent','update',…)` + `fbq('consent','grant')`.
- Νέο `components/site/SiteTags.tsx` (client, next/script): παίρνει τα ids από SiteSettings, βάζει το consent-default-denied bootstrap + GA4/GTM/Pixel scripts + `extraHeadHtml`. Render μέσα στο root `app/layout.tsx` (παντού — public & app), αλλά τα tags ενεργά μόνο μετά consent.
- **Verification meta** (`google-site-verification`, `msvalidate.01`) στο `<head>` πάντα (μέσω `metadata.verification` ή raw meta).
- Refactor `CookieConsent`: διαβάζει `consentConfig` (per-locale κείμενα μέσω `useLocale`+`pickLocale`)· στο accept/reject ενημερώνει gtag + fbq consent. Κρατά το υπάρχον `/api/cookie-consent` persistence.
- `extraBodyHtml` injected στο τέλος του `<body>`.

## Ενότητα 3 — Real structured data + SEO defaults

- `lib/seo/site-schema.ts`: `buildSiteSchemas(settings, appSettings, baseUrl)` → Organization (name, logo από AppSettings, **sameAs** από social) + **LocalBusiness** (address/geo/telephone/openingHours/sameAs) όταν υπάρχουν δεδομένα. Το landing (και μελλοντικές σελίδες) τα κάνουν render αντί για placeholder.
- `buildMetadata` fallback: όταν το page `seo.ogImage` είναι κενό, χρήση `SiteSettings.defaultOgImage`. (Πέρασμα defaultOgImage στο buildMetadata call sites· μικρή προσθήκη param.)
- `metadata.verification` γεμίζει από SiteSettings στο root layout (ή ανά σελίδα).

## Ενότητα 4 — Admin UI

- Νέο route `app/(company)/super-admin/cms/settings/page.tsx` (SUPER_ADMIN, ήδη guarded) + client form(s) σε λογικά groups (SEO/Social/Tags/Verification/GEO/Consent). Consent config με el/en tabs.
- Server actions `app/actions/site-settings.ts`: `updateSiteSettings(data)` (SUPER_ADMIN-guarded, upsert singleton, `revalidatePath("/")`).
- Menu: προσθήκη item «Ρυθμίσεις» στο CMS group (`sidebar-nav.tsx`) → `/super-admin/cms/settings`.

## Out of scope
- C: CMS-ify/translate pricing/services/faq/contact/legal + per-page schemas.
- D: DB-backed UI strings + AI auto-translate.
- Image upload UI για το OG (URL field αρχικά).

## Σημεία προσοχής
- Consent gating πρέπει να είναι **πραγματικά** GDPR-correct: κανένα analytics/marketing tag να μη στέλνει δεδομένα πριν το consent (Consent Mode v2 default denied). Όχι hard-coded gtag χωρίς default-denied.
- `extraHeadHtml`/`extraBodyHtml` = raw HTML από super admin → injected με dangerouslySetInnerHTML· είναι super-admin-only (αποδεκτό risk), αλλά σημείωσέ το.
- Το `getSiteSettings()` cached· revalidate στο update.
- Μη σπάσεις το υπάρχον `/api/cookie-consent` + `cookieConsent` table.
