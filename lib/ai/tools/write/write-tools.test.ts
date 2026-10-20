import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  resolveBuilding: vi.fn(), resolveRequest: vi.fn(), requireBuildingCap: vi.fn(), resolveResponsibility: vi.fn(async () => "COMPANY"),
  createMaintenanceRequest: vi.fn(), createAnnouncement: vi.fn(), listAnnouncementTargets: vi.fn(), createBuildingExpense: vi.fn(), getBuildingCategorySplits: vi.fn(), createRecurringTask: vi.fn(), createRfq: vi.fn(),
  unitFindFirst: vi.fn(), catFindFirst: vi.fn(), supplierFindMany: vi.fn(),
}));
vi.mock("@/lib/ai/tools/resolve", () => ({ resolveBuilding: m.resolveBuilding, resolveRequest: m.resolveRequest, hrefForFault: (_c: unknown, id: string) => `/x/${id}` }));
vi.mock("@/lib/building-access", () => ({ requireBuildingCap: m.requireBuildingCap }));
vi.mock("@/lib/maintenance-requests", () => ({ resolveResponsibility: m.resolveResponsibility }));
vi.mock("@/app/actions/maintenance-requests", () => ({ createMaintenanceRequest: m.createMaintenanceRequest }));
vi.mock("@/app/actions/announcements", () => ({ createAnnouncement: m.createAnnouncement, listAnnouncementTargets: m.listAnnouncementTargets }));
vi.mock("@/app/actions/building-expenses", () => ({ createBuildingExpense: m.createBuildingExpense }));
vi.mock("@/app/actions/expense-categories", () => ({ getBuildingCategorySplits: m.getBuildingCategorySplits }));
vi.mock("@/app/actions/recurring-tasks", () => ({ createRecurringTask: m.createRecurringTask }));
vi.mock("@/app/actions/rfq", () => ({ createRfq: m.createRfq }));
vi.mock("@/lib/db", () => ({ db: { unit: { findFirst: m.unitFindFirst }, maintenanceCategory: { findFirst: m.catFindFirst }, supplier: { findMany: m.supplierFindMany } } }));

import { createFaultReport } from "./create-fault";
import { createAnnouncement } from "./create-announcement";
import { createBuildingExpense } from "./create-expense";
import { createRecurringTask } from "./create-recurring-task";
import { createRfq } from "./create-rfq";
import { toolsForRole } from "../registry";
import type { AssistantCtx } from "../types";

const ctx = (role: string, extra: Partial<AssistantCtx> = {}): AssistantCtx => ({
  user: { id: "u1", name: "Μ", email: "e", role, customerId: "c1", companyId: null }, real: { id: "u1", role }, impersonating: false,
  surface: role.startsWith("PROPERTY") ? "customer" : "company", perms: new Set(),
  scope: { seesAllCustomers: !role.startsWith("PROPERTY"), managerBuildingIds: [], occupantUnits: [{ unitId: "un1", unitNumber: "Α1", buildingId: "b1", buildingName: "Ερμού", role: "RESIDENT" }], supplierId: null },
  page: { path: "/" }, now: new Date("2026-10-20T10:00:00Z"), ...extra,
});

beforeEach(() => { vi.clearAllMocks(); m.resolveBuilding.mockResolvedValue({ id: "b1", name: "Ερμού" }); m.requireBuildingCap.mockResolvedValue({ userId: "u1" }); });

describe("schemas", () => {
  it("reject invalid payloads", () => {
    expect(createFaultReport.schema.safeParse({ description: "τρέχει νερό" }).success).toBe(false);
    expect(createBuildingExpense.schema.safeParse({ month: "2026-10", categoryName: "ΔΕΗ", totalAmount: 0 }).success).toBe(false);
    expect(createBuildingExpense.schema.safeParse({ month: "10/2026", categoryName: "ΔΕΗ", totalAmount: 10 }).success).toBe(false);
    expect(createRecurringTask.schema.safeParse({ title: "Ασανσέρ", frequency: "DAILY" }).success).toBe(false);
    expect(createRfq.schema.safeParse({ supplierNames: [] }).success).toBe(false);
    expect(createAnnouncement.schema.safeParse({ title: "Διακοπή νερού", content: "Αύριο 9-11.", audience: "ALL" }).success).toBe(true);
  });
});

