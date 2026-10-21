import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  openRfq: null as null | { id: string },
  created: [] as unknown[],
  actor: { id: "staff1", role: "MANAGER", supplierId: null as string | null, isSupplierAdmin: false, perms: ["rfq:create", "rfq:edit"] },
  invitation: null as null | Record<string, unknown>,
  wo: null as null | Record<string, unknown>,
  woUpdates: [] as Record<string, unknown>[],
  notify: vi.fn(async () => {}),
  send: vi.fn(async () => ({ sent: 1, noEmail: [], failed: [] })),
  deciders: [] as string[],
  events: [] as Record<string, unknown>[],
  comments: [] as Record<string, unknown>[],
}));
vi.mock("@/lib/auth-effective", () => ({ getEffectiveSession: async () => ({ user: { id: m.actor.id, role: m.actor.role, customerId: null } }) }));
vi.mock("@/lib/rbac/permissions", () => ({ getEffectivePermissions: async () => ({ perms: new Set(m.actor.perms), role: m.actor.role }), can: (p: Set<string>, k: string, a: string) => p.has(`${k}:${a}`) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1", "user-agent": "UA/1" }) }));
vi.mock("@/lib/notify", () => ({ notifyUsers: m.notify, supplierUserIds: vi.fn(async () => []), companyStaffIds: vi.fn(async () => ["adm1"]), buildingDeciderIds: vi.fn(async () => m.deciders) }));
vi.mock("@/lib/rfq-send", () => ({ sendRfqInvitations: m.send }));
vi.mock("@/lib/rfq-candidates", () => ({ listRfqCandidates: vi.fn() }));
vi.mock("@/lib/contracts", () => ({ renderContract: vi.fn(async () => ({ title: "t", html: "<p>frozen</p>", version: 1 })) }));
vi.mock("@/lib/realtime/bus", () => ({ publishBuildingEvent: () => {} }));
vi.mock("@/lib/mailgun", () => ({ sendBrandedEmail: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/email-brand", () => ({ getEmailBrand: async () => ({ name: "Orithon", siteUrl: "https://x" }) }));
vi.mock("@/lib/db", () => {
  const db: Record<string, unknown> = {
    user: { findUnique: vi.fn(async () => ({ supplierId: m.actor.supplierId, isSupplierAdmin: m.actor.isSupplierAdmin, email: "me@x.gr" })), findMany: vi.fn(async () => []) },
    rfqInvitation: { findUnique: vi.fn(async () => m.invitation) },
    workOrder: {
      findFirst: vi.fn(async () => m.wo),
      findUnique: vi.fn(async () => m.wo),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { m.woUpdates.push(data); Object.assign(m.wo!, data); return m.wo; }),
    },
    maintenanceComment: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { m.comments.push(data); return {}; }) },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(db)),
    supplier: { findMany: vi.fn(async () => [{ id: "s1" }]), findUnique: vi.fn(async () => ({ name: "Ηλεκτρολόγοι ΑΕ" })) },
    maintenanceRequest: {
      findUnique: vi.fn(async () => ({ id: "f1", title: "Διαρροή", description: "…", status: "OPEN", buildingId: "b1", categoryId: null, building: { name: "Κ", address: null, city: null } })),
      update: vi.fn(async () => ({})),
    },
    serviceRequest: {
      findFirst: vi.fn(async () => m.openRfq),
      create: vi.fn(async ({ data }: { data: unknown }) => { m.created.push(data); return { id: "rfqNew" }; }),
      updateMany: vi.fn(async () => ({})),
    },
    maintenanceStatusEvent: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { m.events.push(data); return {}; }) },
  };
  return { db };
});

import { createRfq, resendRfqInvitation, supplierAcceptWorkOrder, respondWorkOrder, confirmWorkOrder } from "./rfq";

beforeEach(() => {
  vi.clearAllMocks(); m.openRfq = null; m.created.length = 0; m.woUpdates.length = 0; m.deciders = []; m.events.length = 0; m.comments.length = 0;
  m.actor = { id: "staff1", role: "MANAGER", supplierId: null, isSupplierAdmin: false, perms: ["rfq:create", "rfq:edit"] };
  m.invitation = { id: "inv1", supplierId: "s1", status: "INVITED", rfq: { id: "rfq1", status: "OPEN", deadlineAt: null, maintenanceRequestId: "f1", buildingId: "b1" } };
  m.wo = { id: "w1", number: "WO-2026-0007", title: "Αντλία", status: "ACCEPTED", buildingId: "b1", maintenanceRequestId: "f1", supplierAcceptedAt: null };
});

