# Pages CMS — hybrid, translatable (Sub-project C) — Design

**Ημερομηνία:** 2026-06-30
**Κατάσταση:** Approved (architecture pre-approved)
**Μέρος του:** Front-end CMS expansion. Μετά τα A (i18n+SEO foundation) & B (Site Settings). Ακολουθεί D (translation tooling).

## Στόχος

Όλες οι public σελίδες (Τιμές, Υπηρεσίες[νέα], FAQ, Επικοινωνία, legal: privacy/terms/cookie-policy) γίνονται **CMS-managed, δίγλωσσες (el/en), SEO-complete** (per-page meta + page-type structured data). Hybrid: structured όπου υπάρχει (Pricing→PricingTier, FAQ→FAQ), rich-text (CMSPage) για prose (legal/contact-intro/services).

## Ευρήματα
- Public σελίδες κάτω από `app/[locale]/`. **Stubs** (μόνο `<h1>`): faq, contact, privacy, terms, cookie-policy. `pricing` λειτουργεί (διαβάζει PricingTier, hardcoded EN). `CMSPage` model υπάρχει αλλά **αχρησιμοποίητο**.
- Από A: `Translatable<T>`/`pickLocale`, `PageSeo`+`getPageSeo`, `buildMetadata`, `<JsonLd>`, schema builders (faqPage/productOffer/service/contactPage/breadcrumb), `getLocale`.

## Ενότητα 1 — Translatable επεκτάσεις (additive, μη-breaking)
Προσθήκη `i18n Json?` σε κάθε model (κρατάμε τα legacy columns ως fallback):
- **CMSPage**: `i18n` = `{ title: Translatable<string>, body: Translatable<string> }` (markdown body). Helper `lib/cms/pages.ts` `getCmsPage(slug)` → published row.
- **PricingTier**: `i18n` = `{ name: Translatable<string>, description: Translatable<string>, features: Translatable<string[]> }`. Helper `getPricingTiers()`.
- **FAQ**: `i18n` = `{ question: Translatable<string>, answer: Translatable<string> }`. Helper `getFaqs()` (published, ordered, ομαδοποιημένα ανά category).
Migrations (diff+deploy). Backfill seed: wrap existing legacy values σε `{el:<legacy>, en:<legacy>}`.

## Ενότητα 2 — Public σελίδες (per-locale + SEO + schema)
Κοινό pattern ανά σελίδα: `generateMetadata` διαβάζει `PageSeo[slug]` → `pickLocale` → `buildMetadata` (defaultOgImage από SiteSettings)· render `<JsonLd>` με page-type schema· περιεχόμενο per-locale μέσω `pickLocale`. Κοινό `LandingHeader`/`LandingFooter` wrapper (ή ένα `PublicPage` shell) ώστε header/footer/language-switcher παντού.
- **Pricing**: restyle DG/Fluent· render PricingTier per-locale (name/description/features)· `productOfferSchema` ανά tier· header από CMSPage `pricing-intro` ή PageSeo. 
- **Services (νέα)**: CMSPage `services` (rich-text) ή λίστα· `serviceSchema`.
- **FAQ**: build accordion per-locale ομαδοποιημένο ανά category· `faqPageSchema` (AEO).
- **Contact**: intro από CMSPage `contact`· διατήρηση/προσθήκη φόρμας επικοινωνίας (υπάρχει `/api/contact`? αν όχι, απλό mailto/form action — εκτός core, κράτα minimal)· `contactPageSchema`.
- **Legal** (privacy/terms/cookie-policy): render CMSPage markdown per-locale. Markdown renderer (`react-markdown` αν υπάρχει, αλλιώς απλό sanitized renderer).
- Όλες: `breadcrumbSchema`.

## Ενότητα 3 — Admin «Σελίδες»
- Hub `app/(company)/super-admin/cms/pages/page.tsx`: λίστα όλων των σελίδων (Pricing/Services/FAQ/Contact/Legal) με links σε editors.
- Editors:
  - **CMSPage editor** (`/cms/pages/[slug]`): el/en tabs (title + markdown body) + SEO tab (PageSeo[slug]) + status. Action `updateCmsPage(slug, i18n, status)`.
  - **Pricing editor**: λίστα tiers, el/en επεξεργασία name/description/features (+ τιμές/order/highlighted/published — υπάρχοντα). Actions `updatePricingTier`, create/delete.
  - **FAQ editor**: λίστα, el/en question/answer, category, order, publish, add/delete. Actions.
- Menu: προσθήκη group/items «Σελίδες» στο CMS menu (`sidebar-nav.tsx`).

## Ενότητα 4 — Seed
- `PageSeo` rows: pricing, services, faq, contact, privacy, terms, cookie-policy (el/en titles/descriptions).
- `CMSPage` rows (PUBLISHED): privacy, terms, cookie-policy, contact, services με starter περιεχόμενο (el/en) στο `i18n`.
- PricingTier/FAQ `i18n` backfill (από legacy ή sample).

## Out of scope
- D: DB-backed UI strings + AI auto-translate (τα i18n πεδία θα μεταφράζονται με AI εκεί).
- Σύνθετο contact form/CRM (κρατάμε minimal).
- Image upload UI (URL fields).

## Σημεία προσοχής
- Additive `i18n` columns· `pickLocale` με fallback ώστε legacy/empty να μη σπάει.
- Markdown rendering: sanitize (αν raw HTML). Προτίμησε react-markdown αν είναι ήδη dependency· αλλιώς πρόσθεσέ το ή κάνε minimal.
- Μη σπάσεις το υπάρχον pricing (PricingTier legacy columns παραμένουν).
- Κάθε νέα σελίδα στο `app/sitemap.ts` ήδη υπάρχει (paths). Πρόσθεσε `/services` στο sitemap PATHS.
