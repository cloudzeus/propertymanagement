import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

const m = vi.hoisted(() => ({
  resolve: vi.fn(), markUsed: vi.fn(async () => {}), signIn: vi.fn(async () => "http://localhost:3000/marketplace"),
  redirect: vi.fn((to: string) => { throw new Error("NEXT_REDIRECT:" + to); }),
  user: null as null | { id: string; role: string; supplierId: string | null; passwordHash: string | null },
  created: [] as Record<string, unknown>[],
  updated: [] as { where: unknown; data: Record<string, unknown> }[],
  contactUpdates: [] as { where: unknown; data: Record<string, unknown> }[],
  contactCreates: [] as Record<string, unknown>[],
  usersOfSupplier: 0,
  burnCount: 1,
  contact: { id: "c1", isPrimary: false, name: "Μαρία", userId: null as string | null, phone: null as string | null, mobile: null as string | null },
}));
vi.mock("@/lib/supplier-invites", () => ({ resolveInviteLink: m.resolve, markInviteUsed: m.markUsed }));
vi.mock("@/auth", () => ({ signIn: m.signIn }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("@/lib/db", () => {
  const tx = {
    user: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { m.created.push(data); return { id: "newU", ...data }; }),
      update: vi.fn(async (q: { where: unknown; data: Record<string, unknown> }) => { m.updated.push(q); return {}; }),
      count: vi.fn(async () => m.usersOfSupplier),
    },
    supplierContact: {
      findUnique: vi.fn(async () => m.contact), findFirst: vi.fn(async () => null),
      update: vi.fn(async (q: { where: unknown; data: Record<string, unknown> }) => { m.contactUpdates.push(q); return {}; }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { m.contactCreates.push(data); return { id: "cNew", ...data }; }),
    },
    role: { findUnique: vi.fn(async () => ({ id: "roleCollab" })) },
    supplierInviteLink: { updateMany: vi.fn(async () => ({ count: m.burnCount })) },
  };
  return { db: { ...tx, user: { ...tx.user, findUnique: vi.fn(async () => m.user) }, $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) } };
});

import { activateInvite } from "./invite";

const okLink = (over: Record<string, unknown> = {}) => ({ status: "ok", supplierName: "Ηλεκτρολόγοι ΑΕ", link: { id: "l1", kind: "RFQ_INVITE", email: "a@firm.gr", supplierId: "s1", rfqId: "rfq1", contactId: "c1", expiresAt: new Date(Date.now() + 1000), ...over } });
const good = { name: "Μαρία Κωνσταντίνου", password: "Secret123!", confirm: "Secret123!", agreed: true };

let T = "t0";
let n = 0;
beforeEach(() => { T = `tok-${++n}`; m.burnCount = 1; vi.clearAllMocks(); m.user = null; m.created = []; m.updated = []; m.contactUpdates = []; m.contactCreates = []; m.usersOfSupplier = 0; m.contact = { id: "c1", isPrimary: false, name: "Μαρία", userId: null, phone: "210", mobile: null }; });

