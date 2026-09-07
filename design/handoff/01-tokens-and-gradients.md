# 01 — Tokens, gradients and background effects

## 1. Colour

### Core palette

| Token | Value | Use |
|---|---|---|
| `bg` | `#F4F2EA` | Warm cream page base |
| `card` | `#ffffff` | Every raised surface |
| `paper` | `#FBFAF5` | Recessed surface inside a white card (KPI tiles, role points, inactive options, form fields) |
| `alt` | `#EFEDE2` | Alternate section band (How it works, comparison table, related posts) |
| `txt` | `#1b1c1a` | Primary ink |
| `mut` | `rgba(27,28,26,.62)` | Body / secondary |
| `mut2` | `rgba(27,28,26,.42)` | Tertiary, kickers, captions, meta |
| `ink-chip` | `#15161a` | Deliberate dark panels |
| `accent` | `#F2A23C` | Amber — the single accent |
| `accent-2` | `#5BB6D6` | Sky blue — decorative gradients only, never text |
| `line` | `rgba(27,28,26,.12)` | Card borders, dividers |
| `line2` | `rgba(27,28,26,.07)` | Hairlines, internal row separators |
| `prose` | `#33342f` | Article body ink (slightly softer than `txt`) |

### Derived / one-off values

```
Amber tint fill        rgba(242,162,60,.13)
Amber tint border      rgba(242,162,60,.32)
Amber focus ring       rgba(242,162,60,.16)
Slider track empty     rgba(27,28,26,.10)
Bar chart empty        rgba(27,28,26,.12)   /* hero */   rgba(27,28,26,.10)  /* bento */
Inactive badge fill    rgba(27,28,26,.06)
Toggle group fill      rgba(27,28,26,.05)
Table row hover        rgba(255,255,255,.6)
Avatar placeholder     linear-gradient(135deg,#c9c4b6,#9aa39a)
```

### On dark (`ink-chip`) panels

```
Text                   #ffffff
Secondary text         rgba(255,255,255,.62)
Tertiary text          rgba(255,255,255,.55)
Label / kicker         rgba(255,255,255,.50)
Hairline               rgba(255,255,255,.10)
Input fill             rgba(255,255,255,.09)
Input border           rgba(255,255,255,.18)
Input placeholder      rgba(255,255,255,.42)
```

### Links

`a { color: inherit; text-decoration: none }` and `a:hover { color: var(--txt) }` are set globally. Muted nav/footer links go `mut → txt` on hover. Inline prose links (none yet, but define them): amber, with a `1px` amber underline at 40% opacity that goes solid on hover.

---

## 2. Typography

**Body / UI:** `Commissioner` — weights 400, 500, 600, 700, 800, 900.
**Display accent:** `ACaslon Pro Semibold` (600) — used in exactly four places: the `ORITHON` wordmark, the trust marquee names, the testimonial quote mark, and the article drop cap. Nowhere else.

### Scale

| Role | Size | Weight | Tracking | Line-height |
|---|---|---|---|---|
| H1 landing hero | 74px | 800 | −0.025em | 1.0 |
| H1 inner page | 62px | 800 | −0.03em | 1.02 |
| H1 article | 52px | 800 | −0.03em | 1.02 |
| H2 section | 46px (landing) / 40px (inner) | 800 | −0.02em | 1.05 |
| H2 final CTA | 54px | 800 | −0.02em | 1.05 |
| H2 featured post | 33px | 800 | −0.02em | 1.05 |
| H2 in prose | 29px | 800 | −0.02em | 1.2 |
| H3 | 24px | 800 | −0.015em | 1.2 |
| Lead paragraph | 19px | 400 | — | 1.62 |
| Prose body | 18px | 400 | — | 1.75 |
| Prose list item | 17px | 400 | — | 1.6 |
| Section head body | 17px | 400 | — | 1.6 |
| Pull quote | 25px | 600 | −0.012em | 1.42 |
| Testimonial quote | 28px | 500 | −0.01em | 1.42 |
| Post card title | 17.5px | 700 | −0.01em | 1.3 |
| FAQ question | 16.5px | 700 | −0.008em | 1.4 |
| FAQ answer | 15.5px | 400 | — | 1.68 |
| Body / description | 14.5px | 400 | — | 1.6 |
| Small body | 13.5px | 400 | — | 1.55 |
| Meta / caption | 12.5px | 400 | — | 1.4 |
| Micro label | 10.5–11.5px | 400–800 | — | 1.35 |
| Kicker | 13px | 700 | 0.14em, uppercase | — |
| Tag (uppercase) | 11px | 800 | 0.1em, uppercase | — |
| Tag small | 10.5px | 800 | 0.1em, uppercase | — |
| Column heading (footer) | 12px | 700 | 0.08em, uppercase | — |
| Stat value | 42px | 800 | −0.02em | 1 |
| Plan price | 52px | 800 | −0.035em | 0.92 |
| Calculator result | 62px | 800 | −0.035em | 0.9 |
| Step number | 40px | 800 | −0.02em | 1 |
| Float stat value | 30px | 800 | — | 1 |
| Calculator total | 30px | 800 | −0.025em | 1 |
| Brand wordmark | 21px | 600 (ACaslon) | 0.16em | — |

