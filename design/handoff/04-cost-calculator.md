# 04 — Cost calculator component

Lives on the landing page as section `#calc`, between "How it works" and the Showcase split. It is the primary engagement device on the site: it answers "what will this cost me?" without a sales call.

Build it as `components/calculator/CostCalculator.tsx` (client component) with the model in a pure `components/calculator/pricing.ts` so the pricing page and any future quote flow can share it.

---

## 1. Pricing model — implement exactly

```ts
export const PLANS = [
  { key: 'essential', rate: 1.20, minPerBuilding: 18 },
  { key: 'standard',  rate: 2.20, minPerBuilding: 32 },
  { key: 'pro',       rate: 3.40, minPerBuilding: 55 },
] as const;

export const ADDONS = [
  { key: 'payments',   rate: 0.35 },
  { key: 'technician', rate: 0.45 },
  { key: 'accounting', rate: 0.25 },
] as const;

export const ANNUAL_MULTIPLIER = 0.8;   // annual billing = −20%
```

All rates are **€ per apartment per month**, VAT excluded.

### Formulas

```
totalApartments   = buildings × apartmentsPerBuilding

addonRate         = Σ rate of each selected add-on

planPerBuilding   = max(apartmentsPerBuilding × plan.rate, plan.minPerBuilding)
minApplied        = apartmentsPerBuilding × plan.rate < plan.minPerBuilding

grossMonthly      = buildings × planPerBuilding + totalApartments × addonRate

monthly           = annual ? grossMonthly × 0.8 : grossMonthly
perApartment      = monthly / totalApartments
yearlyTotal       = monthly × 12
yearlySaving      = grossMonthly × 12 × 0.2
```

Two things to get right:

- **The minimum is per building, not per portfolio.** A 4-apartment building on Standard costs €32, not €8.80 — that is what stops small buildings being unprofitable, and the UI must surface it (see §4).
- **`yearlySaving` is computed from the gross figure regardless of the current cycle**, so the callout can say either "you save X" (annual selected) or "switch and save X" (monthly selected) using the same number.

### Defaults

`buildings: 8` · `apartmentsPerBuilding: 14` · `plan: 'standard'` · `annual: true` · `payments: on`, `technician: off`, `accounting: off`.

These land on €2.04/apartment/month, €2,285/month — a believable mid-market figure that makes the component look useful on first paint. Do not change them without a reason.

### Rounding and formatting

| Figure | Decimals |
|---|---|
| Per-apartment result | 2 |
| Plan and add-on rates | 2 |
| Monthly total, yearly total, saving, per-building minimum | 0 |

Format with `Intl.NumberFormat` — `en-US` for English, `el-GR` for Greek (comma decimal separator, dot thousands) — prefixed with `€`. Never hand-roll the separator swap.

---

## 2. Layout

Section: `position:relative; overflow:hidden`, padding `108px 0`, with the calculator glow blob at `top:-180px; right:-120px` (`01 §5.2`).

Section head `max-width:660px`: kicker "Cost calculator" → H2 "What will it cost per apartment?" → lead explaining per-apartment pricing.

Body grid: **`1.12fr .88fr`, `gap:26px`, `align-items:start`** — controls left, result right. One column at ≤980px.

### Controls card

White card, `border-radius:22px; padding:32px 34px`. Five rows, each `padding:22px 0; border-top:1px solid line2`; the first has no top border and no top padding.

Row header: `flex; justify-content:space-between; align-items:flex-end; gap:16px; margin-bottom:16px`.
- Left: question 15.5px/700, and beneath it a 12.5px `mut2` hint (`margin-top:4px`, weight 400).
- Right (slider rows only): the live value, 22px/800, `−0.02em`, tabular, `white-space:nowrap`.

| # | Row | Control |
|---|---|---|
| 1 | How many buildings? / "Everything you manage today" | Slider `min 1, max 120, step 1`; scale `1 · 60 · 120+`; readout `"8 buildings"` (singular at 1) |
| 2 | Apartments per building / "Average across the portfolio" | Slider `min 2, max 80, step 1`; scale `2 · 40 · 80`; readout `"14 apts"` |
| 3 | Choose a plan / "Per apartment, per month" | Three selection cards, `repeat(3,1fr)`, `gap:10px` |
| 4 | Add-ons / "Optional — switch off any time" | Three toggle rows, `1fr 1fr` grid, `gap:10px` (third wraps) |
| 5 | Billing / "Annual billing saves 20%" | Segmented toggle, segments `flex:1` |

