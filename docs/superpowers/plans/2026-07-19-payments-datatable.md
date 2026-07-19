# Payments DataTable Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Rebuild `/owner/payments` + `/portal/payments` on the project DataTable — one row per μονάδα×μήνα, expand shows the FULL ειδοποιητήριο analysis inline (διαμοιρασμός ενοικιαστές/ιδιοκτήτες, σύνολα, χιλιοστά), dropdown «Προβολή λογαριασμού» opens the same notice in a print modal.

**Architecture:** Extract the per-unit notice body into `UnitStatementDocument`; a new `lib/dashboard/payment-statements.ts` builds per-(unit,month) `PaymentRow`s (each with a `UnitStatement` via `buildUnitStatement`); a new client `PaymentsTable` renders `DataTable` with `expandedContent`=`UnitStatementDocument` and row actions.

**Tech Stack:** Next.js 16 server components + client, Prisma 7, DataTable (`components/ui/data-table.tsx`), Orithon tokens, react-icons/ri, vitest.

**Spec:** `docs/superpowers/specs/2026-07-19-payments-datatable-design.md`

Conventions: branch `main`; stage only touched files; trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Ignore pre-existing failures: vitest `lib/cms/landing-types.test.ts`; tsc `app/actions/auth.ts`, `lib/otp.ts`, `prisma.config.ts`, `prisma/seed.ts`, `app/api/super-admin/costs/*`, `components/forms/ForgotPasswordForm.tsx`.

DataTable API (verified): `<DataTable data columns totalRows page pageSize clientSide storageKey searchPlaceholder expandedContent={(row)=>JSX} getRowActions={(row)=>RowAction[]} />`; `ColDef<T> = { id, header, cell:(row)=>JSX, sortKey?, accessor?(row), width?, defaultVisible? }`; `RowAction<T> = { label, icon?, onClick:(row)=>void, danger? }`. Reference usage: `app/(company)/admin/residents/ResidentsClient.tsx`, `components/building/UnitsPanel.tsx`.

---

### Task 1: Extract `UnitStatementDocument`

**Files:** Create `components/building/occupant-shell/UnitStatementDocument.tsx`; modify `components/building/occupant-shell/StatementView.tsx`.

- [ ] **Step 1:** Move the notice BODY (everything that renders for the selected unit: header box, ΑΝΑΛΥΣΗ ΔΑΠΑΝΩΝ tables, ΑΝΑΛΟΓΙΑ ΔΙΑΜΕΡΙΣΜΑΤΟΣ table, footer ΠΛΗΡΩΤΕΟ + split + χιλιοστά + manager signature, heating rows, the `statement-print-root` wrapper) into `UnitStatementDocument`:

```tsx
export function UnitStatementDocument({ building, statement, month, managerName, heatingReadings, showPrintRoot = true }: {
  building: { name: string; address?: string | null; city?: string | null };
  statement: UnitStatement & { tenantPaid?: boolean | null; ownerPaid?: boolean | null };
  month: string;
  managerName?: string | null;
  heatingReadings?: OccupantData["heatingReadings"];
  showPrintRoot?: boolean;
}) { /* the notice body, keyed off the single `statement` */ }
```
The month/unit `<select>` controls + print button STAY in `StatementView`. `StatementView` now: keeps selectors, resolves the selected `UnitStatement` from `statements`, and renders `<UnitStatementDocument building={building} statement={sel} month={selectedMonth} managerName={managerName} heatingReadings={heatingReadings} />`. The `.statement-print-root` class stays on the document root (via `showPrintRoot`) so `window.print()` still works from StatementView.
- [ ] **Step 2:** `npx tsc --noEmit 2>&1 | grep -E "UnitStatementDocument|StatementView"` → empty; `npm run build`. Visually the control-center statement is unchanged. Commit `refactor(building): extract UnitStatementDocument from StatementView`.

---

### Task 2: `payment-statements.ts` — per-(unit,month) rows

**Files:** Create `lib/dashboard/payment-statements.ts`.

- [ ] **Step 1:** Implement `buildPaymentRows(userId, side: "OWNER" | "TENANT")` and thin exports `getOwnerPaymentRows(userId)` = side OWNER, `getResidentPaymentRows(userId)` = side TENANT. Mechanics (mirror `lib/building/occupant-data.ts` statement math — reuse `buildUnitStatement` + `groupForBasis`/basis resolution; extract a shared `unitStatementInputsFor(expenses, unitId)` helper into `lib/building/statement.ts` or a small module if it cleanly de-dupes, else mirror):
  - Resolve the viewer's units: `db.unit.findMany({ where: { OR: [{ownerId:userId},{residentId:userId},{occupancies:{some:{userId,endDate:null}}}] }, select: id/unitNumber/unitType/floor/millesimes/millesimesElevator/millesimesHeating/ownerId/residentId/building{id,name,address,city}, occupancies })`. Per unit derive role OWNER/RESIDENT/BOTH exactly like occupant-data.
  - For each unit's building, load issued expenses grouped by month (`issuedMonth ?? month`), status in CONFIRMED/ISSUED, with `categoryRef{name,defaultBasis}`, tenantPct/ownerPct, amount, receiptFile{url}, and allocations for that unit (`unitShare, tenantAmount, tenantPaid, ownerAmount, ownerPaid`). Reuse building category overrides for basis.
  - For each (unit, month): build `UnitStatementInput[]` (unitAmount = ownerAmount+tenantAmount, unitTenant = tenantAmount, unitOwner = ownerAmount — UNGATED, as fixed in commit 18cd5ad) → `buildUnitStatement(unitMeta, inputs)` → `statement`. Compute `myAmount` = side OWNER ? Σ ownerAmount : Σ tenantAmount; `myPaid` = all my-side allocations paid; `unitTotal` = statement.total; `lines` (category, buildingAmount, unitAmount, ownerAmount, tenantAmount, paid[for side], receiptUrl); `receiptUrls` = distinct receipt urls.
  - Return `PaymentRow[]` sorted by month desc then unitNumber. Decimals→Number, no other-unit data.
