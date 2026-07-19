import { describe, it, expect } from "vitest";
import { buildStatement, buildUnitStatement, groupForBasis, type StatementExpense, type UnitStatementInput } from "./statement";

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

const uexp = (o: Partial<UnitStatementInput>): UnitStatementInput => ({
  id: "e", categoryName: "Καθαριότητα", basis: "GENERAL_MILLESIMES", amount: 100,
  tenantPct: 100, ownerPct: 0, unitAmount: 10, unitTenant: 10, unitOwner: 0, ...o,
});

describe("buildUnitStatement", () => {
  const unit = { unitId: "u1", unitNumber: "3", unitType: "APARTMENT", floor: 2, role: "BOTH" as const,
    millesimes: 159.84, millesimesElevator: 150, millesimesHeating: 160 };

  it("groups, splits owner/tenant per group, computes myPayable for BOTH (self-occupied)", () => {
    const s = buildUnitStatement(unit, [
      uexp({ id: "a", amount: 60, unitAmount: 6, unitTenant: 6, unitOwner: 0 }),
      uexp({ id: "b", categoryName: "ΔΕΗ", amount: 40, unitAmount: 4, unitTenant: 4, unitOwner: 0 }),
      uexp({ id: "c", categoryName: "Ασφάλιστρα", basis: "GENERAL_MILLESIMES", tenantPct: 0, ownerPct: 100, amount: 200, unitAmount: 20, unitTenant: 0, unitOwner: 20 }),
    ]);
    const a = s.groups.find((g) => g.key === "A")!;
    expect(a.buildingTotal).toBe(100);
    expect(a.lines.length).toBe(2);
    expect(a.lines.find((l) => l.id === "a")!.unitAmount).toBe(6); // per-expense personal share carried on the line
    expect(a.unitAmount).toBe(10);
    expect(a.unitTenant).toBe(10);
    expect(a.appliedMillesimes).toBe(159.84);        // group A → general millesimes
    const e = s.groups.find((g) => g.key === "E")!;
    expect(e.unitOwner).toBe(20);
    expect(s.total).toBe(30);
    expect(s.tenantTotal).toBe(10);
    expect(s.ownerTotal).toBe(20);
    expect(s.myPayable).toBe(30);                    // BOTH → owner + tenant
  });

  it("myPayable = owner only when the unit is rented out (role OWNER)", () => {
    const s = buildUnitStatement({ ...unit, role: "OWNER" }, [
      uexp({ amount: 100, unitAmount: 10, unitTenant: 10, unitOwner: 0 }),
      uexp({ id: "x", basis: "ELEVATOR_MILLESIMES", tenantPct: 0, ownerPct: 100, amount: 50, unitAmount: 5, unitTenant: 0, unitOwner: 5 }),
    ]);
    expect(s.tenantTotal).toBe(10);
    expect(s.ownerTotal).toBe(5);
    expect(s.myPayable).toBe(5);
    expect(s.groups.find((g) => g.key === "B")!.appliedMillesimes).toBe(150); // elevator
  });

  it("myPayable = tenant only for a plain resident (role RESIDENT)", () => {
    const s = buildUnitStatement({ ...unit, role: "RESIDENT" }, [uexp({ amount: 100, unitAmount: 10, unitTenant: 10, unitOwner: 0 })]);
    expect(s.myPayable).toBe(10);
  });

  it("keeps total === ownerTotal + tenantTotal; rented unit (tenant pays all) owes 0", () => {
    // Full owner/tenant split flows in (not gated on the viewer): a rented-out
    // owner sees the whole αναλογία but personally owes only the owner side (0 here).
    const s = buildUnitStatement({ ...unit, role: "OWNER" }, [
      uexp({ amount: 100, unitAmount: 10, unitTenant: 10, unitOwner: 0 }),
      uexp({ id: "y", categoryName: "ΔΕΗ", amount: 40, unitAmount: 4, unitTenant: 4, unitOwner: 0 }),
    ]);
    expect(s.tenantTotal).toBe(14);
    expect(s.ownerTotal).toBe(0);
    expect(s.total).toBe(14);
    expect(s.total).toBe(s.ownerTotal + s.tenantTotal);
    expect(s.myPayable).toBe(0);
  });

  it("omits empty groups and orders Α-Ε", () => {
    const s = buildUnitStatement(unit, [uexp({}), uexp({ id: "h", basis: "HEATING_MILLESIMES", unitAmount: 3, unitTenant: 3, unitOwner: 0 })]);
    expect(s.groups.map((g) => g.key)).toEqual(["A", "C"]);
  });
});
