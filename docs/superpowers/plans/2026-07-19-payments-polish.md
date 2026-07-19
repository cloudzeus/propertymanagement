# Payments Polish (print + actions + floor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Fix the blank-page print, move receipts out of the actions dropdown into per-line links, add a consolidated «όλα τα ακίνητα» action + keep the single-property analysis, and add an Όροφος column to the payments DataTable.

**Architecture:** Replace the fragile `.statement-print-root` visibility print trick with a body-level **print portal** (`display:none` on screen, shown in `@media print`). Carry per-expense `receiptUrl` through the statement lines and render an απόδειξη link per line in the ΑΝΑΛΥΣΗ. Build the consolidated modal client-side from the existing `rows`. Add `floor` to `PaymentRow`.

**Tech Stack:** Next.js 16 client components, Prisma 7, DataTable, Orithon tokens, react-icons/ri.

Conventions: branch `main`; stage only touched files; trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Ignore pre-existing failures: vitest `lib/cms/landing-types.test.ts`; tsc `app/actions/auth.ts`, `lib/otp.ts`, `prisma.config.ts`, `prisma/seed.ts`, `app/api/super-admin/costs/*`, `components/forms/ForgotPasswordForm.tsx`.

Current facts: print CSS in `app/globals.css` (@media print, lines ~159-181) uses `.statement-print-root { position:absolute; inset:0 }` + visibility — blank inside the fixed/centered `ModalShell` because absolute is relative to the modal and clipped. `UnitStatementDocument` wraps in `.statement-print-root` when `showPrintRoot`. Statement group line type: `UnitStatementGroup.lines = { id, categoryName, amount }[]` (no receiptUrl). PaymentsTable dropdown currently lists receipts.

---

### Task 1: Robust print via a body-level print portal

**Files:** Create `components/ui/print-area.tsx`; modify `app/globals.css`; modify `components/dashboard/PaymentsTable.tsx`, `components/building/occupant-shell/StatementView.tsx`, `components/building/occupant-shell/UnitStatementDocument.tsx`.

- [ ] **Step 1:** `components/ui/print-area.tsx` (client):

```tsx
"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Renders `children` into a body-level container that is hidden on screen and
 *  the ONLY thing shown when printing (see the `.print-area` rules in globals.css).
 *  Body-level + normal flow → no modal clipping, reliable A4 output. */
export function PrintArea({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(<div className="print-area">{children}</div>, document.body);
}
```

- [ ] **Step 2:** `app/globals.css` — REPLACE the `@media print` block (lines ~159-181) with a display-based rule keyed on `.print-area` (drop the old `.statement-print-root` positioning trick):

```css
@media print {
  @page { size: A4; margin: 12mm; }
  body > *:not(.print-area) { display: none !important; }
  .print-area { display: block !important; background: #fff; color: #000; font-size: 10pt; }
  .print-area { --card:#fff; --bg-canvas:#fff; --paper:#fff; --foreground:#000; --muted-foreground:#333; --border:#000; --border-strong:#000; }
  .print-area [data-boxed], .print-area table, .print-area th, .print-area td { border-color:#000 !important; }
  .print-area [data-boxed] { break-inside: avoid; }
  .print-area tr { break-inside: avoid; }
  .print-area .no-print { display: none !important; }
}
.print-area { display: none; }
```
(`.print-area { display:none }` outside the media query hides it on screen; the `@media print` `display:block !important` wins when printing.)

- [ ] **Step 3:** `UnitStatementDocument.tsx`: drop `showPrintRoot` and the `.statement-print-root` wrapper — always render the plain document (the `PrintArea` provides the print context now). Remove the prop and its references. Keep `data-boxed` on the boxed containers so the print border rule targets them (add `data-boxed` to the boxed `<div>`s if not present).
- [ ] **Step 4:** `StatementView.tsx`: keep the on-screen `<UnitStatementDocument>` for viewing; add `<PrintArea><UnitStatementDocument … /></PrintArea>` rendering the currently-selected statement; the existing print button keeps calling `window.print()`. Remove any `showPrintRoot`/`.statement-print-root` usage.
- [ ] **Step 5:** `PaymentsTable.tsx`: the modal body renders `<UnitStatementDocument>` for viewing (no print-root); add a `<PrintArea>` (outside `ModalShell`) that renders the active modal's document so the modal's print button prints reliably.
- [ ] **Step 6:** `npx tsc --noEmit 2>&1 | grep -E "print-area|UnitStatementDocument|StatementView|PaymentsTable"` → empty; `npm run build`. Manual note: printing the account modal now yields the notice, not a blank page. Commit `fix(print): body-level print portal for statements (fixes blank page)`.

---

### Task 2: Per-line receipts in the analysis (out of the dropdown)

**Files:** `lib/building/statement.ts`, `lib/building/occupant-data.ts`, `lib/dashboard/payment-statements.ts`, `components/building/occupant-shell/UnitStatementDocument.tsx`, `components/dashboard/PaymentsTable.tsx`.

