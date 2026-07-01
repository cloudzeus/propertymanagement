# S0 — Orithon Design System Foundation

**Date:** 2026-07-01
**Status:** Approved design, pending implementation plan
**Part of:** Orithon full-rebrand program (S0 foundation → S1 landing → S2 manager dashboard → S3 resident portal → S4 owner dashboard)

## Goal

Replace the current DG/Fluent design tokens and shared UI primitives with the **Orithon** design language (warm-cream brand, ink/amber/sky accents, Commissioner + Cormorant fonts) as the new default for the whole app — while **keeping** the per-install runtime brand-override mechanism. S0 delivers the *foundation only*: tokens, fonts, and the shared component library. Rebuilding landing sections and cleaning page-level hardcoded colors happen in later sub-projects.

## Decisions (locked)

- **Full rebrand** — Orithon becomes THE design system.
- **Calm data-adaptation** for dashboards: Orithon brand colors/accents, but a softer neutral canvas, Commissioner (not the display serif) for UI text, tighter spacing/radii. The full cream-gradient marketing look is reserved for a `.orithon-marketing` scope used by the landing (S1).
- **Keep runtime theming** via `buildBrandCss` → `<style>` in `layout.tsx`; only the *defaults* change to Orithon.
- **Display font:** ACaslon Pro not licensed/available → use **Cormorant Garamond** (`next/font/google`) as `--font-display` substitute. Swap to real ACaslon later without touching consumers (they reference `--font-display`).

## Architecture

### 1. Token layer — `app/globals.css`

Preserve the existing two-layer structure:
- `:root { … }` raw-token defaults (edited to Orithon values below).
- Runtime override: `buildBrandCss(settings)` injected as `<style>{:root{…}}` in `layout.tsx` (unchanged mechanism; Orithon values become the seeded defaults in `AppSettings`).

**Dashboard (default) token values:**

| Token | Old (DG) | New (Orithon calm) |
|---|---|---|
| `--bg-canvas` | `#F3F2F1` | `#F6F4EC` (soft warm, flat — no radial) |
| `--card` | `#FFFFFF` | `#FFFFFF` |
| `--card-hover` | `#F8F8F8` | `#FBFAF5` (paper) |
| `--bg-elevated` | `#FAFAFA` | `#FBFAF5` |
| `--paper` | — (new) | `#FBFAF5` |
| `--foreground` | `#201F1E` | `#1b1c1a` |
| `--muted-foreground` | `#707070` | `#5b5c58` (ink-mut, solid for legibility) |
| `--border` | `#E1DFDD` | `rgba(27,28,26,.12)` |
| `--border-strong` | `#C8C6C4` | `rgba(27,28,26,.2)` |
| `--muted` | `#F3F2F1` | `#EFEDE2` (section-alt) |
| `--radius` | `8px` | `12px` |
| `--radius-sm` | `4px` | `8px` |

**Brand / semantic tokens:**

| Token | New value | Purpose |
|---|---|---|
| `--color-primary` / `--primary` | `#15161a` (ink chip) | primary buttons, strong actions, DataTable controls |
| `--primary-foreground` | `#ffffff` | text on primary |
| `--color-accent` / `--accent` | `#F2A23C` (amber) | highlights, active indicators, accent button, kicker dot |
| `--accent-2` | `#5BB6D6` (sky) | secondary accent |
| `--color-success` | `#2E7D5B` | warm-harmonized |
| `--color-warning` | `#CA5D00` | kept |
| `--color-danger` / `--destructive` | `#C0392B` | warm-harmonized |

Note: current `AppSettings.colorAccent` default (`#E31E2A`) reseeds to `#F2A23C`; `colorPrimary` (`#0078D4`) → `#15161a`. Update the seed defaults so `buildBrandCss` emits Orithon values (existing installs keep their DB overrides — acceptable; a follow-up migration to reset to Orithon can be decided in S2).

**Shadows / radii additions** (as CSS vars for reuse):
```
--shadow-card:   0 1px 2px rgba(27,28,26,.04), 0 22px 48px -32px rgba(27,28,26,.28);
--shadow-btn:    0 14px 30px -16px rgba(21,22,26,.55);
--radius-lg:     18px;   /* tiles */
--radius-xl:     22px;   /* photo/quote cards */
```

**Marketing scope** — a `.orithon-marketing` class (applied on the landing route wrapper in S1) that overrides `--bg-canvas` to the cream radial-gradient background and sets display headings to `--font-display`. Defined here (empty-ish placeholder + gradient), consumed in S1.

Also expose Orithon colors to Tailwind utilities via the existing `@theme inline` block (`--color-accent`, `--color-paper`, etc.) so `bg-accent`, `text-accent`, `bg-paper` classes work.

### 2. Fonts — `app/layout.tsx`

