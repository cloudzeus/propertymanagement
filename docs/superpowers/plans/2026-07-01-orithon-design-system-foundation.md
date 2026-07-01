# Orithon Design System Foundation (S0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the DG/Fluent design tokens and shared UI primitives with the Orithon design language (warm-cream brand, ink/amber/sky accents, Commissioner + Cormorant fonts) as the app-wide default, keeping the runtime brand-override mechanism.

**Architecture:** Remap CSS custom properties in `app/globals.css` (dashboard "calm" defaults + a `.orithon-marketing` scope for the landing), wire Commissioner/Cormorant fonts in `app/layout.tsx`, reseed Orithon brand defaults in `lib/app-settings.ts`, then refactor the shared `components/ui/*` primitives and the sidebar shell from hardcoded Tailwind `slate-*` classes to token-based styling. A dev-only preview route renders every primitive for visual verification. Page-level color cleanup across the 88 `(company)` files is deferred to S2.

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS 4.1 (`@theme`/CSS vars), `next/font/google`, TypeScript, radix primitives, react-icons/ri.

**Verification note:** These are visual CSS components; there is no meaningful unit-test surface. Each task is verified by (a) `npx tsc --noEmit` type-check + `npx eslint <files>` clean, and (b) rendering the `/super-admin/_design` preview route (built in Task 9) and eyeballing the result against the Orithon tokens. Where a task lands before the preview route exists, verify with type-check/lint only and re-check visually after Task 9.

---

## Task 1: Tokens + fonts + seed defaults

**Files:**
- Modify: `app/globals.css` (lines 1–118)
- Modify: `app/layout.tsx` (font imports + `<html>` className)
- Modify: `lib/app-settings.ts` (DEFAULTS colors, ~lines 32–39)

- [ ] **Step 1: Rewrite the token layer in `app/globals.css`**

Replace the whole `:root { … }` block and the `@theme inline { … }` block (top of file, through the `@theme inline` block) with:

```css
@import "tailwindcss";

/* ─── Orithon Design System — Light-only, warm-cream ─────────────────────── */
:root {
  /* Brand colors — overridden by AppSettings via <style> in root layout */
  --color-primary:     #15161a;   /* ink chip — buttons, strong actions */
  --color-primary-dk:  #000000;
  --color-accent:      #F2A23C;   /* amber — primary accent */
  --color-accent-2:    #5BB6D6;   /* sky — secondary accent */
  --color-success:     #2E7D5B;
  --color-warning:     #CA5D00;
  --color-danger:      #C0392B;
  --color-purple:      #8764B8;
  --color-teal:        #038387;

  /* Surfaces */
  --card:              #FFFFFF;
  --card-hover:        #FBFAF5;
  --bg-canvas:         #F6F4EC;   /* soft warm dashboard canvas (flat) */
  --bg-elevated:       #FBFAF5;
  --paper:             #FBFAF5;   /* tile / muted surface */
  --section-alt:       #EFEDE2;

  /* Text */
  --foreground:        #1b1c1a;
  --muted-foreground:  #5b5c58;

  /* Borders */
  --border:            rgba(27,28,26,.12);
  --border-strong:     rgba(27,28,26,.20);

  /* Semantic aliases (used by DataTable, sidebar, buttons) */
  --primary:           var(--color-primary);
  --primary-dk:        var(--color-primary-dk);
  --primary-foreground:#FFFFFF;
  --accent:            var(--color-accent);
  --accent-2:          var(--color-accent-2);
  --destructive:       var(--color-danger);
  --muted:             #EFEDE2;

  /* Sidebar */
  --sidebar-bg:        #FFFFFF;
  --sidebar-border:    rgba(27,28,26,.12);
  --sidebar-width:     240px;
  --sidebar-collapsed: 64px;

  /* Radii */
  --radius:            12px;
  --radius-sm:         8px;
  --radius-lg:         18px;   /* tiles */
  --radius-xl:         22px;   /* photo / quote cards */

  /* Shadows */
  --shadow-card:       0 1px 2px rgba(27,28,26,.04), 0 22px 48px -32px rgba(27,28,26,.28);
  --shadow-btn:        0 14px 30px -16px rgba(21,22,26,.55);

  /* Fonts */
  --font-sans:         var(--font-commissioner, "Segoe UI", system-ui, sans-serif);
  --font-display:      var(--font-cormorant, Georgia, "Times New Roman", serif);
}

@theme inline {
  --color-background:  var(--bg-canvas);
  --color-foreground:  var(--foreground);
  --color-card:        var(--card);
  --color-paper:       var(--paper);
  --color-accent:      var(--accent);
  --color-accent-2:    var(--accent-2);
  --color-primary:     var(--primary);
  --color-border:      var(--border);
  --font-sans:         var(--font-sans);
  --font-display:      var(--font-display);
  --font-mono:         var(--font-geist-mono);
}

/* Marketing scope — opted-in by the landing route wrapper (S1) */
.orithon-marketing {
  --bg-canvas: #F4F2EA;
  background:
    radial-gradient(120% 95% at 0% 0%, #F1EED6, transparent 46%),
    radial-gradient(120% 95% at 100% 0%, #E7F0E0, transparent 48%),
    #F4F2EA;
  background-attachment: fixed;
}
```

