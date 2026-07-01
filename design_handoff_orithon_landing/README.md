# Handoff: Orithon Landing Page

## Overview
Full marketing landing page for **Orithon** — a SaaS property management platform targeting Greek property managers, building administrators, residents and technicians. The page is bilingual (EN/ΕΛ), switchable at runtime via a language toggle in the nav.

## About the Design Files
`Orithon Landing.dc.html` is a **high-fidelity design prototype** built in HTML. It is a complete reference for layout, typography, colour, spacing, copy and interactions — **not** production code to be shipped. Your job is to **recreate this design in Next.js 16 with Tailwind CSS 4.1**, using its conventions (App Router, server/client components, TypeScript, etc.).

Do **not** copy the HTML template system or the `DCLogic` class — those are prototype-only. Translate every visual decision into idiomatic Next.js + Tailwind code.

---

## Fidelity
**High-fidelity.** Pixel-perfect recreation is the goal. All colours, font sizes, spacing, shadows, border-radii, animations and copy are final and should be matched exactly. Interactions (language toggle, role tab switcher, scroll animations) should also be implemented.

---

## Design Tokens

### Colours
```
/* Backgrounds */
--bg:           #F4F2EA         /* warm cream base */
--bg-gradient:  radial-gradient(120% 95% at 0% 0%, #F1EED6, transparent 46%),
                radial-gradient(120% 95% at 100% 0%, #E7F0E0, transparent 48%),
                #F4F2EA
                /* applied to <body> with background-attachment:fixed */

--card:         #ffffff
--paper:        #FBFAF5         /* tile / role-point bg */
--section-alt:  #EFEDE2         /* "How it works" section bg */

/* Text */
--txt:          #1b1c1a
--mut:          rgba(27,28,26,.62)
--mut2:         rgba(27,28,26,.42)
--ink-mut:      #5b5c58

/* Accents */
--accent:       #F2A23C         /* amber — primary accent */
--accent-2:     #5BB6D6         /* sky blue — secondary */
--ink-chip:     #15161a         /* near-black — primary buttons, icon badges */

/* Borders */
--line:         rgba(27,28,26,.12)
--line2:        rgba(27,28,26,.07)
```

Tailwind 4.1 custom tokens (add to `@theme` in your global CSS):
```css
@theme {
  --color-bg:         #F4F2EA;
  --color-card:       #ffffff;
  --color-paper:      #FBFAF5;
  --color-section-alt:#EFEDE2;
  --color-txt:        #1b1c1a;
  --color-mut:        rgba(27,28,26,.62);
  --color-accent:     #F2A23C;
  --color-accent-2:   #5BB6D6;
  --color-chip:       #15161a;
  --color-line:       rgba(27,28,26,.12);
  --color-line2:      rgba(27,28,26,.07);
}
```

### Typography
- **Body / UI:** `Commissioner` (Google Fonts, weights 400 500 600 700 800 900)
- **Brand wordmark + quote-mark:** `ACaslon Pro Semibold` (local font — see `assets/`)
- **Base size:** 16px, antialiased

Font size scale used in the design:
| Role | Size | Weight |
|---|---|---|
| H1 hero | 74px | 800 |
| H2 section | 46px | 800 |
| H2 CTA | 54px | 800 |
| Lead paragraph | 19px | 400 |
| Feature tile title | 18.5px | 700 |
| Feature tile big | 24px | 700 |
| Body / desc | 14.5–17px | 400 |
| Kicker (uppercase) | 13px | 700, letter-spacing 0.14em |
| Eyebrow badge | 13px | 600 |
| Nav links | 14.5px | 400 |
| Stat value | 42px | 800 |
| Quote | 28px | 500 |
| Small labels | 10.5–12px | 400–700 |

Letter-spacing: H1 `-0.025em`, H2 `-0.02em`, stat `-0.02em`.

### Spacing & Layout
- Max content width: `1200px`, horizontal padding `28px` (mobile `20px`)
- Section vertical padding: `108px 0` (some sections `84px` or `78px`)
- Grid gap between major bento tiles: `16px`
- Card border-radius: `18px` (tiles), `22px` (photo cards), `24px` (quote), `16px` (float stats), `14px` (role tabs)

### Shadows
```
/* White card */
box-shadow: 0 1px 2px rgba(27,28,26,.04), 0 22px 48px -32px rgba(27,28,26,.28);

/* Primary button */
box-shadow: 0 14px 30px -16px rgba(21,22,26,.55);

/* Hero photo / showcase photo */
box-shadow: 0 44px 80px -40px rgba(27,28,26,.4);

/* Role tab active */
box-shadow: 0 10px 24px -18px rgba(27,28,26,.35);
```

---

## Sections & Components

