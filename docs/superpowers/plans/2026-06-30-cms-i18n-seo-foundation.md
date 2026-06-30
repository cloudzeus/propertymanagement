# CMS i18n + SEO Foundation (Sub-project A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the public site genuinely bilingual (el/en) and SEO-complete, proven end-to-end on the home/landing page, with the reusable foundation (Translatable, next-intl routing, SEO infra) that sub-projects B/C/D build on.

**Architecture:** A `Translatable<T> = {el,en}` convention + `pickLocale` helper. next-intl v4 is wired properly with a `[locale]` segment for public pages (localePrefix "as-needed": el unprefixed, en `/en/...`); its middleware is composed into the existing `proxy.ts`. SEO is a `lib/seo` toolkit (`buildMetadata` → Next Metadata with hreflang/canonical/OG/Twitter, `<JsonLd>` + schema builders) plus a `PageSeo` table. Landing data becomes per-locale (`{el,en}` whole-data); the page picks locale before rendering; admin gets el/en tabs + a SEO editor.

**Tech Stack:** Next.js 16.2 (read `node_modules/next/dist/docs/` for app-router i18n + proxy/middleware before route work), next-intl v4.13, Prisma 7 (migrate via diff+deploy, NOT migrate dev; DB run scripts with `npx tsx --env-file=.env`), Vitest, react-icons/ri.

**Verified facts:**
- `next.config.ts`: `withNextIntl("./i18n/request.ts")`. `i18n.ts` exports `locales=["el","en"]`, `defaultLocale="el"`, `type Locale`.
- `i18n/request.ts` uses the OLD `{locale}` param (must become `{requestLocale}` for v4 routing).
- `app/layout.tsx` hardcodes `locale="el"` + `require("../messages/el.json")`, wraps SessionProvider + CookieConsent.
- `proxy.ts` is the ACTIVE middleware (auth guards + matcher `["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"]`). `middleware-intl.ts` is dead.
- Public pages: `app/page.tsx` (landing, CMS-driven), `app/{pricing,faq,contact,privacy,terms,cookie-policy}/page.tsx`.
- `LandingSection.data` is single-language JSON (6 seeded rows). `getLandingSections()` in `lib/cms/landing.ts`. Section components are locale-agnostic and take `data`.
- No `NEXT_PUBLIC_SITE_URL` env yet.

---

## File Structure

**New**
- `lib/i18n/translatable.ts` (+ `.test.ts`) — Translatable type, pickLocale, makeTranslatable, isTranslatable.
- `lib/seo/types.ts` — `SeoMeta`.
- `lib/seo/schema.ts` (+ `.test.ts`) — JSON-LD builders.
- `lib/seo/metadata.ts` (+ `.test.ts`) — `buildMetadata`.
- `components/seo/JsonLd.tsx`.
- `lib/cms/page-seo.ts` — `getPageSeo(slug)`.
- `app/actions/landing-cms.ts` — add `updatePageSeo`.
- `i18n/routing.ts`, `i18n/navigation.ts`.
- `app/[locale]/layout.tsx`.
- `components/i18n/LanguageSwitcher.tsx`.
- `app/sitemap.ts`, `app/robots.ts`.
- `prisma/migrate-landing-i18n.ts` — data migration script.

**Modified**
- `prisma/schema.prisma` — add `PageSeo`.
- `i18n/request.ts`, `next.config.ts` (if needed).
- `proxy.ts` — compose next-intl middleware for public paths.
- `app/layout.tsx` — keep global providers; default `el` messages for non-`[locale]` app routes.
- Move public pages into `app/[locale]/` (git mv).
- `lib/cms/landing-types.ts` — localized section data shape.
- `components/admin/sidebar-nav.tsx` — CMS group.
- `app/(company)/super-admin/cms/landing/{page.tsx,SectionEditor.tsx}` — el/en tabs + SEO.
- `components/landing/{landing-header,landing-footer}.tsx` — add LanguageSwitcher.
- `.env` — add `NEXT_PUBLIC_SITE_URL`.

---

## Task 1: `lib/i18n/translatable.ts` (TDD)

**Files:** Create `lib/i18n/translatable.ts`, `lib/i18n/translatable.test.ts`.

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from "vitest";
import { pickLocale, makeTranslatable, isTranslatable } from "./translatable";

