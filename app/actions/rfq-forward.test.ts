import { describe, it, expect, vi, beforeEach } from "vitest";

/* forwardOffer — travel fee from the building's distance zone (kept apart from
 * rfq.test.ts, which another session edits concurrently). */

const m = vi.hoisted(() => ({
  offer: {} as Record<string, unknown> & { rfq: Record<string, unknown> & { building: Record<string, unknown> & { distanceKm: number | null } } },
  woCreated: [] as Record<string, unknown>[],
}));
vi.mock("@/lib/auth-effective", () => ({ getEffectiveSession: async () => ({ user: { id: "staff1", role: "ADMIN", customerId: null } }) }));
vi.mock("@/lib/rbac/permissions", () => ({ getEffectivePermissions: async () => ({ perms: new Set(["suppliers:edit"]), role: "ADMIN" }), can: (p: Set<string>, k: string, a: string) => p.has(`${k}:${a}`) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/notify", () => ({ notifyUsers: vi.fn(async () => {}), supplierUserIds: vi.fn(async () => []), companyStaffIds: vi.fn(async () => []), buildingDeciderIds: vi.fn(async () => []) }));
vi.mock("@/lib/rfq-send", () => ({ sendRfqInvitations: vi.fn() }));
vi.mock("@/lib/rfq-candidates", () => ({ listRfqCandidates: vi.fn() }));
vi.mock("@/lib/contracts", () => ({ renderContract: vi.fn(async () => ({ title: "t", html: "<p>frozen</p>", version: 1 })) }));
vi.mock("@/lib/realtime/bus", () => ({ publishBuildingEvent: () => {}, publishCompanyEvent: () => {} }));
vi.mock("@/lib/mailgun", () => ({ sendBrandedEmail: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/email-brand", () => ({ getEmailBrand: async () => ({ name: "Orithon", siteUrl: "https://x" }) }));
vi.mock("@/lib/distance/buildings", async () => {
  const { DEFAULT_ZONES } = await import("@/lib/distance/zones");
  return { getDistanceZones: async () => DEFAULT_ZONES };
});
vi.mock("@/lib/db", () => {
  const tx = {
    workOrder: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { m.woCreated.push(data); return { id: `w${m.woCreated.length}`, number: "WO-2026-0001" }; }), findFirst: vi.fn(async () => null), count: vi.fn(async () => 0), update: vi.fn(async () => ({})) },
    supplierOffer: { update: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({})) },
    serviceRequest: { update: vi.fn(async () => ({})) },
    maintenanceRequest: { update: vi.fn(async () => ({})) },
    maintenanceStatusEvent: { create: vi.fn(async () => ({})) },
  };
  return {
    db: {
      ...tx,
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
      user: { findUnique: vi.fn(async () => ({ supplierId: null, isSupplierAdmin: false })) },
      supplierOffer: { ...tx.supplierOffer, findUnique: vi.fn(async () => m.offer) },
      appSettings: { findUnique: vi.fn(async () => ({ offerMarkupPct: 15, warrantyMonths: 6, distanceZones: null })) },
    },
  };
});

import { forwardOffer } from "./rfq";

beforeEach(() => {
  vi.clearAllMocks();
  m.woCreated.length = 0;
  m.offer = {
    id: "o1", rfqId: "rfq1", supplierId: "s1", amount: 100, vatPct: 24, surveyFee: null, surveyWaived: true, description: null, status: "SUBMITTED", earliestDate: null, validUntil: null,
    workOrder: null,
    rfq: { title: "Αντλία", description: "…", building: { id: "b1", customerId: "c1", name: "Κ", distanceKm: 23 }, maintenanceRequest: null },
  };
});

describe("forwardOffer — travel fee", () => {
  it("defaults the travel fee from the building zone and adds it to the customer price", async () => {
    const r = await forwardOffer("o1", { markupPct: 10 });
    expect(r).toMatchObject({ id: "w1" });
    expect(m.woCreated[0]).toMatchObject({ supplierPrice: 100, customerPrice: 125, travelFee: 15, travelZone: "B", travelKm: 23, markupPct: 10 });
  });
  it("uses the manual travel fee and manual price when given", async () => {
    await forwardOffer("o1", { markupPct: 10, travelFee: 5, customerPrice: 150 });
    expect(m.woCreated[0]).toMatchObject({ customerPrice: 150, travelFee: 5, travelZone: "B" });
  });
  it("adds a manual travel fee to the computed price when no manual price is given", async () => {
    await forwardOffer("o1", { markupPct: 10, travelFee: 5 });
    expect(m.woCreated[0]).toMatchObject({ customerPrice: 115, travelFee: 5 });
  });
  it("is zero for covered work", async () => {
    await forwardOffer("o1", { covered: true });
    expect(m.woCreated[0]).toMatchObject({ customerPrice: 0, travelFee: 0, travelZone: "B", travelKm: 23 });
  });
  it("is zero with no zone for buildings without distance", async () => {
    m.offer.rfq.building.distanceKm = null;
    await forwardOffer("o1", { markupPct: 10 });
    expect(m.woCreated[0]).toMatchObject({ customerPrice: 110, travelFee: 0, travelZone: null, travelKm: null });
  });
  it("never goes negative", async () => {
    await forwardOffer("o1", { markupPct: 10, travelFee: -40 });
    expect(m.woCreated[0]).toMatchObject({ customerPrice: 110, travelFee: 0 });
  });
});
