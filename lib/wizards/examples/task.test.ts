import { describe, it, expect } from "vitest";
import { nextOccurrences, reminderDate, exampleForTask } from "./task";

describe("nextOccurrences", () => {
  it("MONTHLY from 2026-01-31 → 2026-02-28, 2026-03-31, 2026-04-30 (anchored to the original day)", () => {
    expect(nextOccurrences("MONTHLY", "2026-01-31")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(nextOccurrences("MONTHLY", "2026-01-31", 4)[3]).toBe("2026-04-30");
  });
  it("WEEKLY adds 7 days; QUARTERLY 3 months; SEMIANNUAL 6; ANNUAL 12", () => {
    expect(nextOccurrences("WEEKLY", "2026-03-02")).toEqual(["2026-03-02", "2026-03-09", "2026-03-16"]);
    expect(nextOccurrences("QUARTERLY", "2026-01-15", 2)).toEqual(["2026-01-15", "2026-04-15"]);
    expect(nextOccurrences("SEMIANNUAL", "2026-01-15", 2)).toEqual(["2026-01-15", "2026-07-15"]);
    expect(nextOccurrences("ANNUAL", "2026-02-28", 2)).toEqual(["2026-02-28", "2027-02-28"]);
  });
  it("CUSTOM = one occurrence; null from → empty", () => {
    expect(nextOccurrences("CUSTOM", "2026-05-01")).toEqual(["2026-05-01"]);
    expect(nextOccurrences("MONTHLY", null)).toEqual([]);
  });
});

describe("reminderDate", () => {
  it("7 days before", () => expect(reminderDate("2026-03-10", 7)).toBe("2026-03-03"));
});

describe("exampleForTask", () => {
  it("lists upcoming dates with their reminders and a package line", () => {
    const ex = exampleForTask({ title: "Συντήρηση ανελκυστήρα", frequency: "MONTHLY", nextDueDate: "2026-03-10", reminderDaysBefore: 7, inPackage: true, vendor: "KLEEMANN" });
    expect(ex.rows).toEqual([{ due: "2026-03-10", reminder: "2026-03-03" }, { due: "2026-04-10", reminder: "2026-04-03" }, { due: "2026-05-10", reminder: "2026-05-03" }]);
    expect(ex.packageLine).toContain("χωρίς επιπλέον χρέωση");
    expect(ex.whoLine).toContain("KLEEMANN");
  });
  it("without a date it says the date will be set later", () => {
    const ex = exampleForTask({ title: "X", frequency: "ANNUAL", nextDueDate: null, reminderDaysBefore: 30, inPackage: false, vendor: null });
    expect(ex.rows).toEqual([]);
    expect(ex.dateLine).toContain("αργότερα");
  });
});