Leave the `/* ─── Base ─── */`, scrollbar, and any later rules below `@theme inline` intact (the `body` rule already reads `var(--bg-canvas)` and `var(--font-sans)`, which now resolve to Orithon).

- [ ] **Step 2: Wire fonts in `app/layout.tsx`**

Replace the Geist font imports/instances:

```tsx
import { Geist_Mono, Commissioner, Cormorant_Garamond } from "next/font/google";
```

Replace the `geistSans`/`geistMono` const block with:

```tsx
const commissioner = Commissioner({
  variable: "--font-commissioner",
  subsets: ["latin", "latin-ext", "greek"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin", "latin-ext", "greek"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
```

Update the `<html>` className from `${geistSans.variable} ${geistMono.variable}` to:

```tsx
className={`${commissioner.variable} ${cormorant.variable} ${geistMono.variable} h-full antialiased`}
```

- [ ] **Step 3: Reseed Orithon brand defaults in `lib/app-settings.ts`**

In the `DEFAULTS` object change these values (keep every other field):

```ts
  colorPrimary: "#15161a",
  colorPrimaryDk: "#000000",
  colorAccent: "#F2A23C",
  colorSuccess: "#2E7D5B",
  colorWarning: "#CA5D00",
  colorDanger: "#C0392B",
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no new errors in `app/layout.tsx`, `lib/app-settings.ts`.
Run: `npx eslint app/layout.tsx lib/app-settings.ts`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css app/layout.tsx lib/app-settings.ts
git commit -m "feat(design): Orithon tokens + Commissioner/Cormorant fonts (S0)"
```

---

## Task 2: Button → token-based variants

**Files:**
- Modify: `components/ui/button.tsx` (replace `buttonVariants`)

- [ ] **Step 1: Replace `buttonVariants` with token-based classes**

