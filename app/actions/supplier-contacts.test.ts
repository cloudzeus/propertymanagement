import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

type Contact = { id: string; supplierId: string; name: string; email: string | null; isPrimary: boolean; receivesRfq: boolean; active: boolean; userId: string | null; phone: string | null; mobile: string | null; position: string | null; notes: string | null };

const m = vi.hoisted(() => ({
  actor: { id: "staff1", role: "EMPLOYEE", customerId: null as string | null, supplierId: null as string | null, isSupplierAdmin: false, perms: new Set<string>(["rfq:edit"]) },
  supplierRow: { id: "s1", customerId: null as string | null, isPlatform: false },
  contacts: [] as Contact[],
  users: [] as { id: string; email: string; role: string; supplierId: string | null; passwordHash: string | null; status: string; isSupplierAdmin: boolean }[],
  userCreates: [] as Record<string, unknown>[],
  userUpdates: [] as { where: { id: string }; data: Record<string, unknown> }[],
  issue: vi.fn(async () => ({ linkId: "l1", url: "https://x/invite/t", expiresAt: new Date() })),
  revoke: vi.fn(async () => {}),
  send: vi.fn(async () => ({ success: true })),
  seq: 0,
}));
vi.mock("@/lib/auth-effective", () => ({ getEffectiveSession: async () => ({ user: { id: m.actor.id, role: m.actor.role, customerId: m.actor.customerId } }) }));
vi.mock("@/lib/rbac/permissions", () => ({ getEffectivePermissions: async () => ({ perms: m.actor.perms, role: m.actor.role }), can: (p: Set<string>, k: string, a: string) => p.has(`${k}:${a}`) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/supplier-invites", () => ({ issueInviteLink: m.issue, revokeInviteLinks: m.revoke }));
vi.mock("@/lib/mailgun", () => ({ sendBrandedEmail: m.send }));
vi.mock("@/lib/email-brand", () => ({ getEmailBrand: async () => ({ name: "Orithon", logoUrl: "x", siteUrl: "https://x" }) }));
vi.mock("@/lib/db", () => {
  const db = {
    supplier: { findUnique: vi.fn(async () => ({ ...m.supplierRow, name: "Ηλεκτρολόγοι ΑΕ" })) },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => m.users.find((u) => (where.id ? u.id === where.id : u.email === where.email)) ?? (where.id === m.actor.id ? { supplierId: m.actor.supplierId, isSupplierAdmin: m.actor.isSupplierAdmin } : null)),
      count: vi.fn(async () => m.users.length),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { const u = { id: `u${++m.seq}`, ...data } as typeof m.users[number]; m.users.push(u); m.userCreates.push(data); return u; }),
      update: vi.fn(async (q: { where: { id: string }; data: Record<string, unknown> }) => { m.userUpdates.push(q); const u = m.users.find((x) => x.id === q.where.id); if (u) Object.assign(u, q.data); return u; }),
    },
    role: { findUnique: vi.fn(async () => ({ id: "roleCollab" })) },
    supplierContact: {
      findFirst: vi.fn(async ({ where }: { where: { id?: string; supplierId?: string; email?: string } }) => m.contacts.find((c) => (where.id ? c.id === where.id : true) && (where.supplierId ? c.supplierId === where.supplierId : true) && (where.email ? c.email === where.email : true)) ?? null),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => m.contacts.find((c) => c.id === where.id) ?? null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { const c = { id: `c${++m.seq}`, userId: null, ...data } as Contact; m.contacts.push(c); return c; }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => { const c = m.contacts.find((x) => x.id === where.id)!; Object.assign(c, data); return c; }),
      updateMany: vi.fn(async ({ where, data }: { where: { supplierId: string; id?: { not: string } }; data: Record<string, unknown> }) => { for (const c of m.contacts) if (c.supplierId === where.supplierId && c.id !== where.id?.not) Object.assign(c, data); return { count: 1 }; }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => { const i = m.contacts.findIndex((c) => c.id === where.id); m.contacts.splice(i, 1); return {}; }),
    },
  };
  return { db: { ...db, $transaction: async (fn: (t: typeof db) => Promise<unknown>) => fn(db) } };
});

import { saveSupplierContact, deactivateSupplierContact, resendContactInvite, removeSupplierContact } from "./supplier-contacts";

const base = { name: "Μαρία Κωνσταντίνου", position: "Λογιστήριο", phone: "210", mobile: "69", email: "Maria@Firm.gr", isPrimary: false, receivesRfq: true, access: "none" as const };

beforeEach(() => { vi.clearAllMocks(); m.contacts = []; m.users = []; m.userCreates = []; m.userUpdates = []; m.seq = 0; m.actor.role = "EMPLOYEE"; m.actor.perms = new Set(["rfq:edit"]); m.supplierRow = { id: "s1", customerId: null, isPlatform: false }; });

