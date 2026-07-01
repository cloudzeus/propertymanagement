# C1 — Structured CMS Editors + Drag-and-Drop (+ AI feature generation)

**Date:** 2026-07-01
**Status:** Approved design, pending implementation plan
**Part of:** CMS 2.0 program → **C1** structured editors/DnD (this) → C2 AI auto SEO/GEO → C3 DeepSeek article suggestions.

## Goal

Give the super-admin full, structured control over the public landing content — Hero, Features, Pricing packages, Testimonials, Logos, FAQ, and a new News section — through **article-like full-page form editors** (never raw JSON), with **drag-and-drop ordering** everywhere, **featured images from the media gallery**, and **DeepSeek-assisted feature generation from a short brief**. All content stays bilingual (el/en).

## Guiding lenses (apply throughout)

- **Branding (Orithon):** every editor and every rendered section uses the Orithon design system (tokens, Commissioner/Cormorant, ink/amber/sky, warm surfaces, `--shadow-card`, radii). Admin editors adopt the "calm data-adaptation"; public output stays pixel-faithful to the handoff. Reuse the Orithon primitives (Button/Card/Badge/Input/Textarea/Select) and the CMS ui kit.
- **UI/UX:** editors are full-page, focused, and forgiving — clear locale tabs, inline validation, optimistic drag with persisted order, MediaPicker for every image, icon picker for features, autosave-on-save with a SaveBar, empty states, and reduced-motion-safe interactions. One clear responsibility per file.
- **Marketing / SEO / GEO:** structured content feeds richer schema. Each section's copy is authored for conversion; the News section drives freshness signals; featured images carry alt text (SEO). C1 lays the data shape that C2's auto SEO/GEO will consume (clean per-locale fields, image alt, publish dates).

## Existing infrastructure (reuse — do not rebuild)

- `LandingSection` (Prisma): `type` (unique), `enabled`, `order`, `data` (Json, bilingual `{el,en}`). Storage stays JSON; only the **admin editing UX** changes from a JSON textarea to typed forms.
- `PricingTier` (structured): `name, slug, description, monthlyPrice, annualPrice, features String[], highlighted, order, published, i18n`.
- `FAQ` (Prisma, has `order`), `Article`/`Author` (blog), `SiteSettings` (GEO fields), `PageSeo`.
- `@dnd-kit/core|sortable|utilities` — **already installed**.
- `components/cms/MediaPicker.tsx`, CMS ui kit (`CmsField/CmsInput/CmsTextarea/LocaleTabs/CmsButton/SaveBar`), `app/actions/translate.ts` (`autoTranslate`), `lib/cms/icon-registry.ts` (`ICON_NAMES`, `resolveIcon`), `lib/ai/agent.ts` (DeepSeek core).
- Section renderers in `components/landing/sections/*` + `section-registry.tsx` (already Orithon-reskinned).

## Architecture

### 1. Reusable `SortableList` (dnd-kit wrapper)
`components/cms/SortableList.tsx` (client). Generic sortable list: renders items with a drag handle, calls `onReorder(orderedIds: string[])` on drop. Keyboard-accessible, reduced-motion aware. Used by: landing sections index, feature items, testimonial items, logo items, pricing tiers, pricing features, FAQ.

### 2. Landing index → sortable section cards
`app/(company)/super-admin/cms/landing/page.tsx` becomes a `SortableList` of section cards (drag handle + enabled toggle + "Edit" link to the full-page editor). New action `reorderSections(orderedIds: string[])` replaces the up/down `reorderSection`. Keep `toggleSection`.

### 3. Full-page editor per section
Route `app/(company)/super-admin/cms/landing/[type]/page.tsx` loads the section by `type`, renders a typed `<SectionForm>` dispatched by type. Each form:
- `LocaleTabs` (el/en) + an **"Auto-translate el→en"** button (`autoTranslate`).
- Section-level fields + a **featured image** field (MediaPicker) where the section renders one (Hero, Features, CTA, News).
- Structured item sub-lists via `SortableList` (no JSON).
- `SaveBar` calling `updateSection(id, {el,en})`.

Typed forms (one file each under `.../landing/[type]/forms/`):
- **HeroForm** — eyebrow, title, subtitle, primaryCta{label,href}, secondaryCta{label,href}, image (MediaPicker) + **dynamic showcase fields**: property name, address, occupancy %, toast{title,sub}, kpi1{label,value}, kpi2{label,value}, bars (9 values). These feed `HeroSection` (which stops hardcoding decorative strings and reads them from `data`, with the current values as fallback).
- **FeaturesForm** — heading, featured image, **items** SortableList (each: icon via icon picker, title, body, optional image) + **AI generate panel** (below).
- **TestimonialsForm** — heading, items (quote, author, role, avatar via MediaPicker).
- **LogosForm** — heading, items (label, image).
- **CtaForm** — heading, body, cta{label,href}, featured/background image.
- **NewsForm** — heading, `count` (how many latest articles to show), optional intro.

