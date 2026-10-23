import { describe, it, expect } from "vitest";
import { exampleForCustomer } from "./customer";

const base = { type: "INDIVIDUAL" as const, name: "Μαρία Παπαδοπούλου", hasLogin: false, loginEmail: null, nextCode: "C00012" };

describe("exampleForCustomer", () => {
  it("lists the four next steps in order", () => {
    const ex = exampleForCustomer(base);
    expect(ex.steps.map((s) => s.title)).toEqual(["Ιδιοκτησία", "Κτήριο & μονάδες", "Χιλιοστά", "Πακέτο υπηρεσιών"]);
    for (const s of ex.steps) expect(s.body.length).toBeGreaterThan(20);
  });
  it("headline names the customer and the code", () => {
    const ex = exampleForCustomer(base);
    expect(ex.headline).toContain("Μαρία Παπαδοπούλου");
    expect(ex.headline).toContain("C00012");
  });
  it("loginLine is null without a login account", () => {
    expect(exampleForCustomer(base).loginLine).toBeNull();
  });
  it("loginLine uses the name and the login email", () => {
    const ex = exampleForCustomer({ ...base, hasLogin: true, loginEmail: "maria@example.gr" });
    expect(ex.loginLine).toContain("maria@example.gr");
    expect(ex.loginLine).toContain("Μαρία Παπαδοπούλου");
  });
  it("companies are addressed as a company", () => {
    const ex = exampleForCustomer({ ...base, type: "COMPANY", name: "Ακίνητα ΑΕ", hasLogin: true, loginEmail: "info@akinita.gr" });
    expect(ex.loginLine).toContain("Η εταιρεία Ακίνητα ΑΕ");
  });
});