- [ ] **Step 2:** `npx tsc --noEmit 2>&1 | grep payment-statements` → empty. Commit `feat(payments): per-unit-month payment rows with embedded statement`.

---

### Task 3: `PaymentsTable` + wire both pages

**Files:** Create `components/dashboard/PaymentsTable.tsx`; modify `app/(customer)/owner/payments/page.tsx`, `app/(customer)/portal/payments/page.tsx`; delete `components/dashboard/payments-view.tsx` after migrating (grep other importers first — if none, delete; else leave).

- [ ] **Step 1:** `PaymentsTable` (client) props `{ rows: PaymentRow[]; managerName?: string | null; title?: string }`. Layout: title h1; two `StatTile`s (Σύνολο οφειλών = Σ myAmount where !myPaid, warning color; Σύνολο χρεώσεων = Σ myAmount). Then `<DataTable clientSide data={rows} totalRows page=1 pageSize=25 storageKey="payments" searchPlaceholder="Αναζήτηση μήνα ή ακινήτου…">`:
  - **columns**: `month` (header «Μήνας», cell el label via a GR_MONTHS map, `accessor: r=>r.month`, sortKey), `building` («Ακίνητο», `accessor: r=>r.buildingName`), `unit` («Μονάδα», cell `r.unitNumber`), `myAmount` («Το μερίδιό μου», cell tabular `formatEuro`, warning when `!r.myPaid && r.myAmount>0`, `accessor: r=>r.myAmount`), `status` («Κατάσταση», cell: `r.myAmount===0` → StatusChip neutral «Καμία οφειλή» (τ' ο ένοικος πληρώνει, for owner side) ; else `r.myPaid` ? success «Εξοφλημένο» : warning «Οφειλή {formatEuro(myAmount)}»).
  - **expandedContent**: `(r) => <UnitStatementDocument building={{name:r.buildingName}} statement={r.statement} month={r.month} managerName={managerName} showPrintRoot={false} />` — the full analysis inline (διαμοιρασμός/σύνολα/χιλιοστά). (address/city optional — pass what PaymentRow carries; extend PaymentRow with building address/city if the document needs it.)
  - **getRowActions**: `(r) => [ { label: "Προβολή λογαριασμού", icon:<RiFileTextLine/>, onClick: ()=>setModal(r) }, ...r.receiptUrls.map((u,i)=>({ label: r.receiptUrls.length>1?`Απόδειξη ${i+1}`:"Απόδειξη", icon:<RiDownloadLine/>, onClick:()=>window.open(u,"_blank") })), { label:"Πλήρες control center", icon:<RiExternalLinkLine/>, onClick:()=>router.push(`/building/${r.buildingId}?s=koino&month=${r.month}&unit=${r.unitId}`) } ]`.
  - **Modal**: local `modal` state; when set, render a portal overlay (reuse `Modal` from `components/building/occupant-shell/Modal.tsx` if exported, else a small createPortal overlay) containing `<UnitStatementDocument … showPrintRoot />` + a print button (`window.print()`). ESC/backdrop close.
  - Empty state: DataTable with 0 rows shows its own empty; add a friendly note above when `rows.length===0`.
- [ ] **Step 2:** `/owner/payments`: `const rows = await getOwnerPaymentRows(userId); const managerName = null;` → `<PaymentsTable rows={rows} title="Πληρωμές" />`. `/portal/payments`: `getResidentPaymentRows(userId)` → `<PaymentsTable rows={rows} title="Πληρωμές" />`. (Both fetch via effective session as today.)
- [ ] **Step 3:** Remove `components/dashboard/payments-view.tsx` if no other importer (`grep -rn "payments-view\|PaymentsView" app components`). `npx tsc --noEmit 2>&1 | grep -E "PaymentsTable|payments"` empty; `npm run build`. Commit `feat(payments): DataTable with inline ειδοποιητήριο analysis and account modal`.

---

### Task 4: Verification + ship

- [ ] `npx vitest run`; `npx tsc --noEmit`; `npm run build` — green modulo documented.
- [ ] Live tsx on Λυδία: `getOwnerPaymentRows` → rows per unit×issued-month; a tenant-paid unit's owner row `myAmount===0` (status «Καμία οφειλή», NOT «Οφειλή»); unit 3 real payable; each row.statement has groups + split + totals.
- [ ] Grep: PaymentsTable is the only payments UI; no server-action import inside it (read-only client).
- [ ] Dev smoke: `/owner/payments` + `/portal/payments` render the table; expand shows the analysis; «Προβολή λογαριασμού» opens the modal; no 500s.
- [ ] Final review agent (correctness of split/totals/millesimes shown, isolation, DataTable a11y, no €0-Οφειλή confusion); fix; update memory; push to GitHub main.
