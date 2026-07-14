"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const user = await db.user.findUnique({
    where: { id: session.user.id as string },
    select: { role: true },
  });
  if (user?.role !== "SUPER_ADMIN") throw new Error("Forbidden");
}

async function managingCompanyId(): Promise<string> {
  const c = await db.company.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!c) throw new Error("No managing company");
  return c.id;
}

export type CustomerInput = {
  type: "INDIVIDUAL" | "COMPANY";
  name: string;
  afm?: string | null;
  doy?: string | null;
  email?: string | null;
  phone?: string | null;
  phone2?: string | null;
  fax?: string | null;
  webpage?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  postalCode?: string | null;
  country?: string | null;
  remarks?: string | null;
  lat?: number | null;
  lng?: number | null;
  // Optional login account for the customer (so they can manage their properties)
  loginEmail?: string | null;
  loginPassword?: string | null;
};

function clean(d: Partial<CustomerInput>) {
  const s = (v?: string | null) => (v?.trim() || null);
  return {
    ...(d.type !== undefined ? { type: d.type as any } : {}),
    ...(d.name !== undefined ? { name: d.name.trim() } : {}),
    ...(d.afm !== undefined ? { afm: s(d.afm) } : {}),
    ...(d.doy !== undefined ? { doy: s(d.doy) } : {}),
    ...(d.email !== undefined ? { email: s(d.email) } : {}),
    ...(d.phone !== undefined ? { phone: s(d.phone) } : {}),
    ...(d.phone2 !== undefined ? { phone2: s(d.phone2) } : {}),
    ...(d.fax !== undefined ? { fax: s(d.fax) } : {}),
    ...(d.webpage !== undefined ? { webpage: s(d.webpage) } : {}),
    ...(d.address !== undefined ? { address: s(d.address) } : {}),
    ...(d.city !== undefined ? { city: s(d.city) } : {}),
    ...(d.district !== undefined ? { district: s(d.district) } : {}),
    ...(d.postalCode !== undefined ? { postalCode: s(d.postalCode) } : {}),
    ...(d.country !== undefined ? { country: s(d.country) } : {}),
    ...(d.remarks !== undefined ? { remarks: s(d.remarks) } : {}),
    ...(d.lat !== undefined ? { lat: d.lat } : {}),
    ...(d.lng !== undefined ? { lng: d.lng } : {}),
  };
}

/** Next auto customer code, sequential per company: C00001, C00002, … */
async function nextCustomerCode(companyId: string): Promise<string> {
  const rows = await db.customer.findMany({
    where: { companyId, code: { startsWith: "C" } },
    select: { code: true },
  });
  let max = 0;
  for (const r of rows) {
    const n = parseInt((r.code ?? "").replace(/\D/g, ""), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `C${String(max + 1).padStart(5, "0")}`;
}

export async function createCustomer(data: CustomerInput) {
  await requireSuperAdmin();
  if (!data.name.trim()) return { error: "Το όνομα/επωνυμία είναι υποχρεωτικό" };

  // Validate optional login account up front (before creating the customer)
  const loginEmail = (data.loginEmail || data.email || "").trim().toLowerCase();
  const wantsLogin = !!data.loginPassword;
  if (wantsLogin) {
    if (!loginEmail) return { error: "Συμπληρώστε email για τον λογαριασμό εισόδου" };
    if ((data.loginPassword ?? "").length < 6) return { error: "Ο κωδικός εισόδου πρέπει να έχει τουλάχιστον 6 χαρακτήρες" };
    const exists = await db.user.findUnique({ where: { email: loginEmail } });
    if (exists) return { error: "Υπάρχει ήδη χρήστης με αυτό το email" };
  }

  const companyId = await managingCompanyId();
  const customer = await db.customer.create({
    data: { companyId, code: await nextCustomerCode(companyId), ...clean(data) } as any,
  });

  let loginCreated = false;
  if (wantsLogin) {
    await db.user.create({
      data: {
        email: loginEmail,
        name: data.name.trim(),
        role: "PROPERTY_ADMIN" as any,
        status: "ACTIVE" as any,
        companyId,
        customerId: customer.id,
        passwordHash: await bcrypt.hash(data.loginPassword!, 10),
      },
    });
    loginCreated = true;
  }

  revalidatePath("/super-admin/customers");
  return { customer: { ...customer, propertyCount: 0, properties: [] }, loginCreated };
}

export async function updateCustomer(id: string, data: Partial<CustomerInput>) {
  await requireSuperAdmin();
  const customer = await db.customer.update({ where: { id }, data: clean(data) });
  const propertyCount = await db.property.count({ where: { customerId: id } });
  revalidatePath("/super-admin/customers");
  return { customer: { ...customer, propertyCount } };
}

export async function deleteCustomer(id: string) {
  await requireSuperAdmin();
  const props = await db.property.count({ where: { customerId: id } });
  if (props > 0) return { error: "Ο πελάτης έχει ιδιοκτησίες — διαγράψτε τις πρώτα" };
  await db.customer.delete({ where: { id } });
  revalidatePath("/super-admin/customers");
  return { success: true };
}

/** Ανάθεση πελάτη σε υπεύθυνο manager — μόνο SUPER_ADMIN/ADMIN. */
export async function assignAccountManager(customerId: string, managerId: string | null) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const me = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (!["SUPER_ADMIN", "ADMIN"].includes(me?.role ?? "")) return { error: "Δεν επιτρέπεται" };

  if (managerId) {
    const mgr = await db.user.findFirst({
      where: { id: managerId, role: "MANAGER", status: "ACTIVE" },
      select: { id: true },
    });
    if (!mgr) return { error: "Μη έγκυρος manager" };
  }

  await db.customer.update({ where: { id: customerId }, data: { accountManagerId: managerId } });
  revalidatePath("/super-admin/customers");
  return { ok: true };
}
