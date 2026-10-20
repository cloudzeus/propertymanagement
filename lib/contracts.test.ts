import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ wo: {} as Record<string, unknown> }));
vi.mock("@/lib/db", () => ({
  db: {
    contractTemplate: { findUnique: vi.fn(async () => null) },
    workOrder: { findUnique: vi.fn(async () => m.wo) },
    company: { findFirst: vi.fn(async () => ({ name: "Orithon", afm: "123" })) },
    appSettings: { findUnique: vi.fn(async () => ({ silentAcceptDays: 5, warrantyMonths: 6 })) },
  },
}));

import { renderContract } from "./contracts";

const baseWo = () => ({
  number: "WO-2026-0007", description: "Αντικατάσταση αντλίας", earliestDate: null, validUntil: null, warrantyMonths: 6, createdAt: new Date("2026-10-01T10:00:00Z"),
  customerPrice: 120, supplierPrice: 100, vatPct: 24, covered: false, surveyFee: null, surveyWaived: true,
  customerAcceptedAt: null, customerAcceptedIp: null, supplierAcceptedAt: null, supplierAcceptedIp: null, supplierAcceptedName: null,
  building: { name: "Αθηνάς 12", address: "Αθηνάς 12", city: "Μαρούσι" }, customer: { name: "Πελάτης", afm: "999" },
  supplier: { name: "Ηλεκτρολόγοι ΑΕ", afm: "111", doy: "Αμαρουσίου", paymentTermsDays: 30, email: "a@firm.gr" },
});

beforeEach(() => { m.wo = baseWo(); });

describe("renderContract — supplier side acceptance block", () => {
  it("shows the signatory name, time and IP once the supplier has e-accepted", async () => {
    m.wo = { ...baseWo(), supplierAcceptedAt: new Date("2026-10-20T09:30:00Z"), supplierAcceptedIp: "1.2.3.4", supplierAcceptedName: "Γιάννης Παπάς" };
    const { html } = await renderContract("WO_SUPPLIER", "w1");
    expect(html).toContain("Αποδοχή Συνεργάτη:");
    expect(html).toContain("Γιάννης Παπάς");
    expect(html).toContain("IP 1.2.3.4");
  });
  it("says acceptance is pending otherwise", async () => {
    const { html } = await renderContract("WO_SUPPLIER", "w1");
    expect(html).toContain("Εκκρεμεί αποδοχή από τον Συνεργάτη");
    expect(html).not.toContain("IP ");
  });
  it("exposes {{supplier.signatory}} to templates", async () => {
    m.wo = { ...baseWo(), supplierAcceptedName: "Γιάννης Παπάς" };
    const { html } = await renderContract("WO_SUPPLIER", "w1");
    expect(html).toContain("Γιάννης Παπάς");
  });
});
