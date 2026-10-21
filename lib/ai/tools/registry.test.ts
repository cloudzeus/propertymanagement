import { describe, it, expect } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/building-access", () => ({ getBuildingAccess: vi.fn(), requireBuildingCap: vi.fn(), requireBuildingView: vi.fn(), managerBuildingIds: vi.fn() }));
vi.mock("@/lib/maintenance-requests", () => ({ canAccessRequest: vi.fn(), resolveResponsibility: vi.fn() }));
vi.mock("@/lib/ai/assistant/retrieval", () => ({ retrieveWiki: vi.fn() }));
vi.mock("@/app/actions/maintenance-requests", () => ({ createMaintenanceRequest: vi.fn() }));
vi.mock("@/app/actions/announcements", () => ({ createAnnouncement: vi.fn(), listAnnouncements: vi.fn(), listAnnouncementTargets: vi.fn() }));
vi.mock("@/app/actions/building-expenses", () => ({ createBuildingExpense: vi.fn(), listBuildingExpenses: vi.fn() }));
vi.mock("@/app/actions/expense-categories", () => ({ getBuildingCategorySplits: vi.fn() }));
vi.mock("@/app/actions/recurring-tasks", () => ({ createRecurringTask: vi.fn() }));
vi.mock("@/app/actions/rfq", () => ({ createRfq: vi.fn() }));
vi.mock("@/lib/building/occupant-data", () => ({ getOccupantControlCenter: vi.fn() }));
vi.mock("@/lib/work/queries", () => ({ loadWorkItems: vi.fn(), managedCustomerIds: vi.fn() }));

import { vi } from "vitest";
import { TOOLS, toolsForRole, toAgentTools, findTool } from "./registry";
import type { AssistantTool } from "./types";
import { TOOL_LABELS } from "./labels";

describe("registry", () => {
  it("has unique names and object JSON schemas", () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of toAgentTools(TOOLS)) expect((t.parameters as { type?: string }).type).toBe("object");
    expect(findTool("listFaults")?.kind).toBe("read");
    expect(findTool("nope")).toBeUndefined();
  });
  it("has a client-safe label for every tool, matching the tool's own label", () => {
    for (const t of TOOLS) expect(TOOL_LABELS[t.name]).toBe(t.label);
    expect(Object.keys(TOOL_LABELS).sort()).toEqual(TOOLS.map((t) => t.name).sort());
  });
  it("filters tools by role", () => {
    const resident = toolsForRole("PROPERTY_RESIDENT", new Set()).map((t) => t.name);
    expect(resident).toEqual(expect.arrayContaining(["listFaults", "getMyBalance", "listMyBuildings", "listAnnouncements", "searchWiki"]));
    expect(resident).not.toContain("listExpenses");
    expect(toolsForRole("COLLABORATOR", new Set()).map((t) => t.name)).not.toContain("getMyBalance");
  });
  it("gates a tool with requiredPerm on the permission set", () => {
    const gated: AssistantTool = { name: "x", description: "", kind: "read", roles: ["MANAGER"], requiredPerm: "suppliers:edit", schema: TOOLS[0].schema, label: "", run: async () => ({ ok: true, data: null }) };
    expect(toolsForRole("MANAGER", new Set(["suppliers:edit"]), [gated]).map((t) => t.name)).toContain("x");
    expect(toolsForRole("MANAGER", new Set(), [gated]).map((t) => t.name)).not.toContain("x");
    expect(toolsForRole("COLLABORATOR", new Set(["suppliers:edit"]), [gated]).map((t) => t.name)).not.toContain("x");
  });
  it("exposes listPendingWork to company roles with work:view only", () => {
    expect(toolsForRole("ADMIN", new Set(["work:view"])).map((t) => t.name)).toContain("listPendingWork");
    expect(toolsForRole("EMPLOYEE", new Set(["work:view"])).map((t) => t.name)).toContain("listPendingWork");
    expect(toolsForRole("ADMIN", new Set()).map((t) => t.name)).not.toContain("listPendingWork");
    expect(toolsForRole("PROPERTY_ADMIN", new Set(["work:view"])).map((t) => t.name)).not.toContain("listPendingWork");
  });
});
