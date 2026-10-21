"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { db } from "@/lib/db";
import { resolveInviteLink } from "@/lib/supplier-invites";
import { hashInviteToken } from "@/lib/supplier-invites-shared";
import { inviteTarget } from "@/lib/supplier-invite-view";
import { inviteActivateLimiter, RATE_LIMIT_MESSAGE } from "@/lib/invite-rate-limit";

export type ActivateInput = { name: string; password: string; confirm: string; agreed: boolean };

const DEAD_LINK = "Ο σύνδεσμος δεν ισχύει πλέον — ζητήστε νέα πρόσκληση από την εταιρεία διαχείρισης.";

/**
 * "Set your password" from an invite link: creates the COLLABORATOR login bound
 * to the supplier (or sets the password of a same-supplier login that has none),
 * links the contact, burns the link and signs the person in towards the RFQ /
 * marketplace. One User per e-mail: any other account on that address is refused.
 */
export async function activateInvite(token: string, input: ActivateInput): Promise<{ error: string }> {
  const name = input.name?.trim() ?? "";
  if (name.length < 3) return { error: "Γράψτε το ονοματεπώνυμό σας" };
  if (!input.password || input.password.length < 8) return { error: "Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες" };
  if (input.password !== input.confirm) return { error: "Οι κωδικοί δεν ταιριάζουν" };
  if (!input.agreed) return { error: "Αποδεχθείτε τους όρους χρήσης" };
  if (!inviteActivateLimiter.allow(hashInviteToken(token))) return { error: RATE_LIMIT_MESSAGE };

  const r = await resolveInviteLink(token);
  if (r.status !== "ok") return { error: DEAD_LINK };
  const { link } = r;
  const email = link.email;
  const existing = await db.user.findUnique({ where: { email }, select: { id: true, role: true, supplierId: true, passwordHash: true } });
  if (existing && (existing.role !== "COLLABORATOR" || existing.supplierId !== link.supplierId)) return { error: "Το email ανήκει σε λογαριασμό άλλου τύπου. Επικοινωνήστε με την εταιρεία διαχείρισης." };
  if (existing?.passwordHash) return { error: "Ο λογαριασμός υπάρχει ήδη — συνδεθείτε με τον κωδικό σας." };

  const passwordHash = await bcrypt.hash(input.password, 10);
  const BURNED = Symbol("burned");
  try {
    await db.$transaction(async (tx) => {
    // one-use: the burn is part of the same transaction as the account write, so two
    // concurrent submits cannot both get through (the second finds usedAt already set)
    const burn = await tx.supplierInviteLink.updateMany({ where: { id: link.id, usedAt: null, revokedAt: null }, data: { usedAt: new Date() } });
    if (burn.count === 0) throw BURNED;
    const contact = link.contactId
      ? await tx.supplierContact.findUnique({ where: { id: link.contactId }, select: { id: true, isPrimary: true, phone: true, mobile: true, userId: true } })
      : await tx.supplierContact.findFirst({ where: { supplierId: link.supplierId, email }, select: { id: true, isPrimary: true, phone: true, mobile: true, userId: true } });
    let userId: string;
    if (existing) {
      await tx.user.update({ where: { id: existing.id }, data: { passwordHash, name, status: "ACTIVE" } });
      userId = existing.id;
    } else {
      const others = await tx.user.count({ where: { supplierId: link.supplierId, role: "COLLABORATOR" } });
      const sysRole = await tx.role.findUnique({ where: { key: "COLLABORATOR" }, select: { id: true } });
      const u = await tx.user.create({
        data: {
          email, name, role: "COLLABORATOR", roleId: sysRole?.id ?? null, status: "ACTIVE", supplierId: link.supplierId,
          isSupplierAdmin: !!contact?.isPrimary || others === 0, passwordHash, phone: contact?.phone ?? null, mobile: contact?.mobile ?? null,
        },
        select: { id: true },
      });
      userId = u.id;
    }
    if (contact) await tx.supplierContact.update({ where: { id: contact.id }, data: { userId, active: true } });
    else await tx.supplierContact.create({ data: { supplierId: link.supplierId, email, name, userId, isPrimary: !existing && (await tx.user.count({ where: { supplierId: link.supplierId, role: "COLLABORATOR" } })) === 1 } });
    });
  } catch (e) {
    if (e === BURNED) return { error: DEAD_LINK };
    throw e;
  }

  try {
    await signIn("credentials", { email, password: input.password, redirectTo: inviteTarget(link) });
  } catch (e) {
    if (e instanceof AuthError) return { error: "Ο λογαριασμός δημιουργήθηκε αλλά η σύνδεση απέτυχε — συνδεθείτε από τη σελίδα εισόδου." };
    throw e; // NEXT_REDIRECT
  }
  return { error: "" };
}
