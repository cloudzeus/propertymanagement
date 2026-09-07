# 02 — Global shell and shared components

## 1. Navigation

Sticky, `z-index: 60`, height `70px`, translucent with blur so the gradient wash shows through.

```css
background: rgba(244,242,234,.72);
backdrop-filter: blur(20px) saturate(140%);
border-bottom: 1px solid rgba(27,28,26,.07);
```

Inner: `display:flex; align-items:center; justify-content:space-between; gap:24px; height:70px` inside the 1200px wrapper.

**Three children, and the flex behaviour matters** (this caused a real overlap bug in the prototype):

1. `.brand` — `flex: none`. Symbol 27×27 (`orithon-symbol-black.png`) + gap 11px + wordmark (ACaslon 21px, tracking 0.16em, `padding-left:.06em` to optically correct the tracking on the first letter).
2. Nav links — `display:flex; gap:26px; font-size:14.5px; color:mut`, every link `white-space:nowrap`. Hover → `txt`. **Active route** gets `color:txt; font-weight:700; box-shadow: inset 0 -2px 0 #F2A23C` (a 2px amber underline drawn inside the box so it doesn't shift layout).
3. `.nav-actions` — `flex:none; gap:14px`. Language toggle, then "Log in" (14.5px, muted), then a small primary button.

**Language toggle:** pill, `border:1px solid line`, `border-radius:999px`, `padding:2px`, `font-size:12px`. Segments `padding:6px 12px; border-radius:999px`; active `background:ink-chip; color:#fff; font-weight:700`; idle `transparent; color:rgba(27,28,26,.5); font-weight:600`.

**Breakpoint:** hide the nav links below **1080px** and show a hamburger. The links measure ~544px intrinsic; brand 172px + actions 274px leaves no room below that. Do not lower this threshold when adding links — raise it.

**Link set:** Features, Calculator, Pricing, News, FAQ, Contact.

### Reading progress bar (article pages only)

`position:fixed; top:0; left:0; height:3px; background:#F2A23C; z-index:80; transition: width .08s linear`. Width = `scrollTop / (scrollHeight − clientHeight)`. Use a passive scroll listener plus `requestAnimationFrame`, or `animation-timeline: scroll()` where supported.

---

## 2. Footer

`border-top: 1px solid line2`, `padding: 56px 0 40px`.

Top row: `flex; justify-content:space-between; gap:40px; flex-wrap:wrap`.
- Left: brand lockup + tagline (`max-width:300px; font-size:14px; color:mut; line-height:1.6; margin-top:16px`).
- Right: three link columns, `flex; gap:60px; flex-wrap:wrap`. Column heading 12px/700/0.08em uppercase, `margin-bottom:16px`. Links 14px, muted, `padding:6px 0`, block, hover → `txt`.

Columns: **Product** (Pricing, Features, Calculator, Security) · **Company** (About, News, Careers, Contact) · **Resources** (FAQ, Help center, API, Privacy).

Bottom bar: `margin-top:46px; padding-top:24px; border-top:1px solid line2`, `flex; justify-content:space-between; flex-wrap:wrap; gap:12px`, 13px `mut2`. Left `© 2026 Orithon. {rights}`, right `Athens · Greece`.

---

## 3. Buttons

Base: `inline-flex; align-items:center; justify-content:center; gap:9px; font-size:15px; font-weight:600; border-radius:12px; padding:14px 22px; white-space:nowrap; border:0; cursor:pointer;` transition `transform .18s cubic-bezier(.2,.7,.3,1), box-shadow .18s, filter .18s`.

Small: `padding:10px 17px; font-size:14px; border-radius:10px`.

| Variant | Rest | Hover |
|---|---|---|
| **primary** | `background:#15161a; color:#fff; font-weight:700;` shadow `0 14px 30px -16px rgba(21,22,26,.55)` | `translateY(-2px); filter:brightness(1.18)` |
| **ghost** | `background:#fff; color:txt; border:1px solid line;` shadow `0 1px 2px rgba(27,28,26,.04)` | `translateY(-2px);` shadow `0 12px 26px -16px rgba(27,28,26,.3)` |
| **amber** | `background:#F2A23C; color:#1b1c1a; font-weight:700` | `filter:brightness(1.08)` |

The amber variant appears only on dark panels (the "open the calculator" strip and the newsletter submit).

---

## 4. Surfaces

### Card (`.glass`)

```css
background: #ffffff;
border: 1px solid rgba(27,28,26,.12);
box-shadow: 0 1px 2px rgba(27,28,26,.04), 0 22px 48px -32px rgba(27,28,26,.28);
```

Despite the name there is no blur — it is a crisp white card. On the `alt` band drop the tiny top shadow and use `0 24px 50px -34px rgba(27,28,26,.3)`.

### Dark panel

`background:#15161a; color:#fff`, no border (or `border-color` matching the fill). Used for: calculator result header, "open the calculator" strip, newsletter strip, support-hours card.

### Recessed tile

`background:#FBFAF5; border:1px solid line2` — always **inside** a white card, never directly on the page.

---

## 5. Small components

**Eyebrow pill** — `inline-flex; gap:9px; align-items:center; font-size:13px; font-weight:600; background:#fff; border:1px solid line; padding:7px 15px 7px 10px; border-radius:999px;` shadow `0 1px 2px rgba(27,28,26,.04)`. Leading dot: 7px circle, amber, `box-shadow: 0 0 10px rgba(242,162,60,.55)`.

**Kicker** — 13px/700, `letter-spacing:.14em`, uppercase, `mut2`. Sits above an H2 with `margin-bottom:14px`.

**Tag** (news category, on light) — `inline-flex; font-size:11px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:#1b1c1a; background:#F2A23C; padding:5px 11px; border-radius:999px`.

**Tag, small/quiet** (post cards) — `font-size:10.5px; font-weight:800; letter-spacing:.1em; uppercase; color:mut; background:paper; border:1px solid line2; padding:4px 9px; border-radius:999px`.

**Tick** (feature lists) — 18px square, `border-radius:5px`, amber fill, white 11px check stroke `2.8`, `flex:none`, `margin-top:1px`. Larger checklist variant (showcase): 22px, `border-radius:7px`, amber, no glyph.

**Icon badge** — 42px circle, `background:#15161a`, 19px white stroked SVG (`stroke-width:1.6`). Small variant 38px with a 15px glyph; role badges 32px circle (active dark/white, idle `rgba(27,28,26,.06)` with muted letter) and 46px `border-radius:12px` for the panel header.

**Section head** — `max-width:620px; margin-bottom:48px`: kicker → H2 (`margin-top:14px`) → paragraph 17px muted (`margin-top:16px`).

**Meta row** — `flex; align-items:center; gap:10px; font-size:12.5px; color:mut2`, items separated by a 3px muted dot.

**Avatar** — circle, `linear-gradient(135deg,#c9c4b6,#9aa39a)`. 34px with `2px solid #fff` border and `margin-left:-10px` when stacked; 46px for author rows; 62px for the bio card.

**Image placeholder** — fills its container, warm neutral surface, centred label naming the intended photo ("Building photo"). Swap for `next/image` with `fill` when real assets land. Drop-in slots: hero, bento tile, showcase, final CTA, news featured, 6 news cards, article hero, 3 related, 2 offices.

---

## 6. Form controls

```css
/* field */
width:100%; background:#FBFAF5; border:1px solid rgba(27,28,26,.12);
border-radius:11px; padding:13px 15px; outline:none;
transition: border-color .18s, box-shadow .18s;

/* focus */
border-color:#F2A23C; background:#fff;
box-shadow: 0 0 0 3px rgba(242,162,60,.16);
```

Label: 13px/700, `margin-bottom:8px`; required marker is an amber `*`.
Textarea: `min-height:130px; resize:vertical; line-height:1.6`.
Two-up rows: `grid-template-columns:1fr 1fr; gap:16px`, collapsing to one column at 560px. Field block `margin-bottom:18px`.
Checkbox: 17px, `accent-color:#F2A23C`, `flex:none`, `margin-top:2px`, label text 13px muted `line-height:1.55`.

**On dark panels** (newsletter): `background:rgba(255,255,255,.09); border:1px solid rgba(255,255,255,.18); color:#fff; border-radius:11px; padding:13px 16px`; placeholder `rgba(255,255,255,.42)`; focus `border-color:#F2A23C`.

### Range slider

```css
appearance:none; width:100%; height:6px; border-radius:999px; outline:none;
background: rgba(27,28,26,.10);   /* overridden per value — see 01 §5.7 */

/* thumb */
width:22px; height:22px; border-radius:50%;
background:#F2A23C; border:3px solid #fff;
box-shadow: 0 3px 10px -2px rgba(27,28,26,.42);
cursor:grab;                       /* :active → grabbing, scale(1.12) */
```

Firefox thumb is authored at 16px because it measures the box differently. Below the track: a min/mid/max scale row, 11.5px `mut2`, tabular numerals.

### Segmented toggle

Container `inline-flex; gap:6px; background:rgba(27,28,26,.05); padding:4px; border-radius:12px`. Segment `padding:11px 20px; border-radius:9px; font-size:13.5px`; active `background:#fff; color:txt; font-weight:700;` shadow `0 2px 8px -3px rgba(27,28,26,.28)`; idle `transparent; color:mut; font-weight:600`. In the calculator the segments are `flex:1` with `padding:11px 10px`.

### Selection card (plan / add-on)

Selected: `background:#fff; border:1.5px solid #F2A23C` + amber shadow (see `01 §4`), plans additionally `translateY(-2px)`.
Unselected: `background:#FBFAF5; border:1.5px solid line2`.
Border width stays `1.5px` in both states so nothing shifts. Checkbox square: 20px, `border-radius:6px`; on → amber fill + white check; off → white fill + `1.5px solid rgba(27,28,26,.18)`.

---

## 7. Animations

```css
@keyframes spin      { to   { transform: translate(-50%,-50%) rotate(360deg) } }
@keyframes floaty    { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-13px) } }
@keyframes marquee   { to   { transform: translateX(-50%) } }
@keyframes revealUp  { from { opacity:0; transform: translateY(42px) } to { opacity:1; transform:none } }
@keyframes fadeIn    { from { opacity:0; transform: translateY(14px) } to { opacity:1; transform:none } }
```

| Effect | Spec |
|---|---|
| Hero float cards | `floaty 7s ease-in-out infinite`; second card `6s` with `.8s` delay |
| Conic ring | `spin 44s linear infinite` |
| Trust marquee | `marquee 30s linear infinite` on a `width:max-content` track holding the list twice, `gap:64px` |
| Scroll reveal | `revealUp` driven by `animation-timeline: view()`, range `entry 2% cover 26%` (inner pages `24%`). Fall back to IntersectionObserver; if neither, render visible |
| Route/page transition | `fadeIn .34s cubic-bezier(.2,.7,.3,1)` |
| Hover lift | `translateY(-2px)` buttons, `-3px` featured post, `-4px` post cards; `.18s`–`.2s cubic-bezier(.2,.7,.3,1)` |
| FAQ chevron | the `+` icon rotates `135deg` when open, `.25s cubic-bezier(.2,.7,.3,1)` |

Marquee needs edge fade: `mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)`.

Wrap `floaty`, `spin`, `marquee` and `revealUp` in `@media (prefers-reduced-motion: no-preference)`.

---

## 8. Breakpoints

| Width | Changes |
|---|---|
| **≤1080px** | Nav links hidden → hamburger |
| **≤980px** | H1 74→54 (inner 62→46), H2 46→36 (inner 40→32), CTA H2 →40, quote →23, prose →17. Hero, showcase and contact grids → 1 column. Bento → 2 columns (big tile and image tile span both; image tile min-height 240px). Stats → 2×2. How-steps → 1 column (drop the connector line). Roles → stacked, tabs become a wrapping row. Calculator → 1 column, result card unsticks, plan options and add-ons → 1 column, result figure 62→52px. Plans → 1 column. Featured post → stacked (media min-height 260px). Posts → 2 columns. FAQ sidebar → horizontal wrapping row, unsticks. Offices → 1 column. Article hero 440→280px. Section padding → 70–78px |
| **≤560px** | H1 →42px (inner 36px). Bento, posts, role points, form rows, stats → 1 column (stats may stay 2×2). Wrapper padding → 20px. Form padding → 26px 22px. Pull quote →21px |

Comparison table below 980px: shrink to 13px, cells `12px 10px`, drop the fixed 150px column width, allow horizontal scroll rather than wrapping cells.
