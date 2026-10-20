import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const m = vi.hoisted(() => ({
  logCreate: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "act1", ...data })),
  logFindUnique: vi.fn(), logUpdateMany: vi.fn(), logUpdate: vi.fn(async (_q: unknown) => ({})),
  msgCreate: vi.fn(async (_q: unknown) => ({ id: "m1" })), convUpdate: vi.fn(async () => ({})),
  buildCtx: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { aiActionLog: { create: m.logCreate, findUnique: m.logFindUnique, updateMany: m.logUpdateMany, update: m.logUpdate }, aiMessage: { create: m.msgCreate }, aiConversation: { update: m.convUpdate, findUnique: vi.fn(async () => ({ pagePath: "/x" })) } } }));
vi.mock("./context", () => ({ buildAssistantContext: m.buildCtx }));

const tool = {
  name: "createFaultReport", description: "", kind: "write" as const, roles: [], label: "Βλάβη",
  schema: z.object({ title: z.string().min(3), buildingId: z.string().optional() }),
  preview: vi.fn(async (args: { title: string }) => ({ title: "Δήλωση βλάβης", summaryLines: [`Τίτλος: ${args.title}`], warnings: [], resolved: { title: args.title, buildingId: "b1" }, buildingId: "b1" })),
  execute: vi.fn(async () => ({ ok: true as const, message: "Η βλάβη δηλώθηκε.", href: "/portal/requests/r1" })),
};
vi.mock("@/lib/ai/tools/registry", () => ({ findTool: (n: string) => (n === "createFaultReport" ? tool : undefined), toolsForRole: () => [tool] }));

import { proposeAction, confirmAction, cancelAction, expireStale } from "./actions";
import type { AssistantCtx } from "@/lib/ai/tools/types";
import type { EffectiveSession } from "@/lib/auth-effective";

const ctx = (over: Partial<AssistantCtx> = {}): AssistantCtx => ({
  user: { id: "u1", name: "Μ", email: "e", role: "PROPERTY_RESIDENT", customerId: "c1", companyId: null }, real: { id: "u1", role: "PROPERTY_RESIDENT" }, impersonating: false,
  surface: "customer", perms: new Set(), scope: { seesAllCustomers: false, managerBuildingIds: [], occupantUnits: [], supplierId: null }, page: { path: "/portal" }, now: new Date("2026-10-20T10:00:00Z"), ...over,
});
const eff: EffectiveSession = { user: { id: "u1", role: "PROPERTY_RESIDENT", roleId: null, companyId: null, customerId: "c1", name: "Μ", email: "e" }, real: { id: "u1", role: "PROPERTY_RESIDENT" }, impersonatorId: null };
const proposed = (over: Record<string, unknown> = {}) => ({ id: "act1", userId: "u1", status: "PROPOSED", expiresAt: new Date(Date.now() + 60_000), toolName: "createFaultReport", argsJson: { title: "Διαρροή" }, previewJson: { page: { path: "/building/b1", buildingId: "b1", tab: "maintenance" } }, conversationId: "conv1", ...over });

beforeEach(() => { vi.clearAllMocks(); m.buildCtx.mockResolvedValue(ctx()); });

describe("proposeAction", () => {
  it("rejects invalid args with a Greek message and writes nothing", async () => {
    const r = await proposeAction(ctx(), tool, { title: "x" }, "conv1");
    expect(r).toHaveProperty("error");
    expect((r as { error: string }).error).toMatch(/title/);
    expect(m.logCreate).not.toHaveBeenCalled();
  });
  it("stores a PROPOSED log with the real actor when impersonating and returns the card", async () => {
    const r = await proposeAction(ctx({ impersonating: true, real: { id: "sa", role: "SUPER_ADMIN" } }), tool, { title: "Διαρροή" }, "conv1");
    expect(r).toMatchObject({ card: { actionId: "act1", tool: "createFaultReport", title: "Δήλωση βλάβης", summaryLines: ["Τίτλος: Διαρροή"] } });
    const data = m.logCreate.mock.calls[0]![0].data;
    expect(data).toMatchObject({ status: "PROPOSED", userId: "u1", actorId: "sa", toolName: "createFaultReport", buildingId: "b1", conversationId: "conv1" });
    expect((data.expiresAt as Date).getTime() - Date.now()).toBeGreaterThan(14 * 60 * 1000);
  });
});

