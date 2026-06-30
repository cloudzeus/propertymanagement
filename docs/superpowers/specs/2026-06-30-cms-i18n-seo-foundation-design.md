# CMS i18n + SEO Foundation (Sub-project A) — Design

**Ημερομηνία:** 2026-06-30
**Κατάσταση:** Approved (design)
**Μέρος του:** Front-end CMS expansion (4 sub-projects A→D). Αυτό είναι το **A — Foundation**. B (Site Settings/consent/tags), C (Pages CMS), D (Translation tooling) ακολουθούν με δικά τους specs.

## Στόχος

Θεμελίωση για πλήρως δίγλωσσο (el/en), SEO-σωστό public site, διαχειριζόμενο από super admin. Αποδεικνύεται end-to-end στο **home/landing**. Παραδίδει: τον `Translatable<T>` μηχανισμό, σωστό next-intl wiring με locale-routed public pages, SEO/structured-data infrastructure, δίγλωσσο landing (render + admin + SEO), CMS menu group, και public language switcher.

## Πλαίσιο / ευρήματα

- next-intl είναι **μισο-στημένο**: `app/layout.tsx` κάνει hardcode `locale="el"` + `require("../messages/el.json")`, αγνοώντας το `i18n/request.ts`. Το `middleware-intl.ts` είναι ανενεργό — το **`proxy.ts`** (Next 16.2 proxy convention) είναι το πραγματικό middleware.
- Locales: `el` (default), `en` (`i18n.ts`). `messages/el.json`,`en.json` = UI strings.
- Public pages σήμερα: `app/page.tsx` (landing, μόλις έγινε CMS-driven), `app/{pricing,faq,contact,privacy,terms,cookie-policy}`.
- LandingSection.data = plain (μονόγλωσσο) JSON, 6 seeded rows.
- Δεν υπάρχει `NEXT_PUBLIC_SITE_URL`.

## Αποφάσεις (locked)
- i18n content: **per-locale nested** (`Translatable<T> = { el, en }`).
- Pages: **hybrid** (structured όπου υπάρχει, rich-text αλλού) — εφαρμόζεται στο C.
- i18n routing: **μόνο public pages** κάτω από `app/[locale]/` (el χωρίς prefix, en = `/en/...`). App routes ως έχουν.
- Landing data shape: **whole-`data` per-locale** (`data = { el: SectionData, en: SectionData }`).

---

## Ενότητα 1 — i18n core & σωστό next-intl wiring

**`lib/i18n/translatable.ts`** (unit-tested):
- `type Translatable<T> = { el: T; en: T }`.
- `isTranslatable(v): boolean` — έχει `el`/`en` keys.
- `pickLocale<T>(value: Translatable<T> | T, locale: Locale): T` — αν translatable → διάλεξε `locale` με fallback σε `el`/defaultLocale· αλλιώς επέστρεψε `value` ως έχει (back-compat).
- `makeTranslatable<T>(el: T, en?: T): Translatable<T>` (en default = el).

**next-intl wiring:**
- `i18n/request.ts` (`getRequestConfig`): επιστρέφει `locale` (από `requestLocale`/param με validation κατά `locales`) + `messages` (`(await import(\`../messages/${locale}.json\`)).default`).
- Νέο `app/[locale]/layout.tsx`: validates `params.locale ∈ locales` (αλλιώς `notFound()`), τυλίγει children σε `NextIntlClientProvider` με `locale` + `await getMessages()`. Ορίζει `generateStaticParams` για τα locales και `<html lang={locale}>` εδώ (το root `app/layout.tsx` παύει να ορίζει lang/provider για τα public — βλ. σημείωση συμβατότητας).
- **Middleware**: στο `proxy.ts`, για **public paths** εφαρμόζεται locale-detection/redirect του next-intl (σύνθεση: τρέξε τη λογική next-intl `createMiddleware` για public, και τη λογική auth για app paths). `localePrefix: "as-needed"` (el χωρίς prefix). Διατήρηση του υπάρχοντος matcher + auth guards για app paths αναλλοίωτων.
- `i18n.ts`: πρόσθεσε `localePrefix`/routing config αν χρειάζεται από το next-intl helper.

**Σημείωση συμβατότητας / δομή routing:** για να μη μείνει αμφίσημο next-intl routing, **όλες** οι υπάρχουσες public σελίδες μετακινούνται μηχανικά κάτω από `app/[locale]/` σε αυτό το A: `page.tsx` (home), `pricing`, `faq`, `contact`, `privacy`, `terms`, `cookie-policy`. Με `localePrefix: "as-needed"` τα el URLs μένουν ίδια (`/pricing`), το en παίρνει `/en/pricing` — κανένα σπασμένο link. **Πλήρη** δίγλωσση + CMS + SEO μεταχείριση παίρνει τώρα **μόνο το home**· οι υπόλοιπες απλώς μετακινούνται (μένουν el-only στην εμφάνιση μέχρι το C). Το `app/[locale]/layout.tsx` ορίζει `<html lang={locale}>` + `NextIntlClientProvider`. Το root `app/layout.tsx` κρατά global providers (SessionProvider κ.λπ.) και έναν default `el` NextIntlClientProvider ώστε το authenticated app (εκτός `[locale]`) να συνεχίσει να φορτώνει messages. Επιβεβαίωσε με build ότι όλα τα παλιά public URLs εξακολουθούν να αναλύονται.

