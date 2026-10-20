"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { getEffectiveSession } from "@/lib/auth-effective";
import { getEffectivePermissions, can } from "@/lib/rbac/permissions";
import { COMPANY_ROLES } from "@/lib/roles-constants";
import { issueInviteLink, revokeInviteLinks } from "@/lib/supplier-invites";
import { sendBrandedEmail } from "@/lib/mailgun";
import { getEmailBrand } from "@/lib/email-brand";
import { contactInvitationEmail } from "@/lib/emails/supplier-invites";
import type { SupplierContactInput } from "@/lib/suppliers-shared";

/* ------------------------------------------------------------------ */
/* Contacts of a company-registry supplier, with optional marketplace   */
/* access. Who may edit: any company role holding suppliers:edit OR     */
/* rfq:edit (EMPLOYEE has rfq but not the full registry edit), or the   */
/* supplier's own admin (mkt-team:edit). Private (customer) lists never. */
/* ------------------------------------------------------------------ */

const clean = (v?: string | null) => (v?.trim() ? v.trim() : null);
const FOREIGN_ROLE = "Το email ανήκει ήδη σε λογαριασμό άλλου τύπου (π.χ. ιδιοκτήτη/διαχειριστή). Χρησιμοποιήστε άλλο email.";
const OTHER_SUPPLIER = "Το email ανήκει σε λογαριασμό άλλου συνεργάτη.";
// Outside parties (supplier admins) must not learn which addresses exist on the platform.
const NEUTRAL = "Το email δεν μπορεί να χρησιμοποιηθεί για πρόσβαση — επικοινωνήστε με την εταιρεία διαχείρισης.";

async function requireContactsEdit(supplierId: string) {
  const [eff, resolved] = await Promise.all([getEffectiveSession(), getEffectivePermissions()]);
  if (!eff?.user?.id || !resolved) throw new Error("Unauthorized");
  const row = await db.supplier.findUnique({ where: { id: supplierId }, select: { id: true, name: true, customerId: true, isPlatform: true } });
  if (!row) throw new Error("Δεν βρέθηκε");
  if (row.customerId || row.isPlatform) throw new Error("Επαφές με πρόσβαση δίνονται μόνο σε συνεργάτες του μητρώου της εταιρείας");
  const role = eff.user.role as string;
  if ((COMPANY_ROLES as readonly string[]).includes(role)) {
    if (!can(resolved.perms, "suppliers", "edit") && !can(resolved.perms, "rfq", "edit")) throw new Error("Δεν επιτρέπεται");
  } else if (role === "COLLABORATOR") {
    const me = await db.user.findUnique({ where: { id: eff.user.id }, select: { supplierId: true, isSupplierAdmin: true } });
    if (me?.supplierId !== supplierId || !me.isSupplierAdmin || !can(resolved.perms, "mkt-team", "edit")) throw new Error("Δεν επιτρέπεται");
  } else throw new Error("Δεν επιτρέπεται");
  return { actorId: eff.user.id, supplier: row, external: role === "COLLABORATOR" };
}

function revalidate(supplierId: string) {
  revalidatePath(`/super-admin/suppliers/${supplierId}`);
  revalidatePath("/marketplace/team");
  revalidatePath("/super-admin/users");
}

/** The user (if any) that already owns this e-mail, classified against this supplier. */
async function classifyEmail(email: string, supplierId: string, external: boolean): Promise<{ error: string } | { user: { id: string; passwordHash: string | null } | null }> {
  const u = await db.user.findUnique({ where: { email }, select: { id: true, role: true, supplierId: true, passwordHash: true } });
  if (!u) return { user: null };
  if (u.role !== "COLLABORATOR") return { error: external ? NEUTRAL : FOREIGN_ROLE };
  if (u.supplierId !== supplierId) return { error: external ? NEUTRAL : OTHER_SUPPLIER };
  return { user: { id: u.id, passwordHash: u.passwordHash } };
}

