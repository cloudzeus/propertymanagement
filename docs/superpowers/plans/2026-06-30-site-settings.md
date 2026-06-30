# Site Settings & Consent/Tags (Sub-project B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A super-admin-managed `SiteSettings` singleton driving social links, GDPR-correct analytics/marketing tags (GA4/GTM/Pixel via Consent Mode v2), verification tags, GEO/LocalBusiness structured data, default OG, and a configurable per-locale consent window.

**Architecture:** New `SiteSettings` Prisma singleton + `getSiteSettings()` accessor. A `SiteTags` client component injects consent-default-denied tag bootstrap + GA/GTM/Pixel via next/script in the root layout; `CookieConsent` is refactored to read the per-locale consent config and grant/deny consent. `buildSiteSchemas()` emits Organization + LocalBusiness from real data. Admin UI at `/super-admin/cms/settings`.

**Tech Stack:** Next.js 16.2 (next/script), Prisma 7 (diff+deploy; DB scripts `npx tsx --env-file=.env`), next-intl (useLocale + pickLocale), Vitest. Builds on A: `lib/seo/*`, `lib/i18n/translatable.ts`, `lib/cms/site-settings.ts`.

**Verified facts:**
- `AppSettings` singleton = brand (companyName, logos, colors) + contact (contactEmail/Phone/Address, websiteUrl). `getAppSettings()` in `lib/app-settings.ts`.
- `CookieConsent` (`components/CookieConsent.tsx`, client) = essential/analytics/marketing/functional prefs → `POST /api/cookie-consent` (`cookieConsent` table) + `window.gtag('consent','update',…)`. Rendered in `app/layout.tsx` inside providers.
- `lib/seo/schema.ts` has `organizationSchema`, `localBusinessSchema`. `<JsonLd>` in `components/seo/JsonLd.tsx`. Landing (`app/[locale]/page.tsx`) currently emits placeholder Organization+WebSite.
- `buildMetadata` in `lib/seo/metadata.ts` (no defaultOgImage fallback param yet).
- CMS menu group "cms" in `NAV_BY_ROLE.SUPER_ADMIN` (`components/admin/sidebar-nav.tsx`), item «Αρχική».

---

## File Structure
**New:** `lib/cms/site-settings.ts`, `lib/cms/site-settings-defaults.ts` (+ test), `components/site/SiteTags.tsx`, `lib/seo/site-schema.ts` (+ test), `app/actions/site-settings.ts`, `app/(company)/super-admin/cms/settings/page.tsx` + `SettingsForm.tsx`, `prisma/seed-site-settings.ts`.
**Modified:** `prisma/schema.prisma`, `components/CookieConsent.tsx`, `app/layout.tsx`, `app/[locale]/page.tsx`, `lib/seo/metadata.ts`, `components/admin/sidebar-nav.tsx`.

---

## Task 1: `SiteSettings` model + accessor + seed

**Files:** Modify `prisma/schema.prisma`; create `lib/cms/site-settings.ts`, `lib/cms/site-settings-defaults.ts`, `lib/cms/site-settings-defaults.test.ts`, `prisma/seed-site-settings.ts`.