Replace the entire `const buttonVariants = cva( … )` call with:

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-sm)] text-sm font-semibold transition-[transform,filter,background-color,box-shadow] duration-150 ease-[cubic-bezier(.2,.7,.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[var(--shadow-btn)] hover:-translate-y-px hover:brightness-[1.12]",
        accent:
          "bg-[var(--accent)] text-[var(--foreground)] hover:-translate-y-px hover:brightness-[1.05]",
        destructive:
          "bg-[var(--destructive)] text-white hover:-translate-y-px hover:brightness-[1.08]",
        outline:
          "border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:-translate-y-px hover:bg-[var(--paper)]",
        secondary:
          "border border-[var(--border)] bg-[var(--paper)] text-[var(--foreground)] hover:bg-[var(--card-hover)]",
        ghost:
          "text-[var(--foreground)] hover:bg-[var(--paper)]",
        link:
          "text-[var(--foreground)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-[var(--radius-sm)] px-3 text-xs",
        lg: "h-11 rounded-[var(--radius)] px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
```

Leave the `Button` forwardRef component and exports unchanged.

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit`
Run: `npx eslint components/ui/button.tsx`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/ui/button.tsx
git commit -m "feat(design): token-based Button variants (S0)"
```

---

## Task 3: New Card + Badge components

**Files:**
- Create: `components/ui/card.tsx`
- Create: `components/ui/badge.tsx`

- [ ] **Step 1: Create `components/ui/card.tsx`**

```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-card)]",
        className
      )}
      {...props}
    />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1 p-6", className)} {...props} />
  )
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-lg font-bold tracking-tight text-[var(--foreground)]", className)}
      {...props}
    />
  )
)
CardTitle.displayName = "CardTitle"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
)
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  )
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardTitle, CardContent, CardFooter }
```

- [ ] **Step 2: Create `components/ui/badge.tsx`**

```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-[var(--border)] bg-[var(--paper)] text-[var(--foreground)]",
        accent:
          "border-transparent bg-[color-mix(in_oklab,var(--accent)_20%,var(--card))] text-[var(--foreground)]",
        success:
          "border-transparent bg-[color-mix(in_oklab,var(--color-success)_16%,var(--card))] text-[var(--color-success)]",
        warning:
          "border-transparent bg-[color-mix(in_oklab,var(--color-warning)_16%,var(--card))] text-[var(--color-warning)]",
        danger:
          "border-transparent bg-[color-mix(in_oklab,var(--destructive)_12%,var(--card))] text-[var(--destructive)]",
        kicker:
          "rounded-none border-none bg-transparent px-0 uppercase tracking-[0.14em] text-[var(--muted-foreground)]",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Show an amber dot before the label (eyebrow style). */
  dot?: boolean
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className="h-[7px] w-[7px] rounded-full bg-[var(--accent)]"
          style={{ boxShadow: "0 0 10px rgba(242,162,60,.55)" }}
        />
      )}
      {children}
    </span>
  )
}

export { Badge, badgeVariants }
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit`
Run: `npx eslint components/ui/card.tsx components/ui/badge.tsx`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add components/ui/card.tsx components/ui/badge.tsx
git commit -m "feat(design): Card + Badge primitives (S0)"
```

---

## Task 4: Input + new Textarea

**Files:**
- Modify: `components/ui/input.tsx`
- Create: `components/ui/textarea.tsx`

- [ ] **Step 1: Retheme `components/ui/input.tsx`**

Replace the `className={cn( … )}` first argument (the long slate string) with:

```tsx
        "flex h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50",
```

- [ ] **Step 2: Create `components/ui/textarea.tsx`**

```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Textarea.displayName = "Textarea"

export { Textarea }
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit`
Run: `npx eslint components/ui/input.tsx components/ui/textarea.tsx`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add components/ui/input.tsx components/ui/textarea.tsx
git commit -m "feat(design): retheme Input + add Textarea (S0)"
```

---

## Task 5: Select + Label retheme

**Files:**
- Modify: `components/ui/select.tsx`
- Modify: `components/ui/label.tsx`

- [ ] **Step 1: Retheme SelectTrigger**

In `SelectTrigger`, replace its `className={cn( … )}` first argument with:

```tsx
      "flex h-10 w-full items-center justify-between rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
```

- [ ] **Step 2: Retheme SelectContent**

In `SelectContent`, replace its first `className` argument with:

```tsx
        "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] shadow-[var(--shadow-card)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
```

- [ ] **Step 3: Retheme SelectItem**

In `SelectItem`, replace its first `className` argument with:

```tsx
      "relative flex w-full cursor-pointer select-none items-center rounded-[var(--radius-sm)] py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-[var(--paper)] focus:text-[var(--foreground)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
```

- [ ] **Step 4: Retheme SelectSeparator**

In `SelectSeparator`, replace `"-mx-1 my-1 h-px bg-slate-100 dark:bg-slate-800"` with:

```tsx
    "-mx-1 my-1 h-px bg-[var(--border)]",
