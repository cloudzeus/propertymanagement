# CMS Admin Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Redesign all `/super-admin/cms/*` admin pages to match the established Fluent/DG dashboard design language (CSS-variable inline styles, shared UI kit, DataTable+Modal for lists), preserving all existing functionality.

**Architecture:** A new `components/cms/ui.tsx` kit (CSS-var based) becomes the single styling source. Each CMS area is refactored onto it. Pricing & FAQ lists move to the existing `components/ui/data-table.tsx` + `components/ui/modal.tsx`. No data/action/public changes.

**Tech Stack:** Next.js 16.2, React, CSS variables from `app/globals.css` (`var(--color-primary)`, `var(--card)`, `var(--border)`, `var(--foreground)`, `var(--muted-foreground)`, `--radius`), react-icons/ri, existing `components/ui/{data-table,modal,button}.tsx`, existing actions in `app/actions/{pages-cms,site-settings,landing-cms,translate}.ts`.

**Design kit reference (from the established good pages — read these before implementing):**
- Tokens: `app/globals.css`. Page-header + card + field + button patterns: `app/(company)/super-admin/settings/brand/BrandForm.tsx` and `.../page.tsx`.
- DataTable + Modal CRUD pattern: `app/(company)/super-admin/customers/CustomersClient.tsx` and `app/(company)/super-admin/services/ServicesClient.tsx`.
- DataTable API: `components/ui/data-table.tsx` (`ColDef<T>`, `RowAction<T>`, props). Modal API: `components/ui/modal.tsx` (`Modal` props open/onClose/title/footer/width; `FormField`, `FieldInput`, `FieldSelect`, `FieldTextarea`).
- Header badge: 40×40 `borderRadius:10` bg `${color}18`; title 22/700; subtitle 13 muted. Card: `var(--card)` + `1px solid var(--border)` + `var(--radius)` + padding 24. Field label 12/600 muted; input `8px 12px`, `1px solid var(--border)`, radius 6, fontSize 13, bg `var(--bg-canvas)`. Primary btn `var(--color-primary)`, saved→`var(--color-success)`.

---

## Task 1: CMS UI kit + AutoTranslateButton restyle

**Files:** Create `components/cms/ui.tsx`; modify `components/i18n/AutoTranslateButton.tsx`.

- [ ] **Step 1:** First READ `app/(company)/super-admin/settings/brand/BrandForm.tsx` to copy the exact inline-style token patterns (header, card, field, save button states). Then create `components/cms/ui.tsx` ('use client') exporting these components, all CSS-var based:
  - `CmsPage({ icon, title, subtitle?, children })` — renders the header (icon badge using a passed `color` default `var(--color-primary)`, title 22/700, subtitle 13 muted) and a container `style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}`. `icon` is a react-icon element.
  - `CmsCard({ title?, actions?, children })` — card section (var(--card)/border/radius/padding 24) with optional title (15/600) + actions row.
  - `CmsField({ label, hint?, children })` — label (12/600 muted, margin-bottom 6) + children + optional hint (11 muted).
  - `CmsInput(props)` and `CmsTextarea(props)` — pass-through `<input>`/`<textarea>` with the token style (focus ring via `var(--color-primary)`). Accept all native props + className/style merge.
  - `LocaleTabs({ value, onChange })` — two buttons "Ελληνικά"/"English"; active = `{ background: var(--color-primary), color: #fff }`, inactive = `{ background: var(--muted), color: var(--muted-foreground) }`; rounded, small.
  - `CmsButton({ variant?: "primary"|"secondary"|"danger", loading?, icon?, children, ...btnProps })` — primary=var(--color-primary) white; secondary=transparent + border var(--border); danger=var(--color-danger). Disabled/loading opacity. 13/600.
  - `SaveBar({ onSave, pending, saved, label? })` — a primary CmsButton showing RiSaveLine + (pending?"Αποθήκευση…":saved?"Αποθηκεύτηκε":(label??"Αποθήκευση")), saved state uses var(--color-success) + RiCheckLine.
  Keep each component small and typed.
