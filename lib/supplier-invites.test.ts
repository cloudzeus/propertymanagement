import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

type Link = {
  id: string; tokenHash: string; kind: "RFQ_INVITE" | "CONTACT_ACTIVATION"; supplierId: string; email: string;
  rfqInvitationId: string | null; contactId: string | null; expiresAt: Date; sentAt: Date; sentCount: number;
  openedAt: Date | null; usedAt: Date | null; revokedAt: Date | null; createdById: string | null;
};

const m = vi.hoisted(() => {
  const links: Link[] = [];
  const invitations = new Map<string, { id: string; rfqId: string; viewedAt: Date | null }>();
  let seq = 0;
  const matches = (l: Link, where: Record<string, unknown>) => Object.entries(where).every(([k, v]) => {
    if (k === "revokedAt" || k === "usedAt") return v === null ? (l as Record<string, unknown>)[k] == null : true;
    return (l as Record<string, unknown>)[k] === v;
  });
  return {
    links, invitations,
    reset() { links.length = 0; invitations.clear(); seq = 0; },
    db: {
      supplierInviteLink: {
        create: vi.fn(async ({ data }: { data: Omit<Link, "id" | "sentAt" | "sentCount" | "openedAt" | "usedAt" | "revokedAt"> }) => {
          const row: Link = { id: `l${++seq}`, sentAt: new Date(), sentCount: 1, openedAt: null, usedAt: null, revokedAt: null, ...data } as Link;
          links.push(row); return row;
        }),
        updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<Link> }) => {
          let n = 0; for (const l of links) if (matches(l, where)) { Object.assign(l, data); n++; } return { count: n };
        }),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Link> }) => { const l = links.find((x) => x.id === where.id)!; Object.assign(l, data); return l; }),
        findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => {
          const l = links.find((x) => x.tokenHash === where.tokenHash); if (!l) return null;
          return { ...l, supplier: { name: "Ηλεκτρολόγοι ΑΕ" }, rfqInvitation: l.rfqInvitationId ? { rfqId: invitations.get(l.rfqInvitationId)?.rfqId ?? "rfqX" } : null };
        }),
      },
      rfqInvitation: {
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: { viewedAt: Date } }) => { const i = invitations.get(where.id)!; Object.assign(i, data); return i; }),
      },
    },
  };
});
vi.mock("@/lib/db", () => ({ db: m.db }));
vi.mock("@/lib/email-brand", () => ({ getEmailBrand: async () => ({ name: "Orithon", logoUrl: "x", siteUrl: "https://app.example.test" }) }));

import { issueInviteLink, resolveInviteLink, markInviteUsed, revokeInviteLinks } from "./supplier-invites";
import { hashInviteToken, INVITE_TTL_DAYS } from "./supplier-invites-shared";

const sha = (t: string) => createHash("sha256").update(t).digest("hex");

beforeEach(() => { m.reset(); vi.clearAllMocks(); m.invitations.set("inv1", { id: "inv1", rfqId: "rfq1", viewedAt: null }); });

describe("issueInviteLink", () => {
  it("stores only the sha256 of the token and builds a /invite/<token> url that expires in 14 days", async () => {
    const r = await issueInviteLink({ kind: "RFQ_INVITE", supplierId: "s1", email: "A@Example.com", rfqInvitationId: "inv1", createdById: "u1" });
    const token = r.url.split("/invite/")[1];
    expect(r.url.startsWith("https://app.example.test/invite/")).toBe(true);
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(m.links[0].tokenHash).toBe(sha(token));
    expect(m.links[0].tokenHash).toBe(hashInviteToken(token));
    expect(m.links[0].email).toBe("a@example.com");
    expect(Math.round((r.expiresAt.getTime() - Date.now()) / 86_400_000)).toBe(INVITE_TTL_DAYS);
  });
  it("revokes earlier active links for the same target and email (resend)", async () => {
    const first = await issueInviteLink({ kind: "RFQ_INVITE", supplierId: "s1", email: "a@example.com", rfqInvitationId: "inv1" });
    const second = await issueInviteLink({ kind: "RFQ_INVITE", supplierId: "s1", email: "a@example.com", rfqInvitationId: "inv1" });
    const t1 = first.url.split("/invite/")[1], t2 = second.url.split("/invite/")[1];
    expect((await resolveInviteLink(t1)).status).toBe("revoked");
    expect((await resolveInviteLink(t2)).status).toBe("ok");
  });
});

describe("resolveInviteLink", () => {
  it("returns invalid for an unknown token", async () => {
    expect((await resolveInviteLink("nope")).status).toBe("invalid");
  });
  it("returns expired when expiresAt is in the past", async () => {
    const r = await issueInviteLink({ kind: "CONTACT_ACTIVATION", supplierId: "s1", email: "b@x.gr", contactId: "c1" });
    m.links[0].expiresAt = new Date(Date.now() - 1000);
    expect((await resolveInviteLink(r.url.split("/invite/")[1])).status).toBe("expired");
  });
  it("returns used after markInviteUsed", async () => {
    const r = await issueInviteLink({ kind: "CONTACT_ACTIVATION", supplierId: "s1", email: "b@x.gr", contactId: "c1" });
    await markInviteUsed(m.links[0].id);
    expect((await resolveInviteLink(r.url.split("/invite/")[1])).status).toBe("used");
  });
  it("ok: marks openedAt once and sets RfqInvitation.viewedAt for RFQ links", async () => {
    const r = await issueInviteLink({ kind: "RFQ_INVITE", supplierId: "s1", email: "a@x.gr", rfqInvitationId: "inv1" });
    const token = r.url.split("/invite/")[1];
    const a = await resolveInviteLink(token, { markOpened: true });
    expect(a.status).toBe("ok");
    if (a.status !== "ok") throw new Error();
    expect(a.link).toMatchObject({ kind: "RFQ_INVITE", email: "a@x.gr", supplierId: "s1", rfqId: "rfq1", contactId: null });
    expect(a.supplierName).toBe("Ηλεκτρολόγοι ΑΕ");
    const opened = m.links[0].openedAt;
    expect(opened).toBeInstanceOf(Date);
    expect(m.invitations.get("inv1")!.viewedAt).toBeInstanceOf(Date);
    await resolveInviteLink(token, { markOpened: true });
    expect(m.links[0].openedAt).toBe(opened);
    expect(m.db.rfqInvitation.update).toHaveBeenCalledTimes(1);
  });
});

describe("revokeInviteLinks", () => {
  it("revokes every active link of a contact", async () => {
    await issueInviteLink({ kind: "CONTACT_ACTIVATION", supplierId: "s1", email: "b@x.gr", contactId: "c1" });
    await revokeInviteLinks({ contactId: "c1" });
    expect(m.links.every((l) => l.revokedAt instanceof Date)).toBe(true);
  });
});
