# Payments Grid — Per-Unit Rows with Totals + Pay Button

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Collapse `/owner/payments` + `/portal/payments` from one row per (unit×month) to **one row per unit** showing totals + a «Πληρωμή» button; move the per-month ειδοποιητήριο analysis into the expand.

**Architecture:** Group the existing per-(unit,month) `PaymentRow[]` into `UnitPaymentRow[]` (total outstanding, months[]), resolve per-building `payEnabled`, and rebuild `PaymentsTable` columns + expand + a pay button that hits `/api/koinochrista/pay`.

**Tech Stack:** Next.js 16, DataTable, Orithon tokens, react-icons/ri, vitest.

Conventions: branch `main`; stage only touched files; trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Ignore pre-existing failures (auth.ts, otp.ts, prisma.config.ts, seed.ts, costs routes, ForgotPasswordForm, landing-types.test).

Facts: `lib/dashboard/payment-statements.ts` has `PaymentRow { id, buildingId, buildingName, unitId, unitNumber, floor, month, myAmount, myPaid, unitTotal, lines, statement, receiptUrls, heatingReadings }` + `getOwnerPaymentRows`/`getResidentPaymentRows`. `components/dashboard/PaymentsTable.tsx` currently DataTable of PaymentRow (columns Μήνας/Ακίνητο/Μονάδα/Όροφος/Το μερίδιό μου/Κατάσταση; expand = UnitStatementDocument; actions = Ανάλυση/Συνολικό/control center). `lib/payments/koinochrista-pay.ts` `getPropertyVivaConfig(buildingId)` + `isKoinochristaPayEnabled(cfg)`. Pay route `POST /api/koinochrista/pay { buildingId, unitId }` → `{ checkoutUrl }` (503 when disabled). `components/building/occupant-shell/UnitStatementDocument.tsx`. `app/(customer)/{owner,portal}/payments/page.tsx`.

---

### Task 1: Per-unit grouping (TDD) + payEnabled

**Files:** `lib/dashboard/payment-statements.ts` (append) + `lib/dashboard/payment-statements.test.ts` (create if none — else append).

- [ ] **Step 1:** Failing test for a pure grouping helper:
```ts
import { describe, it, expect } from "vitest";
import { groupRowsByUnit, type PaymentRowLike } from "./payment-statements";

const r = (o: Partial<PaymentRowLike>): PaymentRowLike => ({
  id: "x", unitId: "u1", buildingId: "b", buildingName: "B", unitNumber: "1", floor: 1,
  month: "2026-06", myAmount: 0, myPaid: true, ...o,
});

describe("groupRowsByUnit", () => {
  it("one row per unit; sums outstanding (unpaid myAmount) and total", () => {
    const g = groupRowsByUnit([
      r({ id: "a", unitId: "u1", month: "2026-06", myAmount: 0, myPaid: true }),
      r({ id: "b", unitId: "u1", month: "2025-04", myAmount: 156.23, myPaid: false }),
      r({ id: "c", unitId: "u2", month: "2026-06", myAmount: 47.55, myPaid: false }),
    ]);
    expect(g.length).toBe(2);
    const u1 = g.find((x) => x.unitId === "u1")!;
    expect(u1.outstanding).toBe(156.23);
    expect(u1.total).toBe(156.23);
    expect(u1.months.length).toBe(2);
    expect(g.find((x) => x.unitId === "u2")!.outstanding).toBe(47.55);
  });
});
```
- [ ] **Step 2:** Run → FAIL. Implement in `payment-statements.ts`:
```ts
export type PaymentRowLike = { id: string; unitId: string; buildingId: string; buildingName: string; unitNumber: string; floor: number | null; month: string; myAmount: number; myPaid: boolean };

export type UnitPaymentRow<R extends PaymentRowLike = PaymentRowLike> = {
  id: string; unitId: string; buildingId: string; buildingName: string; unitNumber: string; floor: number | null;
  outstanding: number; total: number; paid: boolean; months: R[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;
export function groupRowsByUnit<R extends PaymentRowLike>(rows: R[]): UnitPaymentRow<R>[] {
  const by = new Map<string, UnitPaymentRow<R>>();
  for (const row of rows) {
    let u = by.get(row.unitId);
    if (!u) { u = { id: row.unitId, unitId: row.unitId, buildingId: row.buildingId, buildingName: row.buildingName, unitNumber: row.unitNumber, floor: row.floor, outstanding: 0, total: 0, paid: true, months: [] }; by.set(row.unitId, u); }
    u.months.push(row);
    u.total += row.myAmount;
    if (!row.myPaid) { u.outstanding += row.myAmount; u.paid = false; }
  }
  return [...by.values()].map((u) => ({ ...u, outstanding: r2(u.outstanding), total: r2(u.total),
    months: [...u.months].sort((a, b) => b.month.localeCompare(a.month)) }));
}
```
- [ ] **Step 3:** Run → PASS. Commit `feat(payments): per-unit grouping helper for the payments grid`.

