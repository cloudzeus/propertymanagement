# Translation Tooling (Sub-project D) — Design

**Ημερομηνία:** 2026-06-30
**Κατάσταση:** Approved (architecture pre-approved)
**Μέρος του:** Front-end CMS expansion. Τελευταίο sub-project (μετά A/B/C).

## Στόχος

Πλήρης μεταφραστική υποδομή: (1) **DB-backed UI strings** με admin editor (επεξεργασία των next-intl messages χωρίς redeploy)· (2) **AI auto-translate** (DeepSeek, ήδη στο app) reusable κουμπί σε όλα τα el/en CMS editors + bulk για UI strings.

## Πλαίσιο
- `lib/ai/agent.ts` = DeepSeek client (streaming, `DEEPSEEK_API_KEY`, ENDPOINT `api.deepseek.com/v1/chat/completions`, `logAPIUsage`). `GEMINI_API_KEY` διαθέσιμο ως fallback.
- `i18n/request.ts` φορτώνει messages μόνο από `messages/{locale}.json` (90 keys). 
- CMS content (LandingSection, CMSPage, PricingTier, FAQ, PageSeo, SiteSettings consent) είναι ήδη translatable `{el,en}` με el/en editors (A/B/C).

## Ενότητα 1 — DB-backed UI strings
- Νέο model `UiMessage` (`key @unique`, `el String`, `en String`, updatedAt). Holds **overrides** πάνω από τα file defaults.
- `lib/i18n/messages.ts`: `loadMessages(locale)` = deep-merge των file `messages/{locale}.json` (defaults) + DB overrides (UiMessage, set ανά dotted key). `i18n/request.ts` καλεί αυτό αντί για σκέτο import.
- Admin: edit κάθε key (el/en), προσθήκη νέου key, αποθήκευση → UiMessage upsert.

## Ενότητα 2 — AI auto-translate
- `lib/ai/translate.ts`: `translateText(text, from, to)` + `translateBatch(items, from, to)` — non-stream DeepSeek call (reuse ENDPOINT + key + logAPIUsage), system prompt «μεταφραστής, διατήρησε markdown/placeholders, επέστρεψε μόνο τη μετάφραση». Gemini fallback αν λείπει DeepSeek key (optional).
- Server action `app/actions/translate.ts`: `autoTranslate(text, from, to)` (SUPER_ADMIN-guarded) + `autoTranslateBatch`.
- `components/i18n/AutoTranslateButton.tsx` (client): κουμπί «Μετάφραση από EL» που καλεί `autoTranslate(sourceText, "el", "en")` και γεμίζει το target πεδίο (callback prop `onResult`). Reusable.
- Wiring στους υπάρχοντες el/en editors: landing `SectionEditor`/`SeoEditor`, `CmsPageEditor`, `PricingTierEditor`, `FaqEditor`, SiteSettings consent — κουμπί δίπλα σε κάθε en πεδίο (ή «μετάφρασε όλα τα en από el» ανά editor).

## Ενότητα 3 — Translations admin page
- `/super-admin/cms/translations`: λίστα όλων των UI keys (merged defaults + overrides) με el/en inputs· **«Auto-translate missing EN»** bulk· save. Action `updateUiMessages(entries)`.
- Menu item «Μεταφράσεις» στο CMS group.
- Seed: import των τρεχόντων file messages σε UiMessage (optional — ή αφήνουμε files ως defaults και DB μόνο overrides). Επιλογή: **DB μόνο overrides** (μην seed-άρουμε τα πάντα· ο editor δείχνει defaults + επιτρέπει override).

## Out of scope
- Επιπλέον γλώσσες πέρα από el/en (η δομή το επιτρέπει).
- Auto-translate ως background job (γίνεται on-demand).

## Σημεία προσοχής
- `loadMessages` πρέπει να είναι ανθεκτικό (αν DB down → file defaults μόνο, try/catch). Cache ανά request.
- DeepSeek call: timeout + error handling· σε αποτυχία επέστρεψε το πρωτότυπο + μήνυμα, μη ρίξεις τον editor.
- Auto-translate πρέπει να διατηρεί markdown/placeholders ({name} κ.λπ.).
- `logAPIUsage` ώστε το κόστος να μπαίνει στο cost-tracking (ήδη υπάρχει).