async function sendContactInvite(supplier: { id: string; name: string }, contact: { id: string; name: string; email: string }, actorId: string): Promise<boolean> {
  const link = await issueInviteLink({ kind: "CONTACT_ACTIVATION", supplierId: supplier.id, email: contact.email, contactId: contact.id, createdById: actorId });
  const brand = await getEmailBrand();
  const res = await sendBrandedEmail(contact.email, contactInvitationEmail({ brand, supplierName: supplier.name, contactName: contact.name, url: link.url }), ["contact-invite"]);
  return !!res.success;
}
const SEND_FAILED = "Η επαφή αποθηκεύτηκε αλλά το email δεν στάλθηκε — δοκιμάστε «Αποστολή πρόσκλησης» σε λίγο.";

export async function saveSupplierContact(supplierId: string, id: string | null, input: SupplierContactInput): Promise<{ id: string; invited?: boolean } | { error: string }> {
  try {
    const { actorId, supplier, external } = await requireContactsEdit(supplierId);
    const name = input.name?.trim();
    if (!name) return { error: "Το όνομα είναι υποχρεωτικό" };
    const email = clean(input.email)?.toLowerCase() ?? null;
    const access = input.access ?? "none";
    if (access !== "none" && !email) return { error: "Για πρόσβαση χρειάζεται email" };
    if (access === "password" && (!input.password || input.password.length < 8)) return { error: "Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες" };

    const existing = id ? await db.supplierContact.findFirst({ where: { id, supplierId }, select: { id: true, userId: true, email: true } }) : null;
    if (id && !existing) return { error: "Δεν βρέθηκε" };

    // One User per e-mail: decide up-front what this address may become.
    let linkUser: { id: string; passwordHash: string | null } | null = null;
    if (email && (access !== "none" || existing?.userId)) {
      const c = await classifyEmail(email, supplierId, external);
      if ("error" in c) return c;
      linkUser = c.user;
      if (existing?.userId && linkUser && linkUser.id !== existing.userId) return { error: "Η επαφή είναι ήδη δεμένη με άλλον λογαριασμό" };
    }

    const data = {
      name, position: clean(input.position), phone: clean(input.phone), mobile: clean(input.mobile), email,
      isPrimary: !!input.isPrimary, receivesRfq: input.receivesRfq ?? true, notes: clean(input.notes),
    };
    let invited = false;
    const contactId = await db.$transaction(async (tx) => {
      const row = existing
        ? await tx.supplierContact.update({ where: { id: existing.id }, data })
        : await tx.supplierContact.create({ data: { ...data, supplierId, createdById: actorId } });
      if (data.isPrimary) await tx.supplierContact.updateMany({ where: { supplierId, id: { not: row.id } }, data: { isPrimary: false } });

      let userId = existing?.userId ?? null;
      if (email && access !== "none" && !userId) {
        if (linkUser) userId = linkUser.id;
        else if (access === "password") {
          const sysRole = await tx.role.findUnique({ where: { key: "COLLABORATOR" }, select: { id: true } });
          const others = await tx.user.count({ where: { supplierId, role: "COLLABORATOR" } });
          const u = await tx.user.create({
            data: {
              email, name, phone: data.phone, mobile: data.mobile, role: "COLLABORATOR", roleId: sysRole?.id ?? null, status: "ACTIVE",
              supplierId, isSupplierAdmin: input.isSupplierAdmin ?? (data.isPrimary || others === 0), passwordHash: await bcrypt.hash(input.password!, 10),
            },
            select: { id: true },
          });
          userId = u.id;
        }
        if (userId) await tx.supplierContact.update({ where: { id: row.id }, data: { userId } });
      }
      if (userId) {
        const patch: Record<string, unknown> = { name, phone: data.phone, mobile: data.mobile };
        if (input.isSupplierAdmin !== undefined || data.isPrimary) patch.isSupplierAdmin = input.isSupplierAdmin ?? true;
        if (input.isSupplierAdmin === false && !data.isPrimary) patch.isSupplierAdmin = false;
        await tx.user.update({ where: { id: userId }, data: patch });
      }
      return row.id;
    });

    // Invite by link only when nobody owns the address yet (an existing login simply got linked).
    if (email && access === "invite" && !linkUser && !existing?.userId) {
      invited = await sendContactInvite(supplier, { id: contactId, name, email }, actorId);
      revalidate(supplierId);
      if (!invited) return { error: SEND_FAILED };
    }
    revalidate(supplierId);
    return invited ? { id: contactId, invited: true } : { id: contactId };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function deactivateSupplierContact(supplierId: string, id: string) {
  try {
    await requireContactsEdit(supplierId);
    const c = await db.supplierContact.findFirst({ where: { id, supplierId }, select: { id: true, userId: true } });
    if (!c) return { error: "Δεν βρέθηκε" };
    await db.$transaction(async (tx) => {
      await tx.supplierContact.update({ where: { id }, data: { active: false } });
      if (c.userId) await tx.user.update({ where: { id: c.userId }, data: { status: "INACTIVE" } });
    });
    await revokeInviteLinks({ contactId: id });
    revalidate(supplierId);
    return { ok: true as const };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function reactivateSupplierContact(supplierId: string, id: string) {
  try {
    await requireContactsEdit(supplierId);
    const c = await db.supplierContact.findFirst({ where: { id, supplierId }, select: { id: true, userId: true } });
    if (!c) return { error: "Δεν βρέθηκε" };
    await db.$transaction(async (tx) => {
      await tx.supplierContact.update({ where: { id }, data: { active: true } });
      if (c.userId) await tx.user.update({ where: { id: c.userId }, data: { status: "ACTIVE" } });
    });
    revalidate(supplierId);
    return { ok: true as const };
  } catch (e) { return { error: (e as Error).message }; }
}

/** New activation link (earlier ones stop working). Only for contacts without a working login. */
export async function resendContactInvite(supplierId: string, id: string) {
  try {
    const { actorId, supplier, external } = await requireContactsEdit(supplierId);
    const c = await db.supplierContact.findFirst({ where: { id, supplierId }, select: { id: true, name: true, email: true, userId: true } });
    if (!c) return { error: "Δεν βρέθηκε" };
    if (!c.email) return { error: "Η επαφή δεν έχει email" };
    if (c.userId) {
      const u = await db.user.findUnique({ where: { id: c.userId }, select: { passwordHash: true } });
      if (u?.passwordHash) return { error: "Η επαφή έχει ήδη ενεργό λογαριασμό" };
    } else {
      const cls = await classifyEmail(c.email, supplierId, external);
      if ("error" in cls) return cls;
      if (cls.user?.passwordHash) return { error: "Η επαφή έχει ήδη ενεργό λογαριασμό" };
    }
    if (!(await sendContactInvite(supplier, { id: c.id, name: c.name, email: c.email }, actorId))) return { error: "Το email δεν στάλθηκε — δοκιμάστε ξανά σε λίγο." };
    await db.supplierContact.update({ where: { id }, data: { active: true } });
    revalidate(supplierId);
    return { ok: true as const };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function removeSupplierContact(supplierId: string, id: string) {
  try {
    await requireContactsEdit(supplierId);
    const c = await db.supplierContact.findFirst({ where: { id, supplierId }, select: { id: true, userId: true } });
    if (!c) return { ok: true as const };
    if (c.userId) return { error: "Η επαφή έχει λογαριασμό — απενεργοποιήστε την αντί για διαγραφή" };
    await db.supplierContact.delete({ where: { id } });
    revalidate(supplierId);
    return { ok: true as const };
  } catch (e) { return { error: (e as Error).message }; }
}
