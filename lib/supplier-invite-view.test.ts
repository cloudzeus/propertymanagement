import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  resolve: vi.fn(),
  user: null as null | { id: string; role: string; supplierId: string | null; passwordHash: string | null; name: string | null },
  contact: null as null | { name: string },
}));
vi.mock("@/lib/supplier-invites", () => ({ resolveInviteLink: m.resolve }));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn(async () => m.user) },
    supplierContact: { findUnique: vi.fn(async () => m.contact), findFirst: vi.fn(async () => m.contact) },
  },
}));

import { inviteView } from "./supplier-invite-view";

const okLink = (over: Record<string, unknown> = {}) => ({ status: "ok", supplierName: "Ηλεκτρολόγοι ΑΕ", link: { id: "l1", kind: "RFQ_INVITE", email: "a@firm.gr", supplierId: "s1", rfqId: "rfq1", contactId: "c1", expiresAt: new Date(Date.now() + 1000), ...over } });

beforeEach(() => { vi.clearAllMocks(); m.user = null; m.contact = { name: "Μαρία Κ." }; });

describe("inviteView", () => {
  it("maps invalid/expired/revoked/used links to their cards", async () => {
    for (const [status, kind] of [["invalid", "invalid"], ["revoked", "invalid"], ["expired", "expired"], ["used", "used"]] as const) {
      m.resolve.mockResolvedValueOnce({ status });
      expect(await inviteView("t")).toEqual({ kind });
    }
  });
  it("no user → activation form prefilled from the contact, target = the RFQ", async () => {
    m.resolve.mockResolvedValueOnce(okLink());
    expect(await inviteView("t")).toEqual({ kind: "activate", token: "t", email: "a@firm.gr", name: "Μαρία Κ.", supplierName: "Ηλεκτρολόγοι ΑΕ", target: "/marketplace/rfq/rfq1" });
  });
  it("contact activation without an RFQ targets the marketplace home", async () => {
    m.resolve.mockResolvedValueOnce(okLink({ kind: "CONTACT_ACTIVATION", rfqId: null }));
    expect((await inviteView("t")) as { target?: string }).toMatchObject({ kind: "activate", target: "/marketplace" });
  });
  it("same-supplier collaborator with a password → login with the e-mail prefilled and the RFQ as callback", async () => {
    m.resolve.mockResolvedValueOnce(okLink());
    m.user = { id: "u1", role: "COLLABORATOR", supplierId: "s1", passwordHash: "h", name: "Μ" };
    expect(await inviteView("t")).toEqual({ kind: "login", loginUrl: "/login?email=a%40firm.gr&callbackUrl=%2Fmarketplace%2Frfq%2Frfq1" });
  });
  it("same-supplier collaborator WITHOUT a password → activation form", async () => {
    m.resolve.mockResolvedValueOnce(okLink());
    m.user = { id: "u1", role: "COLLABORATOR", supplierId: "s1", passwordHash: null, name: "Μ" };
    expect((await inviteView("t")) as { kind: string }).toMatchObject({ kind: "activate" });
  });
  it("e-mail of another role or another supplier → foreign", async () => {
    m.resolve.mockResolvedValueOnce(okLink());
    m.user = { id: "u1", role: "PROPERTY_OWNER", supplierId: null, passwordHash: "h", name: "Μ" };
    expect(await inviteView("t")).toEqual({ kind: "foreign" });
    m.resolve.mockResolvedValueOnce(okLink());
    m.user = { id: "u1", role: "COLLABORATOR", supplierId: "s2", passwordHash: "h", name: "Μ" };
    expect(await inviteView("t")).toEqual({ kind: "foreign" });
  });
  it("opening the link is recorded (markOpened)", async () => {
    m.resolve.mockResolvedValueOnce({ status: "invalid" });
    await inviteView("t");
    expect(m.resolve).toHaveBeenCalledWith("t", { markOpened: true });
  });
});