describe("createFaultReport", () => {
  it("rejects a unit that is not the occupant's own", async () => {
    const r = await createFaultReport.preview({ unitNumber: "Β9", title: "Διαρροή", description: "Τρέχει νερό" }, ctx("PROPERTY_RESIDENT"));
    expect(r).toHaveProperty("error");
    expect(m.unitFindFirst).not.toHaveBeenCalled();
  });
  it("previews with resolved ids and who handles it, then executes through the action", async () => {
    m.catFindFirst.mockResolvedValue({ id: "cat1", name: "Υδραυλικά" });
    const p = await createFaultReport.preview({ unitNumber: "Α1", title: "Διαρροή", description: "Τρέχει νερό", category: "υδραυλ", priority: "HIGH" }, ctx("PROPERTY_RESIDENT"));
    expect(p).not.toHaveProperty("error");
    const prev = p as { summaryLines: string[]; resolved: Record<string, unknown>; buildingId: string };
    expect(prev.buildingId).toBe("b1");
    expect(prev.resolved).toMatchObject({ buildingId: "b1", unitId: "un1", categoryId: "cat1", priority: "HIGH" });
    expect(prev.summaryLines.join("\n")).toContain("εταιρεία διαχείρισης");
    m.createMaintenanceRequest.mockResolvedValue({ id: "req1" });
    const ex = await createFaultReport.execute(prev.resolved, ctx("PROPERTY_RESIDENT"));
    expect(m.createMaintenanceRequest).toHaveBeenCalledWith(expect.objectContaining({ buildingId: "b1", unitId: "un1", title: "Διαρροή" }));
    expect(ex).toEqual({ ok: true, message: "Η βλάβη δηλώθηκε.", href: "/x/req1" });
  });
  it("maps an action error", async () => {
    m.createMaintenanceRequest.mockResolvedValue({ error: "Δεν έχετε πρόσβαση στο κτήριο" });
    expect(await createFaultReport.execute({ buildingId: "b1", title: "x", description: "y" }, ctx("PROPERTY_RESIDENT"))).toEqual({ ok: false, error: "Δεν έχετε πρόσβαση στο κτήριο" });
  });
});

describe("createAnnouncement", () => {
  it("warns with the recipient count and sends HTML paragraphs to the action", async () => {
    m.listAnnouncementTargets.mockResolvedValue([{ id: "p1", roles: ["OWNER"] }, { id: "p2", roles: ["RESIDENT"] }, { id: "p3", roles: ["OWNER", "RESIDENT"] }]);
    const p = await createAnnouncement.preview({ title: "Διακοπή νερού", content: "Αύριο 9-11.\nΕυχαριστούμε <όλους>.", audience: "OWNERS" }, ctx("ADMIN"));
    const prev = p as { warnings: string[]; resolved: Record<string, unknown> };
    expect(prev.warnings[0]).toContain("2 παραλήπτες");
    m.createAnnouncement.mockResolvedValue({ id: "a1" });
    await createAnnouncement.execute(prev.resolved, ctx("ADMIN"));
    expect(m.createAnnouncement).toHaveBeenCalledWith(expect.objectContaining({ title: "Διακοπή νερού", audience: "OWNERS", targets: [{ scopeType: "BUILDING", scopeId: "b1" }], content: "<p>Αύριο 9-11.</p><p>Ευχαριστούμε &lt;όλους&gt;.</p>" }));
  });
  it("denies when the building capability is missing", async () => {
    m.requireBuildingCap.mockRejectedValue(new Error("Forbidden"));
    expect(await createAnnouncement.preview({ title: "x", content: "y", audience: "ALL" }, ctx("PROPERTY_ADMIN"))).toEqual({ error: "Δεν έχετε δικαίωμα ανακοινώσεων σε αυτό το κτήριο" });
  });
});