describe("saveSupplierContact", () => {
  it("EMPLOYEE with rfq:edit creates a plain contact (lowercased e-mail, no user)", async () => {
    const r = await saveSupplierContact("s1", null, base);
    expect(r).toMatchObject({ id: "c1" });
    expect(m.contacts[0]).toMatchObject({ supplierId: "s1", name: "Μαρία Κωνσταντίνου", email: "maria@firm.gr", position: "Λογιστήριο", userId: null, createdById: "staff1" });
    expect(m.userCreates).toEqual([]);
    expect(m.issue).not.toHaveBeenCalled();
  });
  it("refuses a private (customer) supplier row and an actor without rights", async () => {
    m.supplierRow = { id: "s1", customerId: "cust1", isPlatform: false };
    expect(await saveSupplierContact("s1", null, base)).toEqual({ error: "Επαφές με πρόσβαση δίνονται μόνο σε συνεργάτες του μητρώου της εταιρείας" });
    m.supplierRow = { id: "s1", customerId: null, isPlatform: false };
    m.actor.perms = new Set();
    expect(await saveSupplierContact("s1", null, base)).toEqual({ error: "Δεν επιτρέπεται" });
  });
  it("access=invite issues a CONTACT_ACTIVATION link + e-mail and creates no user", async () => {
    const r = await saveSupplierContact("s1", null, { ...base, access: "invite" });
    expect(r).toEqual({ id: "c1", invited: true });
    expect(m.userCreates).toEqual([]);
    expect(m.issue).toHaveBeenCalledWith(expect.objectContaining({ kind: "CONTACT_ACTIVATION", supplierId: "s1", email: "maria@firm.gr", contactId: "c1", createdById: "staff1" }));
    expect(m.send).toHaveBeenCalledWith("maria@firm.gr", expect.objectContaining({ subject: "Πρόσβαση στο περιβάλλον συνεργατών Orithon" }), ["contact-invite"]);
  });
  it("access=invite needs an e-mail", async () => {
    expect(await saveSupplierContact("s1", null, { ...base, email: "", access: "invite" })).toEqual({ error: "Για πρόσβαση χρειάζεται email" });
  });
  it("access=password creates the COLLABORATOR with a bcrypt hash and never echoes the password", async () => {
    const r = await saveSupplierContact("s1", null, { ...base, access: "password", password: "Secret123!", isSupplierAdmin: true });
    expect(r).toEqual({ id: "c1" });
    expect(JSON.stringify(r)).not.toContain("Secret123!");
    expect(m.userCreates[0]).toMatchObject({ email: "maria@firm.gr", role: "COLLABORATOR", roleId: "roleCollab", supplierId: "s1", isSupplierAdmin: true, status: "ACTIVE", phone: "210", mobile: "69" });
    expect(await bcrypt.compare("Secret123!", m.userCreates[0].passwordHash as string)).toBe(true);
    expect(m.contacts[0].userId).toBe(m.users[0].id);
  });
  it("access=password requires 8+ characters", async () => {
    expect(await saveSupplierContact("s1", null, { ...base, access: "password", password: "short" })).toEqual({ error: "Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες" });
  });
  it("e-mail of a PROPERTY_OWNER → explicit error, nothing created", async () => {
    m.users.push({ id: "own", email: "maria@firm.gr", role: "PROPERTY_OWNER", supplierId: null, passwordHash: "h", status: "ACTIVE", isSupplierAdmin: false });
    expect(await saveSupplierContact("s1", null, { ...base, access: "invite" })).toEqual({ error: "Το email ανήκει ήδη σε λογαριασμό άλλου τύπου (π.χ. ιδιοκτήτη/διαχειριστή). Χρησιμοποιήστε άλλο email." });
    expect(m.contacts).toEqual([]);
    expect(m.issue).not.toHaveBeenCalled();
  });
  it("e-mail of another supplier's collaborator → explicit error", async () => {
    m.users.push({ id: "oth", email: "maria@firm.gr", role: "COLLABORATOR", supplierId: "s9", passwordHash: "h", status: "ACTIVE", isSupplierAdmin: false });
    expect(await saveSupplierContact("s1", null, { ...base, access: "password", password: "Secret123!" })).toEqual({ error: "Το email ανήκει σε λογαριασμό άλλου συνεργάτη." });
  });
  it("a supplier admin (outside party) gets one neutral message for any foreign e-mail — no account oracle", async () => {
    m.actor.role = "COLLABORATOR"; m.actor.supplierId = "s1"; m.actor.isSupplierAdmin = true; m.actor.perms = new Set(["mkt-team:edit"]);
    m.users.push({ id: "own", email: "maria@firm.gr", role: "PROPERTY_OWNER", supplierId: null, passwordHash: "h", status: "ACTIVE", isSupplierAdmin: false });
    const neutral = { error: "Το email δεν μπορεί να χρησιμοποιηθεί για πρόσβαση — επικοινωνήστε με την εταιρεία διαχείρισης." };
    expect(await saveSupplierContact("s1", null, { ...base, access: "invite" })).toEqual(neutral);
    m.users[0] = { id: "oth", email: "maria@firm.gr", role: "COLLABORATOR", supplierId: "s9", passwordHash: "h", status: "ACTIVE", isSupplierAdmin: false };
    expect(await saveSupplierContact("s1", null, { ...base, access: "invite" })).toEqual(neutral);
    m.actor.role = "EMPLOYEE"; m.actor.supplierId = null; m.actor.isSupplierAdmin = false;
  });
  it("e-mail of an existing same-supplier login just links the contact", async () => {
    m.users.push({ id: "same", email: "maria@firm.gr", role: "COLLABORATOR", supplierId: "s1", passwordHash: "h", status: "ACTIVE", isSupplierAdmin: false });
    expect(await saveSupplierContact("s1", null, { ...base, access: "invite" })).toEqual({ id: "c1" });
    expect(m.contacts[0].userId).toBe("same");
    expect(m.issue).not.toHaveBeenCalled();
  });
  it("isPrimary clears the other primaries and makes the linked user supplier admin", async () => {
    m.contacts.push({ id: "c0", supplierId: "s1", name: "Παλιός", email: "old@firm.gr", isPrimary: true, receivesRfq: true, active: true, userId: null, phone: null, mobile: null, position: null, notes: null });
    m.users.push({ id: "same", email: "maria@firm.gr", role: "COLLABORATOR", supplierId: "s1", passwordHash: "h", status: "ACTIVE", isSupplierAdmin: false });
    await saveSupplierContact("s1", null, { ...base, isPrimary: true, access: "invite" });
    expect(m.contacts.find((c) => c.id === "c0")!.isPrimary).toBe(false);
    expect(m.users[0].isSupplierAdmin).toBe(true);
  });
});