---

### Task 2: PaymentsTable → per-unit rows + pay button

**Files:** `components/dashboard/PaymentsTable.tsx`; `app/(customer)/owner/payments/page.tsx`, `app/(customer)/portal/payments/page.tsx`.

- [ ] **Step 1:** Pages: after fetching `rows` (PaymentRow[]), resolve `payEnabledByBuilding`: for each distinct `buildingId`, `isKoinochristaPayEnabled(await getPropertyVivaConfig(buildingId))` (Promise.all over the distinct set). Pass `rows` + `payEnabledByBuilding: Record<string,boolean>` to `PaymentsTable` (still `side`/`title`). (Import from `@/lib/payments/koinochrista-pay`.)
- [ ] **Step 2:** `PaymentsTable`: `const unitRows = groupRowsByUnit(rows)`. Feed `unitRows` to DataTable. Columns:
  - Ακίνητο (`buildingName`), Μονάδα (`unitNumber`), Όροφος (`floor ?? "—"`), **Συνολική οφειλή** (`outstanding`, tabular, warning when >0), Κατάσταση (`outstanding===0 && total>0` → success «Εξοφλημένο»; `outstanding>0` → warning «Οφειλή {outstanding}»; `total===0` → neutral «Καμία οφειλή»).
  - **pay column** (id "pay", header ""): when `outstanding>0`: `payEnabledByBuilding[r.buildingId]` ? a primary button «Πληρωμή {outstanding}» (onClick → `pay(r.buildingId, r.unitId)`) : a disabled button «Σύντομα» (title «Το Viva της ιδιοκτησίας δεν έχει ρυθμιστεί»). When `outstanding===0`: «—» or nothing.
  - StatTiles top: Σύνολο οφειλών (Σ outstanding), Σύνολο χρεώσεων (Σ total). Plus a «Πληρωμή όλων {totalOutstanding}» button when >1 unit owes AND all-owing buildings are payEnabled (or per-building; simplest: a top button that pays the FIRST owing building's all-units via `/api/koinochrista/pay { buildingId }` — since owner units may span buildings, render one «Πληρωμή όλων» per building that owes; keep simple: show per-building pay-all only when a building has >1 owing unit).
  - **expandedContent**: for the unit, render each month's analysis: `r.months.filter(m=>true).map(m => <section><h4>{monthLabel(m.month)} — {statusChip}</h4><UnitStatementDocument statement={m.statement} month={m.month} building={{name:m.buildingName}} heatingReadings={m.heatingReadings}/></section>)`. This is the per-month ειδοποιητήριο analysis in the expand.
  - **getRowActions**: keep «Συνολικό — όλα τα ακίνητα» + «Πλήρες control center» (drop the per-unit «Ανάλυση» — it's in the expand now).
- [ ] **Step 3:** `pay(buildingId, unitId?)`: `const res = await fetch("/api/koinochrista/pay", { method:"POST", headers:{'content-type':'application/json'}, body: JSON.stringify({ buildingId, unitId }) }); const j = await res.json(); if (res.ok && j.checkoutUrl) window.location.href = j.checkoutUrl; else if (res.status===503) setNotice("Οι online πληρωμές δεν είναι ακόμη διαθέσιμες"); else setNotice("Σφάλμα πληρωμής");`. Loading state on the button.
- [ ] **Step 4:** `npx tsc --noEmit 2>&1 | grep -E "PaymentsTable|payments"` empty; `npm run build`; `npx vitest run` (only pre-existing landing-types failure). Commit `feat(payments): per-unit totals grid with pay button; analysis in expand`.

---

### Task 3: Verify + review + ship

- [ ] vitest/tsc/build green modulo documented.
- [ ] Live tsx for Λυδία: `groupRowsByUnit(getOwnerPaymentRows(...))` → 3 rows; unit 3 outstanding 47.55+…; unit 1/2 with 2025-04 debts; totals match the €483,65 stat.
- [ ] Dev smoke: `/owner/payments` shows 3 rows, «Πληρωμή» disabled «Σύντομα» (Viva unconfigured); expand shows per-month ειδοποιητήρια; `/portal/payments` same.
- [ ] Review (grouping correctness, pay-gating per building, no client-trusted amount — pay route recomputes server-side, analysis intact in expand, a11y). Update memory; push.
