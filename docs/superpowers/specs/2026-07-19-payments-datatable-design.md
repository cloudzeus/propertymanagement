# Payments DataTable Redesign — Design

**Date:** 2026-07-19 · **Status:** Approved by user

## Problem

`/owner/payments` (and `/portal/payments`) render `PaymentsView` — a plain per-month list with one
row per expense×unit allocation. For a 3-unit owner one month shows ~13 near-identical rows all
«€0,00 · Οφειλή» (owner owes €0 because tenants pay 100%, yet each allocation is `ownerPaid=false`).
Unusable — the user understands nothing.

## Decisions (user-approved)

1. **Rows = ειδοποιητήριο per μονάδα × μήνα** (not per expense line).
2. **«Προβολή λογαριασμού» opens the full ειδοποιητήριο in a modal** (analysis + χιλιοστά + split +
   print), without leaving the list.
3. Use the project **DataTable** (`components/ui/data-table.tsx`): expandable rows, actions
   dropdown, search, sort, column picker, client-side mode.

## Architecture

### 1. Reuse the notice renderer — extract `UnitStatementDocument`

The per-unit ειδοποιητήριο body currently lives inside `StatementView.tsx`. Extract a pure
presentational component `components/building/occupant-shell/UnitStatementDocument.tsx` that renders
ONE `UnitStatement` (header, ΑΝΑΛΥΣΗ ΔΑΠΑΝΩΝ, ΑΝΑΛΟΓΙΑ ΔΙΑΜΕΡΙΣΜΑΤΟΣ, footer ΠΛΗΡΩΤΕΟ, χιλιοστά,
`statement-print-root`/`no-print` classes, optional heating rows, `managerName`). `StatementView`
keeps only the month/unit selectors + print button and renders `<UnitStatementDocument>`. The
payments modal renders the same component for the chosen (unit, month). Zero visual change to the
control-center statement.

### 2. Data — `lib/dashboard/payment-statements.ts` (new)

`getOwnerPaymentRows(userId)` and `getResidentPaymentRows(userId)` (thin wrappers over a shared
`buildPaymentRows(userId, side)`): for each of the viewer's units and each issued month, produce a
`PaymentRow`:

```ts
type PaymentRow = {
  id: string;                 // `${unitId}:${month}`
  buildingId, buildingName, unitId, unitNumber, month;   // month = YYYY-MM
  side: "OWNER" | "TENANT";
  myAmount: number;           // owner→Σ ownerAmount, tenant→Σ tenantAmount
  myPaid: boolean;            // all my-side allocations of the row paid
  unitTotal: number;          // whole apartment αναλογία (owner+tenant)
  lines: { id, categoryName, buildingAmount, unitAmount, ownerAmount, tenantAmount, paid, receiptUrl }[];
  statement: UnitStatement;   // built via buildUnitStatement — feeds the modal
  receiptUrls: string[];
};
```
Bounded work: viewer units (few) × issued months (few) × categories. Reuses `buildUnitStatement`
and the same basis/allocation logic as `occupant-data.ts` (extract the shared per-expense→
UnitStatementInput mapping into a small helper if it reduces duplication; otherwise mirror it).
`side` is OWNER on `/owner`, TENANT on `/portal`. Status semantics fix the bug: a row with
`myAmount === 0` is **not** a debt — status «Καμία οφειλή» (owner, tenant pays) / paid-neutral.

### 3. UI — `components/dashboard/PaymentsTable.tsx` (new, client)

Replaces `PaymentsView` for both surfaces. Header: two `StatTile`s — Σύνολο οφειλών
(Σ `myAmount` where `!myPaid`), Σύνολο χρεώσεων (Σ `myAmount`). Then `<DataTable clientSide>`:

- **Columns**: Μήνας (sortable, el label) · Ακίνητο (buildingName) · Μονάδα (unitNumber) · Το μερίδιό
  μου (`myAmount`, tabular, warning when owed) · Κατάσταση (badge: Εξοφλημένο / Οφειλή {amount} /
  «Καμία οφειλή» when myAmount 0). Column picker + search come free.
- **expandedContent** = the **full analysis inline**: render `<UnitStatementDocument statement={row.statement} …/>`
  — the complete ειδοποιητήριο showing ΑΝΑΛΥΣΗ ΔΑΠΑΝΩΝ (category × δαπάνη κτηρίου), ΑΝΑΛΟΓΙΑ
  ΔΙΑΜΕΡΙΣΜΑΤΟΣ (χιλιοστά applied · ποσό αναλογίας · **εκ των οποίων ιδιοκτήτη / ενοίκου**), group
  subtotals + grand totals, and the ΠΛΗΡΩΤΕΟ split. This is the analysis the user wants: the
  διαμοιρασμός σε ενοικιαστές/ιδιοκτήτες, σύνολα, and χιλιοστά, right there on expand. Each expense
  line links its απόδειξη when present.
- **getRowActions** (dropdown): «Προβολή λογαριασμού» → the same `<UnitStatementDocument>` in a modal
  with a print button (focused / printable view); «Απόδειξη» per receipt when present; «Πλήρες
  control center» → `/building/${buildingId}?s=koino&month=${month}&unit=${unitId}`.
- Empty state actionable. Orithon tokens, react-icons/ri Line, tabular-nums.

Pages `/owner/payments` and `/portal/payments` fetch rows server-side and render
`<PaymentsTable rows={...} side=... />`. Delete `PaymentsView` (and its `groupAllocationsByMonth`
usage there) once both callers migrate; keep `alloc-view.ts` helpers if still used elsewhere (grep).

### 4. Isolation

Read-only. Rows are the viewer's own units only; building group totals are the public notice
figures (already exposed in the control center). No other unit's per-apartment data. No new mutation
surface. `viewLedger` gating untouched.

## Testing / verification

- vitest: `buildPaymentRows` aggregation is pure-testable via a small extracted mapper, or covered
  by the existing `buildUnitStatement` tests; add a case that a myAmount-0 row is flagged
  non-debt.
- Live check on Λυδία: rows = 3 units × issued months; owner rows with tenant-paid expenses show
  «Καμία οφειλή» not «Οφειλή»; unit 3 (self) shows the real payable; modal renders the full notice.
- tsc/build; dev smoke `/owner/payments` + `/portal/payments`; final review + push.