- [ ] **Step 2:** Restyle `components/i18n/AutoTranslateButton.tsx` to use the same token styling as `CmsButton` secondary (small) — remove the gray-300 Tailwind; use CSS-var inline style (border var(--border), text var(--muted-foreground), hover bg var(--muted)). Keep its props/behavior identical.
- [ ] **Step 3:** `npx tsc --noEmit 2>&1 | grep -iE "cms/ui|AutoTranslate" || echo ok`; `npm run build` → success. Commit `git add components/cms/ui.tsx components/i18n/AutoTranslateButton.tsx && git commit -m "feat(cms-ui): shared CMS UI kit (CSS-var tokens) + restyle AutoTranslateButton"`.

---

## Task 2: Refactor landing admin onto the kit

**Files:** Modify `app/(company)/super-admin/cms/landing/page.tsx`, `SectionEditor.tsx`, `SeoEditor.tsx`.

- [ ] **Step 1:** Read the three files. Refactor presentation ONLY (keep all state/save/validation/autotranslate logic):
  - `page.tsx`: wrap in `<CmsPage icon={<RiLayoutLine/>} title="CMS — Αρχική" subtitle="Διαχείριση των ενοτήτων της αρχικής σελίδας">`. Section list rows + the SEO block in `CmsCard`s. Reorder/toggle controls as `CmsButton` secondary.
  - `SectionEditor.tsx`: replace ad-hoc inputs with `CmsField`+`CmsInput`/`CmsTextarea`; locale toggle → `LocaleTabs`; save → `SaveBar`; keep AutoTranslate button placement (now restyled).
  - `SeoEditor.tsx`: same treatment (CmsField/CmsInput, LocaleTabs, SaveBar).
  - Remove hardcoded blue/gray/slate classes.
- [ ] **Step 2:** `npm run build` → success; `npx tsc --noEmit | grep -i "landing" || echo ok`. Commit `git add "app/(company)/super-admin/cms/landing" && git commit -m "refactor(cms): landing admin onto CMS UI kit"`.

---

## Task 3: Refactor settings form onto the kit

**Files:** Modify `app/(company)/super-admin/cms/settings/page.tsx`, `SettingsForm.tsx`.

- [ ] **Step 1:** Read both. Refactor `SettingsForm.tsx`: `<CmsPage icon={<RiSettings3Line/>} title="Ρυθμίσεις ιστότοπου" subtitle="...">`; each group (SEO/Social/Tags/Verification/GEO/Consent) → `CmsCard title="...">`; fields → `CmsField`+`CmsInput`/`CmsTextarea`; consent el/en → `LocaleTabs`; consentEnabled → a styled checkbox row; save → `SaveBar`. Keep the geo number coercion + consent categories JSON textarea + all submit logic. Remove `inputCls` ad-hoc + slate/blue.
- [ ] **Step 2:** `npm run build` → success. Commit `git add "app/(company)/super-admin/cms/settings" && git commit -m "refactor(cms): site settings admin onto CMS UI kit"`.

---

## Task 4: Refactor pages hub + CMSPage editor

**Files:** Modify `app/(company)/super-admin/cms/pages/page.tsx`, `pages/[slug]/page.tsx`, `pages/[slug]/CmsPageEditor.tsx`.

- [ ] **Step 1:** `pages/page.tsx` (hub): `<CmsPage icon={<RiPagesLine/>} title="Σελίδες" subtitle="...">` + a responsive card grid; each page = a `CmsCard`-like clickable tile (icon + label + small description), linking to its editor. Use react-icons per page.
- [ ] **Step 2:** `CmsPageEditor.tsx`: `LocaleTabs` for title + markdown body (`CmsTextarea` monospace), a SEO `CmsCard` (title/description/keywords/ogImage via CmsField), status `<select>` styled (or FieldSelect), AutoTranslate button (restyled), `SaveBar`. Keep updateCmsPage + updatePageSeo logic. Wrap in `CmsPage` header. (`pages/[slug]/page.tsx` server: just ensure it passes data; minimal change.)
- [ ] **Step 3:** `npm run build` → success. Commit `git add "app/(company)/super-admin/cms/pages" && git commit -m "refactor(cms): pages hub + CMSPage editor onto CMS UI kit"`.

---

## Task 5: Pricing → DataTable + Modal edit

