import { describe, it, expect } from "vitest";
import { resolveRecipients, type Person } from "./recipients";

const people: Person[] = [
  { id: "u1", name: "A", email: "a@x.gr", role: "OWNER",    buildingId: "b1", unit: "Α1" },
  { id: "u1", name: "A", email: "a@x.gr", role: "RESIDENT", buildingId: "b1", unit: "Α1" },
  { id: "u2", name: "B", email: "b@x.gr", role: "RESIDENT", buildingId: "b2", unit: "Β2" },
  { id: "u3", name: "C", email: "c@x.gr", role: "OWNER",    buildingId: "b2", unit: "Β3" },
];

describe("resolveRecipients", () => {
  it("ALL dedups by user id across buildings", () => {
    expect(resolveRecipients(people, "ALL").map((p) => p.id).sort()).toEqual(["u1", "u2", "u3"]);
  });
  it("OWNERS keeps only owners", () => {
    expect(resolveRecipients(people, "OWNERS").map((p) => p.id).sort()).toEqual(["u1", "u3"]);
  });
  it("RESIDENTS keeps only residents", () => {
    expect(resolveRecipients(people, "RESIDENTS").map((p) => p.id).sort()).toEqual(["u1", "u2"]);
  });
  it("CUSTOM keeps only the given ids (and dedups)", () => {
    expect(resolveRecipients(people, "CUSTOM", ["u2", "u2"]).map((p) => p.id)).toEqual(["u2"]);
  });
  it("keeps the first-seen unit/building for a deduped user", () => {
    expect(resolveRecipients(people, "ALL").find((p) => p.id === "u1")?.unit).toBe("Α1");
  });
});