describe("review fixes", () => {
  it("stores the authorized page context with the proposal", async () => {
    await proposeAction(ctx({ page: { path: "/building/b1", buildingId: "b1", buildingName: "Ερμού", tab: "maintenance" } }), tool, { title: "Διαρροή" }, "conv1");
    const data = m.logCreate.mock.calls[0]![0].data as { previewJson: { page?: unknown } };
    expect(data.previewJson.page).toEqual({ path: "/building/b1", buildingId: "b1", tab: "maintenance" });
  });
  it("re-authorizes the proposal's page context on confirm (not just the conversation path)", async () => {
    m.logFindUnique.mockResolvedValue(proposed());
    m.logUpdateMany.mockResolvedValue({ count: 1 });
    await confirmAction("act1", eff);
    expect(m.buildCtx).toHaveBeenCalledWith(eff, { path: "/building/b1", buildingId: "b1", tab: "maintenance" });
  });
  it("marks the row FAILED when something throws after the EXECUTING claim", async () => {
    m.logFindUnique.mockResolvedValue(proposed());
    m.logUpdateMany.mockResolvedValue({ count: 1 });
    tool.preview.mockRejectedValueOnce(new Error("Forbidden"));
    const r = await confirmAction("act1", eff);
    expect(r).toEqual({ ok: false, error: "Forbidden" });
    expect(m.logUpdate.mock.calls[0]![0] as object).toMatchObject({ where: { id: "act1" }, data: { status: "FAILED", error: "Forbidden" } });
  });
  it("returns the stored result when an EXECUTED proposal is confirmed again", async () => {
    m.logFindUnique.mockResolvedValue(proposed({ status: "EXECUTED", resultJson: { ok: true, message: "Η βλάβη δηλώθηκε.", href: "/portal/requests/r1" } }));
    expect(await confirmAction("act1", eff)).toEqual({ ok: true, message: "Η βλάβη δηλώθηκε.", href: "/portal/requests/r1" });
    expect(tool.execute).not.toHaveBeenCalled();
  });
  it("expireStale also fails EXECUTING rows stuck for more than 5 minutes", async () => {
    m.logUpdateMany.mockResolvedValue({ count: 0 });
    await expireStale();
    const calls = m.logUpdateMany.mock.calls.map((c) => c[0] as { where: { status: string }; data: { status: string } });
    expect(calls.some((c) => c.where.status === "PROPOSED" && c.data.status === "EXPIRED")).toBe(true);
    expect(calls.some((c) => c.where.status === "EXECUTING" && c.data.status === "FAILED")).toBe(true);
  });
});

describe("confirmAction", () => {
  it("executes exactly once and records the result and a tool message", async () => {
    m.logFindUnique.mockResolvedValue(proposed());
    m.logUpdateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const r1 = await confirmAction("act1", eff);
    expect(r1).toEqual({ ok: true, message: "Η βλάβη δηλώθηκε.", href: "/portal/requests/r1" });
    expect(tool.execute).toHaveBeenCalledTimes(1);
    expect(m.logUpdate.mock.calls[0]![0] as object).toMatchObject({ where: { id: "act1" }, data: { status: "EXECUTED" } });
    expect(m.msgCreate.mock.calls[0]![0] as object).toMatchObject({ data: { conversationId: "conv1", role: "tool", toolName: "createFaultReport" } });
    const r2 = await confirmAction("act1", eff);
    expect(r2).toEqual({ ok: false, error: "Η ενέργεια εκτελείται ήδη." });
    expect(tool.execute).toHaveBeenCalledTimes(1);
  });
  it("marks FAILED when the tool reports an error", async () => {
    m.logFindUnique.mockResolvedValue(proposed());
    m.logUpdateMany.mockResolvedValue({ count: 1 });
    tool.execute.mockResolvedValueOnce({ ok: false, error: "Δεν έχετε πρόσβαση στο κτήριο" } as never);
    expect(await confirmAction("act1", eff)).toEqual({ ok: false, error: "Δεν έχετε πρόσβαση στο κτήριο" });
    expect(m.logUpdate.mock.calls[0]![0] as object).toMatchObject({ data: { status: "FAILED", error: "Δεν έχετε πρόσβαση στο κτήριο" } });
  });
  it("refuses another user's proposal and an expired one without executing", async () => {
    m.logFindUnique.mockResolvedValue(proposed({ userId: "other" }));
    expect(await confirmAction("act1", eff)).toEqual({ ok: false, error: "Η πρόταση δεν σας ανήκει." });
    m.logFindUnique.mockResolvedValue(proposed({ expiresAt: new Date(Date.now() - 1) }));
    expect(await confirmAction("act1", eff)).toMatchObject({ ok: false, error: expect.stringContaining("έληξε") });
    expect(tool.execute).not.toHaveBeenCalled();
  });
});

describe("cancelAction", () => {
  it("cancels the owner's live proposal", async () => {
    m.logFindUnique.mockResolvedValue(proposed());
    m.logUpdateMany.mockResolvedValue({ count: 1 });
    expect(await cancelAction("act1", eff)).toEqual({ ok: true });
    expect(m.logUpdateMany.mock.calls[0]![0] as object).toMatchObject({ where: { id: "act1", status: "PROPOSED" }, data: { status: "CANCELLED" } });
  });
});
