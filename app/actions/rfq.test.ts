import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  openRfq: null as null | { id: string },
  created: [] as unknown[],
}));
vi.mock("@/lib/auth-effective", () => ({ getEffectiveSession: async () => ({ user: { id: "staff1", role: "MANAGER", customerId: null } }) }));
vi.mock("@/lib/rbac/permissions", () => ({ getEffectivePermissions: async () => ({ perms: new Set(["rfq:create", "rfq:edit"]), role: "MANAGER" }), can: (p: Set<string>, k: string, a: string) => p.has(`${k}:${a}`) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/notify", () => ({ notifyUsers: vi.fn(async () => {}), supplierUserIds: vi.fn(async () => []), companyStaffIds: vi.fn(async () => []), buildingDeciderIds: vi.fn(async () => []) }));
vi.mock("@/lib/rfq-send", () => ({ sendRfqInvitations: vi.fn(async () => ({ sent: 1, noEmail: [], failed: [] })) }));
vi.mock("@/lib/rfq-candidates", () => ({ listRfqCandidates: vi.fn() }));
vi.mock("@/lib/contracts", () => ({ renderContract: vi.fn() }));
vi.mock("@/lib/realtime/bus", () => ({ publishBuildingEvent: () => {} }));
vi.mock("@/lib/mailgun", () => ({ sendBrandedEmail: vi.fn() }));
vi.mock("@/lib/email-brand", () => ({ getEmailBrand: async () => ({}) }));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn(async () => ({ supplierId: null, isSupplierAdmin: false })) },
    maintenanceRequest: { findUnique: vi.fn(async () => ({ id: "f1", title: "Διαρροή", description: "…", buildingId: "b1", categoryId: null, building: { name: "Κ", address: null, city: null } })) },
    supplier: { findMany: vi.fn(async () => [{ id: "s1" }]) },
    serviceRequest: {
      findFirst: vi.fn(async () => m.openRfq),
      create: vi.fn(async ({ data }: { data: unknown }) => { m.created.push(data); return { id: "rfqNew" }; }),
    },
    maintenanceStatusEvent: { create: vi.fn(async () => ({})) },
  },
}));

import { createRfq } from "./rfq";

beforeEach(() => { vi.clearAllMocks(); m.openRfq = null; m.created.length = 0; });

describe("createRfq", () => {
  it("refuses a second open RFQ on the same fault so suppliers are not invited twice", async () => {
    m.openRfq = { id: "rfqOld" };
    expect(await createRfq({ maintenanceRequestId: "f1", supplierIds: ["s1"] })).toEqual({ error: "Υπάρχει ήδη ανοιχτό αίτημα προσφοράς για αυτή τη βλάβη — προσθέστε συνεργάτες σε αυτό ή ακυρώστε το." });
    expect(m.created).toEqual([]);
  });
  it("creates the RFQ when none is open", async () => {
    expect(await createRfq({ maintenanceRequestId: "f1", supplierIds: ["s1"] })).toMatchObject({ id: "rfqNew", sent: 1 });
  });
});