- [ ] **Step 1:** Add model:
```prisma
model SiteSettings {
  id                     String   @id @default("singleton")
  siteName               String   @default("PropertyPro")
  defaultOgImage         String?
  facebookUrl            String?
  instagramUrl           String?
  linkedinUrl            String?
  xUrl                   String?
  youtubeUrl             String?
  tiktokUrl              String?
  googleAnalyticsId      String?
  googleTagManagerId     String?
  facebookPixelId        String?
  extraHeadHtml          String?  @db.Text
  extraBodyHtml          String?  @db.Text
  googleSiteVerification String?
  bingSiteVerification   String?
  geoLat                 Float?
  geoLng                 Float?
  addrStreet             String?
  addrCity               String?
  addrPostal             String?
  addrCountry            String?
  telephone              String?
  openingHours           String?
  consentEnabled         Boolean  @default(true)
  consentConfig          Json?
  updatedAt              DateTime @updatedAt
  updatedById            String?
}
```
- [ ] **Step 2:** `npx prisma generate`. Migration via diff (`npx prisma migrate diff --from-config-datasource prisma.config.ts --to-schema-datamodel prisma/schema.prisma --script`), place at `prisma/migrations/20260630030000_add_site_settings/migration.sql`, then `npx prisma migrate deploy`. If DB down, DONE_WITH_CONCERNS.
- [ ] **Step 3:** `lib/cms/site-settings-defaults.ts` — default consent config (TDD target):
```ts
import { makeTranslatable, type Translatable } from "@/lib/i18n/translatable";

export interface ConsentCategory { key: string; required: boolean; label: Translatable<string>; description: Translatable<string>; }
export interface ConsentConfig { title: Translatable<string>; body: Translatable<string>; policyLink: string; categories: ConsentCategory[]; }

export const DEFAULT_CONSENT_CONFIG: ConsentConfig = {
  title: makeTranslatable("Χρησιμοποιούμε cookies", "We use cookies"),
  body: makeTranslatable("Χρησιμοποιούμε cookies για να βελτιώσουμε την εμπειρία σας.", "We use cookies to improve your experience."),
  policyLink: "/cookie-policy",
  categories: [
    { key: "essential", required: true, label: makeTranslatable("Απαραίτητα", "Essential"), description: makeTranslatable("Αναγκαία για τη λειτουργία.", "Required for the site to work.") },
    { key: "analytics", required: false, label: makeTranslatable("Στατιστικά", "Analytics"), description: makeTranslatable("Μας βοηθούν να βελτιωνόμαστε.", "Help us improve.") },
    { key: "marketing", required: false, label: makeTranslatable("Marketing", "Marketing"), description: makeTranslatable("Εξατομικευμένες διαφημίσεις.", "Personalised ads.") },
  ],
};
```
Test `lib/cms/site-settings-defaults.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_CONSENT_CONFIG } from "./site-settings-defaults";
describe("default consent config", () => {
  it("has essential required + analytics/marketing optional", () => {
    const keys = DEFAULT_CONSENT_CONFIG.categories.map((c) => c.key);
    expect(keys).toEqual(["essential", "analytics", "marketing"]);
    expect(DEFAULT_CONSENT_CONFIG.categories[0].required).toBe(true);
    expect(DEFAULT_CONSENT_CONFIG.categories[1].required).toBe(false);
  });
  it("labels are translatable", () => {
    expect(DEFAULT_CONSENT_CONFIG.title).toHaveProperty("el");
    expect(DEFAULT_CONSENT_CONFIG.title).toHaveProperty("en");
  });
});
```
Run TDD: write test → fail → implement → pass.
- [ ] **Step 4:** `lib/cms/site-settings.ts`:
```ts
import "server-only";
import { db } from "@/lib/db";
import { DEFAULT_CONSENT_CONFIG, type ConsentConfig } from "./site-settings-defaults";

export async function getSiteSettings() {
  const row = await db.siteSettings.findUnique({ where: { id: "singleton" } });
  const consentConfig = (row?.consentConfig as ConsentConfig | null) ?? DEFAULT_CONSENT_CONFIG;
  return {
    siteName: row?.siteName ?? "PropertyPro",
    defaultOgImage: row?.defaultOgImage ?? null,
    social: { facebook: row?.facebookUrl ?? null, instagram: row?.instagramUrl ?? null, linkedin: row?.linkedinUrl ?? null, x: row?.xUrl ?? null, youtube: row?.youtubeUrl ?? null, tiktok: row?.tiktokUrl ?? null },
    googleAnalyticsId: row?.googleAnalyticsId ?? null,
    googleTagManagerId: row?.googleTagManagerId ?? null,
    facebookPixelId: row?.facebookPixelId ?? null,
    extraHeadHtml: row?.extraHeadHtml ?? null,
    extraBodyHtml: row?.extraBodyHtml ?? null,
    googleSiteVerification: row?.googleSiteVerification ?? null,
    bingSiteVerification: row?.bingSiteVerification ?? null,
    geo: row?.geoLat != null && row?.geoLng != null ? { lat: row.geoLat, lng: row.geoLng } : null,
    address: { street: row?.addrStreet ?? null, city: row?.addrCity ?? null, postal: row?.addrPostal ?? null, country: row?.addrCountry ?? null },
    telephone: row?.telephone ?? null,
    openingHours: row?.openingHours ?? null,
    consentEnabled: row?.consentEnabled ?? true,
    consentConfig,
  };
}
export type SiteSettingsView = Awaited<ReturnType<typeof getSiteSettings>>;
```
- [ ] **Step 5:** `prisma/seed-site-settings.ts` (idempotent upsert of `singleton` with `consentConfig: DEFAULT_CONSENT_CONFIG`). Run `npx tsx --env-file=.env prisma/seed-site-settings.ts` (twice). If DB down, note it.
- [ ] **Step 6:** `npx tsc --noEmit | grep -i site-settings || echo ok`; `npm run test -- lib/cms/site-settings-defaults.test.ts`. Commit `git add prisma/schema.prisma prisma/migrations/ lib/prisma lib/cms/site-settings* prisma/seed-site-settings.ts && git commit -m "feat(site-settings): SiteSettings model + accessor + consent defaults + seed"`.