const asSupplierAdmin = () => { m.actor = { id: "sup1", role: "COLLABORATOR", supplierId: "s1", isSupplierAdmin: true, perms: ["mkt-work-orders:edit"] }; };

describe("resendRfqInvitation", () => {
  it("re-sends while the RFQ is open and unanswered", async () => {
    expect(await resendRfqInvitation("inv1")).toEqual({ ok: true, sent: 1 });
    expect(m.send).toHaveBeenCalledWith("rfq1", ["s1"], "staff1");
  });
  it("refuses once the deadline has passed, even before the cron expires the RFQ", async () => {
    (m.invitation!.rfq as { deadlineAt: Date | null }).deadlineAt = new Date(Date.now() - 60_000);
    expect(await resendRfqInvitation("inv1")).toEqual({ error: "Η προθεσμία του αιτήματος έχει περάσει — στείλτε νέο αίτημα προσφοράς." });
    expect(m.send).not.toHaveBeenCalled();
  });
  it("refuses when the supplier already answered or the RFQ is closed", async () => {
    m.invitation!.status = "OFFERED";
    expect(await resendRfqInvitation("inv1")).toEqual({ error: "Ο συνεργάτης έχει ήδη απαντήσει" });
    m.invitation!.status = "INVITED"; (m.invitation!.rfq as { status: string }).status = "CANCELLED";
    expect(await resendRfqInvitation("inv1")).toEqual({ error: "Το αίτημα δεν είναι πλέον ανοιχτό" });
  });
});

describe("supplierAcceptWorkOrder", () => {
  const input = { signatoryName: "Γιάννης Παπάς", agreed: true };
  it("only the supplier's admin may sign", async () => {
    asSupplierAdmin(); m.actor.isSupplierAdmin = false;
    expect(await supplierAcceptWorkOrder("w1", input)).toEqual({ error: "Μόνο ο διαχειριστής του συνεργάτη αποδέχεται αναθέσεις" });
    expect(m.woUpdates).toEqual([]);
  });
  it("requires the customer's acceptance first, a name and explicit consent", async () => {
    asSupplierAdmin();
    m.wo!.status = "PENDING_CUSTOMER";
    expect(await supplierAcceptWorkOrder("w1", input)).toEqual({ error: "Η ανάθεση δεν είναι ακόμη αποδεκτή από τον πελάτη" });
    m.wo!.status = "ACCEPTED";
    expect(await supplierAcceptWorkOrder("w1", { signatoryName: "Γ", agreed: true })).toEqual({ error: "Γράψτε το ονοματεπώνυμο του υπογράφοντα" });
    expect(await supplierAcceptWorkOrder("w1", { ...input, agreed: false })).toEqual({ error: "Επιβεβαιώστε ότι διαβάσατε και αποδέχεστε τους όρους" });
    expect(m.woUpdates).toEqual([]);
  });
  it("records signatory, IP, UA and time, freezes the contract and notifies staff bell-only", async () => {
    asSupplierAdmin();
    expect(await supplierAcceptWorkOrder("w1", input)).toEqual({ ok: true });
    expect(m.woUpdates[0]).toMatchObject({ supplierAcceptedById: "sup1", supplierAcceptedIp: "1.2.3.4", supplierAcceptedUa: "UA/1", supplierAcceptedName: "Γιάννης Παπάς" });
    expect(m.woUpdates[0].supplierAcceptedAt).toBeInstanceOf(Date);
    expect(m.woUpdates[1]).toEqual({ supplierContractHtml: "<p>frozen</p>" });
    expect(m.notify).toHaveBeenCalledWith(["adm1"], expect.objectContaining({ email: false, href: "/admin/work-orders/w1/contract/supplier" }));
  });
  it("is idempotent once signed", async () => {
    asSupplierAdmin(); m.wo!.supplierAcceptedAt = new Date();
    expect(await supplierAcceptWorkOrder("w1", input)).toEqual({ ok: true });
    expect(m.woUpdates).toEqual([]);
  });
});

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

