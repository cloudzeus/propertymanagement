import { describe, it, expect } from "vitest";
import { exampleForOccupant } from "./occupant";

describe("exampleForOccupant", () => {
  it("resident: portal surface, sees own bills, pays operating expenses", () => {
    const ex = exampleForOccupant({ role: "RESIDENT", name: "Μαρία", unitNumber: "1Α", isNewAccount: true });
    expect(ex.surface).toBe("/portal");
    expect(ex.sees.join(" ")).toContain("κοινόχρηστα");
    expect(ex.splitRows.find((r) => r.label.includes("Καθαρισμός"))!.pays).toBe("Ένοικος");
    expect(ex.loginLine).toContain("αρχικό κωδικό");
  });
  it("owner: owner surface, pays owner expenses (repairs)", () => {
    const ex = exampleForOccupant({ role: "OWNER", name: "Γιάννης", unitNumber: "2Β", isNewAccount: false });
    expect(ex.surface).toBe("/owner");
    expect(ex.splitRows.find((r) => r.label.includes("Επισκευή"))!.pays).toBe("Ιδιοκτήτης");
    expect(ex.loginLine).toContain("ήδη");
  });
});