describe("translatable", () => {
  it("makeTranslatable defaults en to el", () => {
    expect(makeTranslatable("Γεια")).toEqual({ el: "Γεια", en: "Γεια" });
    expect(makeTranslatable("Γεια", "Hi")).toEqual({ el: "Γεια", en: "Hi" });
  });
  it("isTranslatable detects shape", () => {
    expect(isTranslatable({ el: 1, en: 2 })).toBe(true);
    expect(isTranslatable("x")).toBe(false);
    expect(isTranslatable({ el: 1 })).toBe(false);
    expect(isTranslatable(null)).toBe(false);
  });
  it("pickLocale picks the locale", () => {
    expect(pickLocale({ el: "Γεια", en: "Hi" }, "en")).toBe("Hi");
    expect(pickLocale({ el: "Γεια", en: "Hi" }, "el")).toBe("Γεια");
  });
  it("pickLocale falls back to el for empty en", () => {
    expect(pickLocale({ el: "Γεια", en: "" }, "en")).toBe("Γεια");
  });
  it("pickLocale returns non-translatable values as-is (back-compat)", () => {
    expect(pickLocale("plain", "en")).toBe("plain");
    expect(pickLocale({ title: "x" } as any, "en")).toEqual({ title: "x" });
  });
});
```
- [ ] **Step 2:** `npm run test -- lib/i18n/translatable.test.ts` → FAIL.
- [ ] **Step 3: Implement**
```ts
import type { Locale } from "@/i18n";
import { defaultLocale } from "@/i18n";

export type Translatable<T> = { el: T; en: T };

export function isTranslatable(v: unknown): v is Translatable<unknown> {
  return !!v && typeof v === "object" && "el" in (v as any) && "en" in (v as any);
}

export function makeTranslatable<T>(el: T, en?: T): Translatable<T> {
  return { el, en: en ?? el };
}

export function pickLocale<T>(value: Translatable<T> | T, locale: Locale): T {
  if (isTranslatable(value)) {
    const v = value as Translatable<T>;
    const picked = v[locale];
    // fall back to default locale when the requested one is empty/missing
    if (picked === undefined || picked === null || picked === "") return v[defaultLocale];
    return picked;
  }
  return value as T;
}
```
- [ ] **Step 4:** test → PASS.
- [ ] **Step 5:** Commit `git add lib/i18n/translatable.* && git commit -m "feat(i18n): Translatable type + pickLocale helper"`.

---

## Task 2: `lib/seo/types.ts` + `lib/seo/schema.ts` (TDD)

**Files:** Create `lib/seo/types.ts`, `lib/seo/schema.ts`, `lib/seo/schema.test.ts`.

- [ ] **Step 1: Failing test** `lib/seo/schema.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { organizationSchema, webSiteSchema, faqPageSchema, breadcrumbSchema } from "./schema";