### 1. Navigation (sticky)
- **Layout:** flex row, space-between, height `70px`
- **Background:** `rgba(244,242,234,.72)` + `backdrop-filter: blur(20px) saturate(140%)`
- **Border-bottom:** `1px solid rgba(27,28,26,.07)`
- **Left:** brand mark (27×27px SVG/PNG `orithon-symbol-black.png`) + wordmark `ORITHON` in ACaslon, 21px, letter-spacing `0.16em`
- **Centre:** 3 nav links (Features / Solutions / How it works), 14.5px, colour `--mut`, hover `--txt`
- **Right:** language toggle pill → EN / ΕΛ; Log in link; "Book a demo" primary button
- **Language toggle:** pill container `border: 1px solid --line`, `border-radius: 999px`, `padding: 2px`; active segment `background: --ink-chip; color: #fff; border-radius: 999px; padding: 6px 12px; font-weight: 700`; idle segment transparent, muted text

### 2. Hero
- **Layout:** CSS grid `1.05fr 0.95fr`, gap `50px`, align-items center
- **Background:** body gradient (cream + amber-green radial, fixed)
- **Grid overlay:** 54×54px line grid, opacity 0.045, masked with radial gradient
- **Glow blob:** absolute, `1100×780px`, `radial-gradient(closest-side, rgba(242,162,60,.16), rgba(91,182,214,.07) 55%, transparent)`, `filter: blur(8px)`