---

## Task 2: `buildSiteSchemas` + metadata defaultOgImage (TDD)

**Files:** Create `lib/seo/site-schema.ts`, `lib/seo/site-schema.test.ts`; modify `lib/seo/metadata.ts`.

- [ ] **Step 1: Failing test** `lib/seo/site-schema.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildSiteSchemas } from "./site-schema";

const settings: any = { siteName: "Acme", social: { facebook: "https://fb.com/a", instagram: null, linkedin: null, x: null, youtube: null, tiktok: null }, geo: { lat: 1, lng: 2 }, address: { street: "S", city: "Athens", postal: "111", country: "GR" }, telephone: "+30", openingHours: null };

describe("buildSiteSchemas", () => {
  const s = buildSiteSchemas(settings, "https://x.gr", "Acme logo url");
  it("emits Organization with sameAs from non-null social", () => {
    const org = s.find((x: any) => x["@type"] === "Organization");
    expect(org.sameAs).toEqual(["https://fb.com/a"]);
  });
  it("emits LocalBusiness when geo+address present", () => {
    const lb = s.find((x: any) => x["@type"] === "LocalBusiness");
    expect(lb.geo.latitude).toBe(1);
    expect(lb.address.addressLocality).toBe("Athens");
  });
});
```
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** `lib/seo/site-schema.ts`:
```ts
import { organizationSchema, webSiteSchema, localBusinessSchema } from "./schema";
import type { SiteSettingsView } from "@/lib/cms/site-settings";

export function buildSiteSchemas(s: SiteSettingsView, baseUrl: string, logo?: string) {
  const sameAs = Object.values(s.social).filter((v): v is string => !!v);
  const out: object[] = [
    organizationSchema({ name: s.siteName, url: baseUrl, ...(logo ? { logo } : {}), ...(sameAs.length ? { sameAs } : {}) }),
    webSiteSchema({ name: s.siteName, url: baseUrl }),
  ];
  if (s.geo && (s.address.city || s.address.street)) {
    out.push(localBusinessSchema({
      name: s.siteName, url: baseUrl, ...(s.telephone ? { telephone: s.telephone } : {}),
      address: { streetAddress: s.address.street ?? undefined, addressLocality: s.address.city ?? undefined, postalCode: s.address.postal ?? undefined, addressCountry: s.address.country ?? undefined },
      geo: s.geo, ...(sameAs.length ? { sameAs } : {}),
    }));
  }
  return out;
}
```
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5:** Modify `buildMetadata` (`lib/seo/metadata.ts`) — add optional `defaultOgImage?: string` to its input; use `seo.ogImage || defaultOgImage` for OG/Twitter images. Keep existing tests green (the new param is optional). 
- [ ] **Step 6:** `npm run test -- lib/seo`. Commit `git add lib/seo/site-schema.* lib/seo/metadata.ts && git commit -m "feat(seo): buildSiteSchemas + defaultOgImage fallback"`.

