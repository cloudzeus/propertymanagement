# 07 — FAQ (`/faq`) and Contact (`/contact`)

---

# Part A — FAQ

Order: Header → Sidebar + accordion → Help card → Footer.

## 1. Header

Standard inner-page header (`05 §1`). Eyebrow "Support" → H1 62px `max-width:700px` "Questions, answered plainly." → lead: "Everything managers ask us before they switch — pricing, migration, legal compliance and what happens on day one."

## 2. Layout

`grid-template-columns:250px 1fr; gap:40px; align-items:start; margin-top:52px`. One column at ≤980px.

## 3. Category sidebar

`flex; flex-direction:column; gap:5px; position:sticky; top:96px`. At ≤980px it unsticks and becomes a wrapping horizontal row.

Item: `padding:13px 16px; border-radius:11px; font-size:14.5px; flex; justify-content:space-between; align-items:center; gap:10px`.
- Active: `background:#15161a; color:#fff; font-weight:700`
- Idle: `transparent; color:mut; font-weight:600`

Each shows a count on the right: `font-size:11.5px; opacity:.55`, tabular.

Categories (3 questions each): **Pricing & contracts** · **Setup & migration** · **Compliance & data** · **Operations & support**.

Switching category resets the open question to the first one.

## 4. Accordion

One card per question: white surface, `border-radius:16px; overflow:hidden; margin-bottom:10px`.

**Open card:** `border-color: rgba(27,28,26,.18)` and shadow `0 26px 54px -34px rgba(27,28,26,.34)`.

**Question row** — `flex; align-items:flex-start; justify-content:space-between; gap:20px; padding:24px 28px; cursor:pointer; font-size:16.5px; font-weight:700; −0.008em; line-height:1.4`.

**Icon** — 26px circle, `flex:none; margin-top:1px`, containing a 12px `+` glyph (`stroke-width:2.4`), transition `.25s cubic-bezier(.2,.7,.3,1)`:
- Closed: `background: rgba(27,28,26,.06)`, stroke `rgba(27,28,26,.55)`
- Open: `background:#F2A23C`, stroke `#fff`, **`transform: rotate(135deg)`** — the plus becomes an ×

**Answer** — `padding:0 28px 26px; font-size:15.5px; line-height:1.68; color:mut; max-width:720px`.

**Behaviour:** single-open. Clicking the open question closes it (all collapsed is a valid state). First question of each category starts open. Animate height via a grid-rows or max-height transition; do not pop.

Use `<button aria-expanded>` for the question row with a proper `aria-controls` region — not a clickable `div`.

## 5. Question set

**Pricing & contracts** — How is Orithon priced? (per apartment/month, small per-building minimum, no setup or per-user fees) · Is there a minimum contract? (no; monthly cancels any time, annual saves 20%, data exports in open formats) · What happens if a building leaves my portfolio? (billed on apartments active at period start, not your peak)

**Setup & migration** — How long does migration take? (most portfolios live within a week; send any format, we map units/owners/meters/opening balances, you review first) · Can I import opening balances and history? (yes, flagged separately for auditability) · Do residents need to install anything? (no — browser link, optional iOS/Android app)

**Compliance & data** — Is Orithon compliant with Greek common-expense law? (share-based, area, per-riser and custom allocation; statements carry the information needed for disputes and assembly minutes) · Does it connect to myDATA and my accountant? (Pro includes integrations and myDATA-ready exports; CSV on all plans) · Where is our data stored? (EU data centres, encrypted at rest and in transit, 30-day backups, GDPR, DPA on request)

**Operations & support** — How do payments reach the building account? (settle directly into the nominated building account; Orithon never holds funds, only reconciles) · What support do we get on day one? (guided onboarding, migration review call, unlimited email; Standard adds priority, Pro a named success manager) · Can technicians use it without an account? (yes — dispatch a work order by link, external contractors update status and upload photos with no login)

Full answer copy, EN and GR, in the reference file. Model as `lib/faq.ts`: `{ category, question, answer }[]`. Emit `FAQPage` JSON-LD.

## 6. Help card

White card, `border-radius:20px; padding:38px 40px; margin-top:44px`, `flex; align-items:center; justify-content:space-between; gap:30px; flex-wrap:wrap`.

