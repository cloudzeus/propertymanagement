import { describe, it, expect } from "vitest";
import { buildStatement, groupForBasis, type StatementExpense } from "./statement";

const exp = (over: Partial<StatementExpense>): StatementExpense => ({
  id: "e1", categoryName: "Καθαριότητα", basis: "GENERAL_MILLESIMES",
  amount: 100, tenantPct: 100, ownerPct: 0, myShare: 10, myTenant: 10, myOwner: 0, ...over,
});

describe("groupForBasis", () => {
  it("maps bases to the classic groups", () => {
    expect(groupForBasis("GENERAL_MILLESIMES", 100)).toBe("A");
    expect(groupForBasis("ELEVATOR_MILLESIMES", 100)).toBe("B");
    expect(groupForBasis("HEATING_MILLESIMES", 100)).toBe("C");
    expect(groupForBasis("METERED_70_30", 100)).toBe("C");
    expect(groupForBasis("EQUAL_PER_UNIT", 100)).toBe("D");
    expect(groupForBasis("GENERAL_MILLESIMES", 0)).toBe("E"); // tenantPct 0 → owners-only
  });
});

describe("buildStatement", () => {
  it("groups expenses, sums group totals and my amounts", () => {
    const s = buildStatement([
      exp({ id: "a", amount: 60, myShare: 6, myTenant: 6 }),
      exp({ id: "b", categoryName: "ΔΕΗ", amount: 40, myShare: 4, myTenant: 4 }),
      exp({ id: "c", categoryName: "Συντήρηση ασανσέρ", basis: "ELEVATOR_MILLESIMES", amount: 50, myShare: 2, myTenant: 2, myOwner: 0 }),
      exp({ id: "d", categoryName: "Ανακαίνιση", basis: "GENERAL_MILLESIMES", tenantPct: 0, ownerPct: 100, amount: 200, myShare: 20, myTenant: 0, myOwner: 20 }),
    ]);
    const a = s.groups.find((g) => g.key === "A")!;
    expect(a.total).toBe(100);
    expect(a.lines.length).toBe(2);
    expect(a.myTotal).toBe(10);
    expect(s.groups.find((g) => g.key === "B")!.total).toBe(50);
    expect(s.groups.find((g) => g.key === "E")!.myTotal).toBe(20);
    expect(s.total).toBe(350);
    expect(s.myTotal).toBe(32);
    expect(s.myTenant).toBe(12);
    expect(s.myOwner).toBe(20);
  });
  it("omits empty groups", () => {
    expect(buildStatement([exp({})]).groups.map((g) => g.key)).toEqual(["A"]);
  });
});
