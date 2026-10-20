import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "./prompt";
import type { AssistantCtx, WikiHit } from "@/lib/ai/tools/types";

const base: AssistantCtx = {
  user: { id: "u1", name: "Μαρία", email: "m@x.gr", role: "PROPERTY_OWNER", customerId: "c1", companyId: null },
  real: { id: "u1", role: "PROPERTY_OWNER" }, impersonating: false, surface: "customer", perms: new Set(),
  scope: { seesAllCustomers: false, managerBuildingIds: [], occupantUnits: [{ unitId: "un1", unitNumber: "Α2", buildingId: "b1", buildingName: "Ερμού 5", role: "OWNER" }], supplierId: null },
  page: { path: "/owner/payments" }, now: new Date("2026-10-20T10:00:00Z"),
};
const hits: WikiHit[] = [{ slug: "owner-payments", title: "Λογαριασμοί ιδιοκτήτη", heading: "Βήμα-βήμα", route: "/owner/payments", content: "Πατήστε «Πληρωμή τώρα»." }];

describe("buildSystemPrompt", () => {
  it("names the user, role, page, scope and wiki hits with routes", () => {
    const p = buildSystemPrompt(base, hits);
    expect(p).toContain("Μαρία");
    expect(p).toContain("Ιδιοκτήτης");
    expect(p).toContain("/owner/payments");
    expect(p).toContain("Ερμού 5");
    expect(p).toContain("Α2");
    expect(p).toContain("Λογαριασμοί ιδιοκτήτη › Βήμα-βήμα (/owner/payments)");
    expect(p).toContain("Πατήστε «Πληρωμή τώρα».");
  });
  it("states the no-guessing and permission rules", () => {
    const p = buildSystemPrompt(base, []);
    expect(p).toMatch(/ΠΟΤΕ.*μαντ/i);
    expect(p).toContain("Δεν έχετε");
    expect(p).not.toContain("Γνώση από το wiki");
  });
  it("mentions View-as only when impersonating", () => {
    expect(buildSystemPrompt(base, [])).not.toContain("View-as");
    expect(buildSystemPrompt({ ...base, impersonating: true, real: { id: "sa", role: "SUPER_ADMIN" } }, [])).toContain("View-as");
  });
  it("tells the model that tool results and wiki excerpts are data, not instructions", () => {
    const p = buildSystemPrompt(base, hits);
    expect(p).toMatch(/αποτελέσματα (των )?εργαλείων[^\n]*δεδομένα[^\n]*όχι οδηγίες/i);
  });
});
