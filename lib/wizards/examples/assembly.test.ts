import { describe, it, expect } from "vitest";
import { assemblyQuorum, assemblyConsumption, exampleForAssembly } from "./assembly";

const units = [{ unitNumber: "1Α", millesimes: 200 }, { unitNumber: "1Β", millesimes: 300 }, { unitNumber: "2Α", millesimes: 500 }];

describe("assembly helpers", () => {
  it("quorum = Σ millesimes of present units", () => {
    expect(assemblyQuorum(units, ["1Α", "2Α"])).toEqual({ present: 700, total: 1000, ok: true });
    expect(assemblyQuorum(units, ["1Α"])).toEqual({ present: 200, total: 1000, ok: false });
  });
  it("consumption = minutes × participants (person-minutes)", () => {
    expect(assemblyConsumption(60, 10)).toBe(600);
    expect(assemblyConsumption(90, 12)).toBe(1080);
  });
  it("example: timeline, quorum of a majority and the prepaid balance after", () => {
    const ex = exampleForAssembly({ title: "Τακτική ΓΣ 2026", when: "2026-04-15T19:00:00", units, prepaidMinutes: 1800, durationMinutes: 60, participants: 10 });
    expect(ex.timeline.map((t) => t.title)).toEqual(["Πρόσκληση", "Συνέλευση", "Απαρτία", "Πρακτικά"]);
    expect(ex.quorum.present).toBeGreaterThanOrEqual(501);
    expect(ex.consumption).toBe(600);
    expect(ex.balanceAfter).toBe(1200);
  });
  it("no prepaid balance → balanceAfter null and a warning line", () => {
    const ex = exampleForAssembly({ title: "X", when: null, units: [], prepaidMinutes: 0, durationMinutes: 60, participants: 8 });
    expect(ex.balanceAfter).toBeNull();
    expect(ex.balanceLine).toContain("προαγορ");
  });
});