**Files:** Modify `app/(company)/super-admin/cms/pricing/page.tsx`; create `app/(company)/super-admin/cms/pricing/PricingClient.tsx`; (remove/retire old `PricingTierEditor.tsx` usage).

- [ ] **Step 1:** Read `app/(company)/super-admin/customers/CustomersClient.tsx` for the DataTable+Modal CRUD pattern, and `components/ui/{data-table,modal}.tsx` for exact APIs.
- [ ] **Step 2:** `pricing/page.tsx` (server): `const tiers = await db.pricingTier.findMany({ orderBy: { order: "asc" } });` pass to `<PricingClient initial={tiers} />` wrapped conceptually by the client. (Keep it a server component fetching data; the client renders CmsPage + DataTable.)
- [ ] **Step 3:** `PricingClient.tsx` ('use client'): `<CmsPage icon={<RiPriceTag3Line/>} title="Τιμές" subtitle="...">` containing a `DataTable` with columns: name (i18n.name.el ?? name), monthlyPrice (€/μήνα), highlighted (badge), order, published (StatusBadge). Toolbar "Νέο πλάνο" opens an add Modal. Row actions: «Επεξεργασία» (open edit Modal), «Διαγραφή» (danger → `deletePricingTier`). The Modal uses `LocaleTabs` for name/description/features (features newline textarea per locale) + FieldInput for monthlyPrice/annualPrice/slug/order + checkboxes for highlighted/published. Save → `updatePricingTier(id, {...})` or `createPricingTier({...})` (import from `@/app/actions/pages-cms`); on success `router.refresh()`. Keep el-legacy sync (name/description/features mirror i18n.*.el).
- [ ] **Step 4:** `npm run build` → success. Commit `git add "app/(company)/super-admin/cms/pricing" && git commit -m "feat(cms): pricing admin as DataTable + Modal edit"`.

---

## Task 6: FAQ → DataTable + Modal edit

**Files:** Modify `app/(company)/super-admin/cms/faq/page.tsx`; create `app/(company)/super-admin/cms/faq/FaqClient.tsx`.

- [ ] **Step 1:** `faq/page.tsx` (server): `const faqs = await db.fAQ.findMany({ orderBy: { order: "asc" } });` → `<FaqClient initial={faqs} />`.
- [ ] **Step 2:** `FaqClient.tsx` ('use client'): `<CmsPage icon={<RiQuestionLine/>} title="FAQ" subtitle="...">` + DataTable columns: question (i18n.question.el ?? question, truncated), category, order, published (StatusBadge). Toolbar "Νέα ερώτηση" → add Modal. Row actions edit/delete. Modal: `LocaleTabs` question/answer (CmsTextarea) + category/order/published. Save → `updateFaq`/`createFaq`, delete → `deleteFaq` (from `@/app/actions/pages-cms`); `router.refresh()`.
- [ ] **Step 3:** `npm run build` → success. Commit `git add "app/(company)/super-admin/cms/faq" && git commit -m "feat(cms): FAQ admin as DataTable + Modal edit"`.

---

## Task 7: Translations tokenize + final verification

**Files:** Modify `app/(company)/super-admin/cms/translations/page.tsx`, `TranslationsEditor.tsx`.

- [ ] **Step 1:** Wrap the translations page in `<CmsPage icon={<RiTranslate2/>} title="Μεταφράσεις" subtitle="...">`. Tokenize the table (CSS vars: header bg `var(--muted)`, borders `var(--border)`, inputs via CmsInput-style), keep sticky header + search + per-row AutoTranslate + bulk + save (use `SaveBar`/`CmsButton`). Keep all logic.
- [ ] **Step 2: FULL verification:** `npm run test` (all pass) + `npm run build` (success). `npx tsc --noEmit 2>&1 | grep -iE "cms|Editor|Client|cms/ui" || echo ok`. Manual: every CMS page shares the same header/card/field/tab/button look, brand-token colored, max-width, DataTable lists for pricing/faq, Modals for edit; all save/autotranslate still work.
- [ ] **Step 3:** Commit `git add "app/(company)/super-admin/cms/translations" && git commit -m "refactor(cms): translations admin tokenized + final polish"`.

## Done = CMS admin fully consistent with the app's Fluent/DG dashboard.