`text-wrap: pretty` on all headings and lead paragraphs.

---

## 3. Spacing, radii, layout

```
Content max-width       1200px, padding 0 28px  (mobile 0 20px)
Prose max-width         760px container, 720px text column
Article hero container  1000px
Section padding         96–108px vertical; 84px for the stats band; 78px on tablet; 70px on mobile
Nav height              70px, sticky
Sticky offset           92px (calculator result), 96px (FAQ sidebar)
```

| Radius | Applied to |
|---|---|
| 6px | Checkbox |
| 7px | Checklist square |
| 9px | Toggle segment (inner) |
| 10px | Small button, icon tile |
| 11px | KPI tile, form field, chip-ish tiles |
| 12px | Button, role point, badge square |
| 13px | Add-on row, image label |
| 14px | Slider-row card, plan option, eyebrow-adjacent tiles |
| 16px | Stat card, float stat, FAQ card |
| 18px | Bento tile, step card, post card, office card, bio, takeaway box |
| 20px | Role panel, enterprise strip, FAQ help card |
| 22px | Photo card, calculator card, plan card, article hero, form, news CTA |
| 24px | Testimonial card |
| 999px | Pill: eyebrow, tag, chip, lang toggle, avatar, dot |

---

## 4. Shadows

```
Card (.glass)
  0 1px 2px rgba(27,28,26,.04), 0 22px 48px -32px rgba(27,28,26,.28)

Card on alt band
  0 24px 50px -34px rgba(27,28,26,.3)

Step card
  0 20px 44px -34px rgba(27,28,26,.28)

Primary button
  0 14px 30px -16px rgba(21,22,26,.55)

Ghost button (rest → hover)
  0 1px 2px rgba(27,28,26,.04)  →  0 12px 26px -16px rgba(27,28,26,.3)

Large photo
  0 44px 80px -40px rgba(27,28,26,.4)      /* hero */
  0 44px 90px -44px rgba(27,28,26,.4)      /* showcase */

Post card hover
  0 30px 58px -34px rgba(27,28,26,.42)
Featured post hover
  0 34px 66px -38px rgba(27,28,26,.4)

Active plan card (amber)
  0 30px 66px -34px rgba(242,162,60,.6), 0 1px 2px rgba(27,28,26,.05)
Active plan option (calculator)
  0 10px 26px -18px rgba(242,162,60,.75)

Active role tab
  0 10px 24px -18px rgba(27,28,26,.35)
Active toggle segment
  0 2px 8px -3px rgba(27,28,26,.28)
Open FAQ card
  0 26px 54px -34px rgba(27,28,26,.34)
Slider thumb
  0 3px 10px -2px rgba(27,28,26,.42)
```

---

## 5. Gradients and background effects

These are the reason the light palette reads as designed rather than flat. Implement all of them.

### 5.1 Page base — fixed warm gradient

On `<body>`, on **every** page:

```css
background:
  radial-gradient(120% 95% at 0% 0%,   #F1EED6 0%, transparent 46%),
  radial-gradient(120% 95% at 100% 0%, #E7F0E0 0%, transparent 48%),
  #F4F2EA;
background-attachment: fixed;
```

Warm sand from the top-left, cool sage from the top-right, cream underneath. `fixed` matters: the wash stays put while content scrolls, so long pages keep a consistent tint instead of repeating the gradient. Sections that need a flat band (`alt`, dark panels) paint over it.

### 5.2 Radial glow blob

A soft amber→blue bloom behind hero and page headers. Absolutely positioned, `pointer-events:none`, `filter: blur(...)`, sits under content.

| Instance | Position | Size | Gradient | Blur |
|---|---|---|---|---|
| Landing hero | `top:-260px; left:50%; translateX(-50%)` | 1100×780 | `radial-gradient(closest-side, rgba(242,162,60,.16), rgba(91,182,214,.07) 55%, transparent 75%)` | 8px |
| Calculator section | `top:-180px; right:-120px` | 760×620 | `radial-gradient(closest-side, rgba(242,162,60,.14), rgba(91,182,214,.06) 58%, transparent 76%)` | 6px |
| Inner page header | `top:-260px; left:50%; translateX(-50%)` | 1000×640 | `radial-gradient(closest-side, rgba(242,162,60,.15), rgba(91,182,214,.06) 56%, transparent 76%)` | 6px |

The parent section needs `position:relative; overflow:hidden` and content inside it needs `position:relative` to sit above.

### 5.3 Masked grid overlay (hero only)

```css
background-image:
  linear-gradient(rgba(27,28,26,.045) 1px, transparent 1px),
  linear-gradient(90deg, rgba(27,28,26,.045) 1px, transparent 1px);
background-size: 54px 54px;
mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, #000, transparent 75%);
```

The mask is essential — an unmasked grid to the section edges looks like a wireframe.

### 5.4 Grain

Inline SVG turbulence, `opacity:.03`, `mix-blend-mode: multiply`, `pointer-events:none`, `inset:0`.

```
url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")
```

Applied on: hero, calculator-adjacent headers, final CTA, all four inner page headers. `multiply` (not `overlay`) — this is a light theme.

### 5.5 Rotating conic ring (hero)

```css
width: 430px; height: 430px; border-radius: 50%;
top: 50%; left: 54%; transform: translate(-50%, -50%);
background: conic-gradient(from 200deg,
  #F2A23C, #5BB6D6, #F2A23C, #5BB6D6, #F2A23C);
opacity: .32;
filter: blur(2px);
mask: radial-gradient(circle, transparent 56%, #000 57%, #000 60%, transparent 61%);
animation: spin 44s linear infinite;
```

The mask turns the disc into a ~3%-wide ring. Keep the rotation slow — it should be barely perceptible.

### 5.6 Image scrims

Every placeholder/photo gets a scrim so white label cards stay legible. All use a cool slate (`15,22,30`), never pure black.

```
Hero photo        linear-gradient(180deg, rgba(15,22,30,.04) 0%, rgba(15,22,30,.06) 50%, rgba(15,22,30,.42) 100%)
Bento image tile  linear-gradient(180deg, rgba(15,22,30,.02), rgba(15,22,30,.5))
Showcase photo    linear-gradient(120deg, rgba(15,22,30,.18), rgba(15,22,30,.02))
Final CTA         linear-gradient(180deg, rgba(244,242,234,.84), rgba(244,242,234,.93))
```

The CTA scrim is the odd one out — a near-opaque **cream** veil, because dark text sits on top of a full-bleed photo.

### 5.7 Slider track fill

The filled portion of a range input, recomputed per value:

```
background: linear-gradient(90deg,
  #F2A23C {p}%,
  rgba(27,28,26,.10) {p}%);
```

Hard stop, no feather.

### 5.8 Amber tint panel

Savings callout in the calculator:

```
background: rgba(242,162,60,.13);
border: 1px solid rgba(242,162,60,.32);
```

The only place amber is used as a fill behind body text, and only at 13%.
