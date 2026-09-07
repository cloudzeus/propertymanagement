# 03 — Landing page (`/`)

Order: Hero → Trust marquee → Stats → Features bento → Roles → How it works → **Cost calculator** (spec `04`) → Showcase → Testimonial → Final CTA → Footer.

---

## 1. Hero

`position:relative; padding:78px 0 96px; overflow:hidden`.

Three stacked background layers, all `pointer-events:none`: glow blob → masked grid → grain (see `01 §5.2–5.4`). Content wrapper `position:relative`.

Grid: `1.05fr .95fr`, `gap:50px`, `align-items:center`.

### Left column

1. Eyebrow pill — "Property & common-area management"
2. H1, 74px, two lines: line 1 ink, line 2 **amber** — "Every building," / "under control."
3. Lead, 19px muted, `max-width:520px`
4. Button row `gap:13px; margin-top:34px` — primary "Book a demo", ghost "▷ Watch overview"
5. Trust row `margin-top:38px; gap:14px` — four overlapping 34px avatars + 13.5px muted line "Trusted by managers across 200+ buildings"

Each element enters on load with a staggered `pop` (`opacity 0, translateY(26px)` → rest): 0.05 / 0.12 / 0.20 / 0.30 / 0.38 / 0.46s.

### Right column — `height:480px`, `position:relative`

| Layer | Placement | Detail |
|---|---|---|
| Conic ring | `top:50%; left:54%` centred | `01 §5.5` |
| Photo card | `top:8px; right:0`, 340×420 | `border-radius:22px; border:1px solid line;` photo shadow; bottom scrim; overflow hidden |
| Photo label | `left/right:14px; bottom:14px` | White card, `border-radius:14px; padding:13px 15px`, `flex; justify-content:space-between`. Left: "Astra Residences" 14px/700 + "Kifisias Ave 124" 11.5px muted. Right: "96%" 16px/800 + "occupied" 10.5px muted |
| Payment toast | `left:6px; top:6px`, `z-index:4` | White card, `border-radius:14px; padding:11px 14px`, `flex; gap:11px`. 26px amber rounded square with `€` (800/13px, ink) + "Payment received" 12px/700 / "Apt 4B · €84.50" 10.5px muted. `floaty 6s`, `.8s` delay |
| Dashboard card | `left:-8px; bottom:18px`, width 310, `z-index:3` | White card, `border-radius:18px; padding:16px`. `floaty 7s` |

**Dashboard card contents:**
- Header row: left, amber 6px dot with `box-shadow: 0 0 8px rgba(242,162,60,.6)` + "Live portfolio" 11px muted; right "June 2026" 10.5px `mut2`
- KPI grid `1fr 1fr; gap:9px; margin:12px 0` — each tile `background:paper; border:1px solid line; border-radius:11px; padding:10px 11px`; label 10px `mut2`, value 21px/800 (`€184k`, `12`)
- Caption "Collections vs. budget" 10.5px `mut2`
- Bar chart: `flex; align-items:flex-end; gap:6px; height:60px; margin-top:8px`. Nine bars `flex:1; border-radius:3px 3px 0 0`, heights `46 62 54 72 64 84 70 92 80%`; bars 8–9 amber, rest `rgba(27,28,26,.12)`

---

## 2. Trust marquee

`padding:30px 0`, hairline top and bottom. Centred 12px `mut2` uppercase label (`letter-spacing:.1em`, `margin-bottom:22px`), then the marquee (`02 §7`). Names in **ACaslon 23px** `mut2`: Meridian · Halcyon · Astor · Lumen · Veridia · Solace · Atrium · Northwind, duplicated for the loop.

---

## 3. Stats band

`padding:84px 0`. Four columns, `gap:16px`. Each: white card, `border-radius:16px; padding:26px 24px`; value 42px/800 `−0.02em`; label 14px muted `margin-top:6px`.

`200+` buildings managed · `98%` on-time payments · `4h` avg. resolution time · `€12M` collected per year

(GR: `200+` κτήρια · `98%` έγκαιρες πληρωμές · `4ώρ` μέσος χρόνος επίλυσης · `€12εκ` εισπράξεις / έτος)

---

## 4. Features bento

Section head: kicker "One platform" / H2 "Everything a building needs, in one place." / lead.

Grid: `repeat(3,1fr)`, `grid-auto-rows: minmax(180px,auto)`, `gap:16px`. Tiles are white cards, `border-radius:18px; padding:26px; display:flex; flex-direction:column; position:relative; overflow:hidden`.

