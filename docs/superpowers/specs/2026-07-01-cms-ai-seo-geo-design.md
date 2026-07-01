# C2 — AI Auto SEO/GEO per Page (DeepSeek)

**Date:** 2026-07-01
**Status:** Approved design, pending implementation plan
**Part of:** CMS 2.0 program → C1 structured editors (shipped) → **C2** AI SEO/GEO (this) → C3 DeepSeek article suggestions.

## Goal

Let the super-admin manage SEO for every public page from one place and **auto-generate** locality-aware SEO with DeepSeek. A central `/super-admin/cms/seo` page lists all public pages; each has the existing `SeoEditor` plus an "AI generate" panel that produces `{title, description, keywords}` per locale from the page's own content (optionally guided by a short brief), respecting SEO length limits and a Greek/Athens property-management local focus. GEO stays as the existing `LocalBusiness` JSON-LD (already emitted from `SiteSettings`); C2 surfaces GEO-field completeness so the admin knows local schema is populated.

## Guiding lenses

- **Marketing/SEO/GEO expert:** titles ≤60 chars, descriptions 120–155 chars, keyword sets that mix service + locality ("διαχείριση πολυκατοικίας Αθήνα"), unique per page, conversion-oriented. Encourage LocalBusiness completeness for map/AI-answer visibility.
- **Branding/UI:** the SEO page and AI panel use Orithon + the CMS ui kit; calm, scannable, one focal action per card.

## Existing infrastructure (reuse)

- `SeoMeta` (`lib/seo/types.ts`): `{title, description, keywords?, ogImage?, canonical?, robots?}`.
- `PageSeo` (Prisma, slug→bilingual JSON), `getPageSeo(slug)` (`lib/cms/page-seo.ts`), `updatePageSeo(slug, seo)` (`app/actions/landing-cms.ts`).
- `SeoEditor` (`app/(company)/super-admin/cms/landing/SeoEditor.tsx`) — manual fields + `autoTranslate` el→en.
- `lib/seo/*`: `buildMetadata`, `schema.ts`, `site-schema.ts` (`LocalBusiness`/GEO from `SiteSettings`).
- `SiteSettings` GEO fields: `geoLat, geoLng, addrStreet, addrCity, addrPostal, addrCountry, telephone, openingHours`.
- DeepSeek: `deepseekComplete` (`lib/ai.ts`). CMS content sources: `getAllLandingSections`, `db.pricingTier`, `db.fAQ`, `db.cMSPage`.

## Architecture

### 1. Pure SEO helpers — `lib/ai/seo.ts` (tested)
- `buildSeoPrompt(context: string, brief: string, locale: "el"|"en", siteName: string): string` — instructs DeepSeek to return ONLY JSON `{title, description, keywords}` in the target language, with the length rules and a Greek property-management + local (Athens/Greece) angle; `context` is the page's own text, `brief` is the optional admin steer.
- `normalizeSeo(raw: unknown): { title: string; description: string; keywords: string }` — parse/clamp: title ≤60 chars, description ≤155, keywords a comma-joined string; trims; tolerant of extra JSON prose (extract first `{…}`).

### 2. Page content extractor — `lib/cms/seo-context.ts` (server-only, tested selector)
`getPageContext(slug: string, locale: "el"|"en"): Promise<string>` returns representative text per known slug:
- `home` → landing section headings/titles/subtitles (from `getAllLandingSections`, picked locale).
- `pricing` → tier names + descriptions.
- `faq` → FAQ questions.
- `services|contact|privacy|terms|cookie-policy` → `db.cMSPage` title + body (localized).
- `blog` → a static description.
- unknown → the site name + slug.
Keep it bounded (truncate to ~1500 chars). A small pure helper `summarizeContext(parts: string[], max: number)` is unit-tested; the db reads are thin.

### 3. Server action — `generateSeo` in `app/actions/ai-cms.ts`
`generateSeo(slug: string, brief: string, locale: "el"|"en"): Promise<{title:string;description:string;keywords:string}>` — `requireSuperAdmin()`, gather `getPageContext(slug, locale)`, read `SiteSettings.siteName`, `buildSeoPrompt`, `deepseekComplete`, `normalizeSeo`. Never persists — returns a draft for the editor.

### 4. SeoEditor — add AI panel
Extend `SeoEditor` with an "AI" panel (Orithon `--paper` card): optional brief textarea + "Δημιουργία SEO με AI" button → calls `generateSeo(slug, brief, activeLocale)` → fills `title/description/keywords` for the active locale as editable drafts (not saved until Save). Keep existing manual fields, `autoTranslate`, and `updatePageSeo` save. Add live char counters on title/description (green within limits, amber over).

### 5. Central SEO page — `app/(company)/super-admin/cms/seo/page.tsx`
Server page listing `PUBLIC_PAGES` (a constant: `[{slug,label}]` for home/pricing/faq/services/contact/blog/privacy/terms/cookie-policy). For each, load `getPageSeo(slug)` and render a `CmsCard` with `SeoEditor`. Top of page: a `GeoStatus` card showing which `SiteSettings` GEO fields are filled (checklist) + link to `/super-admin/cms/settings` — communicates LocalBusiness readiness. Add a **"SEO" sidebar menu item** in the CMS group (`components/admin/sidebar-nav.tsx`).

### 6. GEO
No new schema. `GeoStatus` (`components/cms/GeoStatus.tsx`) reads `SiteSettings` and lists geoLat/geoLng/address/telephone/openingHours completeness. The `LocalBusiness` JSON-LD already renders sitewide; C2 only surfaces its inputs' status and makes AI copy locality-aware.

## Data flow

SEO page (server) loads PageSeo per slug → `SeoEditor` (client) local `{el,en}` state → optional `generateSeo` (DeepSeek, draft) / `autoTranslate` → `updatePageSeo(slug, {el,en})` → `revalidatePath("/")` + the page path. All actions `requireSuperAdmin`.

## Error handling & edge cases

- DeepSeek failure / missing `DEEPSEEK_API_KEY` → inline friendly error, editor unchanged.
- Malformed model JSON → `normalizeSeo` extracts first object or returns empty strings; never throws to UI.
- Unknown slug context → site-name fallback; generation still works.
- Over-limit generated text → clamped by `normalizeSeo`; counters warn if the admin edits past limits.
- Empty `en` → `autoTranslate` covers it; `pickLocale` falls back el→en at render.

## Testing (vitest)

- `normalizeSeo`: clamps title/description length, joins keyword arrays, tolerates prose-wrapped JSON, returns safe empties on garbage.
- `summarizeContext`: concatenates + truncates to max, drops empties.
- `buildSeoPrompt`: includes locale language, length rules, brief, and locality cue.
UI verified via `npm run build` + manual pass on `/super-admin/cms/seo` (generate, edit, save, check page `<head>`).

## Files

- New: `lib/ai/seo.ts` (+test), `lib/cms/seo-context.ts` (+test for `summarizeContext`), `app/(company)/super-admin/cms/seo/page.tsx`, `components/cms/GeoStatus.tsx`, `lib/cms/public-pages.ts` (PUBLIC_PAGES constant).
- Modify: `app/actions/ai-cms.ts` (add `generateSeo`), `app/(company)/super-admin/cms/landing/SeoEditor.tsx` (AI panel + counters; make reusable if needed), `components/admin/sidebar-nav.tsx` (SEO menu item).

## Out of scope

- Per-page GEO overrides / dedicated geo fields (SiteSettings-level GEO only).
- C3 DeepSeek article suggestions (separate spec).
- OG image generation.
