// Pure statement math for the occupant ειδοποιητήριο (classic κοινόχρηστα notice).
// Groups building expenses into the classic Α-Ε sections and sums building totals
// alongside the viewer's own share (tenant/owner split). No DB access here — the
// loader (occupant-data.ts) resolves bases and per-viewer amounts first.

export type StatementBasis = "GENERAL_MILLESIMES" | "ELEVATOR_MILLESIMES" | "HEATING_MILLESIMES" | "EQUAL_PER_UNIT" | "METERED_70_30";
export type StatementGroupKey = "A" | "B" | "C" | "D" | "E";

export const GROUP_LABELS: Record<StatementGroupKey, string> = {
  A: "Α. ΚΟΙΝΟΧΡΗΣΤΑ", B: "Β. ΑΝΕΛΚΥΣΤΗΡΑΣ", C: "Γ. ΘΕΡΜΑΝΣΗ",
  D: "Δ. ΛΟΙΠΑ ΕΞΟΔΑ", E: "Ε. ΕΞΟΔΑ ΣΥΝΙΔΙΟΚΤΗΣΙΑΣ",
};

export type StatementExpense = {
  id: string; categoryName: string; basis: StatementBasis;
  amount: number; tenantPct: number; ownerPct: number;
  myShare: number; myTenant: number; myOwner: number;
};

export type StatementGroup = {
  key: StatementGroupKey; label: string; total: number; myTotal: number;
  lines: { id: string; categoryName: string; amount: number; myShare: number }[];
};

export type Statement = {
  groups: StatementGroup[];
  total: number; myTotal: number; myTenant: number; myOwner: number;
};

export function groupForBasis(basis: StatementBasis, tenantPct: number): StatementGroupKey {
  if (tenantPct === 0) return "E"; // owners-only expense, regardless of distribution basis
  if (basis === "ELEVATOR_MILLESIMES") return "B";
  if (basis === "HEATING_MILLESIMES" || basis === "METERED_70_30") return "C";
  if (basis === "EQUAL_PER_UNIT") return "D";
  return "A";
}

// ── Per-unit statement (classic per-apartment ειδοποιητήριο) ────────────────
// Unlike buildStatement (which aggregates all of a viewer's units into a single
// "my share"), this builds one notice for ONE unit from ITS OWN allocations only,
// with the owner/tenant split and the χιλιοστά applied per group.

// The aggregate `myShare/myTenant/myOwner` fields make no sense per-unit — the
// unit* trio carries this unit's own allocation instead.
export type UnitStatementInput = Omit<StatementExpense, "myShare" | "myTenant" | "myOwner"> & { unitAmount: number; unitTenant: number; unitOwner: number; receiptUrl?: string | null };

export type UnitStatementGroup = {
  key: StatementGroupKey; label: string; buildingTotal: number;
  lines: { id: string; categoryName: string; amount: number; receiptUrl?: string | null }[];
  appliedMillesimes: number | null;
  unitAmount: number; unitTenant: number; unitOwner: number;
};

export type UnitStatementMeta = {
  unitId: string; unitNumber: string; unitType: string; floor: number | null;
  role: "OWNER" | "RESIDENT" | "BOTH";
  millesimes: number | null; millesimesElevator: number | null; millesimesHeating: number | null;
};

export type UnitStatement = UnitStatementMeta & {
  groups: UnitStatementGroup[];
  total: number; tenantTotal: number; ownerTotal: number; myPayable: number;
};

/** Which χιλιοστά set applies to a group: Β→ανελκυστήρα, Γ→θέρμανσης, else→γενικά. */
function millesimesForGroup(m: UnitStatementMeta, key: StatementGroupKey): number | null {
  if (key === "B") return m.millesimesElevator;
  if (key === "C") return m.millesimesHeating;
  return m.millesimes; // A, D, E → general
}

// Per-unit grouping keeps functional expenses (ανελκυστήρας/θέρμανση) in their own
// section even when they are owner-only, so the ΑΝΑΛΟΓΙΑ table shows the elevator/
// heating χιλιοστά against them. Only *generic* owner-only expenses fall to Ε.
// (This differs from groupForBasis, which the aggregate buildStatement keeps.)
function unitGroupForBasis(basis: StatementBasis, tenantPct: number): StatementGroupKey {
  if (basis === "ELEVATOR_MILLESIMES") return "B";
  if (basis === "HEATING_MILLESIMES" || basis === "METERED_70_30") return "C";
  if (tenantPct === 0) return "E"; // owners-only generic expense
  if (basis === "EQUAL_PER_UNIT") return "D";
  return "A";
}

export function buildUnitStatement(unit: UnitStatementMeta, rows: UnitStatementInput[]): UnitStatement {
  const order: StatementGroupKey[] = ["A", "B", "C", "D", "E"];
  const groups = new Map<StatementGroupKey, UnitStatementGroup>();
  let total = 0, tenantTotal = 0, ownerTotal = 0;
  for (const r of rows) {
    const key = unitGroupForBasis(r.basis, r.tenantPct);
    let g = groups.get(key);
    if (!g) {
      g = { key, label: GROUP_LABELS[key], buildingTotal: 0, lines: [], appliedMillesimes: millesimesForGroup(unit, key), unitAmount: 0, unitTenant: 0, unitOwner: 0 };
      groups.set(key, g);
    }
    g.buildingTotal += r.amount;
    g.lines.push({ id: r.id, categoryName: r.categoryName, amount: r.amount, receiptUrl: r.receiptUrl ?? null });
    g.unitAmount += r.unitAmount; g.unitTenant += r.unitTenant; g.unitOwner += r.unitOwner;
    total += r.unitAmount; tenantTotal += r.unitTenant; ownerTotal += r.unitOwner;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  const myPayable =
    (unit.role === "OWNER" || unit.role === "BOTH" ? ownerTotal : 0) +
    (unit.role === "RESIDENT" || unit.role === "BOTH" ? tenantTotal : 0);
  return {
    ...unit,
    groups: order.filter((k) => groups.has(k)).map((k) => {
      const g = groups.get(k)!;
      return { ...g, buildingTotal: round(g.buildingTotal), unitAmount: round(g.unitAmount), unitTenant: round(g.unitTenant), unitOwner: round(g.unitOwner) };
    }),
    total: round(total), tenantTotal: round(tenantTotal), ownerTotal: round(ownerTotal), myPayable: round(myPayable),
  };
}

export function buildStatement(rows: StatementExpense[]): Statement {
  const order: StatementGroupKey[] = ["A", "B", "C", "D", "E"];
  const groups = new Map<StatementGroupKey, StatementGroup>();
  let total = 0, myTotal = 0, myTenant = 0, myOwner = 0;
  for (const r of rows) {
    const key = groupForBasis(r.basis, r.tenantPct);
    let g = groups.get(key);
    if (!g) { g = { key, label: GROUP_LABELS[key], total: 0, myTotal: 0, lines: [] }; groups.set(key, g); }
    g.total += r.amount;
    g.myTotal += r.myShare;
    g.lines.push({ id: r.id, categoryName: r.categoryName, amount: r.amount, myShare: r.myShare });
    total += r.amount; myTotal += r.myShare; myTenant += r.myTenant; myOwner += r.myOwner;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    groups: order.filter((k) => groups.has(k)).map((k) => {
      const g = groups.get(k)!;
      return { ...g, total: round(g.total), myTotal: round(g.myTotal) };
    }),
    total: round(total), myTotal: round(myTotal), myTenant: round(myTenant), myOwner: round(myOwner),
  };
}
