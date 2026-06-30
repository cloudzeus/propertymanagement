# CMS Admin Redesign — Fluent/DG consistency — Design

**Ημερομηνία:** 2026-06-30
**Κατάσταση:** Approved
**Σκοπός:** Το CMS admin (`/super-admin/cms/*`) να σταματήσει να είναι ad-hoc/ασυνεπές και να ευθυγραμμιστεί πλήρως με το καθιερωμένο Fluent/DG dashboard design language της εφαρμογής.

## Πρόβλημα (audit)
Οι CMS editors χρησιμοποιούν inline Tailwind με **hardcoded χρώματα** (`bg-blue-600`, `bg-slate-900`, `border-gray-300`, `focus:border-blue-500`), **δεν** χρησιμοποιούν τα υπάρχοντα `components/ui/*` (Button/Input/Select/Modal/DataTable/RichText), ασυνεπή locale tabs (blue vs slate), spacing που χοροπηδάει (`space-y-3` vs `space-y-6`), labels διαφορετικού μεγέθους, κανένα max-width, save buttons χωρίς states. Σε αντίθεση, οι «καλές» σελίδες (customers/services/brand) χρησιμοποιούν **inline styles με CSS variables** + DataTable + Modal.

## Καθιερωμένο design language (target)
- **Tokens (app/globals.css):** `var(--color-primary)` #0078D4, `var(--color-danger)` #A4262C, `var(--color-success)`, `var(--card)` #FFF, `var(--bg-canvas)` #F3F2F1, `var(--foreground)` #201F1E, `var(--muted-foreground)` #707070, `var(--border)` #E1DFDD, `--radius` 8px.
- **Page header:** icon badge (40×40, `borderRadius:10`, bg `${color}18`) + h1 (22/700) + subtitle (13, muted).
- **Card section:** `background:var(--card); border:1px solid var(--border); borderRadius:var(--radius); padding:24` + section title (15/600).
- **Fields:** label 12/600 muted + input `padding:8px 12px; border:1px solid var(--border); borderRadius:6; fontSize:13; background:var(--bg-canvas)`.
- **Primary button:** `var(--color-primary)` bg, white, 13/600, pending/saved states (RiSaveLine/RiCheckLine + var(--color-success) when saved).
- **Lists:** `components/ui/data-table.tsx` (ColDef/RowAction/BatchAction, search/sort/actions). **Edit:** `components/ui/modal.tsx` (Modal + FormField + FieldInput/FieldSelect/FieldTextarea).

## Ενότητα 1 — CMS UI kit
Νέο `components/cms/ui.tsx` (client-safe primitives, CSS-var based) — η **μοναδική** πηγή styling για όλο το CMS admin:
- `CmsPage({ icon, title, subtitle, children })` — header (icon badge + title + subtitle) + max-width container (`maxWidth: 1100, margin: 0 auto`) + vertical gap.
- `CmsCard({ title?, children, actions? })` — card section.
- `CmsField({ label, hint?, children })` — label + slot.
- `CmsInput`, `CmsTextarea` — styled input/textarea (CSS vars, consistent focus).
- `LocaleTabs({ value, onChange })` — el/en toggle (active = var(--color-primary) bg/white· inactive = subtle).
- `CmsButton({ variant: primary|secondary|danger, loading?, icon?, children })`.
- `SaveBar({ onSave, pending, saved })` — primary save με states.
Restyle `components/i18n/AutoTranslateButton.tsx` στα ίδια tokens (secondary button).

## Ενότητα 2 — Refactor όλων των CMS areas στο kit
Κάθε σελίδα: `CmsPage` header + max-width + `CmsCard` sections + `CmsField`/`CmsInput`/`CmsTextarea` + `LocaleTabs` + `SaveBar`. Ίδιο spacing/labels/buttons παντού.
- **landing** (`landing/page.tsx`, `SectionEditor.tsx`, `SeoEditor.tsx`): header «CMS — Αρχική», sections list με καθαρά cards, el/en LocaleTabs, SaveBar.
- **settings** (`settings/SettingsForm.tsx`): grouped CmsCard sections (SEO/Social/Tags/Verification/GEO/Consent), consistent fields, SaveBar.
- **pages** (`pages/page.tsx` hub + `pages/[slug]/CmsPageEditor.tsx`): hub = card grid με icon ανά σελίδα· editor = CmsPage + LocaleTabs (title + markdown CmsTextarea monospace) + SEO card + status select + SaveBar.
- **pricing** (`pricing/page.tsx` + νέο `PricingClient.tsx`): **DataTable** (στήλες: name(el), τιμή/μήνα, highlighted, order, published) με search/sort + row actions (Επεξεργασία/Διαγραφή) + «Νέο πλάνο». **Modal edit**: LocaleTabs για name/description/features + numeric/flags. Χρήση actions από `app/actions/pages-cms.ts`.
- **faq** (`faq/page.tsx` + νέο `FaqClient.tsx`): **DataTable** (question(el), category, order, published) + row actions + «Νέα ερώτηση». **Modal edit**: LocaleTabs question/answer + category/order/publish.
- **translations** (`translations/TranslationsEditor.tsx`): CmsPage header + tokenized table (sticky header, search, per-row AutoTranslate, SaveBar). Ήδη table — απλώς tokenize.

## Out of scope
- Αλλαγές στο public-facing UI ή στα data models/actions (μόνο admin presentation· οι actions μένουν).
- Νέα features (μόνο redesign/consistency).
- Dark mode (η εφαρμογή είναι light-only).

## Σημεία προσοχής
- Χρήση **CSS variables** (όχι hardcoded blue/gray/slate) — single source of truth, σέβεται και το customizable brand (--color-primary από AppSettings).
- Επαναχρησιμοποίηση των ΥΠΑΡΧΟΝΤΩΝ `components/ui/data-table.tsx` & `modal.tsx` (FormField/FieldInput/FieldSelect/FieldTextarea) — μη ξαναγράφεις table/modal.
- Διατήρηση όλης της λειτουργικότητας (save/validation/autotranslate/i18n) — μόνο presentation αλλάζει.
- Markdown body: παραμένει monospace textarea (το public rendering είναι react-markdown)· απλώς tokenized.
