import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  recipients: {} as Record<string, { email: string; userId: string | null; contactId: string | null }[]>,
  invitations: [] as { id: string; rfqId: string; supplierId: string; emailCount: number; lastEmailAt: Date | null }[],
  issue: vi.fn(async (i: { email: string }) => ({ linkId: "l", url: `https://x/invite/t-${i.email}`, expiresAt: new Date() })),
  send: vi.fn(async (_to: string, _mail: { subject: string; html: string; text: string }, _tags: string[]) => ({ success: true })),
}));
vi.mock("@/lib/db", () => ({
  db: {
    serviceRequest: { findUnique: vi.fn(async () => ({ id: "rfq1", title: "Διαρροή", deadlineAt: null, surveyRequired: false, building: { name: "Αθηνάς 12", city: "Μαρούσι" }, invitations: m.invitations })) },
    rfqInvitation: {
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { emailCount: { increment: number }; lastEmailAt: Date } }) => {
        const i = m.invitations.find((x) => x.id === where.id)!; i.emailCount += data.emailCount.increment; i.lastEmailAt = data.lastEmailAt; return i;
      }),
    },
    supplier: { findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => [{ id: "s1", name: "Α" }, { id: "s2", name: "Β" }].filter((s) => where.id.in.includes(s.id))) },
  },
}));
vi.mock("@/lib/rfq-candidates", () => ({ recipientsForSupplier: vi.fn(async (id: string) => m.recipients[id] ?? []) }));
vi.mock("@/lib/supplier-invites", () => ({ issueInviteLink: m.issue }));
vi.mock("@/lib/mailgun", () => ({ sendBrandedEmail: m.send }));
vi.mock("@/lib/email-brand", () => ({ getEmailBrand: async () => ({ name: "Orithon", logoUrl: "x", siteUrl: "https://x" }) }));

import { sendRfqInvitations } from "./rfq-send";

beforeEach(() => {
  vi.clearAllMocks();
  m.invitations.length = 0;
  m.invitations.push({ id: "inv1", rfqId: "rfq1", supplierId: "s1", emailCount: 0, lastEmailAt: null }, { id: "inv2", rfqId: "rfq1", supplierId: "s2", emailCount: 0, lastEmailAt: null });
  m.recipients = { s1: [{ email: "a@s1.gr", userId: "u1", contactId: null }, { email: "b@s1.gr", userId: null, contactId: "c1" }], s2: [] };
});

describe("sendRfqInvitations", () => {
  it("issues one personal link and one e-mail per recipient and counts the send on the invitation", async () => {
    const r = await sendRfqInvitations("rfq1", ["s1", "s2"], "staff1");
    expect(r).toEqual({ sent: 2, noEmail: ["s2"], failed: [] });
    expect(m.issue).toHaveBeenCalledTimes(2);
    expect(m.issue.mock.calls.map((c) => c[0])).toEqual([
      expect.objectContaining({ kind: "RFQ_INVITE", supplierId: "s1", email: "a@s1.gr", rfqInvitationId: "inv1", createdById: "staff1" }),
      expect.objectContaining({ kind: "RFQ_INVITE", supplierId: "s1", email: "b@s1.gr", rfqInvitationId: "inv1" }),
    ]);
    expect(m.send).toHaveBeenCalledTimes(2);
    expect(m.send.mock.calls[0][0]).toBe("a@s1.gr");
    expect(m.send.mock.calls[0][1].html).toContain("https://x/invite/t-a@s1.gr");
    expect(m.invitations[0].emailCount).toBe(1);
    expect(m.invitations[0].lastEmailAt).toBeInstanceOf(Date);
  });
  it("a supplier with nobody to mail gets no link and its counter stays at zero", async () => {
    await sendRfqInvitations("rfq1", ["s2"], "staff1");
    expect(m.issue).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
    expect(m.invitations[1].emailCount).toBe(0);
  });
  it("a second send increments the counter (resend)", async () => {
    await sendRfqInvitations("rfq1", ["s1"], "staff1");
    await sendRfqInvitations("rfq1", ["s1"], "staff1");
    expect(m.invitations[0].emailCount).toBe(2);
  });
  it("tells recipients with a login to sign in and the others to set a password", async () => {
    await sendRfqInvitations("rfq1", ["s1"], "staff1");
    const htmlA = m.send.mock.calls[0][1].html;
    const htmlB = m.send.mock.calls[1][1].html;
    expect(htmlA).toMatch(/συνδεθείτε/i);
    expect(htmlB).toMatch(/κωδικό πρόσβασης/);
  });
    it("a Mailgun failure is not counted as sent and does not bump the counter", async () => {
    m.send.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false });
    const r = await sendRfqInvitations("rfq1", ["s1"], "staff1");
    expect(r).toEqual({ sent: 1, noEmail: [], failed: ["b@s1.gr"] });
    expect(m.invitations[0].emailCount).toBe(1);
    m.send.mockResolvedValue({ success: false });
    const r2 = await sendRfqInvitations("rfq1", ["s1"], "staff1");
    expect(r2.sent).toBe(0);
    expect(r2.failed).toEqual(["a@s1.gr", "b@s1.gr"]);
    expect(m.invitations[0].emailCount).toBe(1);
  });
});
