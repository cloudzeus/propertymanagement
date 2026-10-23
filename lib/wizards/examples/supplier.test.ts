import { describe, it, expect } from "vitest";
import { exampleForSupplier } from "./supplier";

const zones = [{ code: "A", label: "Ζώνη Α", maxKm: 10, travelFee: 0 }, { code: "B", label: "Ζώνη Β", maxKm: 30, travelFee: 0 }];

describe("exampleForSupplier", () => {
  it("timeline has 5 steps and names the supplier", () => {
    const ex = exampleForSupplier({ name: "Ηλεκτρολογικά Παπαδόπουλος", categories: ["Ηλεκτρολογικά"], zones, siteSurveyFee: null, surveyZoneFees: {}, surveyWaived: true, emergency24h: false });
    expect(ex.timeline).toHaveLength(5);
    expect(ex.timeline[2].body).toContain("Ηλεκτρολογικά Παπαδόπουλος");
    expect(ex.timeline[4].title).toContain("Σύμβαση");
  });
  it("survey lines: base + zone surcharge per zone, with the waiver note", () => {
    const ex = exampleForSupplier({ name: "X", categories: [], zones, siteSurveyFee: 30, surveyZoneFees: { B: 12 }, surveyWaived: true, emergency24h: false });
    expect(ex.surveyLines).toEqual([{ zone: "Ζώνη Α", amount: 30 }, { zone: "Ζώνη Β", amount: 42 }]);
    expect(ex.surveyNote).toContain("συμψηφίζεται");
  });
  it("no survey fee → surveyLines empty and a free-survey note", () => {
    const ex = exampleForSupplier({ name: "X", categories: [], zones, siteSurveyFee: null, surveyZoneFees: {}, surveyWaived: false, emergency24h: true });
    expect(ex.surveyLines).toEqual([]);
    expect(ex.surveyNote).toContain("δωρεάν");
    expect(ex.badges).toContain("Έκτακτα 24/7");
  });
  it("categories appear in the badges", () => {
    const ex = exampleForSupplier({ name: "X", categories: ["Υδραυλικά", "Θέρμανση"], zones: [], siteSurveyFee: null, surveyZoneFees: {}, surveyWaived: false, emergency24h: false });
    expect(ex.badges).toEqual(["Υδραυλικά", "Θέρμανση"]);
  });
});