---

## Task 3: `SiteTags` (Consent Mode v2) + wire into layout

**Files:** Create `components/site/SiteTags.tsx`; modify `app/layout.tsx`.

- [ ] **Step 1:** `components/site/SiteTags.tsx` (client, next/script). Renders, in order: (a) consent-mode default-DENIED bootstrap inline script; (b) GA4 gtag.js (if `googleAnalyticsId`); (c) GTM (if `googleTagManagerId`); (d) Facebook Pixel init with `fbq('consent','revoke')` default (if `facebookPixelId`); (e) `extraHeadHtml` via dangerouslySetInnerHTML. Props from SiteSettings.
```tsx
"use client";
import Script from "next/script";
export function SiteTags({ ga, gtm, pixel, extraHead }: { ga?: string | null; gtm?: string | null; pixel?: string | null; extraHead?: string | null }) {
  return (
    <>
      <Script id="consent-default" strategy="beforeInteractive">{`
        window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=window.gtag||gtag;
        gtag('consent','default',{ad_storage:'denied',analytics_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
      `}</Script>
      {ga && (<><Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" /><Script id="ga-init" strategy="afterInteractive">{`gtag('js',new Date());gtag('config','${ga}');`}</Script></>)}
      {gtm && (<Script id="gtm" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');`}</Script>)}
      {pixel && (<Script id="fb-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('consent','revoke');fbq('init','${pixel}');fbq('track','PageView');`}</Script>)}
      {extraHead ? <div dangerouslySetInnerHTML={{ __html: extraHead }} /> : null}
    </>
  );
}
```
- [ ] **Step 2:** In `app/layout.tsx`: `const site = await getSiteSettings();` then render `<SiteTags ga={site.googleAnalyticsId} gtm={site.googleTagManagerId} pixel={site.facebookPixelId} extraHead={site.extraHeadHtml} />` inside `<head>` (or top of body). Also add `metadata.verification` from `site.googleSiteVerification`/`bingSiteVerification` (set in the existing exported `metadata` is static; instead add a small `<meta>` in head via the layout, or convert to `generateMetadata`). Simplest: render `<meta name="google-site-verification" .../>` + `<meta name="msvalidate.01" .../>` in `<head>` when present. Render `extraBodyHtml` at end of `<body>`.
- [ ] **Step 3:** `npm run build` → success. Commit `git add components/site/SiteTags.tsx app/layout.tsx && git commit -m "feat(site): consent-mode v2 tag injection + verification meta"`.

---

## Task 4: Config-driven CookieConsent (per-locale) + consent grant

**Files:** Modify `components/CookieConsent.tsx`; pass config from `app/layout.tsx`.

- [ ] **Step 1:** Make `CookieConsent` accept props `{ config: ConsentConfig; enabled: boolean }` (from `getSiteSettings()` in the layout). Use `useLocale()` + `pickLocale` to show title/body/category labels in the active language. If `!enabled`, render nothing.
- [ ] **Step 2:** On Accept (all or selected): keep the existing `/api/cookie-consent` POST, AND call:
```ts
window.gtag?.('consent','update',{ analytics_storage: analytics?'granted':'denied', ad_storage: marketing?'granted':'denied', ad_user_data: marketing?'granted':'denied', ad_personalization: marketing?'granted':'denied' });
(window as any).fbq?.('consent', marketing ? 'grant':'revoke');
```
On Reject: all denied + `fbq consent revoke`.
- [ ] **Step 3:** In `app/layout.tsx`, render `<CookieConsent config={site.consentConfig} enabled={site.consentEnabled} />` (replace the prop-less usage). 
- [ ] **Step 4:** `npm run build` → success. Commit `git add components/CookieConsent.tsx app/layout.tsx && git commit -m "feat(consent): config-driven per-locale cookie banner + consent-mode grant"`.

---

## Task 5: Landing uses real schemas

**Files:** Modify `app/[locale]/page.tsx`.

- [ ] **Step 1:** Replace the placeholder `JsonLd data={[organizationSchema(...), webSiteSchema(...)]}` with real data:
```tsx
import { getSiteSettings } from "@/lib/cms/site-settings";
import { getAppSettings } from "@/lib/app-settings";
import { buildSiteSchemas } from "@/lib/seo/site-schema";
// inside Home():
const site = await getSiteSettings();
const app = await getAppSettings();
const schemas = buildSiteSchemas(site, BASE, app.logoFullLight ?? app.logoUrl ?? undefined);
// <JsonLd data={schemas} />
```
Also pass `defaultOgImage: site.defaultOgImage ?? undefined` into the `buildMetadata` call in `generateMetadata` (fetch site settings there too).
- [ ] **Step 2:** `npm run build` → success. Commit `git add "app/[locale]/page.tsx" && git commit -m "feat(landing): real Organization/LocalBusiness schemas + default OG"`.

---

## Task 6: Admin settings page + action + menu

**Files:** Create `app/actions/site-settings.ts`, `app/(company)/super-admin/cms/settings/page.tsx`, `.../SettingsForm.tsx`; modify `components/admin/sidebar-nav.tsx`.

- [ ] **Step 1:** `app/actions/site-settings.ts`:
```ts
"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
async function requireSuperAdmin() { const s = await auth(); if ((s?.user as any)?.role !== "SUPER_ADMIN") throw new Error("Forbidden"); }
export async function updateSiteSettings(data: Record<string, unknown>): Promise<void> {
  await requireSuperAdmin();
  await db.siteSettings.upsert({ where: { id: "singleton" }, update: data as any, create: { id: "singleton", ...(data as any) } });
  revalidatePath("/"); revalidatePath("/super-admin/cms/settings");
}
```
- [ ] **Step 2:** `page.tsx` (server) fetches `getSiteSettings()` + raw row; renders `<SettingsForm initial={...} />`. `SettingsForm.tsx` (client): grouped sections (SEO / Social / Tags / Verification / GEO / Consent). Scalar fields → inputs. Consent config → el/en tabs editing title/body/policyLink + per-category labels/descriptions (JSON textarea acceptable for categories to stay pragmatic). Submit → `updateSiteSettings(payload)` via useTransition + "Αποθηκεύτηκε". Keep it functional.
- [ ] **Step 3:** Add menu item «Ρυθμίσεις» → `/super-admin/cms/settings` to the CMS group in `sidebar-nav.tsx` (match existing NavItem shape; ri icon e.g. RiSettings3Line/RiSettings3Fill).
- [ ] **Step 4:** `npm run build`; manual: edit GA id + a social link + consent text → save → reflected (view-source shows tag + sameAs in JSON-LD; banner shows new text). Commit `git add app/actions/site-settings.ts "app/(company)/super-admin/cms/settings" components/admin/sidebar-nav.tsx && git commit -m "feat(site-settings): super-admin settings admin UI + menu"`.

---

## Task 7: Final verification

- [ ] **Step 1:** `npm run test` (all pass) + `npm run build` (success).
- [ ] **Step 2:** Manual: tags load only after consent (Consent Mode default denied verified in head); verification meta present when set; landing JSON-LD shows Organization (sameAs) + LocalBusiness (geo/address) when configured; settings admin saves & reflects; cookie banner shows per-locale text and switches with the language switcher.
- [ ] **Step 3:** `npx tsc --noEmit 2>&1 | grep -iE "site-settings|SiteTags|site-schema|CookieConsent|settings" || echo ok`. Commit fixes.

## Out of scope: C (pages), D (translation tooling). Image upload UI (URL fields only). `<html lang>` localization (from A).