- [ ] **Step 1:** `statement.ts`: add `receiptUrl?: string | null` to `UnitStatementInput` and to `UnitStatementGroup.lines` item type; in `buildUnitStatement` carry it: `g.lines.push({ id: r.id, categoryName: r.categoryName, amount: r.amount, receiptUrl: r.receiptUrl ?? null })`. Existing tests still pass (extra optional field).
- [ ] **Step 2:** `occupant-data.ts` + `payment-statements.ts`: when building each `UnitStatementInput`, set `receiptUrl: e.receiptFile?.url ?? null` (both already select `receiptFile`/`receiptFile.url` for the expense — verify; add to the select if missing).
- [ ] **Step 3:** `UnitStatementDocument.tsx`: in the ΑΝΑΛΥΣΗ ΔΑΠΑΝΩΝ group table, add a trailing cell per line: when `l.receiptUrl`, an anchor icon (`RiFileTextLine`, target=_blank, title «Απόδειξη») ~34px; else «—» muted. Header cell «Απόδειξη» (narrow, right). `no-print` on the receipt column so the printed notice stays clean (or keep — decide: hide in print via `.no-print`).
- [ ] **Step 4:** `PaymentsTable.tsx`: REMOVE the receipt entries from `getRowActions` (drop the `...r.receiptUrls.map(...)`). Receipts now live in the expanded analysis per line.
- [ ] **Step 5:** `npx tsc --noEmit` filtered empty; `npx vitest run` (only pre-existing failure); `npm run build`. Commit `feat(payments): per-line receipt links in the analysis, out of the actions menu`.

---

### Task 3: Consolidated action + property analysis + Όροφος column

**Files:** `lib/dashboard/payment-statements.ts` (add `floor`), `components/dashboard/PaymentsTable.tsx`.

- [ ] **Step 1:** `payment-statements.ts`: add `floor: number | null` to `PaymentRow` (unit already selects `floor` — thread it through).
- [ ] **Step 2:** `PaymentsTable.tsx` columns: add an **Όροφος** column after Μονάδα — `cell: r => r.floor ?? "—"`, `accessor: r => r.floor ?? ""`, small width, `defaultVisible: true`.
- [ ] **Step 3:** Dropdown actions become exactly:
  - `{ label: "Ανάλυση ακινήτου", icon: <RiFileTextLine/>, onClick: () => setModal({ kind: "unit", row: r }) }` (the single-unit notice — was «Προβολή λογαριασμού»).
  - `{ label: "Συνολικό — όλα τα ακίνητα", icon: <RiStackLine/>, onClick: () => setModal({ kind: "all", month: r.month }) }`.
  - `{ label: "Πλήρες control center", icon: <RiExternalLinkLine/>, onClick: () => router.push(`/building/${r.buildingId}?s=koino&month=${r.month}&unit=${r.unitId}`) }`.
  Change `modal` state to a union `{ kind: "unit"; row } | { kind: "all"; month } | null`.
- [ ] **Step 4:** Consolidated modal (`kind: "all"`): title «Συνολικό ειδοποιητήριο · {monthLabel(month)}». Body = a `data-boxed` table built from `rows.filter(r => r.month === month)`: columns Ακίνητο · Μονάδα · Όροφος · Πληρωτέο (`r.myAmount`, tabular) · Κατάσταση (same badge logic). Footer grand-total row: **Σύνολο πληρωτέο** = Σ `myAmount`, plus a split line Ιδιοκτήτη (Σ statement.ownerTotal for owner-relevant) / Ενοίκου when meaningful — keep to Σύνολο πληρωτέο + count of units to stay clear. Printable via the same `<PrintArea>` (render the consolidated table when `kind==="all"`). Print button in the modal footer.
- [ ] **Step 5:** The `<PrintArea>` renders whichever is active: the single `UnitStatementDocument` for `kind:"unit"`, or the consolidated table for `kind:"all"`.
- [ ] **Step 6:** `npx tsc --noEmit` filtered empty; `npm run build`. Commit `feat(payments): consolidated all-properties action + floor column`.

---

### Task 4: Verify + ship

- [ ] `npx vitest run`; `npx tsc --noEmit`; `npm run build` — green modulo documented.
- [ ] Dev smoke `/owner/payments`: Όροφος column shows; expand analysis has per-line απόδειξη links; dropdown = Ανάλυση ακινήτου / Συνολικό όλα τα ακίνητα / control center (NO receipts); «Ανάλυση ακινήτου» modal prints a real A4 notice (not blank); «Συνολικό» modal lists all units for the month + total, prints. `/portal/payments` same.
- [ ] Grep: `.statement-print-root` no longer referenced anywhere (replaced by `.print-area`); confirm control-center statement (`/building/[id]?s=koino`) still prints via PrintArea.
- [ ] Final review agent (print correctness, no regressions to control-center statement, isolation, a11y); fix; update memory; push to GitHub main.
