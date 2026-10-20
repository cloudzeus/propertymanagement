import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getEmailBrand } from "@/lib/email-brand";
import { hashInviteToken, inviteUrl, INVITE_TTL_DAYS } from "./supplier-invites-shared";

/**
 * One-time signed links sent to suppliers by e-mail:
 *  - RFQ_INVITE          → /marketplace/rfq/[id] after login or activation
 *  - CONTACT_ACTIVATION  → "set your password" for a contact that was given access
 * The token (32 random bytes, base64url) is never stored — only its sha256 — and
 * every link is bound to one recipient e-mail. Issuing a new link for the same
 * target + e-mail revokes the earlier ones (that is what "resend" means).
 */
export type InviteKind = "RFQ_INVITE" | "CONTACT_ACTIVATION";

export type ResolvedInvite =
  | { status: "invalid" | "expired" | "revoked" | "used" }
  | {
      status: "ok";
      link: { id: string; kind: InviteKind; email: string; supplierId: string; rfqId: string | null; contactId: string | null; expiresAt: Date };
      supplierName: string;
    };

export async function issueInviteLink(i: {
  kind: InviteKind; supplierId: string; email: string; rfqInvitationId?: string | null; contactId?: string | null; createdById?: string | null;
}): Promise<{ linkId: string; url: string; expiresAt: Date }> {
  const email = i.email.trim().toLowerCase();
  await db.supplierInviteLink.updateMany({
    where: { kind: i.kind, email, revokedAt: null, usedAt: null, ...(i.rfqInvitationId ? { rfqInvitationId: i.rfqInvitationId } : {}), ...(i.contactId ? { contactId: i.contactId } : {}) },
    data: { revokedAt: new Date() },
  });
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);
  const row = await db.supplierInviteLink.create({
    data: {
      tokenHash: hashInviteToken(token), kind: i.kind, supplierId: i.supplierId, email,
      rfqInvitationId: i.rfqInvitationId ?? null, contactId: i.contactId ?? null, expiresAt, createdById: i.createdById ?? null,
    },
  });
  const brand = await getEmailBrand();
  return { linkId: row.id, url: inviteUrl(token, brand.siteUrl), expiresAt };
}

export async function resolveInviteLink(token: string, opts: { markOpened?: boolean } = {}): Promise<ResolvedInvite> {
  if (!token || token.length > 200) return { status: "invalid" };
  const row = await db.supplierInviteLink.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: { supplier: { select: { name: true } }, rfqInvitation: { select: { rfqId: true } } },
  });
  if (!row) return { status: "invalid" };
  if (row.revokedAt) return { status: "revoked" };
  if (row.usedAt) return { status: "used" };
  if (row.expiresAt.getTime() < Date.now()) return { status: "expired" };
  if (opts.markOpened && !row.openedAt) {
    const now = new Date();
    await db.supplierInviteLink.update({ where: { id: row.id }, data: { openedAt: now } });
    if (row.kind === "RFQ_INVITE" && row.rfqInvitationId) {
      await db.rfqInvitation.update({ where: { id: row.rfqInvitationId }, data: { viewedAt: now } }).catch(() => {});
    }
  }
  return {
    status: "ok",
    link: { id: row.id, kind: row.kind, email: row.email, supplierId: row.supplierId, rfqId: row.rfqInvitation?.rfqId ?? null, contactId: row.contactId, expiresAt: row.expiresAt },
    supplierName: row.supplier.name,
  };
}

export async function markInviteUsed(linkId: string): Promise<void> {
  await db.supplierInviteLink.update({ where: { id: linkId }, data: { usedAt: new Date() } });
}

export async function revokeInviteLinks(where: { rfqInvitationId?: string; contactId?: string; email?: string }): Promise<void> {
  await db.supplierInviteLink.updateMany({ where: { ...where, revokedAt: null, usedAt: null }, data: { revokedAt: new Date() } });
}