const NOTE_ERR = "Γράψτε πώς συμφώνησε ο πελάτης (τουλάχιστον 5 χαρακτήρες)";

describe("respondWorkOrder on the customer's behalf", () => {
  beforeEach(() => { m.wo = { id: "w1", number: "WO-2026-0007", title: "Αντλία", status: "PENDING_CUSTOMER", buildingId: "b1", supplierId: "s1", maintenanceRequestId: "f1", validUntil: null }; });
  it("staff who is not the building decider must give a note", async () => {
    expect(await respondWorkOrder("w1", true)).toEqual({ error: NOTE_ERR });
    expect(await respondWorkOrder("w1", true, null, { onBehalfNote: "ναι" })).toEqual({ error: NOTE_ERR });
    expect(m.woUpdates).toHaveLength(0);
  });
  it("records the note as a status event and an internal comment when staff accept on behalf", async () => {
    expect(await respondWorkOrder("w1", true, null, { onBehalfNote: "τηλεφωνικά με κ. Παπαδόπουλο 21/10" })).toEqual({ ok: true });
    expect(m.woUpdates[0]).toMatchObject({ status: "ACCEPTED", customerAcceptedById: "staff1" });
    expect(m.events.some((e) => String(e.note).includes("Εκ μέρους πελάτη: τηλεφωνικά με κ. Παπαδόπουλο 21/10"))).toBe(true);
    expect(m.comments[0]).toMatchObject({ requestId: "f1", authorId: "staff1", internal: true });
    expect(String(m.comments[0].body)).toContain("Αποδοχή προσφοράς εκ μέρους πελάτη (WO-2026-0007)");
  });
  it("declining on behalf keeps the customer reason and records the note too", async () => {
    expect(await respondWorkOrder("w1", false, "πολύ ακριβό", { onBehalfNote: "email 21/10 από τον διαχειριστή" })).toEqual({ ok: true });
    expect(m.woUpdates[0]).toMatchObject({ status: "DECLINED", customerDeclineReason: "πολύ ακριβό" });
    expect(String(m.comments[0].body)).toContain("Απόρριψη προσφοράς εκ μέρους πελάτη");
  });
  it("the building decider accepts without a note, as before", async () => {
    m.actor = { id: "pa1", role: "PROPERTY_ADMIN", supplierId: null, isSupplierAdmin: false, perms: [] }; m.deciders = ["pa1"];
    expect(await respondWorkOrder("w1", true)).toEqual({ ok: true });
    expect(m.comments).toHaveLength(0);
  });
});

describe("confirmWorkOrder on the customer's behalf", () => {
  beforeEach(() => { m.wo = { id: "w1", number: "WO-2026-0007", title: "Αντλία", status: "COMPLETED", buildingId: "b1", supplierId: "s1", maintenanceRequestId: "f1" }; });
  it("staff who is not the decider must give a note; a dispute still needs its own note", async () => {
    expect(await confirmWorkOrder("w1", true)).toEqual({ error: NOTE_ERR });
    expect(await confirmWorkOrder("w1", false, null, { onBehalfNote: "τηλεφωνικά 21/10" })).toEqual({ error: "Γράψτε τι δεν έγινε σωστά" });
    expect(m.woUpdates).toHaveLength(0);
  });
  it("confirms with the note recorded", async () => {
    expect(await confirmWorkOrder("w1", true, null, { onBehalfNote: "τηλεφωνικά 21/10 με τον διαχειριστή" })).toEqual({ ok: true });
    expect(m.woUpdates[0]).toMatchObject({ status: "CONFIRMED", customerConfirmedById: "staff1" });
    expect(String(m.comments[0].body)).toContain("Επιβεβαίωση παραλαβής εκ μέρους πελάτη (WO-2026-0007)");
  });
  it("the decider confirms without a note, as before", async () => {
    m.actor = { id: "pa1", role: "PROPERTY_ADMIN", supplierId: null, isSupplierAdmin: false, perms: [] }; m.deciders = ["pa1"];
    expect(await confirmWorkOrder("w1", true)).toEqual({ ok: true });
    expect(m.comments).toHaveLength(0);
  });
});