describe("createBuildingExpense", () => {
  it("defaults the split from the category and executes with ownerPct = 100 - tenantPct", async () => {
    m.getBuildingCategorySplits.mockResolvedValue([{ category: { id: "c-deh", name: "ΔΕΗ κοινοχρήστων" }, effective: { tenantPct: 100, ownerPct: 0 } }, { category: { id: "c-lift", name: "Ανελκυστήρας" }, effective: { tenantPct: 70, ownerPct: 30 } }]);
    const p = await createBuildingExpense.preview({ month: "2026-10", categoryName: "ανελκ", totalAmount: 120.5, supplierName: "ΟΤΙΣ" }, ctx("ADMIN"));
    const prev = p as { resolved: Record<string, unknown>; summaryLines: string[] };
    expect(prev.resolved).toMatchObject({ categoryId: "c-lift", tenantPct: 70 });
    expect(prev.summaryLines.join("\n")).toContain("70%");
    m.createBuildingExpense.mockResolvedValue({ id: "e1" });
    await createBuildingExpense.execute(prev.resolved, ctx("ADMIN"));
    expect(m.createBuildingExpense).toHaveBeenCalledWith("b1", expect.objectContaining({ categoryId: "c-lift", totalAmount: 120.5, tenantPct: 70, ownerPct: 30, fileId: null, month: "2026-10" }));
  });
  it("maps a thrown action error", async () => {
    m.createBuildingExpense.mockRejectedValue(new Error("dup"));
    expect(await createBuildingExpense.execute({ buildingId: "b1", categoryId: "c", month: "2026-10", totalAmount: 1, tenantPct: 50 }, ctx("ADMIN"))).toEqual({ ok: false, error: "dup" });
  });
});

describe("createRecurringTask", () => {
  it("executes through the action with the building id", async () => {
    m.createRecurringTask.mockResolvedValue({ task: "t1" });
    const p = await createRecurringTask.preview({ title: "Συντήρηση ανελκυστήρα", frequency: "MONTHLY", nextDueDate: "2026-11-01" }, ctx("ADMIN"));
    const prev = p as { resolved: Record<string, unknown> };
    const ex = await createRecurringTask.execute(prev.resolved, ctx("ADMIN"));
    expect(m.createRecurringTask).toHaveBeenCalledWith("b1", expect.objectContaining({ title: "Συντήρηση ανελκυστήρα", frequency: "MONTHLY", nextDueDate: "2026-11-01" }));
    expect(ex.ok).toBe(true);
  });
});

describe("createRfq", () => {
  it("resolves suppliers by name and passes their ids", async () => {
    m.resolveRequest.mockResolvedValue({ id: "req1", name: "Διαρροή" });
    m.supplierFindMany.mockImplementation(async ({ where }: { where: { name: { contains: string } } }) => (where.name.contains === "ΟΤΙΣ" ? [{ id: "s1", name: "ΟΤΙΣ ΑΕ" }] : [{ id: "s2", name: "Υδραυλικός Α" }]));
    const p = await createRfq.preview({ supplierNames: ["ΟΤΙΣ", "Υδραυλ"], deadlineAt: "2026-10-25" }, ctx("ADMIN"));
    const prev = p as { resolved: Record<string, unknown>; warnings: string[] };
    expect(prev.resolved).toMatchObject({ maintenanceRequestId: "req1", supplierIds: ["s1", "s2"] });
    expect(prev.warnings[0]).toContain("2 συνεργάτες");
    m.createRfq.mockResolvedValue({ id: "rfq1" });
    await createRfq.execute(prev.resolved, ctx("ADMIN"));
    expect(m.createRfq).toHaveBeenCalledWith(expect.objectContaining({ maintenanceRequestId: "req1", supplierIds: ["s1", "s2"], deadlineAt: "2026-10-25T23:59:00" }));
  });
  it("fails the preview when a name is ambiguous", async () => {
    m.resolveRequest.mockResolvedValue({ id: "req1", name: "Διαρροή" });
    m.supplierFindMany.mockResolvedValue([{ id: "s1", name: "Α" }, { id: "s2", name: "Β" }]);
    expect(await createRfq.preview({ supplierNames: ["Α"] }, ctx("ADMIN"))).toHaveProperty("error");
  });
});

describe("registry gating of write tools", () => {
  it("filters write tools by role and permission", () => {
    const names = (role: string, perms: string[] = []) => toolsForRole(role, new Set(perms)).map((t) => t.name);
    expect(names("PROPERTY_RESIDENT")).toContain("createFaultReport");
    expect(names("PROPERTY_RESIDENT")).not.toContain("createAnnouncement");
    expect(names("PROPERTY_ADMIN")).toEqual(expect.arrayContaining(["createAnnouncement", "createBuildingExpense", "createRecurringTask"]));
    expect(names("MANAGER", ["suppliers:edit"])).toContain("createRfq");
    expect(names("MANAGER")).not.toContain("createRfq");
    expect(names("COLLABORATOR", ["suppliers:edit"])).not.toContain("createRfq");
  });
});
