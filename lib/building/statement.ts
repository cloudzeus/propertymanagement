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
