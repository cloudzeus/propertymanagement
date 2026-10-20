import { createHash } from "node:crypto";

/** Signed supplier links (RFQ invitations, contact activation) live 14 days. */
export const INVITE_TTL_DAYS = 14;

/** Only this hash is stored; the token itself exists in the e-mail alone. */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteUrl(token: string, siteUrl: string): string {
  return `${siteUrl.replace(/\/$/, "")}/invite/${token}`;
}