**Left (copy):**
- Eyebrow badge: white pill, `border: 1px solid --line`, amber dot (7px circle, `box-shadow: 0 0 10px rgba(242,162,60,.55)`)
- H1: "Every building," (dark) + "under control." (`color: --accent` #F2A23C)
- Lead paragraph (max-width 520px)
- CTA row: primary button (dark chip) + ghost button ("▷ Watch overview")
- Trust row: 4 avatar circles (34px, `border: 2px solid white`, neutral gradient fills) + trust text

**Right (visual):**
- Decorative ring: 430×430px circle, `conic-gradient(--accent, --accent-2, --accent, --accent-2, --accent)`, opacity 0.32, blur 2px, masked to thin ring, `animation: spin 44s linear infinite`
- Hero photo card: 340×420px, border-radius 22px, `image-slot` placeholder; subtle bottom scrim `linear-gradient(180deg, rgba(15,22,30,.04) 0%, rgba(15,22,30,.42) 100%)`; white glass label bottom-left with property name + occupancy
- Toast float (top-left of visual): white card, amber € badge, text "Payment received / Apt 4B · €84.50", `animation: floaty 6s ease-in-out infinite`
- Dashboard float (bottom-left): white card, live badge (amber dot), KPI grid (2 cols: Collected €184k / Open tickets 12), bar chart (9 bars, amber for last 2), `animation: floaty 7s ease-in-out infinite`

### 3. Marquee (trust logos)
- Border top/bottom `1px solid rgba(27,28,26,.07)`
- Scrolling text names in ACaslon 23px, colour `--mut2`, gap 64px
- Edge fade via `mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)`
- Names: Meridian · Halcyon · Astor · Lumen · Veridia · Solace · Atrium · Northwind (repeated)

### 4. Stats Bar
- 4-column grid, gap 16px
- Each stat: white card, border-radius 16px, padding 26px 24px
- Value: 42px 800 weight, colour `--txt`
- Label: 14px, `--mut`
- Values: `200+` buildings managed · `98%` on-time payments · `4h` avg. resolution time · `€12M` collected per year

### 5. Features (Bento grid)
- 3-column grid, `grid-auto-rows: minmax(180px, auto)`, gap 16px
- **Tile 1 (big, col 1–2):** Shared expenses & billing. Icon (black circle, white stroke SVG). Mini bar chart (9 bars, amber accent bars). 
- **Tile 2 (col 3, row 1–2):** Full-height image slot with dark overlay gradient + white glass label at bottom.
- **Tiles 3–7:** Single-cell tiles with icon + title + description.
- All tiles: white card, border-radius 18px, padding 26px
- Icon badges: 42px circle, `background: --ink-chip`, white SVG stroke (19px)
- Mobile: 2 columns, big tile spans full width

### 6. Solutions / Roles (tab switcher)
- 2-column grid: `320px` tab list + `1fr` panel
- **Tab list:** 3 vertical tabs; active = white card + shadow; idle = transparent
- Active badge: 32px circle, `background: --ink-chip`, white letter
- Idle badge: 32px circle, `background: rgba(27,28,26,.06)`, muted letter
- **Panel:** white glass card, padding 34px, min-height 260px
- Panel header: 46px rounded square badge (dark chip, white letter) + role name 24px 800 + tag 13.5px muted
- 2×2 grid of role points: `#FBFAF5` bg, border `rgba(27,28,26,.07)`, border-radius 12px, padding 15px 16px, amber `›` prefix

### 7. How It Works (alternate bg `#EFEDE2`)
- 3-column grid of step cards (white, border, shadow)
- Step number: 40px 800, colour `--accent` (amber)
- Horizontal connector line: absolute, 1px, `--paper-line`, top 48px
- Steps: 01 Add buildings · 02 Issue & collect · 03 Run operations

### 8. Showcase (split)
- 2-column grid `1.05fr 0.95fr`, gap 54px
- **Left media:** 440px tall; full-bleed image with subtle left-dark overlay; 2 float stat cards (white glass, 200px wide): "€184k Collected" top-left, "12 Open tickets" bottom-right
- **Right copy:** kicker + H2 + lead + 3 checklist items (amber 22px rounded square checkbox + title + subtitle) + ghost CTA button

### 9. Testimonial
- Centred white glass card, padding 54px 56px, border-radius 24px
- Quote mark: ACaslon 90px, colour `--accent`
- Quote text: 28px 500, max-width 760px
- Attribution: 46px avatar circle + name 700 + role muted

### 10. Final CTA
- Full-width, position relative; background image with light scrim `linear-gradient(180deg, rgba(244,242,234,.84), rgba(244,242,234,.93))`
- Centred H2 54px + lead paragraph + 2 buttons (primary dark + ghost)

### 11. Footer
- Border-top `1px solid rgba(27,28,26,.07)`, padding `56px 0 40px`
- Flex row: brand block (logo + tagline 14px muted) + 3 link columns (Product / Company / Resources)
- Bottom bar: copyright + "Athens · Greece", font-size 13px, `--mut2`

---

## Interactions & Behaviour

### Language Toggle (EN / ΕΛ)
- Client component with `useState('en')`
- Switches all copy between English and Greek objects
- Active segment: `background: --ink-chip; color: #fff`
- All copy strings provided in both languages — see the HTML file for the full EN and GR translation objects

### Role Tab Switcher (Solutions section)
- Client component with `useState(0)` for 3 roles: Managers / Residents / Technicians (EN) — Διαχειριστές / Ένοικοι / Τεχνικοί (GR)
- Tab click updates active panel content with transition

### Scroll Reveal Animation
- Elements with `.reveal` class animate in on scroll: `opacity 0 → 1`, `translateY(42px → 0)`
- Use `animation-timeline: view()` (CSS) or IntersectionObserver fallback
- Range: `entry 2% cover 26%`

### Hero Floaty Cards
- CSS keyframe animation `floaty`: `translateY(0 → -13px → 0)`, duration 7s / 6s, `ease-in-out infinite`, staggered by 0.8s

### Decorative Ring
- CSS `spin` keyframe: `rotate(0 → 360deg)`, duration 44s, linear infinite

### Marquee
- CSS `translateX(-50%)` loop, duration 30s, linear infinite
- Edge fade with CSS mask

### Buttons
- Primary: `transform: translateY(-2px)` + `filter: brightness(1.18)` on hover
- Ghost: `transform: translateY(-2px)` + heavier shadow on hover
- Transition: `0.18s cubic-bezier(.2,.7,.3,1)`

---

## Responsive Behaviour
- **< 980px:** single-column hero; bento becomes 2-col (big tile full width, image full width); stats 2×2; how-steps stacked; roles stacked (tabs become horizontal wrap); nav links hidden (add hamburger)
- **< 560px:** bento single column; stats 2×2; role-pts single column; side padding 20px; H1 42px

---

## Copy (English — key strings)
See the HTML file's `en` and `gr` objects in the `<script type="text/x-dc">` block for the complete bilingual copy. Full text is there for every section.

---

## Assets
| File | Use |
|---|---|
| `assets/orithon-symbol-black.png` | 27×27 nav / footer brand mark (dark theme) |
| `assets/orithon-lockup-black.png` | Full lockup (alt usage) |
| Image slots | 4 placeholder image areas: hero photo, bento image tile, showcase photo, CTA background — use `<Image>` components with real property photos |

---

## Implementation Notes for Claude Code

1. **Font setup:** Add `Commissioner` via `next/font/google`. Register `ACaslon Pro` via `next/font/local` pointing to your font file. Apply both via CSS variables on `<html>`.

2. **Tailwind 4.1:** Use `@theme` in `globals.css` for all custom tokens (colours, radii, shadows). The new `@theme` block replaces the old `theme.extend` in `tailwind.config`.

3. **i18n:** Implement with a simple React context (`LanguageContext`) wrapping the page — no need for Next.js i18n routing since it's a single-page toggle. The HTML file has the full EN + GR string dictionaries.

4. **Image placeholders:** Replace all `image-slot` references with Next.js `<Image>` components (fill layout). Use a neutral `bg-stone-100` placeholder with a centred label until real assets arrive.

5. **Animations:** Define `spin`, `floaty`, `marquee`, `revealUp` in `globals.css` as `@keyframes`. Use `animation-timeline: view()` for scroll reveals with an IntersectionObserver polyfill/fallback.

6. **Component structure suggestion:**
```
app/
  page.tsx               ← landing page assembly
  layout.tsx             ← font setup + metadata
components/
  Nav.tsx
  Hero.tsx
  Marquee.tsx
  StatsBar.tsx
  Features.tsx
  Roles.tsx              ← client component (tab state)
  HowItWorks.tsx
  Showcase.tsx
  Testimonial.tsx
  FinalCta.tsx
  Footer.tsx
  LanguageContext.tsx    ← client context (lang state)
```

7. **Reference file:** Open `Orithon Landing.dc.html` in a browser to see the exact rendered result. Every section, spacing value, colour, shadow and interaction in this README maps 1:1 to that file.
