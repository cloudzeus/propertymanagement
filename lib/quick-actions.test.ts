import { describe, it, expect } from "vitest";
import { resolveQuickActions } from "./quick-actions";

const allowed = new Set(["/admin/maintenance", "/admin/work-orders", "/admin/maintenance-program", "/super-admin/suppliers", "/admin/announcements", "/super-admin/onboarding", "/marketplace/rfq", "/marketplace/work-orders", "/marketplace/requests"]);

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
});
