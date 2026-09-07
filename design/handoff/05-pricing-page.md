# 05 — Pricing page (`/pricing`)

Order: Header → Plan cards → Enterprise strip → "All plans include" → Comparison band → Calculator cross-sell → Footer.

---

## 1. Page header

Shared inner-page header pattern, reused on all four inner pages:

```
position:relative; padding:74px 0 12px; overflow:hidden
+ glow blob (top:-260px; left:50%; 1000×640)
+ grain
content wrapper position:relative
```

Eyebrow pill "Pricing" → H1 **62px** `max-width:820px` → lead 19px muted.

- H1: "Priced per apartment. Never per headache."
- Lead: "One transparent rate per apartment, per month. No setup fees, no per-user charges, no lock-in — cancel whenever you like."

Then the billing toggle, `margin-top:34px`: segmented control (`02 §6`) with **Monthly** / **Annual · save 20%**. Default **Annual**.

The toggle multiplies every displayed rate and minimum by `0.8` when annual — the same `ANNUAL_MULTIPLIER` from `calculator/pricing.ts`. Rates go €1.20 / €2.20 / €3.40 → €0.96 / €1.76 / €2.72; minimums €18 / €32 / €55 → €14 / €26 / €44 (0 decimals).

---

## 2. Plan cards

`repeat(3,1fr)`, `gap:18px`, `align-items:start`, `margin-top:52px`.

Card: white surface, `border-radius:22px; padding:32px 30px 34px; position:relative; display:flex; flex-direction:column`.

**Standard is the featured plan:** `border:1.5px solid #F2A23C`, amber shadow `0 30px 66px -34px rgba(242,162,60,.6), 0 1px 2px rgba(27,28,26,.05)`, `transform:translateY(-8px)`, plus the badge. Exactly one badge on the page.

Badge: `position:absolute; top:-12px; left:30px; background:#F2A23C; color:#1b1c1a; font-size:11px; font-weight:800; letter-spacing:.09em; text-transform:uppercase; padding:6px 12px; border-radius:999px` — "Most popular".

Card contents, in order:

| Element | Spec |
|---|---|
| Name | 20px/800, `−0.01em` |
| Description | 13.5px muted, `line-height:1.5; margin-top:7px; min-height:40px` (keeps the price line level across cards) |
| Price row | `flex; align-items:flex-end; gap:8px; margin:22px 0 4px`. Value **52px/800**, `−0.035em`, `line-height:.92`, tabular. Unit 12.5px muted, `max-width:92px; line-height:1.35; padding-bottom:5px` — "per apartment / month" |
| Minimum | 12px `mut2`, tabular — "Minimum €26 per building / month" |
| Feature list | `list-style:none; margin:26px 0 28px; flex; flex-direction:column; gap:12px`. Each row `flex; gap:11px; align-items:flex-start; font-size:14px; line-height:1.5` with an 18px amber tick |
| CTA | `margin-top:auto`. Featured → primary "Book a demo"; others → ghost "Get started". All link to `/contact` |

### Plan content

**Essential — €1.20, min €18**
"For small portfolios that mainly need charges issued and paid."
Unlimited buildings & units · Automatic expense splitting · Card & bank payments · Resident portal · Email support

**Standard — €2.20, min €32 — Most popular**
"The complete day-to-day workspace for professional managers."
Everything in Essential · Tickets & maintenance workflow · Document archive per building · Announcements & polls · Owner reports & exports · Priority support

**Pro — €3.40, min €55**
"For large operations that need integrations and deep reporting."
Everything in Standard · Open API & webhooks · Custom dashboards & KPIs · Accounting integrations · Single sign-on (SSO) · Dedicated success manager

---

## 3. Enterprise strip

White card, `border-radius:20px; padding:32px 34px; margin-top:18px`, `flex; align-items:center; justify-content:space-between; gap:30px; flex-wrap:wrap`.

Left: H3 "Managing more than 100 buildings?" + 15px muted paragraph `max-width:620px; margin-top:12px` about volume pricing, a dedicated migration team, custom SLAs and SSO, with a two-working-day quote promise.
Right: ghost button "Request a quote" → `/contact`.

---

## 4. All plans include

`repeat(4,1fr)`, `gap:16px`, `margin-top:56px`. Recessed tiles: `background:paper; border:1px solid line2; border-radius:14px; padding:20px`. Title 14.5px/700 (`margin-bottom:6px`), description 13px muted `line-height:1.5`.

1. **No setup fee** — onboarding, training and data import included in every plan.
2. **Unlimited users** — every colleague, owner and technician at no extra cost.
3. **Greek compliance** — built around Greek common-expense law and myDATA reporting.
4. **Cancel anytime** — monthly plans stop when you say so; your data exports with you.

Two columns at ≤980px.

---

## 5. Comparison band

Section on the `alt` band (`#EFEDE2`), `padding:96px 0`.

Kicker "Compare" → H2 "What is in each plan" (`margin-top:14px`) → table `margin-top:44px`.

Table: `width:100%; border-collapse:collapse; font-size:14.5px`.
- `th`: left-aligned, `padding:16px 18px`, 12px/700 uppercase `letter-spacing:.1em` `mut2`, `border-bottom:1px solid line`. The three plan columns are centred, `width:150px`.
- `td`: `padding:16px 18px; border-bottom:1px solid line2`; plan cells centred.
- Row hover: `background: rgba(255,255,255,.6)`.
- `✓` cells amber and `font-weight:800`; `—` cells `mut2`. Text values (`∞`, `Email`, `Priority`, `Dedicated`) inherit.

### Rows (Essential / Standard / Pro)

| Feature | E | S | P |
|---|---|---|---|
| Buildings & units | ∞ | ∞ | ∞ |
| Automatic expense splitting | ✓ | ✓ | ✓ |
| Online payments | ✓ | ✓ | ✓ |
| Resident portal & app | ✓ | ✓ | ✓ |
| Tickets & maintenance | — | ✓ | ✓ |
| Document archive | — | ✓ | ✓ |
| Announcements & polls | — | ✓ | ✓ |
| Owner reports & exports | — | ✓ | ✓ |
| Custom dashboards | — | — | ✓ |
| Open API & webhooks | — | — | ✓ |
| Accounting integrations | — | — | ✓ |
| Single sign-on (SSO) | — | — | ✓ |
| Support | Email | Priority | Dedicated |

Below 980px: 13px, cells `12px 10px`, drop the fixed column width, wrap the table in a horizontal scroller with a fade on the right edge. Do not let cells wrap into three lines.

---

## 6. Calculator cross-sell

Same strip geometry as the enterprise card, but a **dark panel**: `background:#15161a; border-color:#15161a`.

Left: H3 in white "Not sure which plan fits?" + `rgba(255,255,255,.62)` 15px paragraph `max-width:560px` pointing at the home-page calculator.
Right: **amber** button "Open the calculator" → `/#calc`.

Section `padding-bottom:20px` so the footer margin does the rest.