describe("schema builders", () => {
  it("organization", () => {
    const s = organizationSchema({ name: "Acme", url: "https://x.gr", logo: "https://x.gr/l.png", sameAs: ["https://fb.com/x"] });
    expect(s["@type"]).toBe("Organization");
    expect(s.name).toBe("Acme");
    expect(s.sameAs).toEqual(["https://fb.com/x"]);
  });
  it("website with search action", () => {
    const s = webSiteSchema({ name: "Acme", url: "https://x.gr" });
    expect(s["@type"]).toBe("WebSite");
    expect(s.potentialAction["@type"]).toBe("SearchAction");
  });
  it("faqPage", () => {
    const s = faqPageSchema([{ question: "Q?", answer: "A" }]);
    expect(s["@type"]).toBe("FAQPage");
    expect(s.mainEntity[0]["@type"]).toBe("Question");
    expect(s.mainEntity[0].acceptedAnswer.text).toBe("A");
  });
  it("breadcrumb", () => {
    const s = breadcrumbSchema([{ name: "Home", url: "https://x.gr" }]);
    expect(s["@type"]).toBe("BreadcrumbList");
    expect(s.itemListElement[0].position).toBe(1);
  });
});
```
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement** `lib/seo/types.ts`:
```ts
export interface SeoMeta {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  canonical?: string;
  robots?: string;
}
```
and `lib/seo/schema.ts`:
```ts
export function organizationSchema(o: { name: string; url: string; logo?: string; sameAs?: string[]; }) {
  return { "@context": "https://schema.org", "@type": "Organization", name: o.name, url: o.url, ...(o.logo ? { logo: o.logo } : {}), ...(o.sameAs?.length ? { sameAs: o.sameAs } : {}) };
}
export function webSiteSchema(o: { name: string; url: string; }) {
  return { "@context": "https://schema.org", "@type": "WebSite", name: o.name, url: o.url,
    potentialAction: { "@type": "SearchAction", target: `${o.url}/search?q={search_term_string}`, "query-input": "required name=search_term_string" } };
}
export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.url })) };
}
export function faqPageSchema(items: { question: string; answer: string }[]) {
  return { "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: items.map((it) => ({ "@type": "Question", name: it.question, acceptedAnswer: { "@type": "Answer", text: it.answer } })) };
}
export function productOfferSchema(o: { name: string; description?: string; price: number; currency?: string; url: string }) {
  return { "@context": "https://schema.org", "@type": "Product", name: o.name, ...(o.description ? { description: o.description } : {}),
    offers: { "@type": "Offer", price: o.price, priceCurrency: o.currency ?? "EUR", url: o.url, availability: "https://schema.org/InStock" } };
}
export function serviceSchema(o: { name: string; description?: string; provider: string }) {
  return { "@context": "https://schema.org", "@type": "Service", name: o.name, ...(o.description ? { description: o.description } : {}), provider: { "@type": "Organization", name: o.provider } };
}
export function contactPageSchema(o: { name: string; url: string }) {
  return { "@context": "https://schema.org", "@type": "ContactPage", name: o.name, url: o.url };
}
export function localBusinessSchema(o: { name: string; url: string; telephone?: string; address?: { streetAddress?: string; addressLocality?: string; postalCode?: string; addressCountry?: string }; geo?: { lat: number; lng: number }; sameAs?: string[] }) {
  return { "@context": "https://schema.org", "@type": "LocalBusiness", name: o.name, url: o.url,
    ...(o.telephone ? { telephone: o.telephone } : {}),
    ...(o.address ? { address: { "@type": "PostalAddress", ...o.address } } : {}),
    ...(o.geo ? { geo: { "@type": "GeoCoordinates", latitude: o.geo.lat, longitude: o.geo.lng } } : {}),
    ...(o.sameAs?.length ? { sameAs: o.sameAs } : {}) };
}
```
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5:** Commit `git add lib/seo/types.ts lib/seo/schema.ts lib/seo/schema.test.ts && git commit -m "feat(seo): SeoMeta type + JSON-LD schema builders"`.

---

## Task 3: `lib/seo/metadata.ts` — buildMetadata (TDD)

**Files:** Create `lib/seo/metadata.ts`, `lib/seo/metadata.test.ts`.

- [ ] **Step 1: Failing test**:
```ts
import { describe, it, expect } from "vitest";
import { buildMetadata } from "./metadata";

const seo = { title: "Τιμές", description: "Πλάνα", ogImage: "https://x.gr/og.png" };

describe("buildMetadata", () => {
  const m = buildMetadata({ seo, locale: "el", path: "/pricing", baseUrl: "https://x.gr" });
  it("sets title/description", () => {
    expect(m.title).toBe("Τιμές");
    expect(m.description).toBe("Πλάνα");
  });
  it("sets canonical and hreflang alternates", () => {
    expect(m.alternates?.canonical).toBe("https://x.gr/pricing");
    expect(m.alternates?.languages?.el).toBe("https://x.gr/pricing");
    expect(m.alternates?.languages?.en).toBe("https://x.gr/en/pricing");
    expect((m.alternates?.languages as any)["x-default"]).toBe("https://x.gr/pricing");
  });
  it("sets openGraph image", () => {
    expect((m.openGraph?.images as any)?.[0]?.url ?? m.openGraph?.images).toContain("og.png");
  });
});
```
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement** `lib/seo/metadata.ts`:
```ts
import type { Metadata } from "next";
import type { SeoMeta } from "./types";
import { locales, defaultLocale, type Locale } from "@/i18n";

function localizedPath(locale: Locale, path: string): string {
  // as-needed: default locale has no prefix
  if (locale === defaultLocale) return path === "/" ? "" : path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

export function buildMetadata(input: { seo: SeoMeta; locale: Locale; path: string; baseUrl: string }): Metadata {
  const { seo, locale, path, baseUrl } = input;
  const canonical = `${baseUrl}${localizedPath(locale, path)}`;
  const languages: Record<string, string> = {};
  for (const l of locales) languages[l] = `${baseUrl}${localizedPath(l, path)}`;
  languages["x-default"] = `${baseUrl}${localizedPath(defaultLocale, path)}`;

  return {
    title: seo.title,
    description: seo.description,
    ...(seo.keywords ? { keywords: seo.keywords } : {}),
    alternates: { canonical, languages },
    openGraph: {
      title: seo.title, description: seo.description, url: canonical, siteName: "PropertyPro",
      locale, type: "website", ...(seo.ogImage ? { images: [{ url: seo.ogImage }] } : {}),
    },
    twitter: { card: "summary_large_image", title: seo.title, description: seo.description, ...(seo.ogImage ? { images: [seo.ogImage] } : {}) },
    ...(seo.robots ? { robots: seo.robots } : {}),
  };
}
```
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5:** Commit `git add lib/seo/metadata.* && git commit -m "feat(seo): buildMetadata with hreflang/canonical/OG/Twitter"`.

---

## Task 4: `<JsonLd>` component

**Files:** Create `components/seo/JsonLd.tsx`.

- [ ] **Step 1: Implement**
```tsx
export function JsonLd({ data }: { data: object | object[] }) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d) }} />
      ))}
    </>
  );
}
```
- [ ] **Step 2:** `npx tsc --noEmit 2>&1 | grep -i JsonLd || echo ok`.
- [ ] **Step 3:** Commit `git add components/seo/JsonLd.tsx && git commit -m "feat(seo): JsonLd component"`.

---

## Task 5: `PageSeo` model + migration + getPageSeo + seed

**Files:** Modify `prisma/schema.prisma`; create `lib/cms/page-seo.ts`, `prisma/seed-page-seo.ts`.

- [ ] **Step 1:** Add model:
```prisma
model PageSeo {
  id        String   @id @default(cuid())
  slug      String   @unique
  seo       Json     // Translatable<SeoMeta>
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```
- [ ] **Step 2:** `npx prisma generate`. Migration via diff (Prisma 7 syntax: `npx prisma migrate diff --from-config-datasource prisma.config.ts --to-schema-datamodel prisma/schema.prisma --script` — mirror the structure of `prisma/migrations/20260630010000_add_landing_section/`; if the exact diff flags differ, replicate whatever produced the prior migration). Place at `prisma/migrations/20260630020000_add_page_seo/migration.sql`. Then `npx prisma migrate deploy`. If DB unreachable, DONE_WITH_CONCERNS.
- [ ] **Step 3:** `lib/cms/page-seo.ts`:
```ts
import "server-only";
import { db } from "@/lib/db";
import type { SeoMeta } from "@/lib/seo/types";
import type { Translatable } from "@/lib/i18n/translatable";

export async function getPageSeo(slug: string): Promise<Translatable<SeoMeta> | null> {
  const row = await db.pageSeo.findUnique({ where: { slug } });
  return (row?.seo as Translatable<SeoMeta>) ?? null;
}
```
- [ ] **Step 4:** `prisma/seed-page-seo.ts` (idempotent upsert), seed `home`:
```ts
import { db } from "@/lib/db";
const HOME = {
  el: { title: "PropertyPro — Διαχείριση Ακινήτων", description: "Η ολοκληρωμένη πλατφόρμα διαχείρισης πολυκατοικιών και ακινήτων.", ogImage: "" },
  en: { title: "PropertyPro — Property Management", description: "The all-in-one platform for managing buildings and properties.", ogImage: "" },
};
async function main() {
  await db.pageSeo.upsert({ where: { slug: "home" }, update: {}, create: { slug: "home", seo: HOME } });
  console.log("PageSeo seeded.");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```
Run `npx tsx --env-file=.env prisma/seed-page-seo.ts` (DB script env note). If DB down, DONE_WITH_CONCERNS.
- [ ] **Step 5:** Commit `git add prisma/schema.prisma prisma/migrations/ lib/prisma lib/cms/page-seo.ts prisma/seed-page-seo.ts && git commit -m "feat(seo): PageSeo model + getPageSeo + home seed"`.

---

## Task 6: next-intl routing wiring (no UI yet)

**Files:** Create `i18n/routing.ts`, `i18n/navigation.ts`; modify `i18n/request.ts`. Add `NEXT_PUBLIC_SITE_URL` to `.env`.

- [ ] **Step 1:** Read `node_modules/next/dist/docs/` for app-router i18n (next-intl is external but confirm App Router metadata/alternates API). Then `i18n/routing.ts`:
```ts
import { defineRouting } from "next-intl/routing";
import { locales, defaultLocale } from "@/i18n";

export const routing = defineRouting({
  locales: [...locales],
  defaultLocale,
  localePrefix: "as-needed",
});
```
- [ ] **Step 2:** `i18n/navigation.ts`:
```ts
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
```
- [ ] **Step 3:** Update `i18n/request.ts` to v4 routing API:
```ts
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as any)) locale = routing.defaultLocale;
  return { locale, messages: (await import(`../messages/${locale}.json`)).default };
});
```
- [ ] **Step 4:** Add to `.env`: `NEXT_PUBLIC_SITE_URL=https://property.dgsmart.gr` (and note it should be set in Coolify too).
- [ ] **Step 5:** `npx tsc --noEmit` clean for i18n files. (Routing isn't active until middleware+segment — next task.) Commit `git add i18n/ .env && git commit -m "feat(i18n): next-intl v4 routing + navigation + requestLocale config"`. NOTE: `.env` is gitignored — if so, DON'T add it; instead document the new var in the commit message and report it. Verify with `git check-ignore .env`.

---

## Task 7: `[locale]` segment + move public pages + compose middleware

**Files:** Create `app/[locale]/layout.tsx`; `git mv` public pages; modify `app/layout.tsx`, `proxy.ts`.

- [ ] **Step 1:** Create `app/[locale]/layout.tsx`:
```tsx
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const messages = await getMessages();
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
```
- [ ] **Step 2:** Move public pages under `[locale]` (keep `app/layout.tsx` as the root):
```bash
mkdir -p "app/[locale]"
git mv app/page.tsx "app/[locale]/page.tsx"
for d in pricing faq contact privacy terms cookie-policy; do git mv "app/$d" "app/[locale]/$d"; done
```
Confirm with `ls "app/[locale]"`.
- [ ] **Step 3:** `app/layout.tsx` — the root still renders `<html>`/`<body>`/providers for ALL routes (app + `[locale]`). Keep the existing `el` `NextIntlClientProvider` for non-`[locale]` (authenticated app) routes; the `[locale]/layout.tsx` provides its own provider nested for public pages (nested providers are fine — inner wins). No structural change needed beyond leaving it as-is. Verify `app/layout.tsx` still wraps `{children}` and that `<html lang>` stays (the `[locale]` layout does NOT render `<html>` — only the root does; so localized `lang` attribute is a known limitation, acceptable for A; document it).
- [ ] **Step 4:** Compose next-intl middleware into `proxy.ts`. Read next-intl "composing middlewares" docs pattern. Implement: build the intl middleware once and, for PUBLIC localized paths, return its response; otherwise run the existing auth logic. Concretely, at the top of the handler after computing `pathWithoutLocale`/`isPublic`:
```ts
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
const intlMiddleware = createIntlMiddleware(routing);
// ... inside the auth(...) callback, BEFORE the auth checks, for public paths:
if (isPublic) {
  return intlMiddleware(req);
}
```
Place this so public paths get locale handling (redirects `/en` ↔ `/`, sets locale) and protected paths keep the existing auth guards untouched. Ensure `isPublic` is computed on `pathWithoutLocale` (already is). Keep the matcher as-is.
- [ ] **Step 5:** `npm run build`. Verify: `/` , `/pricing`, `/faq`, `/contact`, `/privacy`, `/terms`, `/cookie-policy` resolve (el, unprefixed) AND `/en`, `/en/pricing` resolve (en). App routes (`/super-admin`, `/admin`, …) still guarded. If build/route conflicts, read errors and fix within scope; if the middleware composition fights the auth flow, report BLOCKED with specifics.
- [ ] **Step 6:** Commit `git add -A && git commit -m "feat(i18n): [locale] segment for public pages + intl middleware composed into proxy"`.

---

## Task 8: Landing data → per-locale + locale-aware render

**Files:** Modify `lib/cms/landing-types.ts`, `app/[locale]/page.tsx`, `components/landing/section-registry.tsx`; create `prisma/migrate-landing-i18n.ts`.

- [ ] **Step 1:** In `lib/cms/landing-types.ts` add:
```ts
import type { Translatable } from "@/lib/i18n/translatable";
// The stored shape per section: whole SectionData duplicated per locale.
export type LocalizedSectionData = Translatable<any>;
```
(Keep existing typed shapes; storage is `{el,en}` of the same.)
- [ ] **Step 2:** Data migration `prisma/migrate-landing-i18n.ts` (idempotent):
```ts
import { db } from "@/lib/db";
async function main() {
  const rows = await db.landingSection.findMany();
  for (const r of rows) {
    const d: any = r.data;
    if (d && typeof d === "object" && "el" in d && "en" in d) continue; // already migrated
    const localized = { el: d, en: JSON.parse(JSON.stringify(d)) };
    await db.landingSection.update({ where: { id: r.id }, data: { data: localized } });
  }
  console.log("Landing data localized.");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```
Run `npx tsx --env-file=.env prisma/migrate-landing-i18n.ts` (idempotent; safe to re-run). If DB down, DONE_WITH_CONCERNS.
- [ ] **Step 3:** Update `components/landing/section-registry.tsx` — `renderSection` signature unchanged (receives already-picked `data`). No change needed IF the page picks locale first.
- [ ] **Step 4:** Update `app/[locale]/page.tsx`:
```tsx
import { getLocale } from "next-intl/server";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { getLandingSections } from "@/lib/cms/landing";
import { renderSection } from "@/components/landing/section-registry";
import { pickLocale } from "@/lib/i18n/translatable";
import type { Locale } from "@/i18n";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationSchema, webSiteSchema } from "@/lib/seo/schema";
import { getPageSeo } from "@/lib/cms/page-seo";
import { buildMetadata } from "@/lib/seo/metadata";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://property.dgsmart.gr";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getPageSeo("home");
  const seo = t ? pickLocale(t, locale as Locale) : { title: "PropertyPro", description: "" };
  return buildMetadata({ seo, locale: locale as Locale, path: "/", baseUrl: BASE });
}

export default async function Home() {
  const locale = (await getLocale()) as Locale;
  let sections: Awaited<ReturnType<typeof getLandingSections>> = [];
  try { sections = await getLandingSections(); } catch { sections = []; }
  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={[organizationSchema({ name: "PropertyPro", url: BASE }), webSiteSchema({ name: "PropertyPro", url: BASE })]} />
      <LandingHeader />
      <main>{sections.map((s) => renderSection(s.type, pickLocale(s.data as any, locale), s.id))}</main>
      <LandingFooter />
    </div>
  );
}
```
- [ ] **Step 5:** `npm run build` → success; `/` (el) and `/en` render localized landing; view-source shows JSON-LD + hreflang in metadata. Commit `git add -A && git commit -m "feat(landing): per-locale section data + localized render + SEO metadata/JSON-LD"`.

---

## Task 9: Admin el/en tabs + SEO editor + updatePageSeo

**Files:** Modify `app/(company)/super-admin/cms/landing/SectionEditor.tsx`, `app/(company)/super-admin/cms/landing/page.tsx`, `app/actions/landing-cms.ts`.

- [ ] **Step 1:** Add `updatePageSeo` to `app/actions/landing-cms.ts`:
```ts
export async function updatePageSeo(slug: string, seo: unknown): Promise<void> {
  await requireSuperAdmin();
  await db.pageSeo.upsert({ where: { slug }, update: { seo: seo as any }, create: { slug, seo: seo as any } });
  revalidatePath("/");
  revalidatePath("/super-admin/cms/landing");
}
```
- [ ] **Step 2:** `SectionEditor.tsx` — add an **el/en tab** toggle. The component's local state holds `{ el: <data>, en: <data> }`. Editing fields edits the active-locale copy. On submit, send the full `{el,en}` to `updateSection`. Initialize from `section.data` which is now `{el,en}` (if a legacy non-`{el,en}` arrives, wrap via `{el:data,en:data}` defensively).
- [ ] **Step 3:** `page.tsx` (admin) — add a **SEO editor** block for the home page: fetch `getPageSeo("home")`, render a small client form (el/en tabs) for `title`/`description`/`keywords`/`ogImage`, submit via `updatePageSeo("home", {el,en})`. Keep it in a sibling client component `SeoEditor.tsx` (create it) to keep concerns separate.
- [ ] **Step 4:** `npm run build`; manual: edit Hero title in `en` tab → save → `/en` reflects it; edit home SEO title `en` → `/en` `<title>` updates. Commit `git add -A && git commit -m "feat(cms): el/en section tabs + home SEO editor"`.

---

## Task 10: sitemap.ts + robots.ts

**Files:** Create `app/sitemap.ts`, `app/robots.ts`.

- [ ] **Step 1:** `app/sitemap.ts`:
```ts
import type { MetadataRoute } from "next";
import { locales, defaultLocale } from "@/i18n";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://property.dgsmart.gr";
const PATHS = ["/", "/pricing", "/faq", "/contact", "/privacy", "/terms", "/cookie-policy"];

function loc(locale: string, path: string) {
  if (locale === defaultLocale) return `${BASE}${path === "/" ? "" : path}`;
  return `${BASE}/${locale}${path === "/" ? "" : path}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((p) => ({
    url: loc(defaultLocale, p),
    alternates: { languages: Object.fromEntries(locales.map((l) => [l, loc(l, p)])) },
  }));
}
```
- [ ] **Step 2:** `app/robots.ts`:
```ts
import type { MetadataRoute } from "next";
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://property.dgsmart.gr";
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/super-admin", "/admin", "/manager", "/staff", "/owner", "/portal", "/marketplace", "/api"] }], sitemap: `${BASE}/sitemap.xml` };
}
```
- [ ] **Step 3:** `npm run build`; verify `/sitemap.xml` and `/robots.txt` build. Commit `git add app/sitemap.ts app/robots.ts && git commit -m "feat(seo): locale-aware sitemap + robots"`.

---

## Task 11: CMS menu group

**Files:** Modify `components/admin/sidebar-nav.tsx`.

- [ ] **Step 1:** The earlier "cms" group currently has one item "Landing". Keep it as a group titled "CMS" with item «Αρχική» → `/super-admin/cms/landing` (rename label to «Αρχική» if it says "Landing"). Match the existing NavGroup/NavItem shape. (Other items added in B/C/D.)
- [ ] **Step 2:** `npx tsc --noEmit` clean; `npm run build`. Commit `git add components/admin/sidebar-nav.tsx && git commit -m "feat(cms): CMS menu group with Αρχική"`.

---

## Task 12: Language switcher in header + footer

**Files:** Create `components/i18n/LanguageSwitcher.tsx`; modify `components/landing/landing-header.tsx`, `components/landing/landing-footer.tsx`.

- [ ] **Step 1:** `components/i18n/LanguageSwitcher.tsx` (`'use client'`):
```tsx
"use client";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div className="flex items-center gap-1 text-sm">
      {routing.locales.map((l) => (
        <button key={l} onClick={() => router.replace(pathname, { locale: l })}
          className={l === locale ? "font-semibold underline" : "text-gray-500 hover:text-gray-800"}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
```
- [ ] **Step 2:** Import and render `<LanguageSwitcher />` in `landing-header.tsx` (near the nav/CTA) and `landing-footer.tsx`.
- [ ] **Step 3:** `npm run build`; manual: switching el↔en on `/` navigates `/` ↔ `/en` preserving path; on `/pricing` ↔ `/en/pricing`. Commit `git add -A && git commit -m "feat(i18n): public language switcher in header + footer"`.

---

## Task 13: Final verification

- [ ] **Step 1:** `npm run test` (all pass) + `npm run build` (success).
- [ ] **Step 2:** Manual matrix: `/` and `/en` render localized landing; `<title>`/hreflang/canonical correct per locale (view source); JSON-LD present; `/sitemap.xml` + `/robots.txt` correct; admin el/en tabs + SEO editor reflect on the public page; old public URLs still resolve; app routes still guarded; logged-in workspace CTA still works.
- [ ] **Step 3:** `npx tsc --noEmit 2>&1 | grep -iE "i18n|seo|landing|locale" || echo ok`. Commit any fixes.

---

## Out of scope (B/C/D)
- Site Settings (social/GA/FB/consent config), Organization/LocalBusiness data wiring, default OG image, verification tags.
- CMS-ifying & translating pricing/services/faq/contact/legal; per-page SEO + page-type schemas.
- DB-backed UI strings + admin editor + AI auto-translate.
- Localized `<html lang>` (root layout limitation — revisit if needed).
