import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { rfqToDTO } from "./rfq";

const row = (sup: { email: string | null; contactEmail: string | null; users: number; contacts: number }, inv: Partial<{ emailCount: number; viewedAt: Date | null; status: string }> = {}) => ({
  id: "rfq1", title: "Διαρροή", description: "…", status: "OPEN", deadlineAt: null, surveyRequired: false, notes: null, createdAt: new Date(), buildingId: "b1", maintenanceRequestId: "f1", categoryId: null, createdById: null, updatedAt: new Date(),
  invitations: [{
    id: "inv1", rfqId: "rfq1", supplierId: "s1", status: inv.status ?? "INVITED", sentAt: new Date(), viewedAt: inv.viewedAt ?? null, declineReason: null, lastEmailAt: null, emailCount: inv.emailCount ?? 0,
    supplier: { name: "Α", email: sup.email, contactEmail: sup.contactEmail, _count: { users: sup.users, contactPeople: sup.contacts } }, links: [],
  }],
  offers: [],
}) as unknown as Parameters<typeof rfqToDTO>[0];

describe("rfqToDTO — hasRecipient / state", () => {
  it("a supplier with no address, no login and no RFQ contact is NO_EMAIL", () => {
    const d = rfqToDTO(row({ email: null, contactEmail: null, users: 0, contacts: 0 }));
    expect(d.invitations[0]).toMatchObject({ hasRecipient: false, state: "NO_EMAIL" });
  });
  it("a reachable supplier that was never mailed is NOT_SENT, and SENT once a mail left", () => {
    expect(rfqToDTO(row({ email: null, contactEmail: null, users: 0, contacts: 1 })).invitations[0].state).toBe("NOT_SENT");
    expect(rfqToDTO(row({ email: "a@x.gr", contactEmail: null, users: 0, contacts: 0 }, { emailCount: 1 })).invitations[0].state).toBe("SENT");
  });
});