```

- [ ] **Step 5: Retheme Label**

In `components/ui/label.tsx`, change the `labelVariants` string to add the token color:

```tsx
const labelVariants = cva(
  "text-sm font-medium leading-none text-[var(--foreground)] peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)
```

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit`
Run: `npx eslint components/ui/select.tsx components/ui/label.tsx`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add components/ui/select.tsx components/ui/label.tsx
git commit -m "feat(design): retheme Select + Label to Orithon tokens (S0)"
```

---

## Task 6: Modal helpers retheme

**Files:**
- Modify: `components/ui/modal.tsx`

- [ ] **Step 1: Round the modal panel + backdrop to tokens**

In the `Modal` component's inner panel `<div>` style, change `borderRadius: 10` to `borderRadius: "var(--radius-lg)"` and `boxShadow: "0 20px 60px rgba(0,0,0,0.2)"` to `boxShadow: "var(--shadow-card)"`. Change the backdrop `background: "rgba(0,0,0,0.45)"` to `background: "rgba(27,28,26,.42)"`.

- [ ] **Step 2: Token the close button + FormField required marker**

In the close `<button>` style change `borderRadius: 6` to `borderRadius: "var(--radius-sm)"` and `background: "var(--bg-canvas)"` to `background: "var(--paper)"`.
In `FormField`, change the required-marker `<span style={{ color: "#dc2626", … }}>` to `color: "var(--destructive)"`.

- [ ] **Step 3: Token the FieldInput / FieldSelect / FieldTextarea radii**

In `FieldInput`, `FieldSelect`, and `FieldTextarea`, change each `borderRadius: 6` to `borderRadius: "var(--radius-sm)"` and each disabled `background: "var(--bg-canvas)"` to `background: "var(--paper)"`.

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit`
Run: `npx eslint components/ui/modal.tsx`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add components/ui/modal.tsx
git commit -m "feat(design): retheme Modal + form helpers (S0)"
```

---

## Task 7: Sidebar shell retheme (neutrals only)

**Files:**
- Modify: `components/admin/sidebar-nav.tsx`

Scope: convert hardcoded neutral surfaces/hovers to Orithon tokens. Leave the per-item `item.color` / `group.color` rainbow accents as-is (that palette decision belongs to S2).

- [ ] **Step 1: Token the hover backgrounds**

Replace every occurrence of the hardcoded hover color `"#F3F2F1"` with `"var(--paper)"` in this file (appears in group-header `onMouseEnter`, item `onMouseEnter`, and the `iconBtnStyle` base `background`). Use find/replace for the literal `#F3F2F1`.

- [ ] **Step 2: Token the footer + user card**

In the footer `<div>` (around line 500) change `background: "#FAFAFA"` to `background: "var(--paper)"`.
In the user card `<div>` (around line 508) change `background: "#DEECF9", border: "1px solid #A3CEEE"` to `background: "var(--card)", border: "1px solid var(--border)"`.
Change the user name `color: "#201F1E"` to `color: "var(--foreground)"` and the role `color: "#707070"` to `color: "var(--muted-foreground)"`.

- [ ] **Step 3: Token the logout hover + iconBtn text**

In the logout button, change the hover `color: "#A4262C"` / `background: "#FEE7E6"` to `color: "var(--destructive)"` / `background: "color-mix(in oklab, var(--destructive) 10%, var(--card))"`, and the mouse-leave `color: "#8A8A8A"` / `background: "#F3F2F1"` to `color: "var(--muted-foreground)"` / `background: "var(--paper)"`.
In `iconBtnStyle` change `color: "#5C5C5C"` to `color: "var(--muted-foreground)"`.

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit`
Run: `npx eslint components/admin/sidebar-nav.tsx`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add components/admin/sidebar-nav.tsx
git commit -m "feat(design): retheme sidebar shell neutrals to Orithon tokens (S0)"
```

---

## Task 8: DataTable verification + radius polish

**Files:**
- Modify: `components/ui/data-table.tsx` (radius literals only)

The DataTable already consumes `var(--card)`, `var(--border)`, `var(--primary)`, `var(--foreground)`, `var(--muted)`, `var(--destructive)`, `var(--primary-foreground)` — it rethemes automatically. Only polish the small hardcoded `borderRadius: 4` literals.

- [ ] **Step 1: Bump the container + control radii**

Find the outer table container style with `border: "1px solid var(--border)"` near the top of the render (around line 284) and ensure it uses `borderRadius: "var(--radius)"` (add or change to it if a numeric literal is present). Change the search input `borderRadius: 4` (around line 309) and the column-menu button/menu `borderRadius` numeric literals to `"var(--radius-sm)"`. Do not change anything referencing `var(--primary)` selection logic.

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit`
Run: `npx eslint components/ui/data-table.tsx`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/ui/data-table.tsx
git commit -m "chore(design): DataTable radius polish for Orithon (S0)"
```

---

## Task 9: Design preview route

**Files:**
- Create: `app/(company)/super-admin/_design/page.tsx`

- [ ] **Step 1: Create the preview page**

```tsx
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const SWATCHES = [
  ["--bg-canvas", "canvas"], ["--card", "card"], ["--paper", "paper"],
  ["--section-alt", "section-alt"], ["--primary", "primary"], ["--accent", "accent"],
  ["--accent-2", "accent-2"], ["--foreground", "foreground"], ["--muted-foreground", "muted"],
  ["--color-success", "success"], ["--color-warning", "warning"], ["--destructive", "danger"],
] as const;

export default function DesignPreviewPage() {
  return (
    <div style={{ padding: 40, maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 40 }}>
      <div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 48, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
          Orithon
        </h1>
        <p style={{ color: "var(--muted-foreground)", marginTop: 4 }}>
          Design system preview — Commissioner body, Cormorant display.
        </p>
      </div>

      <section>
        <Badge variant="kicker">Colors</Badge>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginTop: 12 }}>
          {SWATCHES.map(([v, label]) => (
            <div key={v}>
              <div style={{ height: 56, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: `var(${v})` }} />
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <Button>Default</Button>
        <Button variant="accent">Accent</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
      </section>

      <section style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <Badge dot>Live</Badge>
        <Badge variant="accent">Accent</Badge>
        <Badge variant="success">Paid</Badge>
        <Badge variant="warning">Pending</Badge>
        <Badge variant="danger">Overdue</Badge>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <CardHeader><CardTitle>Sample card</CardTitle></CardHeader>
          <CardContent style={{ color: "var(--muted-foreground)" }}>
            White surface, warm border, soft elevation.
          </CardContent>
        </Card>
        <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <Label htmlFor="d-in">Input</Label>
            <div style={{ marginTop: 6 }}><Input id="d-in" placeholder="Type here…" /></div>
          </div>
          <div>
            <Label htmlFor="d-ta">Textarea</Label>
            <div style={{ marginTop: 6 }}><Textarea id="d-ta" placeholder="Notes…" /></div>
          </div>
        </Card>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit`
Run: `npx eslint "app/(company)/super-admin/_design/page.tsx"`
Expected: clean.

- [ ] **Step 3: Visual verification**

Run: `npm run dev`
Visit: `http://localhost:3000/super-admin/_design` (log in as a SUPER_ADMIN if required by the route group's auth).
Expected: cream canvas, Cormorant "Orithon" heading, ink primary button with amber focus ring, amber accent button, warm-bordered cards/inputs, all 12 color swatches correct. Note any mismatch and fix the offending token/component before committing.

- [ ] **Step 4: Commit**

```bash
git add "app/(company)/super-admin/_design/page.tsx"
git commit -m "feat(design): Orithon primitives preview route (S0)"
```

---

## Task 10: Full build verification

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: build succeeds with no type errors. If `next build` surfaces errors from pre-existing page-level `slate-*` usage, confirm they are pre-existing (not introduced by S0) — S0 does not touch those pages. Fix only regressions caused by this plan.

- [ ] **Step 2: Regression spot-check**

Run: `npm run dev` and visit `/super-admin/users` (an existing DataTable page).
Expected: table renders in Orithon tokens (warm borders, ink controls) with no broken interaction (search, column menu, row selection).

- [ ] **Step 3: Final commit (if any fixes)**

```bash
git add -A
git commit -m "fix(design): S0 build/regression fixes"
```

---

## Notes for the executor

- **No dark mode:** the app is light-only; drop any `dark:` variants you touch (as done in the primitives above).
- **Do not** convert page-level `slate-*`/`blue-*` colors in the 88 `(company)` files — that is S2. Mixed appearance on un-migrated pages is expected.
- **ACaslon later:** `--font-display` currently resolves to Cormorant Garamond; swapping in real ACaslon later only touches `app/layout.tsx` + the `--font-cormorant`/`--font-display` wiring — no consumer changes.
- **Marketing scope** (`.orithon-marketing`) is defined but unused until S1.
