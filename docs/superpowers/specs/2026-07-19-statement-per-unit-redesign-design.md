# Ειδοποιητήριο Redesign — per-unit, owner/tenant analysis — Design

**Date:** 2026-07-19 · **Status:** Approved by user

## Problem

The occupant statement (`/building/[id]?s=koino`) aggregates all of a multi-unit owner's units
into one «Η αναλογία μου» column and never shows the owner-vs-tenant split. A real ειδοποιητήριο
(reference photo) is **per apartment**: analysis of expenses by group, the apartment's χιλιοστά per
group, the ποσό αναλογίας, and the split between owner and tenant. Design and print are also weak.

## Decisions (user-approved)

1. **Per unit, one at a time** + unit selector when the viewer has >1 unit in the building.
2. **Full analysis per group Α-Ε**: category lines + building total, the unit's applied χιλιοστά,
   the ποσό αναλογίας, and the owner/tenant split (columns).
3. **Classic A4 print** — black-and-white, boxed, header with πολυκατοικία/μήνας/διαμέρισμα,
   manager name + payment-days note + signature line, fit-to-page.

## Architecture

### 1. Data — `lib/building/statement.ts` + `lib/building/occupant-data.ts`

Replace the single aggregated statement with **one statement per unit**. New pure builder in
`statement.ts`:

```ts
export type UnitStatementExpense = StatementExpense & { unitAmount, unitTenant, unitOwner };
export type UnitStatementGroup = {
  key, label, buildingTotal,           // Σ building amounts in the group
  lines: { id, categoryName, amount }[], // building-level lines (the ΑΝΑΛΥΣΗ)
  unitAmount, unitTenant, unitOwner,   // this unit's αναλογία + split
};
export type UnitStatement = {
  unitId, unitNumber, unitType, floor,
  role: "OWNER" | "RESIDENT" | "BOTH",     // viewer's relation to this unit
  millesimes, millesimesElevator, millesimesHeating,
  groups: UnitStatementGroup[],
  total, tenantTotal, ownerTotal,          // unit αναλογία totals
  myPayable,                               // (role owner? ownerTotal:0)+(role tenant? tenantTotal:0)
  tenantPaid, ownerPaid,                   // paid state for the viewer's sides
};
export function buildUnitStatement(unit, expenses: {row: StatementExpense w/ per-unit alloc}[]): UnitStatement
```
`groupForBasis` reused. Group's applied χιλιοστά shown in the view come from the unit's millesime
set matching the group basis (A/D→millesimes general, B→elevator, C→heating; E→general). The
per-unit amounts come from each expense's allocation **for that unit** (`unitShare`,
`tenantAmount`, `ownerAmount`) — no cross-unit summing.

`occupant-data.ts`: build `statements: UnitStatement[]` (one per myUnit) instead of the single
`statement`; keep `paid` derivable from the selected unit. Header extras: `managerName`
(building contact whose category matches διαχειριστής, else the property/customer account manager
name if cheaply available, else null) and a static `paymentNote` is NOT stored — omit unless a
building field exists (check; otherwise the print simply shows a signature line + manager name).
`expenses`/gallery/assemblies/files/contacts/announcements unchanged. All Decimals→Number, dates ISO.

### 2. View — `components/building/occupant-shell/StatementView.tsx`

Props gain `statements: UnitStatement[]` + `managerName`. Add a **unit `<select>`** (no-print)
when `statements.length > 1`, URL `?s=koino&month=&unit=`. For the selected unit render the notice:

- **Header box**: ΕΙΔΟΠΟΙΗΤΗΡΙΟ ΚΟΙΝΟΧΡΗΣΤΩΝ · Πολυκατοικία (name, address) · Μήνας · Διαμέρισμα
  (number, floor, type, role badge) · Χιλιοστά (κανονικά/ανελκυστήρα/θέρμανσης).
- **ΑΝΑΛΥΣΗ ΔΑΠΑΝΩΝ** per group Α-Ε: category | δαπάνη κτηρίου, group subtotal.
- **ΑΝΑΛΟΓΙΑ ΔΙΑΜΕΡΙΣΜΑΤΟΣ** per group: ομάδα | χιλιοστά (applied) | ποσό αναλογίας |
  εκ των οποίων ιδιοκτήτη | ενοίκου. Group subtotals + grand total row.
- **Footer**: ΣΥΝΟΛΟ ΑΝΑΛΟΓΙΑΣ, split Ιδιοκτήτη/Ενοίκου, big **ΠΛΗΡΩΤΕΟ ΠΟΣΟ** (viewer's
  `myPayable` — the owner portion if they rent it out, both if self-occupied, tenant if they only
  rent), paid badge; a note explaining what «πληρωτέο» covers for this role; manager name +
  «Ο/Η Διαχειριστής/τρια» signature line.
- Heating readings block stays under group Γ.
- Empty-month state unchanged.

### 3. Print — `app/globals.css`

Keep the `body:has(.statement-print-root)` scoping. Enhance the print rules: A4 page
(`@page { size: A4; margin: 12mm }`), force black text + white bg + solid `#000` 1px borders on
all boxed/table elements inside `.statement-print-root`, `font-size: 10pt`, avoid row breaks
(`tr { break-inside: avoid }`), hide the unit/month selectors and any nav (`.no-print`). Only the
**selected** unit prints (the DOM already renders one unit at a time).

## Isolation

Unchanged: only the viewer's own unit statements are built; building group totals are public
(the notice is lobby-posted). No other unit's αναλογία is ever included. `viewLedger` gating on
the manager-grade actions stays.

## Testing / verification

- vitest: `buildUnitStatement` pure tests (per-group split, myPayable by role SELF/RENTED-out/
  resident-only, empty groups) — TDD.
- Live check vs DB for Λυδία's building (unit 3 self-occupied → myPayable = tenant share;
  units 1-2 rented → myPayable = owner share).
- tsc/build; print preview; final review + push.