| Tile | Placement | Content |
|---|---|---|
| 1 | `grid-column:1/3` | Icon badge, title **24px**/700, description, then a 9-bar mini chart (`height:54px; gap:7px`, same heights, last two amber, rest `rgba(27,28,26,.10)`) |
| 2 | `grid-column:3; grid-row:1/3` | Image only — `padding:0; min-height:376px`. Placeholder fills, scrim on top, white label card `left/right/bottom:16px; border-radius:13px; padding:12px 14px`: 13.5px/700 title + 11.5px muted sub |
| 3–7 | auto | Icon badge → title 18.5px/700 (`margin:18px 0 8px`) → description 14.5px muted `line-height:1.6` |

Icon badge is `margin-bottom:auto` so titles bottom-align across a row.

Content: Shared expenses & billing (big) · *image tile* · Online payments · Tasks & repairs · Resident communication · Documents & archive · Reporting & dashboards. Icons: concentric circles, rounded square with lines, triangle, circular arrow, window, ascending bars — all 24-box stroked SVG at `stroke-width:1.6`.

---

## 5. Roles tab switcher

`padding-top:24px`. Section head: "For every role" / "Built for everyone in the building." / "One source of truth, three tailored experiences."

Grid `320px 1fr`, `gap:24px`, `align-items:start`.

**Tabs** — vertical, `gap:9px`. Each `padding:15px 18px; border-radius:14px; flex; gap:13px; align-items:center`. Active: `background:#fff; border:1px solid rgba(27,28,26,.14)` + tab shadow. Idle: transparent, transparent border. 32px circular badge (active dark/white, idle `rgba(27,28,26,.06)`/muted) + name 15px/700 + tag 12.5px muted.

**Panel** — white card, `border-radius:20px; padding:34px; min-height:260px`. Header: 46px `border-radius:12px` dark badge with the role letter + name 24px/800 + tag 13.5px muted. Then a `1fr 1fr` grid, `gap:13px; margin-top:24px` of role points: `background:paper; border:1px solid line2; border-radius:12px; padding:15px 16px; font-size:14.5px`, each led by an amber `›` (13px/bold).

Roles: **M** Managers / Property & facility companies · **R** Residents / Owners & tenants · **T** Technicians / Maintenance crews. Four points each. Greek letters Δ / Ε / Τ.

---

## 6. How it works — alternate band

Section `background:#EFEDE2`. Cards become `background:#fff; border:1px solid rgba(27,28,26,.10)` with the step shadow.

Head: "How it works" / "Live in three steps." / "No migrations, no spreadsheets, no IT project."

Three columns, `gap:20px`, `position:relative`. A connector hairline sits behind them: `position:absolute; top:48px; left:8%; right:8%; height:1px; background:rgba(27,28,26,.10)` — hidden at ≤980px.

Card `border-radius:18px; padding:28px`: number 40px/800 **amber**, title 19px/700 (`margin:16px 0 8px`), description 14.5px muted.

01 Add your buildings · 02 Issue & collect · 03 Run operations

---

## 7. Showcase split

Grid `1.05fr .95fr`, `gap:54px`, `align-items:center`.

**Left** `height:440px; position:relative`:
- Photo `inset:0; border-radius:22px; border:1px solid line;` showcase shadow, diagonal scrim
- Float stat `left:-22px; top:40px` — white card, `border-radius:16px; padding:16px 18px; width:200px`; value 30px/800 amber-ink (`€184k`), label 12.5px muted
- Float stat `right:-18px; bottom:48px` — same, `12` / "Open tickets"

**Right:** kicker "Glass-clear operations" → H2 "See every building at a glance." → 17px muted paragraph → three checklist rows → ghost button `margin-top:24px`.

Checklist row: `flex; gap:13px; align-items:flex-start; padding:13px 0; border-top:1px solid line2`. 22px amber `border-radius:7px` square (`flex:none; margin-top:2px`) + title 15.5px with a muted 13.5px sub-line below (`margin-top:3px`).

Rows: Portfolio dashboard · Per-building drill-down · Exportable reports.

---

## 8. Testimonial

`padding-top:0`. Single centred white card, `border-radius:24px; padding:54px 56px; text-align:center`.

Quote mark: **ACaslon** `“`, 90px, amber, `line-height:.5; height:42px`.
Quote: 28px/500, `line-height:1.42; −0.01em; max-width:760px; margin:22px auto 0`.
Attribution `margin-top:30px`, `flex; justify-content:center; gap:13px`: 46px avatar + left-aligned name 15px/700 and role 13px muted.

Eleni Markou — Property manager · 38 buildings.

---

## 9. Final CTA

`position:relative; padding:128px 0; overflow:hidden; text-align:center`. Full-bleed image `inset:0` + the cream scrim (`01 §5.6`) + grain. Content `position:relative`.

H2 54px, `max-width:680px; margin:0 auto` — "Stop chasing buildings. Start running them."
Paragraph 18px muted, `max-width:480px; margin:20px auto 32px`.
Centred button row `gap:13px`: primary "Book a demo", ghost "Talk to sales".