Left: H3 "Still not sure?" + 15px muted paragraph `max-width:480px; margin-top:12px` — replies within four working hours, in Greek or English.
Right: primary button "Talk to a human" → `/contact`.

---

# Part B — Contact

Order: Header → Form + side column → Office cards → Footer.

## 1. Header

Eyebrow "Contact" → H1 62px `max-width:700px` "Let us look at your portfolio together." → lead: book a 20-minute walkthrough, ask about migration, or say what is broken today; a real person reads every message.

## 2. Layout

`grid-template-columns:1.1fr .9fr; gap:26px; align-items:start; margin-top:52px`. One column at ≤980px.

## 3. Form

White card, `border-radius:22px; padding:36px 38px` (mobile `26px 22px`).

H3 at 21px "Send us a message" + 14px muted paragraph (`margin:10px 0 28px`).

Fields, in order — control specs in `02 §6`:

| Row | Fields |
|---|---|
| 1 | Full name **\*** · Company |
| 2 | Email **\*** · Phone |
| 3 | Buildings you manage *(select)* · What is this about? *(select)* |
| 4 | Message *(textarea, full width)* |

Placeholders: "Eleni Markou" / "Markou Property Management" / "eleni@company.gr" / "+30 210 000 0000"; message placeholder invites detail about buildings, current tools and what to fix first.

**Buildings** options: 1–5 · 6–20 · 21–60 · 61–100 · More than 100 buildings.
**Topic** options: Book a demo · Pricing question · Migrating from another tool · Technical support · Partnership.

Consent checkbox `margin:6px 0 22px`, `flex; gap:11px; align-items:flex-start; cursor:pointer`, 13px muted — agreement to be contacted and to storage per the privacy policy. Link "privacy policy".

Submit: full-width primary "Send message". Footnote below, 12px `mut2` centred `margin-top:14px` — "We reply within four working hours."

### Success state

On submit the form is **replaced** by a white card, `border-radius:22px; padding:56px 44px; text-align:center`:

- 64px amber circle, `margin:0 auto 24px`, containing a 28px white check (`stroke-width:2.6`)
- H2 at 30px "Message received."
- 16px muted paragraph `max-width:400px; margin:16px auto 28px`
- Ghost button "Send another message" restores the form

Scroll to top on submit. Add real validation (inline, on blur), a pending button state, and a server error state — the prototype has none of the three.

## 4. Side column

`flex; flex-direction:column; gap:14px`.

**Three contact cards** — white, `border-radius:18px; padding:24px 26px`: 38px dark circle icon (15px white glyph, `margin-bottom:16px`) → title 15.5px/700 → description 13.5px muted `line-height:1.55; margin-top:6px` → value 15px/700 **amber** `margin-top:12px`, `display:inline-block`.

| Icon | Title | Description | Value |
|---|---|---|---|
| ☎ | Talk to sales | For demos, pricing and migration questions. | +30 210 300 4500 |
| ✉ | Support | Existing customers, any question, any plan. | support@orithon.gr |
| ⚑ | Partnerships | Accountants, technicians and software partners. | partners@orithon.gr |

Replace the glyphs with proper stroked icons; make the values real `tel:` / `mailto:` links.

**Support hours card** — dark panel, same padding and radius. Title white 15.5px/700, then rows: `flex; justify-content:space-between; gap:16px; font-size:13.5px; padding:9px 0; border-bottom:1px solid rgba(255,255,255,.1)`; day `rgba(255,255,255,.6)`, hours `font-weight:700`.

Monday – Friday 09:00 – 19:00 · Saturday 10:00 – 14:00 · Emergencies 24 / 7

## 5. Office cards

`1fr 1fr; gap:16px; margin-top:56px` (1 column ≤980px), with the scroll reveal.

White card, `border-radius:18px; overflow:hidden`: media `height:170px` (placeholder fills), then body `padding:22px 24px 24px` — city 17px/800, address 13.5px muted `line-height:1.55; margin-top:8px`.

- **Athens** — Kifisias Avenue 124, Marousi 151 25 — third floor, above the pharmacy.
- **Thessaloniki** — Tsimiski 43, Thessaloniki 546 23 — opening September 2026.

If a real map is wanted later, use static map tiles styled to the warm palette — not a live embed, which would fight the page's colour.
