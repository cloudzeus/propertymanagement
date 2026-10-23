import { describe, it, expect } from "vitest";
import { exampleForProperty } from "./property";

const base = { customerName: "Ακίνητα Κέντρου ΑΕ", name: "Σόλωνος 12", address: "Σόλωνος 12, Αθήνα", managed: true, sameAddressBuilding: true, buildingName: null };

describe("exampleForProperty", () => {
  it("builds a 3-level tree customer › property › building", () => {
    const t = exampleForProperty(base).tree;
    expect(t.map((n) => n.depth)).toEqual([0, 1, 2]);
    expect(t[0].label).toBe("Ακίνητα Κέντρου ΑΕ");
    expect(t[1].label).toBe("Σόλωνος 12");
    expect(t[2].label).toBe("Σόλωνος 12"); // default building takes the property name
    expect(t[2].sub).toContain("ίδια διεύθυνση");
  });
  it("uses the building name and says the address comes later when not shared", () => {
    const t = exampleForProperty({ ...base, sameAddressBuilding: false, buildingName: "Κτήριο Α" }).tree;
    expect(t[2].label).toBe("Κτήριο Α");
    expect(t[2].sub).toContain("αργότερα");
  });
  it("explains managed vs self-managed", () => {
    expect(exampleForProperty(base).managedLine).toContain("εταιρεία");
    expect(exampleForProperty({ ...base, managed: false }).managedLine).toContain("Αυτοδιαχείριση");
  });
  it("always states that the package lives on the property", () => {
    expect(exampleForProperty(base).packageLine).toContain("πακέτο υπηρεσιών");
  });
});
