# C3 — DeepSeek Article Topic Suggestions + Draft Generation

**Date:** 2026-07-01
**Status:** Approved design, pending implementation plan
**Part of:** CMS 2.0 program → C1 editors (shipped) → C2 AI SEO/GEO (shipped) → **C3** article suggestions (this).

## Goal

Help the super-admin publish more, faster: a DeepSeek panel in the articles admin that **suggests relevant article topics** (property-management, Greek audience, avoiding duplicates of existing articles), with one-click **"Create draft"** that spins up a DRAFT `Article` and opens the editor; plus an in-editor **"Generate full article"** that fills excerpt + body (markdown) from the title/angle. Bilingual via the existing `autoTranslate`.

## Guiding lenses

- **Marketing/SEO/GEO:** topics target local intent (κοινόχρηστα, διαχείριση πολυκατοικίας, Αθήνα, νομοθεσία), long-tail and search-worthy, non-duplicative of existing titles; drafts are structured (H2 sections, scannable) for SEO.
- **UI/UX + Orithon:** suggestions render in a calm `--paper` panel/modal with clear "Create draft" actions; generation shows loading + inline errors; nothing auto-persists except the explicit draft creation.

## Existing infrastructure (reuse)

- `deepseekComplete(prompt)` (`lib/ai.ts`); pattern mirrors C1/C2 (`app/actions/ai-cms.ts`, `requireSuperAdmin`).
- Articles admin: `ArticlesClient.tsx` (list), `articles/[id]/ArticleEditor.tsx` (i18n `{title, excerpt, body}` as `Record<locale,string>`, `autoTranslate`, tags, media, SEO).
- `createArticle(data)` (`app/actions/blog.ts`) → auto-slugs from `i18n.title.el`, returns new id.
- `getPublishedArticles`, `db.article` for existing-titles dedup.
- CMS ui kit, `Modal` (`components/ui/modal.tsx`).

## Architecture

### 1. Pure helpers — `lib/ai/articles.ts` (tested)
- `buildTopicsPrompt(theme: string, existingTitles: string[], count: number): string` — ask DeepSeek for `count` Greek article ideas for a property-management SaaS, avoiding the listed existing titles; return ONLY a JSON array `[{title, angle, tags}]`.
- `normalizeTopics(raw: unknown): Topic[]` where `Topic = {title, angle, tags: string[]}` — parse JSON (tolerant of prose), drop titleless, trim, clamp tags to strings, cap list length.
- `buildDraftPrompt(title: string, angle: string, locale: "el"|"en"): string` — ask for a full article as JSON `{excerpt, body}` where `body` is Markdown with H2 sections, ~600–900 words, in the target language.
- `normalizeDraft(raw: unknown): { excerpt: string; body: string }` — parse JSON; if parsing fails, treat the whole text as `body` and leave `excerpt` empty; trim.

### 2. Server actions — `app/actions/ai-cms.ts`
- `suggestArticleTopics(theme: string, count: number): Promise<Topic[]>` — `requireSuperAdmin`; read recent article titles (`db.article.findMany({ select: { i18n }, take: 40 })`, extract `i18n.title.el/en`); `deepseekComplete(buildTopicsPrompt(...))`; `normalizeTopics`; clamp count 1–8.
- `generateArticleDraft(title: string, angle: string, locale: Locale): Promise<{excerpt:string;body:string}>` — `requireSuperAdmin`; `deepseekComplete(buildDraftPrompt(...))`; `normalizeDraft`.

### 3. ArticlesClient — suggestions panel
Add a "Προτάσεις με AI" button opening a `Modal`: optional theme `CmsInput` + count, "Δημιουργία προτάσεων" → `suggestArticleTopics` → list of cards (title, angle, tag chips). Each card has "Δημιουργία draft" → `createArticle({ status: "DRAFT", tags, i18n: { title: { el: topic.title, en: "" }, excerpt: { el: topic.angle, en: "" }, body: { el: "", en: "" } } })` → `router.push('/super-admin/cms/articles/' + id)`. Inline error + loading states; nothing persists until "Create draft".

### 4. ArticleEditor — full-draft generation
Add a "Δημιουργία πλήρους άρθρου (AI)" button (near the translate button): calls `generateArticleDraft(i18n.title[locale] || i18n.title.el, i18n.excerpt[locale], locale)` → fills `excerpt` + `body` for the active locale via the existing `setContent` (editable drafts; saved with the existing `SaveBar`/`updateArticle`). Loading + inline error; confirm-overwrite if body already has content.

## Data flow

Client (list/editor) → server actions (`suggestArticleTopics`, `generateArticleDraft`, existing `createArticle`/`updateArticle`) → DeepSeek. Only `createArticle` and Save persist; generation returns editable drafts. All AI actions `requireSuperAdmin`.

## Error handling & edge cases

- DeepSeek failure / missing `DEEPSEEK_API_KEY` → inline error; UI unchanged; nothing persisted.
- Malformed model output → `normalizeTopics`/`normalizeDraft` degrade gracefully (empty list / body-only).
- Duplicate avoidance is best-effort (titles fed to the prompt); not enforced server-side.
- Draft creation with empty `en` → fine; `autoTranslate` and editor fill EN later; `createArticle` slugs from `title.el`.
- Overwrite guard in editor: if `body[locale]` non-empty, `confirm()` before replacing.

## Testing (vitest)

- `normalizeTopics`: parses JSON array, drops titleless items, coerces tags to string[], tolerates prose-wrapped JSON, caps length.
- `normalizeDraft`: parses `{excerpt,body}`; falls back to body-only on non-JSON; trims.
- `buildTopicsPrompt`: includes theme, existing titles, count, JSON-only instruction.
UI verified via `npm run build` + manual pass in the articles admin.

## Files

- New: `lib/ai/articles.ts` (+`lib/ai/articles.test.ts`).
- Modify: `app/actions/ai-cms.ts` (add `suggestArticleTopics`, `generateArticleDraft`); `app/(company)/super-admin/cms/articles/ArticlesClient.tsx` (suggestions modal + create-draft); `app/(company)/super-admin/cms/articles/[id]/ArticleEditor.tsx` (full-draft button).

## Out of scope

- Auto-publishing; scheduling; image generation for articles; SEO auto-fill on generated drafts (C2 already covers per-page SEO; article-level SEO stays manual/autoTranslate).
