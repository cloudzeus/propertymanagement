import { describe, it, expect } from "vitest";
import { resolveQuickActions, quickActionsTitle } from "./quick-actions";

const allowed = new Set(["/admin/maintenance", "/admin/work-orders", "/admin/maintenance-program", "/super-admin/suppliers", "/admin/announcements", "/super-admin/onboarding", "/marketplace/rfq", "/marketplace/work-orders", "/marketplace/requests", "/admin/work"]);

describe("quick actions", () => {
  it("differs per page for staff", () => {
    const dash = resolveQuickActions({ pathname: "/super-admin", role: "ADMIN", allowed, canExpense: true }).map((a) => a.key);
    const maint = resolveQuickActions({ pathname: "/admin/maintenance/abc", role: "ADMIN", allowed, canExpense: true }).map((a) => a.key);
    expect(dash).toContain("expense");
    expect(dash).not.toEqual(maint);
    expect(maint).not.toContain("faults"); // already there
    expect(maint).toContain("work-orders");
  });
  it("hides what the role may not open and the expense modal for non-expense roles", () => {
    const res = resolveQuickActions({ pathname: "/portal", role: "PROPERTY_RESIDENT", allowed: new Set(["/portal/payments"]), canExpense: false }).map((a) => a.key);
    expect(res).toEqual(["report", "portal-pay"]);
  });
  it("supplier gets RFQ/work-order shortcuts", () => {
    const res = resolveQuickActions({ pathname: "/marketplace", role: "COLLABORATOR", allowed, canExpense: false }).map((a) => a.key);
    expect(res).toEqual(["mkt-rfq", "mkt-wo", "mkt-tasks", "report"]);
  });
  it("never returns more than five", () => {
    expect(resolveQuickActions({ pathname: "/super-admin", role: "SUPER_ADMIN", allowed, canExpense: true }).length).toBeLessThanOrEqual(5);
  });
  it("dashboards and fault pages offer the work center; the work center page offers faults/work orders/programme", () => {
    const dash = resolveQuickActions({ pathname: "/admin", role: "ADMIN", allowed, canExpense: true }).map((a) => a.key);
    expect(dash).toContain("work");
    const work = resolveQuickActions({ pathname: "/admin/work", role: "EMPLOYEE", allowed, canExpense: false }).map((a) => a.key);
    expect(work).not.toContain("work");
    expect(work).toEqual(expect.arrayContaining(["report", "faults"]));
    expect(quickActionsTitle("/admin/work", "ADMIN")).toBe("Κέντρο εργασιών");
  });
  it("building pages deep-link into the «Ενέργειες» menu of that building (?action=)", () => {
    const res = resolveQuickActions({ pathname: "/super-admin/buildings/b1", role: "SUPER_ADMIN", allowed, canExpense: true });
    expect(res.map((a) => a.key)).toEqual(["b-fault", "b-expense", "b-koino", "b-announcement", "printables"]);
    expect(res[0].href).toBe("/super-admin/buildings/b1?action=fault-new");
    expect(quickActionsTitle("/super-admin/buildings/b1", "SUPER_ADMIN")).toBe("Το κτήριο");
    const mgr = resolveQuickActions({ pathname: "/building/b1?s=finance", role: "PROPERTY_ADMIN", allowed, canExpense: true });
    expect(mgr[0].href).toBe("/building/b1?action=fault-new");
    // the list page is not a building page
    expect(resolveQuickActions({ pathname: "/super-admin/buildings", role: "SUPER_ADMIN", allowed, canExpense: true }).map((a) => a.key)).not.toContain("b-fault");
  });
});
