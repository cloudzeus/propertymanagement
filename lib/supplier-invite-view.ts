import "server-only";
import { db } from "@/lib/db";
import { resolveInviteLink } from "@/lib/supplier-invites";

/** What /invite/[token] shows (spec §6). */
export type InviteView =
  | { kind: "invalid" | "expired" | "used" }
  | { kind: "login"; loginUrl: string }
  | { kind: "foreign" }
  | { kind: "activate"; token: string; email: string; name: string; supplierName: string; target: string };

export function inviteTarget(link: { kind: string; rfqId: string | null }): string {
  return link.kind === "RFQ_INVITE" && link.rfqId ? `/marketplace/rfq/${link.rfqId}` : "/marketplace";
}

export async function inviteView(token: string): Promise<InviteView> {
  const r = await resolveInviteLink(token, { markOpened: true });
  if (r.status !== "ok") return { kind: r.status === "expired" ? "expired" : r.status === "used" ? "used" : "invalid" };
  const target = inviteTarget(r.link);
  const user = await db.user.findUnique({ where: { email: r.link.email }, select: { id: true, role: true, supplierId: true, passwordHash: true, name: true } });
  if (user) {
    if (user.role !== "COLLABORATOR" || user.supplierId !== r.link.supplierId) return { kind: "foreign" };
    if (user.passwordHash) return { kind: "login", loginUrl: `/login?email=${encodeURIComponent(r.link.email)}&callbackUrl=${encodeURIComponent(target)}` };
  }
  const contact = r.link.contactId
    ? await db.supplierContact.findUnique({ where: { id: r.link.contactId }, select: { name: true } })
    : await db.supplierContact.findFirst({ where: { supplierId: r.link.supplierId, email: r.link.email }, select: { name: true } });
  return { kind: "activate", token, email: r.link.email, name: contact?.name ?? user?.name ?? "", supplierName: r.supplierName, target };
}