### 4. AI feature generation (DeepSeek)
`app/actions/ai-cms.ts` → `generateFeatures(brief: string, count: number, locale: "el"|"en")`. Calls `lib/ai/agent.ts` (DeepSeek) with a structured prompt → returns `[{icon, title, body}]` where `icon` is constrained to `ICON_NAMES`. In FeaturesForm, an "AI" panel: textarea brief + count → on generate, results populate the items SortableList as **editable drafts** (not persisted until the admin clicks Save). Offer "translate to other locale" via `autoTranslate`. Guardrails: validate icon against allowlist (fallback to a default), clamp count 1–8, trim/limit body length, handle DeepSeek errors with a friendly message; never auto-save.

### 5. Pricing editors
- `app/(company)/super-admin/cms/pricing/page.tsx` → `SortableList` of tiers (drag + published toggle + Edit).
- Full-page tier editor `.../pricing/[id]/page.tsx`: name, slug, description, monthly/annual price, highlighted, **features** as a `SortableList` of strings (add/remove/reorder), bilingual via `i18n`.
- Actions: `reorderTiers(orderedIds[])`, `updateTier(id, data)`, `createTier`, `deleteTier` (reuse existing where present).

### 6. FAQ editor
`app/(company)/super-admin/cms/faq/*`: structured question/answer (bilingual) list with `SortableList` reorder writing `order`; add/remove. New `reorderFaqs(orderedIds[])`.

### 7. News section (new type)
- Add `"NEWS"` to `LANDING_SECTION_TYPES` and `defaultSectionData`.
- `components/landing/sections/NewsSection.tsx` (server): reads latest `count` published `Article`s (via `lib/cms/blog`), renders Orithon cards (featured image, title, date, excerpt, author) with a `Reveal` stagger; links to `/[locale]/blog/[slug]`. Register in `section-registry`.
- Seed a NEWS `LandingSection` row (disabled by default) so it appears in the admin list.

## Data flow

Client editors hold local `{el,en}` state → server actions (`updateSection`, `updateTier`, `reorder*`, `generateFeatures`) → `revalidatePath("/")` + admin path. DnD is optimistic; the reorder action persists `order` in a `$transaction`. All actions `requireSuperAdmin()`.

## Error handling & edge cases

- **Reorder bounds/consistency:** `reorder*` recomputes `order` from the incoming id array; ignores unknown ids; wraps writes in `$transaction`.
- **Legacy JSON data:** forms defensively coerce non-`{el,en}` payloads (reuse existing `toBilingual`) and missing arrays to `[]`.
- **MediaPicker:** store media URL (and alt) on the field; empty allowed (renderers already guard).
- **AI:** DeepSeek failure → inline error, list unchanged; icon not in allowlist → default; output never auto-persists.
- **NEWS with zero published articles:** section renders nothing (returns null) — same guard pattern as Logos/Testimonials.
- **i18n fallback:** `pickLocale` already falls back el→en; the auto-translate button reduces empty en fields.

## Testing

Repo uses vitest. Add unit tests for pure logic:
- `applyReorder(orderedIds, rows)` helper → correct `order` mapping, ignores unknown ids.
- `generateFeatures` output normalizer (icon allowlist clamp, count clamp, shape) — test the pure normalizer, mock the DeepSeek call.
- `NewsSection` data mapping (latest N, published only) — test the selector helper.
Editors are UI: verify via `npm run build` + manual pass on `/super-admin/cms/landing`, `/pricing`, `/faq`, and the public `/` (+`/en`).

## Files (high level)

- New: `components/cms/SortableList.tsx`; `app/(company)/super-admin/cms/landing/[type]/page.tsx` + `forms/{Hero,Features,Testimonials,Logos,Cta,News}Form.tsx`; `app/(company)/super-admin/cms/pricing/[id]/page.tsx`; `components/landing/sections/NewsSection.tsx`; `app/actions/ai-cms.ts`; reorder helpers (`lib/cms/reorder.ts`).
- Modify: landing/pricing/faq admin index pages; `app/actions/landing-cms.ts` (add `reorderSections`, `updateSection` stays), pricing/faq actions; `lib/cms/landing-types.ts` (+NEWS, Hero dynamic fields); `components/landing/section-registry.tsx`; `components/landing/sections/HeroSection.tsx` (read decorative fields from data w/ fallback); seed for NEWS.

## Out of scope for C1

- **C2:** AI auto-generate SEO/GEO per page (PageSeo/SiteSettings) — separate spec.
- **C3:** DeepSeek article topic/draft suggestions in the blog admin — separate spec.
- Front-of-site new prototype sections (Stats/Roles/HowItWorks/Showcase) unless later added as CMS types.