describe("lifecycle", () => {
  it("deactivate flips the contact and sets the linked user INACTIVE; reactivation is separate", async () => {
    m.contacts.push({ id: "c1", supplierId: "s1", name: "Μ", email: "m@firm.gr", isPrimary: false, receivesRfq: true, active: true, userId: "u1", phone: null, mobile: null, position: null, notes: null });
    m.users.push({ id: "u1", email: "m@firm.gr", role: "COLLABORATOR", supplierId: "s1", passwordHash: "h", status: "ACTIVE", isSupplierAdmin: false });
    expect(await deactivateSupplierContact("s1", "c1")).toEqual({ ok: true });
    expect(m.contacts[0].active).toBe(false);
    expect(m.users[0].status).toBe("INACTIVE");
  });
  it("resend revokes the old links and sends a fresh one", async () => {
    m.contacts.push({ id: "c1", supplierId: "s1", name: "Μ", email: "m@firm.gr", isPrimary: false, receivesRfq: true, active: true, userId: null, phone: null, mobile: null, position: null, notes: null });
    expect(await resendContactInvite("s1", "c1")).toEqual({ ok: true });
    expect(m.issue).toHaveBeenCalledWith(expect.objectContaining({ kind: "CONTACT_ACTIVATION", contactId: "c1", email: "m@firm.gr" }));
    expect(m.send).toHaveBeenCalledTimes(1);
  });
  it("resend refuses when the contact already has a working login", async () => {
    m.contacts.push({ id: "c1", supplierId: "s1", name: "Μ", email: "m@firm.gr", isPrimary: false, receivesRfq: true, active: true, userId: "u1", phone: null, mobile: null, position: null, notes: null });
    m.users.push({ id: "u1", email: "m@firm.gr", role: "COLLABORATOR", supplierId: "s1", passwordHash: "h", status: "ACTIVE", isSupplierAdmin: false });
    expect(await resendContactInvite("s1", "c1")).toEqual({ error: "Η επαφή έχει ήδη ενεργό λογαριασμό" });
  });
  it("remove refuses a contact with a login and deletes one without", async () => {
    m.contacts.push({ id: "c1", supplierId: "s1", name: "Μ", email: null, isPrimary: false, receivesRfq: true, active: true, userId: "u1", phone: null, mobile: null, position: null, notes: null });
    expect(await removeSupplierContact("s1", "c1")).toEqual({ error: "Η επαφή έχει λογαριασμό — απενεργοποιήστε την αντί για διαγραφή" });
    m.contacts[0].userId = null;
    expect(await removeSupplierContact("s1", "c1")).toEqual({ ok: true });
    expect(m.contacts).toEqual([]);
  });
});
