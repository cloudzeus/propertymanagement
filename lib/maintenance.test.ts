import { describe, it, expect } from "vitest";
import { pickReminderEmails, isReminderDue } from "./maintenance";

const companyEmployees = ["emp1@co.gr", "emp2@co.gr"];
const managers = ["mgr@owner.gr"];

describe("pickReminderEmails", () => {
  it("managed + in package → company employees", () => {
    expect(pickReminderEmails({ managed: true, inServicePackage: true }, companyEmployees, managers))
      .toEqual(companyEmployees);
  });
  it("managed + out of package → managers", () => {
    expect(pickReminderEmails({ managed: true, inServicePackage: false }, companyEmployees, managers))
      .toEqual(managers);
  });
  it("not managed → managers", () => {
    expect(pickReminderEmails({ managed: false, inServicePackage: true }, companyEmployees, managers))
      .toEqual(managers);
  });
});

describe("isReminderDue", () => {
  const today = new Date("2026-07-05T09:00:00Z");
  it("due when today >= nextDueDate - reminderDaysBefore and not yet sent", () => {
    expect(isReminderDue({ nextDueDate: new Date("2026-07-10"), reminderDaysBefore: 7, reminderSentAt: null }, today)).toBe(true);
  });
  it("not due when still before the reminder window", () => {
    expect(isReminderDue({ nextDueDate: new Date("2026-07-20"), reminderDaysBefore: 7, reminderSentAt: null }, today)).toBe(false);
  });
  it("not due when already sent for this cycle", () => {
    expect(isReminderDue({ nextDueDate: new Date("2026-07-10"), reminderDaysBefore: 7, reminderSentAt: new Date("2026-07-04") }, today)).toBe(false);
  });
  it("no nextDueDate → never due", () => {
    expect(isReminderDue({ nextDueDate: null, reminderDaysBefore: 7, reminderSentAt: null }, today)).toBe(false);
  });
});
