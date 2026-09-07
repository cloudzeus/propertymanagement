# Orithon — Design Handoff for Claude Code

Property & common-area management SaaS for the Greek market. Bilingual marketing site (EN / ΕΛ), six pages plus an interactive cost calculator.

## Target stack

| | |
|---|---|
| Framework | Next.js 16.2+ (App Router, TypeScript) |
| Styling | Tailwind CSS 4.1 (`@theme` in CSS, **no** `tailwind.config.js` theme extension) |
| Fonts | `Commissioner` via `next/font/google`; `ACaslon Pro Semibold` via `next/font/local` |
| Images | `next/image`, all currently placeholders |
| i18n | Client React context with an EN/GR dictionary — single-page toggle, no locale routing |

## Fidelity

**High.** Pixel-accurate recreation is the goal. Every colour, size, radius, shadow, gradient and animation in these documents is final and taken from the built design. Interactions are specified and must work.

## Read in this order

| File | What is in it |
|---|---|
| `01-tokens-and-gradients.md` | Colours, type scale, spacing, radii, shadows, **every gradient and background effect** |
| `02-global-shell.md` | Nav, footer, buttons, cards, badges, form controls, animations, breakpoints |
| `03-landing-page.md` | Home page, section by section |
| `04-cost-calculator.md` | The calculator: full pricing model, formulas, states, layout |
| `05-pricing-page.md` | Plans, billing toggle, comparison table |
| `06-news-and-post.md` | Article index and article detail |
| `07-faq-and-contact.md` | FAQ accordion and contact form |
| `08-copy-and-i18n.md` | Copy inventory, i18n architecture, Greek-language rules |
| `globals.css` | **Ready-to-paste** Tailwind 4.1 theme, keyframes and gradient utilities |
| `reference/` | The two source design files + logo assets |

## The reference files

`reference/Orithon Landing.dc.html` and `reference/Orithon Pages.dc.html` are **high-fidelity design prototypes**, not production code. Open them in a browser to see the exact rendered target and to read the complete bilingual copy dictionaries.

Do **not** port their template system or logic classes. Recreate the design in idiomatic Next.js. Do lift verbatim: hex values, pixel sizes, gradient definitions, shadow strings, keyframes, copy strings, and the calculator's pricing constants.

## Route map

| Route | Source in prototype | Spec |
|---|---|---|
| `/` | `Orithon Landing.dc.html` | `03`, `04` |
| `/pricing` | `Orithon Pages.dc.html` → `page: 'pricing'` | `05` |
| `/news` | `Orithon Pages.dc.html` → `page: 'news'` | `06` |
| `/news/[slug]` | `Orithon Pages.dc.html` → `page: 'post'` | `06` |
| `/faq` | `Orithon Pages.dc.html` → `page: 'faq'` | `07` |
| `/contact` | `Orithon Pages.dc.html` → `page: 'contact'` | `07` |

The prototype fakes routing with internal state because it is a single file. In Next.js these are **real routes** — use the App Router, not a page-switcher.

## Suggested structure

```
app/
  layout.tsx                 fonts, metadata, LanguageProvider, Nav, Footer
  globals.css                paste from handoff/globals.css
  page.tsx                   landing
  pricing/page.tsx
  news/page.tsx
  news/[slug]/page.tsx
  faq/page.tsx
  contact/page.tsx
components/
  shell/Nav.tsx              client — active route, language toggle
  shell/Footer.tsx
  shell/LanguageProvider.tsx client — context + dictionary
  shell/ReadingProgress.tsx  client — scroll progress bar
  ui/Button.tsx              primary | ghost | dark, sm | md
  ui/Card.tsx                the .glass surface
  ui/Eyebrow.tsx  ui/Kicker.tsx  ui/Tag.tsx  ui/Tick.tsx
  ui/BackdropGlow.tsx        the radial glow blob
  ui/GridOverlay.tsx         masked hero grid
  ui/Grain.tsx               noise overlay
  ui/ImagePlaceholder.tsx    stand-in until real photos arrive
  calculator/CostCalculator.tsx   client — the whole calculator
  calculator/pricing.ts      plan + add-on constants, pure calc function
  landing/*                  Hero, Marquee, StatsBar, Features, Roles, HowItWorks, Showcase, Testimonial, FinalCta
  pricing/*                  BillingToggle, PlanCard, EnterpriseStrip, IncludedGrid, ComparisonTable
  news/*                     CategoryChips, FeaturedPost, PostCard, NewsletterStrip
  post/*                     ArticleHeader, Prose, PullQuote, TakeawayBox, ShareRow, AuthorBio, RelatedPosts
  faq/*                      FaqSidebar, FaqAccordion
  contact/*                  ContactForm, ContactCards, SupportHours, OfficeCards
lib/
  dictionary.ts              EN + GR strings
  posts.ts                   article data
  faq.ts                     FAQ data
```

## Non-negotiable directives

1. **Warm, light palette only.** Cream/ivory backgrounds, near-black ink, amber accent, sky-blue secondary. There is no dark theme. The only dark surfaces are deliberate ink-chip panels (primary buttons, icon badges, calculator result header, newsletter strip, support-hours card).
2. **Amber `#F2A23C` is a punctuation mark, not a wash.** Use it for the hero emphasis word, dots, ticks, step numbers, slider fills, active borders, the big result figure, and pull-quote rules. Never as a large fill behind text.
3. **The gradient backgrounds are load-bearing.** The fixed body gradient plus per-section radial glow blobs are what stop the light palette feeling flat. Do not flatten them to a solid colour. Full definitions in `01`.
4. **Never below the specified minimum sizes.** Body copy 14px, prose 18px, hit targets 44px.
5. **`gap`-based flex/grid for every sibling group.** No margin-spaced inline siblings.
6. **Tabular numerals on every figure.** `font-variant-numeric: tabular-nums` on prices, stats, KPIs, dates, counts — otherwise the calculator jitters as values change.
7. **Every interactive surface has a hover state**, and it is always the same gesture: `translateY(-2px)` (cards `-3px`/`-4px`) plus a deeper shadow, `0.18s cubic-bezier(.2,.7,.3,1)`.
8. **Respect `prefers-reduced-motion`** — disable the float, spin, marquee and reveal animations; keep hover colour changes.
9. **Greek is a first-class language**, not a translation afterthought. See `08`.
10. **Placeholder images stay obvious.** Neutral warm surface with a centred label naming what belongs there. Never ship a fake photo or an SVG illustration of a building.

## Not yet designed — ask before inventing

Log-in / app UI, legal pages, careers, case studies, cookie banner, 404, mobile hamburger menu panel (the breakpoint hides the nav links; the drawer itself is unspecified).