describe("activateInvite", () => {
  it("validates input before touching anything", async () => {
    m.resolve.mockResolvedValue(okLink());
    expect(await activateInvite(T, { ...good, password: "short", confirm: "short" })).toEqual({ error: "Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες" });
    expect(await activateInvite(T, { ...good, confirm: "Other123!" })).toEqual({ error: "Οι κωδικοί δεν ταιριάζουν" });
    expect(await activateInvite(T, { ...good, agreed: false })).toEqual({ error: "Αποδεχθείτε τους όρους χρήσης" });
    expect(await activateInvite(T, { ...good, name: "Μ" })).toEqual({ error: "Γράψτε το ονοματεπώνυμό σας" });
    expect(m.created).toEqual([]);
  });
  it("rejects a dead link", async () => {
    m.resolve.mockResolvedValueOnce({ status: "expired" });
    expect(await activateInvite(T, good)).toEqual({ error: "Ο σύνδεσμος δεν ισχύει πλέον — ζητήστε νέα πρόσκληση από την εταιρεία διαχείρισης." });
  });
  it("creates the COLLABORATOR, links the contact, burns the link and signs in towards the RFQ", async () => {
    m.resolve.mockResolvedValueOnce(okLink());
    await expect(activateInvite(T, good)).rejects.toThrow(/NEXT_REDIRECT/);
    expect(m.created).toHaveLength(1);
    const u = m.created[0];
    expect(u).toMatchObject({ email: "a@firm.gr", name: "Μαρία Κωνσταντίνου", role: "COLLABORATOR", roleId: "roleCollab", supplierId: "s1", isSupplierAdmin: true, status: "ACTIVE", phone: "210" });
    expect(await bcrypt.compare("Secret123!", u.passwordHash as string)).toBe(true);
    expect(m.contactUpdates[0]).toMatchObject({ where: { id: "c1" }, data: { userId: "newU" } });
    expect(m.markUsed).not.toHaveBeenCalled();
    // sign in without Auth.js' absolute redirect (it would use AUTH_URL's origin), then a relative Next redirect
    expect(m.signIn).toHaveBeenCalledWith("credentials", { email: "a@firm.gr", password: "Secret123!", redirect: false });
    expect(m.redirect).toHaveBeenCalledWith("/marketplace/rfq/rfq1");
  });
  it("is not supplier admin when the supplier already has logins and the contact is not primary", async () => {
    m.resolve.mockResolvedValueOnce(okLink());
    m.usersOfSupplier = 2;
    await expect(activateInvite(T, good)).rejects.toThrow(/NEXT_REDIRECT/);
    expect(m.created[0]).toMatchObject({ isSupplierAdmin: false });
  });
  it("a link without a contact creates one for the new login", async () => {
    m.resolve.mockResolvedValueOnce(okLink({ contactId: null }));
    await expect(activateInvite(T, good)).rejects.toThrow(/NEXT_REDIRECT/);
    expect(m.contactCreates[0]).toMatchObject({ supplierId: "s1", email: "a@firm.gr", name: "Μαρία Κωνσταντίνου", userId: "newU" });
  });
  it("an existing login with a password is told to sign in instead; nothing is created", async () => {
    m.resolve.mockResolvedValueOnce(okLink());
    m.user = { id: "u1", role: "COLLABORATOR", supplierId: "s1", passwordHash: "h" };
    expect(await activateInvite(T, good)).toEqual({ error: "Ο λογαριασμός υπάρχει ήδη — συνδεθείτε με τον κωδικό σας." });
    expect(m.created).toEqual([]);
    expect(m.markUsed).not.toHaveBeenCalled();
  });
  it("an existing same-supplier login WITHOUT a password gets the password set (no second user)", async () => {
    m.resolve.mockResolvedValueOnce(okLink());
    m.user = { id: "u1", role: "COLLABORATOR", supplierId: "s1", passwordHash: null };
    await expect(activateInvite(T, good)).rejects.toThrow(/NEXT_REDIRECT/);
    expect(m.created).toEqual([]);
    expect(m.updated[0]).toMatchObject({ where: { id: "u1" } });
    expect(await bcrypt.compare("Secret123!", m.updated[0].data.passwordHash as string)).toBe(true);
  });
  it("burns the link atomically: a concurrent second submit finds it used and creates nothing", async () => {
    m.resolve.mockResolvedValueOnce(okLink());
    m.burnCount = 0;
    expect(await activateInvite(T, good)).toEqual({ error: "Ο σύνδεσμος δεν ισχύει πλέον — ζητήστε νέα πρόσκληση από την εταιρεία διαχείρισης." });
    expect(m.created).toEqual([]);
    expect(m.signIn).not.toHaveBeenCalled();
  });
  it("an e-mail of another role is refused", async () => {
    m.resolve.mockResolvedValueOnce(okLink());
    m.user = { id: "u1", role: "PROPERTY_OWNER", supplierId: null, passwordHash: "h" };
    expect(await activateInvite(T, good)).toEqual({ error: "Το email ανήκει σε λογαριασμό άλλου τύπου. Επικοινωνήστε με την εταιρεία διαχείρισης." });
  });
});
