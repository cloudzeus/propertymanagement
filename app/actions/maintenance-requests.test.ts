import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  actor: { id: "staff1", role: "MANAGER" },
  req: null as null | Record<string, unknown>,
  updates: [] as Record<string, unknown>[],
  appointments: [] as Record<string, unknown>[],
  notify: vi.fn(async () => {}),
}));
vi.mock("@/lib/auth-effective", () => ({ getEffectiveSession: async () => ({ user: { id: m.actor.id, role: m.actor.role } }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/realtime/bus", () => ({ publishBuildingEvent: () => {}, publishCompanyEvent: () => {} }));
vi.mock("@/lib/building-access", () => ({ requireBuildingCap: vi.fn(async () => {}) }));
vi.mock("@/lib/maintenance-requests", () => ({
  notifyStakeholders: m.notify, canAccessRequest: vi.fn(async () => true), resolveResponsibility: vi.fn(async () => "COMPANY"), computeSlaDueAt: () => null,
}));
vi.mock("@/lib/db", () => ({
  db: {
    maintenanceRequest: {
      findUnique: vi.fn(async () => m.req),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { m.updates.push(data); return {}; }),
    },
    maintenanceAppointment: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { m.appointments.push(data); return { id: "a1" }; }) },
    user: { findUnique: vi.fn(async () => null) },
    $transaction: vi.fn(async (ops: unknown) => (Array.isArray(ops) ? Promise.all(ops) : (ops as (tx: unknown) => Promise<unknown>)({}))),
  },
}));

import { scheduleRequest } from "./maintenance-requests";

const future = (minutes: number) => { const d = new Date(Date.now() + 2 * 24 * 3600_000); d.setHours(10, minutes, 0, 0); return d; };

beforeEach(() => {
  vi.clearAllMocks(); m.updates.length = 0; m.appointments.length = 0;
  m.actor = { id: "staff1", role: "MANAGER" };
  m.req = { id: "f1", title: "Διαρροή", status: "OPEN", buildingId: "b1", handledBy: "COMPANY", reportedById: "r1", supplierId: null, estimatedMinutes: null, managerPresence: false, building: { propertyId: "p1" } };
});

describe("scheduleRequest", () => {
  it("rejects a start in the past, a start off the 30-minute grid, and a closed fault", async () => {
    expect(await scheduleRequest("f1", new Date(Date.now() - 3600_000).toISOString())).toEqual({ error: "Η ημερομηνία πρέπει να είναι στο μέλλον" });
    expect(await scheduleRequest("f1", future(20).toISOString())).toEqual({ error: "Η ώρα πρέπει να είναι σε όρια 30 λεπτών" });
    m.req!.status = "COMPLETED";
    expect(await scheduleRequest("f1", future(30).toISOString())).toEqual({ error: "Η βλάβη έχει κλείσει" });
    expect(m.appointments).toHaveLength(0);
  });
  it("creates the appointment, stores the duration and moves an OPEN fault to SCHEDULED", async () => {
    const start = future(30);
    expect(await scheduleRequest("f1", start.toISOString(), 90)).toEqual({ ok: true });
    expect(m.appointments[0]).toMatchObject({ requestId: "f1", startAt: start, endAt: new Date(start.getTime() + 90 * 60_000), bookedById: "staff1", managerPresence: false });
    expect(m.updates[0]).toMatchObject({ scheduledDate: start, estimatedMinutes: 90, status: "SCHEDULED" });
    const ev = (m.updates[0].statusEvents as { create: { fromStatus: string; toStatus: string; note: string } }).create;
    expect(ev).toMatchObject({ fromStatus: "OPEN", toStatus: "SCHEDULED" });
    expect(ev.note.startsWith("Ραντεβού")).toBe(true);
    expect(m.notify).toHaveBeenCalledWith(expect.objectContaining({ requestId: "f1", type: "MAINTENANCE_APPOINTMENT", excludeUserId: "staff1" }));
  });
  it("keeps the status of an IN_PROGRESS fault but still records the appointment", async () => {
    m.req!.status = "IN_PROGRESS";
    expect(await scheduleRequest("f1", future(0).toISOString(), 60)).toEqual({ ok: true });
    expect(m.updates[0].status).toBeUndefined();
    const ev = (m.updates[0].statusEvents as { create: { fromStatus: string; toStatus: string } }).create;
    expect(ev).toMatchObject({ fromStatus: "IN_PROGRESS", toStatus: "IN_PROGRESS" });
    expect(m.appointments).toHaveLength(1);
  });
  it("falls back to the stored estimate (then 60) when no usable duration is given, rounding to 30", async () => {
    m.req!.estimatedMinutes = 60;
    await scheduleRequest("f1", future(30).toISOString());
    expect(m.updates[0].estimatedMinutes).toBe(60);
    await scheduleRequest("f1", future(30).toISOString(), 0);
    expect(m.updates[1].estimatedMinutes).toBe(60);
    await scheduleRequest("f1", future(30).toISOString(), Number.NaN);
    expect(m.updates[2].estimatedMinutes).toBe(60);
    m.req!.estimatedMinutes = null;
    await scheduleRequest("f1", future(30).toISOString());
    expect(m.updates[3].estimatedMinutes).toBe(60);
    await scheduleRequest("f1", future(30).toISOString(), 45);
    expect(m.updates[4].estimatedMinutes).toBe(60);
    await scheduleRequest("f1", future(30).toISOString(), 10);
    expect(m.updates[5].estimatedMinutes).toBe(30);
  });
  it("stores the manager-presence flag on the appointment and the fault in the same update, with a single notification", async () => {
    const start = future(30);
    expect(await scheduleRequest("f1", start.toISOString(), 60, true)).toEqual({ ok: true });
    expect(m.appointments[0]).toMatchObject({ managerPresence: true });
    expect(m.updates[0]).toMatchObject({ managerPresence: true, estimatedMinutes: 60 });
    expect(m.notify).toHaveBeenCalledTimes(1);
    expect((m.notify.mock.calls[0] as unknown as [{ body: string }])[0].body).toContain("παρουσία διαχειριστή");
  });
  it("refuses non-company roles that cannot manage the fault", async () => {
    m.actor = { id: "x", role: "PROPERTY_OWNER" };
    expect(await scheduleRequest("f1", future(30).toISOString())).toEqual({ error: "Δεν επιτρέπεται" });
  });
});
