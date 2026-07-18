import { describe, it, expect } from "vitest";
import { capsForStaff, capsForManager, NO_CAPS } from "./building-caps";

describe("capsForManager", () => {
  it("managed building: view-heavy, communication CRUD, request creation", () => {
    const c = capsForManager(true);
    expect(c.editUnits).toBe(false);
    expect(c.editMillesimes).toBe(false);
    expect(c.manageExpenses).toBe(false);
    expect(c.manageKoinochrista).toBe(false);
    expect(c.managePayments).toBe(false);
    expect(c.manageInfra).toBe(false);
    expect(c.manageManagedItems).toBe(false);
    expect(c.manageMaintenance).toBe(false);
    expect(c.manageFiles).toBe(true);
    expect(c.manageContacts).toBe(true);
    expect(c.manageAnnouncements).toBe(true);
    expect(c.manageAssemblies).toBe(true);
    expect(c.manageCalendar).toBe(true);
    expect(c.createRequests).toBe(true);
    expect(c.editDistribution).toBe(false);
    expect(c.viewAudit).toBe(true);
    expect(c.manageManagers).toBe(false);
  });
  it("self-managed building: full CRUD except distribution settings and managers", () => {
    const c = capsForManager(false);
    expect(c.editUnits).toBe(true);
    expect(c.editMillesimes).toBe(true);
    expect(c.manageExpenses).toBe(true);
    expect(c.manageKoinochrista).toBe(true);
    expect(c.managePayments).toBe(true);
    expect(c.manageInfra).toBe(true);
    expect(c.manageManagedItems).toBe(false); // managed items are company-catalog only
    expect(c.manageMaintenance).toBe(true);
    expect(c.editDistribution).toBe(false);
    expect(c.manageManagers).toBe(false);
  });
  it("staff gets everything; NO_CAPS gets nothing", () => {
    expect(Object.values(capsForStaff()).every(Boolean)).toBe(true);
    expect(Object.values(NO_CAPS).every((v) => v === false)).toBe(true);
  });
});