Slider track fill percentages: `(buildings − 1) / 119 × 100` and `(apartments − 2) / 78 × 100`.

**Plan card** (`border-radius:14px; padding:15px 15px 14px; text-align:left`, selection styling per `02 §6`): name 14.5px/700 → rate 19px/800 `−0.02em` tabular (`margin-top:9px`) → unit line 10.5px `mut2` `line-height:1.35`. Unit lines: "charges + payments" / "+ tickets, docs, comms" / "+ API, reporting, SSO".

**Add-on row** (`border-radius:13px; padding:14px 15px; flex; gap:12px; align-items:center`): 20px checkbox square then name 14px/600 with price 11.5px `mut2` below — `"+€0.35 / apt"`. Note the **singular** unit here; the slider readout uses the plural "apts". In Greek both are "διαμ.".

Add-ons: Online payments `+€0.35` · Technician app `+€0.45` · Accounting export `+€0.25`.

### Result card

`position:sticky; top:92px`, `border-radius:22px; overflow:hidden` — a dark header over a white body.

**Header** — `background:#15161a; color:#fff; padding:32px 32px 28px`:
- 11.5px/800 uppercase `letter-spacing:.14em` label `rgba(255,255,255,.5)` — "Your estimate"
- The figure: `flex; align-items:flex-start; gap:6px; margin-top:16px`. Number **62px/800**, `−0.035em`, `line-height:.9`, tabular, **amber**. Beside it, 12.5px `rgba(255,255,255,.62)` `max-width:96px; padding-top:6px` reading "per apartment / month"
- Scope line 13px `rgba(255,255,255,.55)` `margin-top:18px` — `"8 buildings · 112 apartments in total"`

**Body** — `background:#fff; padding:26px 32px 30px`:

Three breakdown rows, `flex; justify-content:space-between; align-items:baseline; gap:14px; padding:11px 0; border-bottom:1px solid line2`; label muted 13.5px, value 700 tabular `white-space:nowrap`.

| Label | Value |
|---|---|
| Plan | `Standard · €2.20` — plus `" (min. per building applied)"` when the minimum binds |
| Add-ons | `1 · +€0.35`, or `—` when none |
| Billing | `Annual · −20%` or `Monthly` |

Total block `padding:20px 0 4px`, `flex; justify-content:space-between; align-items:baseline`: left "Total per month" 14.5px/700 with `€27,418 / year` beneath in 12.5px `mut2` tabular; right the monthly figure at **30px/800**, `−0.025em`, tabular.

Savings callout — amber tint panel (`01 §5.8`), `border-radius:11px; padding:11px 13px; margin-top:18px; font-size:12.5px; font-weight:600; flex; gap:9px`, led by a 💡. Copy switches on cycle: "You save €6,856 per year with annual billing." / "Switch to annual billing and save €6,856 per year."

Then a stacked button column `margin-top:22px; gap:9px`: primary "Book a demo", ghost "See full pricing" → `/pricing`.

Footnote 11.5px `mut2` centred `margin-top:16px`: "Estimate only. VAT excluded. Final quote after a 20-minute walkthrough."

---

## 3. Behaviour

- Every control updates the result **immediately** — no Calculate button.
- Sliders fire on `input` (drag), not only `change`.
- All figures use tabular numerals; the total and per-apartment figures must not reflow as digits change. Reserve width or right-align.
- The sticky result card stays in view while the controls are scrolled on desktop; below 980px it unsticks and sits under the controls.
- Consider a debounced `router.replace` writing state to the query string so an estimate can be shared — not in the prototype, but cheap and worth it.
- Keyboard: sliders are natively focusable; plan cards and add-on rows must be real `<button>`/`<label><input type="checkbox">` elements, not clickable `div`s. Give the plan group `role="radiogroup"`.
- Announce the result with `aria-live="polite"` on the per-apartment figure.

## 4. Edge cases to handle

| Case | Expected |
|---|---|
| 1 building | Readout reads "1 building" (singular) |
| Apartments below the plan minimum threshold (e.g. 8 apts on Pro → 8 × 3.40 = €27.20 < €55) | Per-apartment figure rises above the headline rate; the Plan row appends "(min. per building applied)" |
| All add-ons off | Add-ons row shows `—`, not `0 · +€0.00` |
| Monthly cycle | Savings callout flips to the "switch and save" wording; the number is unchanged |
| Maximum (120 × 80, Pro, all add-ons) | ~€36,000/month — must not overflow the card; the 30px total has room for six digits plus separator |