---

## Ενότητα 2 — SEO / GEO / AEO infrastructure

**`lib/seo/types.ts`**: `SeoMeta = { title: string; description: string; keywords?: string; ogImage?: string; canonical?: string; robots?: string }` — αποθηκεύεται **translatable** (`Translatable<SeoMeta>`).

**`lib/seo/metadata.ts`** — `buildMetadata({ seo, locale, path, baseUrl }): Metadata`:
- `title`, `description`, `keywords`.
- `alternates.canonical` = `baseUrl + localizedPath`.
- `alternates.languages` = hreflang για `el`,`en` + `x-default` (el).
- `openGraph` (title/description/url/siteName/images/locale) + `twitter` (summary_large_image).
- `robots` (parse directive ή default index,follow).

**`components/seo/JsonLd.tsx`** — `<script type="application/ld+json">` με JSON.stringify (server component).
**`lib/seo/schema.ts`** — builders: `organizationSchema`, `webSiteSchema` (+SearchAction), `breadcrumbSchema`, `faqPageSchema`, `productOfferSchema`, `serviceSchema`, `localBusinessSchema`, `contactPageSchema`. (Στο A χρησιμοποιούνται Organization + WebSite· τα υπόλοιπα είναι έτοιμα για B/C.)

**`PageSeo` Prisma model**: `{ id, slug @unique, seo Json /* Translatable<SeoMeta> */, updatedAt, createdAt }`. Migration (diff+deploy). Seed row `home`.

**`app/sitemap.ts`** + **`app/robots.ts`** (δυναμικά, locale-aware): για κάθε γνωστό public route, entry για `el` (no prefix) + `en` (`/en/...`) με `alternates`. robots δείχνει στο sitemap. Base URL από `NEXT_PUBLIC_SITE_URL` (νέο env· fallback `NEXTAUTH_URL`).

**Landing `generateMetadata`**: διαβάζει `PageSeo['home']`, `pickLocale`, `buildMetadata`. Η σελίδα κάνει render `<JsonLd>` με WebSite + Organization schema.

---

## Ενότητα 3 — Landing bilingual

- `lib/cms/landing-types.ts`: το αποθηκευμένο `data` γίνεται `LocalizedSection = Translatable<SectionData>` (whole-data per locale). Οι υπάρχουσες typed shapes (HeroData κ.λπ.) μένουν· απλώς wrap.
- **Data migration** (`prisma/migrate-landing-i18n.ts`, idempotent): για κάθε από τα 6 rows, αν το `data` δεν είναι ήδη `{el,en}`, μετασχημάτισε σε `{ el: <current>, en: <deep copy current> }` (en αρχικά = el ώστε να δουλεύει το en μέχρι να μεταφραστεί).
- `app/[locale]/page.tsx`: `const locale = await getLocale()` (ή από params)· `getLandingSections()` → για κάθε section `pickLocale(section.data, locale)` πριν το `renderSection`. Τα section components μένουν locale-agnostic (παίρνουν έτοιμο SectionData).
- `SectionEditor`: **el/en tabs** (επεξεργασία ανά γλώσσα του ίδιου section)· στο submit στέλνει `{ el, en }`. Προσθήκη **SEO tab** (επεξεργασία `PageSeo['home']` per-locale) — ή ξεχωριστό μικρό SEO editor στη σελίδα admin.
- `updateSection` action: αποδέχεται το `{el,en}` data (ήδη `data as any`). Νέο action `updatePageSeo(slug, seo)`.

---

## Ενότητα 4 — CMS menu group + Language switcher

- **Menu group**: στο `components/admin/sidebar-nav.tsx` (SUPER_ADMIN) το σημερινό μονό CMS item γίνεται **group «CMS»** με item «Αρχική» → `/super-admin/cms/landing`. (Ρυθμίσεις/Σελίδες/Μεταφράσεις προστίθενται στα B/C/D — χωρίς dead links.)
- **Language switcher** (`components/i18n/LanguageSwitcher.tsx`, client): el/en toggle. Χρησιμοποιεί next-intl navigation (`createNavigation`/`usePathname`+`useRouter`) για εναλλαγή locale διατηρώντας το path. Μπαίνει στο `landing-header.tsx` + `landing-footer.tsx`.

---

## Out of scope (επόμενα sub-projects)
- B: Site Settings (social, GA/FB tags, consent config), Organization/**LocalBusiness** (GEO address/geo/sameAs), verification tags, default OG image.
- C: μετακίνηση & CMS-ification των pricing/services/faq/contact/legal κάτω από `app/[locale]/`, per-page SEO + page-type schemas.
- D: DB-backed UI strings + admin editor + **AI auto-translate**.

## Σημεία προσοχής
- Η σύνθεση next-intl middleware **μέσα** στο `proxy.ts` είναι το πιο λεπτό σημείο — να μη σπάσουν τα auth guards/redirects των app routes. Διάβασε `node_modules/next/dist/docs/` (proxy/middleware + i18n) πριν.
- Μόνο το home μετακινείται στο `[locale]` τώρα· πρόσεξε να μη σπάσουν links προς `/` και το logged-in CTA.
- `pickLocale` πρέπει να είναι ανθεκτικό σε legacy μη-translatable rows (πριν το migration) — fallback returns value as-is.
- Διατήρησε το try/catch fallback στο landing fetch.