- `Commissioner` (`next/font/google`, weights 400 500 600 700 800 900, subsets latin + latin-ext for Greek? — Commissioner supports Greek; include `greek` subset) → CSS var `--font-commissioner`, wired to `--font-sans`. Replaces Geist as the UI/body font.
- `Cormorant_Garamond` (`next/font/google`, weights 500 600 700) → `--font-display`. Used only by brand wordmark, landing display headings, and quote-mark (all in S1); dashboards keep `--font-sans`.
- Keep `Geist_Mono` as `--font-mono` (code/mono usage) — no need to churn it.
- `body { font-family: var(--font-sans) }` already resolves via `--font-sans`; ensure `--font-sans` now points at Commissioner.

### 3. Shared primitives (`components/ui/`)

Convert to token-based so the whole app rethemes centrally:

- **`button.tsx`** — rewrite `buttonVariants`:
  - `default`: `bg-[var(--primary)] text-[var(--primary-foreground)]` + `--shadow-btn`, hover `brightness(1.12) translateY(-1px)`, transition `.18s cubic-bezier(.2,.7,.3,1)`.
  - `accent`: amber bg, ink text.
  - `outline`: warm border, `bg-card`, hover `bg-paper`.
  - `ghost`: transparent, hover `bg-paper`.
  - `secondary`: `bg-paper` + border.
  - `destructive`: `bg-[var(--destructive)]` white text.
  - `link`: foreground, underline on hover.
  - sizes: `sm` h-8, `default` h-10, `lg` h-11, `icon` square. radius `--radius`.
- **`card.tsx`** (new): white surface, `--radius-lg`, `--shadow-card`, `1px --border`. Sub-parts `CardHeader/CardTitle/CardContent/CardFooter` optional-lite.
- **`badge.tsx`** (new): variants `default` (paper chip), `accent` (amber-tint), `success/warning/danger` (tinted via color-mix), plus `kicker` (uppercase 13px 700, letter-spacing .14em, muted) and `eyebrow` (white pill + amber dot).
- **`input.tsx`, `select.tsx`, `label.tsx`, `textarea.tsx`** (add textarea if missing): warm `--border`, `bg-card`, focus ring `--primary` (or `--accent`), `--radius-sm`.
- **`modal.tsx`**: surfaces → `--card`, overlay warm ink scrim, `--radius-lg`, `--shadow-card`.
- **`data-table.tsx`**: already var-consuming — verify visually after remap; only adjust radius (`4`→ tokens) and header tint if needed. No structural change.

### 4. Sidebar shell

Retheme the existing `SidebarNav`/dashboard shell to Orithon: `--sidebar-bg` stays white (or `--paper`), warm border, nav item hover `bg-paper`, **active item** = ink text + amber left-accent bar (or amber-tinted pill) — decided during implementation against the live component. Token-driven, no layout change.

### 5. Preview route (verification harness)

`app/(company)/super-admin/_design/page.tsx` — a dev/admin-only page rendering every primitive in all variants/states (buttons, badges, inputs, select, card, modal trigger, a sample DataTable, sidebar swatch, color swatches, type scale). This is how we visually confirm S0 before S2 touches 88 pages. Not linked in nav (direct URL).

## Out of scope for S0

- Rebuilding landing sections / marketing components → **S1**.
- Converting page-level hardcoded `slate-*`/`blue-*` colors across the 88 `(company)` files → **S2**.
- Resident portal / owner dashboards → **S3 / S4**.
- Real ACaslon font swap (drop-in later; consumers already use `--font-display`).

## Error handling & edge cases

- **Existing installs with DB brand overrides**: `buildBrandCss` still wins over defaults — they keep custom colors until an explicit reset. Documented, not auto-migrated in S0.
- **Greek glyphs**: Commissioner + Cormorant Garamond both ship Greek subsets; include `greek` subset so `el` copy renders in-brand.
- **Font flash**: rely on `next/font` self-hosting + `display: swap` default; acceptable.
- **Hardcoded-color pages** will look mixed (new tokens + old slate) until S2 — expected and bounded; the preview route reflects only the corrected primitives.

## Testing / verification

Primarily visual (CSS/design):
1. `npm run build` passes (type-check + lint clean for changed files).
2. `/super-admin/_design` renders all primitives without errors; manual visual check against Orithon tokens (colors, radii, shadows, fonts).
3. Spot-check one existing DataTable-using page (e.g. `super-admin/users`) confirms it rethemes via variables with no regression in interaction.
4. Language toggle / Greek copy renders in Commissioner.

## Files touched (S0)

- `app/globals.css` — token remap, new vars, `.orithon-marketing` scope, `@theme` exposure.
- `app/layout.tsx` — Commissioner + Cormorant fonts, `--font-sans` rewire.
- `lib/app-settings.ts` — Orithon seed defaults for brand colors (keep mechanism).
- `components/ui/button.tsx` — rewrite variants (token-based).
- `components/ui/card.tsx`, `components/ui/badge.tsx`, `components/ui/textarea.tsx` — new.
- `components/ui/input.tsx`, `select.tsx`, `label.tsx`, `modal.tsx` — retheme.
- `components/ui/data-table.tsx` — verify + minor radius tweak.
- Sidebar shell component — retheme.
- `app/(company)/super-admin/_design/page.tsx` — new preview route.
