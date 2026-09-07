# 08 — Copy, i18n and voice

## 1. Architecture

Every string on the site exists in **English and Greek**. The prototype holds two parallel dictionaries per file and swaps them with a nav toggle.

For Next.js:

```
lib/dictionary.ts     →  { en: {...}, gr: {...} }  keyed by section
components/shell/LanguageProvider.tsx  →  client context, persists to localStorage
```

A single-page toggle in the nav is the specified behaviour. Do **not** add locale routing (`/el/...`) unless the user asks — it changes the URL structure, SEO strategy and the toggle's meaning.

Rules:

- The toggle switches the whole page instantly; nothing re-fetches.
- Persist the choice (`localStorage`) and restore on load. Do not auto-detect from `Accept-Language` without a visible way back.
- Set `<html lang>` to match the active language.
- Structured content (posts, FAQ) carries both languages per record — `{ title: { en, gr } }` — not two separate arrays that can drift out of sync.
- Never machine-translate at runtime.

Label the toggle **EN** / **ΕΛ** (not "GR" — Greeks write it ΕΛ).

## 2. Greek is a first-class language

The Greek copy in the reference files is written, not translated. Keep that standard.

- **Greek runs 15–25% longer than English.** Every layout must survive it: no fixed-width buttons, no `white-space:nowrap` on body copy, no single-line assumptions for headings. Test the nav, the plan card names, the FAQ sidebar and the calculator row headers in Greek before calling anything done.
- **Numbers:** comma decimal separator, dot thousands — `€2,04` and `€2.285`. Use `Intl.NumberFormat('el-GR')`, never a manual replace.
- **Dates:** long form with the genitive month — "12 Ιουλίου 2026".
- **Keep the loanwords the industry actually uses** — `demo`, `dashboard`, `reports`, `API`, `SSO`, `portal`, `app`, `integrations`, `onboarding`, `priority`. Do not "purify" them; managers do not say «ταμπλό».
- **Do translate the domain vocabulary properly** — κοινόχρηστα, χιλιοστά, επιμερισμός, αποθεματικό, γενική συνέλευση, ένοικοι, ιδιοκτήτες, διαχειριστής, βλάβη, αίτημα. These are legal and professional terms; getting them wrong loses the audience immediately.
- **Greek accents matter**, including on capital-initial words in mixed case. Never uppercase Greek text with accents retained — CSS `text-transform:uppercase` on Greek strips accents incorrectly in some renderers. **The uppercase kicker/tag styles must not be applied to Greek strings without checking** — either author them already-uppercase or drop the transform for `lang="el"`.
- Use the Greek question mark `;` and the ano teleia where appropriate. Use « » guillemets for quotations, not " ".

## 3. Voice

**What it sounds like:** plain, concrete, slightly dry. It respects the reader's time and knows the job. Numbers instead of adjectives. The product is calm; the copy is calm.

- Short declaratives. "Every building, under control." "Live in three steps."
- Concrete over abstract: "Reconciliation happens on its own", not "streamlined financial workflows".
- Name the pain precisely: "replaced four tools and a lot of phone calls", "one lift motor away from an awkward assembly".
- Numbers earn their place: 200+ buildings, 98% on-time, 4h resolution, €12M/year, 96% coverage. Never invent new ones.
- Admit limits — "Estimate only. VAT excluded." A calculator that overpromises is worse than no calculator.

**What to avoid:** "revolutionary", "seamless", "leverage", "empower", "solution" as a noun, "game-changing", exclamation marks, rhetorical questions in body copy, emoji (the single 💡 in the calculator savings callout is the only one, and it is deliberate).

**Headline pattern:** a statement, then a turn. "Priced per apartment. Never per headache." "Stop chasing buildings. Start running them." Two beats, second one shorter.

**Button labels:** verb-first, 2–3 words. Book a demo · Get started · Request a quote · Talk to sales · Talk to a human · Read the story · Open the calculator · Send message · Subscribe.

## 4. Copy inventory

Where the strings live in the reference files — read them there rather than retyping:

| Content | Location |
|---|---|
| Landing: nav, hero, stats, features, roles, steps, showcase, testimonial, CTA, footer, calculator | `reference/Orithon Landing.dc.html` → `en` and `gr` objects in the logic block, plus `featEN/featGR`, `roleEN/roleGR`, `nStats`, `steps`, `scPoints` |
| Pricing, news, article, FAQ, contact | `reference/Orithon Pages.dc.html` → the `t` object (built with an `L(en, gr)` helper), `planDefs`, `prIncluded`, `cmpDefs`, `postDefs`, `article`, `faqDefs`, `contactCards`, `hours`, `offices` |

The `L(en, gr)` helper in the Pages file makes every pair adjacent — the same pattern is worth keeping in `dictionary.ts` so a translation can never be silently missed.

## 5. Metadata to write

Not in the prototype; needed for launch. One per route, both languages:

- `title` (≤60 chars), `description` (≤155)
- OpenGraph title/description/image — the OG images need designing; ask before inventing them
- `Organization` JSON-LD on the layout, `FAQPage` on `/faq`, `Article` on post pages, `Product`/`Offer` on `/pricing`
- Canonical URLs, `sitemap.ts`, `robots.ts`

## 6. Legal copy still missing

Privacy policy, terms, cookie policy and the DPA referenced in the FAQ all need real text from the client. The footer and consent checkbox link to them today with nothing behind the links. Flag this rather than writing placeholder legal text.
