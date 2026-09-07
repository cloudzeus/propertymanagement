"use server";

import { db } from "@/lib/db";
import { Prisma } from "@/lib/prisma/client";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { getEffectiveSession } from "@/lib/auth-effective";
import { getEffectivePermissions, can } from "@/lib/rbac/permissions";
import { isStaffRole, scopeOf, supplierOptionsForBuilding, ensurePlatformSupplier, geocodeSupplierAddress, listServiceCatalog } from "@/lib/suppliers";
import { requireBuildingView } from "@/lib/building-access";
import {
  SUPPLIER_KINDS, normalizeAfm, normalizeWorkingHours,
  type SupplierFormInput, type CatalogItemInput, type SupplierOption,
} from "@/lib/suppliers-shared";

/* ------------------------------------------------------------------ */
/* Actor + authorization                                               */
/*                                                                     */
/* Three kinds of actors touch suppliers:                              */
/*  - company staff  → the company registry (customerId null)          */
/*  - PROPERTY_ADMIN → their own private list (customerId = theirs)    */
/*  - COLLABORATOR   → their own Supplier row (profile/catalog/team)   */
/* Private lists are invisible to staff (data isolation); the platform */
/* row is editable by staff only.                                      */
/* ------------------------------------------------------------------ */

type Actor = {
  id: string; role: string; customerId: string | null;
  supplierId: string | null; isSupplierAdmin: boolean;
  perms: Set<string>;
};

async function actor(): Promise<Actor> {
  const [eff, resolved] = await Promise.all([getEffectiveSession(), getEffectivePermissions()]);
  if (!eff?.user?.id || !resolved) throw new Error("Unauthorized");
  const u = await db.user.findUnique({ where: { id: eff.user.id }, select: { supplierId: true, isSupplierAdmin: true } });
  return {
    id: eff.user.id, role: eff.user.role, customerId: eff.user.customerId,
    supplierId: u?.supplierId ?? null, isSupplierAdmin: u?.isSupplierAdmin ?? false,
    perms: resolved.perms,
  };
}

type Row = { id: string; customerId: string | null; isPlatform: boolean };

/** Can this actor edit (or delete, when `del`) the given supplier row? */
function canEdit(a: Actor, row: Row, del = false): boolean {
  const scope = scopeOf(row);
  if (scope === "private") return a.role === "PROPERTY_ADMIN" && !!a.customerId && a.customerId === row.customerId && can(a.perms, "customer-suppliers", del ? "delete" : "edit");
  if (scope === "platform") return isStaffRole(a.role) && !del && can(a.perms, "suppliers", "edit");
  // company registry row
  if (isStaffRole(a.role)) return can(a.perms, "suppliers", del ? "delete" : "edit");
  // a supplier admin manages their own profile/catalog/team, never deletes the row
  return !del && a.role === "COLLABORATOR" && a.supplierId === row.id && a.isSupplierAdmin && can(a.perms, "mkt-profile", "edit");
}

async function loadRow(id: string): Promise<Row | null> {
  return db.supplier.findUnique({ where: { id }, select: { id: true, customerId: true, isPlatform: true } });
}

function revalidate(row?: Row | null) {
  revalidatePath("/super-admin/suppliers");
  revalidatePath("/building/suppliers");
  revalidatePath("/marketplace");
  revalidatePath("/marketplace/profile");
  revalidatePath("/marketplace/catalog");
  revalidatePath("/marketplace/team");
  if (row) revalidatePath(`/super-admin/suppliers/${row.id}`);
}

const clean = (v?: string | null) => (v?.trim() ? v.trim() : null);

function normalizeForm(input: SupplierFormInput) {
  const name = input.name?.trim();
  if (!name) return { error: "Η επωνυμία είναι υποχρεωτική" } as const;
  const kind = SUPPLIER_KINDS.includes(input.kind) ? input.kind : "SERVICES";
  const terms = input.paymentTermsDays != null && Number.isFinite(Number(input.paymentTermsDays)) ? Math.max(0, Math.round(Number(input.paymentTermsDays))) : null;
  const surveyRaw: unknown = input.siteSurveyFee;
  const siteSurveyFee = surveyRaw == null || surveyRaw === "" || !Number.isFinite(Number(surveyRaw)) ? null : Math.max(0, Number(surveyRaw));
  return {
    data: {
      kind, name,
      code: clean(input.code), afm: normalizeAfm(input.afm), doy: clean(input.doy),
      email: clean(input.email)?.toLowerCase() ?? null, phone: clean(input.phone), phone2: clean(input.phone2), webpage: clean(input.webpage),
      address: clean(input.address), city: clean(input.city), district: clean(input.district), postalCode: clean(input.postalCode), country: clean(input.country),
      isActive: input.isActive ?? true, remarks: clean(input.remarks),
      contactName: clean(input.contactName), contactPhone: clean(input.contactPhone), contactEmail: clean(input.contactEmail)?.toLowerCase() ?? null,
      iban: clean(input.iban)?.replace(/\s+/g, "").toUpperCase() ?? null, bank: clean(input.bank), paymentTermsDays: terms,
      siteSurveyFee, siteSurveyFeeWaived: input.siteSurveyFeeWaived ?? true,
      workingHours: input.workingHours === undefined ? undefined : (input.workingHours ? normalizeWorkingHours(input.workingHours) : null),
      emergency24h: input.emergency24h ?? false,
    },
    categoryIds: input.categoryIds ? [...new Set(input.categoryIds.filter(Boolean))] : undefined,
  } as const;
}

/* ------------------------------------------------------------------ */
/* Supplier CRUD                                                       */
/* ------------------------------------------------------------------ */

/**
 * Create a supplier. `scope: "company"` → company registry (staff with
 * suppliers:create). `scope: "private"` → the acting PROPERTY_ADMIN's list.
 */
export async function createSupplier(input: SupplierFormInput, scope: "company" | "private") {
  const a = await actor();
  let customerId: string | null = null;
  if (scope === "company") {
    if (!isStaffRole(a.role) || !can(a.perms, "suppliers", "create")) return { error: "Δεν επιτρέπεται" };
  } else {
    if (a.role !== "PROPERTY_ADMIN" || !a.customerId || !can(a.perms, "customer-suppliers", "create")) return { error: "Δεν επιτρέπεται" };
    customerId = a.customerId;
  }
  const n = normalizeForm(input);
  if ("error" in n) return { error: n.error };

  if (n.data.afm) {
    const dup = await db.supplier.findFirst({ where: { afm: n.data.afm, customerId, isPlatform: false }, select: { name: true } });
    if (dup) return { error: `Υπάρχει ήδη συνεργάτης με αυτό το ΑΦΜ («${dup.name}»)` };
  }
  const geo = await geocodeSupplierAddress(n.data);
  const row = await db.supplier.create({
    data: {
      ...n.data, customerId,
      workingHours: n.data.workingHours ?? undefined,
      lat: geo?.lat ?? null, lng: geo?.lng ?? null,
      ...(n.categoryIds?.length ? { categories: { create: n.categoryIds.map((categoryId) => ({ categoryId })) } } : {}),
    },
    select: { id: true, customerId: true, isPlatform: true },
  });
  revalidate(row);
  return { id: row.id };
}

export async function updateSupplier(id: string, input: SupplierFormInput) {
  const a = await actor();
  const row = await loadRow(id);
  if (!row) return { error: "Δεν βρέθηκε" };
  if (!canEdit(a, row)) return { error: "Δεν επιτρέπεται" };
  const n = normalizeForm(input);
  if ("error" in n) return { error: n.error };

  if (n.data.afm) {
    const dup = await db.supplier.findFirst({ where: { afm: n.data.afm, customerId: row.customerId, isPlatform: false, id: { not: id } }, select: { name: true } });
    if (dup) return { error: `Υπάρχει ήδη συνεργάτης με αυτό το ΑΦΜ («${dup.name}»)` };
  }
  // Re-geocode only when the address changed or coordinates are missing.
  const prev = await db.supplier.findUnique({ where: { id }, select: { address: true, city: true, postalCode: true, lat: true } });
  const addrChanged = prev && (prev.address !== n.data.address || prev.city !== n.data.city || prev.postalCode !== n.data.postalCode);
  const geo = addrChanged || prev?.lat == null ? await geocodeSupplierAddress(n.data) : null;

  await db.$transaction(async (tx) => {
    const { workingHours, ...rest } = n.data;
    await tx.supplier.update({
      where: { id },
      data: {
        ...rest,
        ...(workingHours === undefined ? {} : { workingHours: workingHours ?? Prisma.DbNull }),
        ...(geo ? { lat: geo.lat, lng: geo.lng } : addrChanged ? { lat: null, lng: null } : {}),
      },
    });
    if (n.categoryIds) {
      await tx.supplierCategory.deleteMany({ where: { supplierId: id } });
      if (n.categoryIds.length) await tx.supplierCategory.createMany({ data: n.categoryIds.map((categoryId) => ({ supplierId: id, categoryId })), skipDuplicates: true });
    }
  });
  revalidate(row);
  return { ok: true };
}

export async function deleteSupplier(id: string) {
  const a = await actor();
  const row = await loadRow(id);
  if (!row) return { ok: true };
  if (!canEdit(a, row, true)) return { error: "Δεν επιτρέπεται" };
  const usage = await db.supplier.findUnique({
    where: { id },
    select: { _count: { select: { maintenanceRequests: true, expenses: true, recurringTasks: true, users: true } } },
  });
  const c = usage?._count;
  if (c && (c.maintenanceRequests > 0 || c.expenses > 0 || c.recurringTasks > 0)) {
    return { error: "Ο συνεργάτης έχει ιστορικό (αναθέσεις/έξοδα/εργασίες). Απενεργοποιήστε τον αντί για διαγραφή." };
  }
  await db.supplier.delete({ where: { id } });
  revalidate(row);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Catalog: services & products                                        */
/* ------------------------------------------------------------------ */

function normalizeItem(input: CatalogItemInput) {
  const name = input.name?.trim();
  if (!name) return { error: "Το όνομα είναι υποχρεωτικό" } as const;
  const raw: unknown = input.price;
  const price = raw == null || raw === "" ? null : Number(raw);
  if (price != null && (!Number.isFinite(price) || price < 0)) return { error: "Μη έγκυρη τιμή" } as const;
  const vat = input.vatPct == null ? 24 : Math.round(Number(input.vatPct));
  if (!Number.isFinite(vat) || vat < 0 || vat > 100) return { error: "Μη έγκυρος ΦΠΑ" } as const;
  return {
    data: {
      name, sku: clean(input.sku), description: clean(input.description), unit: clean(input.unit),
      price, vatPct: vat, active: input.active ?? true, sortOrder: Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 0,
    },
  } as const;
}

async function requireCatalogEdit(supplierId: string) {
  const a = await actor();
  const row = await loadRow(supplierId);
  if (!row) throw new Error("Δεν βρέθηκε");
  // catalog edits also allowed to the supplier's admin (mkt-catalog) — same rule as profile
  if (!canEdit(a, row)) throw new Error("Δεν επιτρέπεται");
  return row;
}

export async function saveSupplierService(supplierId: string, id: string | null, input: CatalogItemInput) {
  try {
    const row = await requireCatalogEdit(supplierId);
    const n = normalizeItem(input);
    if ("error" in n) return { error: n.error };
    // services carry no SKU
    const data = { name: n.data.name, description: n.data.description, unit: n.data.unit, price: n.data.price, vatPct: n.data.vatPct, active: n.data.active, sortOrder: n.data.sortOrder };
    if (id) {
      const owned = await db.supplierService.findFirst({ where: { id, supplierId }, select: { id: true } });
      if (!owned) return { error: "Δεν βρέθηκε" };
      await db.supplierService.update({ where: { id }, data });
    } else {
      await db.supplierService.create({ data: { ...data, supplierId } });
    }
    revalidate(row);
    return { ok: true };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function deleteSupplierService(supplierId: string, id: string) {
  try {
    const row = await requireCatalogEdit(supplierId);
    await db.supplierService.deleteMany({ where: { id, supplierId } });
    revalidate(row);
    return { ok: true };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function saveSupplierProduct(supplierId: string, id: string | null, input: CatalogItemInput) {
  try {
    const row = await requireCatalogEdit(supplierId);
    const n = normalizeItem(input);
    if ("error" in n) return { error: n.error };
    if (id) {
      const owned = await db.supplierProduct.findFirst({ where: { id, supplierId }, select: { id: true } });
      if (!owned) return { error: "Δεν βρέθηκε" };
      await db.supplierProduct.update({ where: { id }, data: n.data });
    } else {
      await db.supplierProduct.create({ data: { ...n.data, supplierId } });
    }
    revalidate(row);
    return { ok: true };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function deleteSupplierProduct(supplierId: string, id: string) {
  try {
    const row = await requireCatalogEdit(supplierId);
    await db.supplierProduct.deleteMany({ where: { id, supplierId } });
    revalidate(row);
    return { ok: true };
  } catch (e) { return { error: (e as Error).message }; }
}

/* ------------------------------------------------------------------ */
/* Team: COLLABORATOR logins under a company-registry supplier          */
/* ------------------------------------------------------------------ */

export type SupplierUserInput = { name?: string | null; email: string; phone?: string | null; password?: string | null; isSupplierAdmin?: boolean; status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" };

async function requireTeamEdit(supplierId: string) {
  const a = await actor();
  const row = await loadRow(supplierId);
  if (!row) throw new Error("Δεν βρέθηκε");
  if (scopeOf(row) !== "company") throw new Error("Λογαριασμοί δίνονται μόνο σε συνεργάτες του μητρώου της εταιρίας");
  if (!canEdit(a, row)) throw new Error("Δεν επιτρέπεται");
  return { a, row };
}

export async function createSupplierUser(supplierId: string, input: SupplierUserInput) {
  try {
    const { row } = await requireTeamEdit(supplierId);
    const email = input.email?.trim().toLowerCase();
    if (!email) return { error: "Το email είναι υποχρεωτικό" };
    if (!input.password || input.password.length < 6) return { error: "Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες" };
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return { error: "Υπάρχει ήδη χρήστης με αυτό το email" };
    const sysRole = await db.role.findUnique({ where: { key: "COLLABORATOR" }, select: { id: true } });
    const u = await db.user.create({
      data: {
        email, name: clean(input.name), phone: clean(input.phone),
        role: "COLLABORATOR", roleId: sysRole?.id ?? null, status: input.status ?? "ACTIVE",
        supplierId, isSupplierAdmin: input.isSupplierAdmin ?? false,
        passwordHash: await bcrypt.hash(input.password, 10),
      },
      select: { id: true },
    });
    revalidate(row);
    revalidatePath("/super-admin/users");
    return { id: u.id };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function updateSupplierUser(supplierId: string, userId: string, input: Partial<SupplierUserInput>) {
  try {
    const { a, row } = await requireTeamEdit(supplierId);
    const target = await db.user.findFirst({ where: { id: userId, supplierId, role: "COLLABORATOR" }, select: { id: true, isSupplierAdmin: true } });
    if (!target) return { error: "Δεν βρέθηκε" };
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = clean(input.name);
    if (input.phone !== undefined) patch.phone = clean(input.phone);
    if (input.email !== undefined) {
      const email = input.email.trim().toLowerCase();
      const dup = await db.user.findFirst({ where: { email, id: { not: userId } }, select: { id: true } });
      if (dup) return { error: "Υπάρχει ήδη χρήστης με αυτό το email" };
      patch.email = email;
    }
    if (input.password) {
      if (input.password.length < 6) return { error: "Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες" };
      patch.passwordHash = await bcrypt.hash(input.password, 10);
    }
    if (input.status !== undefined) patch.status = input.status;
    if (input.isSupplierAdmin !== undefined) {
      // a supplier admin may not strip their own admin flag (lock-out guard)
      if (a.id === userId && !input.isSupplierAdmin) return { error: "Δεν μπορείτε να αφαιρέσετε τον δικό σας ρόλο διαχειριστή" };
      patch.isSupplierAdmin = input.isSupplierAdmin;
    }
    await db.user.update({ where: { id: userId }, data: patch });
    revalidate(row);
    revalidatePath("/super-admin/users");
    return { ok: true };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function removeSupplierUser(supplierId: string, userId: string) {
  try {
    const { a, row } = await requireTeamEdit(supplierId);
    if (a.id === userId) return { error: "Δεν μπορείτε να διαγράψετε τον εαυτό σας" };
    const target = await db.user.findFirst({ where: { id: userId, supplierId, role: "COLLABORATOR" }, select: { id: true } });
    if (!target) return { error: "Δεν βρέθηκε" };
    await db.user.delete({ where: { id: userId } });
    revalidate(row);
    revalidatePath("/super-admin/users");
    return { ok: true };
  } catch (e) { return { error: (e as Error).message }; }
}

/* ------------------------------------------------------------------ */
/* First-login wizard (supplier admin) + master service catalog         */
/* ------------------------------------------------------------------ */

export type OnboardingInput = {
  profile: SupplierFormInput;
  /** catalog items the supplier offers, with their own price/unit */
  services: { catalogItemId: string; price?: number | null; unit?: string | null }[];
};

/**
 * Completes /marketplace/onboarding: saves the profile, replaces specialties,
 * creates one SupplierService per selected catalog item (idempotent) and stamps
 * `onboardedAt`. Only the supplier's own admin (or company staff) may run it.
 */
export async function completeSupplierOnboarding(supplierId: string, input: OnboardingInput) {
  const a = await actor();
  const row = await loadRow(supplierId);
  if (!row) return { error: "Δεν βρέθηκε" };
  if (scopeOf(row) !== "company" || !canEdit(a, row)) return { error: "Δεν επιτρέπεται" };

  const saved = await updateSupplier(supplierId, input.profile);
  if ("error" in saved && saved.error) return saved;

  const catalog = await listServiceCatalog();
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const picks = input.services.filter((s) => byId.has(s.catalogItemId));
  const existing = await db.supplierService.findMany({ where: { supplierId, catalogItemId: { not: null } }, select: { id: true, catalogItemId: true } });
  const have = new Map(existing.map((e) => [e.catalogItemId!, e.id]));

  await db.$transaction(async (tx) => {
    for (const p of picks) {
      const c = byId.get(p.catalogItemId)!;
      const price = p.price == null || Number.isNaN(Number(p.price)) ? null : Math.max(0, Number(p.price));
      const data = { name: c.name, description: c.description, unit: clean(p.unit) ?? c.unit, price, active: true };
      const id = have.get(p.catalogItemId);
      if (id) await tx.supplierService.update({ where: { id }, data });
      else await tx.supplierService.create({ data: { ...data, supplierId, catalogItemId: c.id } });
    }
    // deselected catalog items are switched off, not deleted (history/offers may reference them)
    const keep = new Set(picks.map((p) => p.catalogItemId));
    const off = existing.filter((e) => !keep.has(e.catalogItemId!)).map((e) => e.id);
    if (off.length) await tx.supplierService.updateMany({ where: { id: { in: off } }, data: { active: false } });
    await tx.supplier.update({ where: { id: supplierId }, data: { onboardedAt: new Date() } });
  });
  revalidate(row);
  revalidatePath("/marketplace/onboarding");
  return { ok: true };
}

export type CatalogItemAdminInput = { name: string; description?: string | null; unit?: string | null; categoryId?: string | null; active?: boolean; sortOrder?: number };

/** Company staff maintain the master service catalog (suppliers:edit). */
export async function saveServiceCatalogItem(id: string | null, input: CatalogItemAdminInput) {
  const a = await actor();
  if (!isStaffRole(a.role) || !can(a.perms, "suppliers", "edit")) return { error: "Δεν επιτρέπεται" };
  const name = input.name?.trim();
  if (!name) return { error: "Το όνομα είναι υποχρεωτικό" };
  const data = { name, description: clean(input.description), unit: clean(input.unit), categoryId: input.categoryId || null, active: input.active ?? true, sortOrder: Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 0 };
  if (id) await db.serviceCatalogItem.update({ where: { id }, data });
  else await db.serviceCatalogItem.create({ data });
  revalidatePath("/super-admin/suppliers/catalog");
  revalidatePath("/marketplace/onboarding");
  return { ok: true };
}

export async function deleteServiceCatalogItem(id: string) {
  const a = await actor();
  if (!isStaffRole(a.role) || !can(a.perms, "suppliers", "delete")) return { error: "Δεν επιτρέπεται" };
  const used = await db.supplierService.count({ where: { catalogItemId: id } });
  if (used > 0) return { error: `Η υπηρεσία χρησιμοποιείται από ${used} συνεργάτες — απενεργοποιήστε την αντί για διαγραφή.` };
  await db.serviceCatalogItem.delete({ where: { id } });
  revalidatePath("/super-admin/suppliers/catalog");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Rating + preferred supplier (continuity)                             */
/* ------------------------------------------------------------------ */

/** Company staff rate the supplier after a fault is COMPLETED (one rating per fault). */
export async function rateSupplier(requestId: string, score: number, comment?: string | null) {
  const a = await actor();
  if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(a.role)) return { error: "Δεν επιτρέπεται" };
  const s = Math.round(Number(score));
  if (!Number.isFinite(s) || s < 1 || s > 5) return { error: "Η βαθμολογία είναι 1–5" };
  const req = await db.maintenanceRequest.findUnique({ where: { id: requestId }, select: { supplierId: true, status: true, buildingId: true } });
  if (!req?.supplierId) return { error: "Η βλάβη δεν έχει ανατεθεί σε συνεργάτη" };
  if (req.status !== "COMPLETED") return { error: "Αξιολόγηση μόνο μετά την ολοκλήρωση" };

  await db.supplierRating.upsert({
    where: { requestId },
    update: { score: s, comment: clean(comment), byUserId: a.id },
    create: { requestId, supplierId: req.supplierId, score: s, comment: clean(comment), byUserId: a.id },
  });
  const agg = await db.supplierRating.aggregate({ where: { supplierId: req.supplierId }, _avg: { score: true }, _count: { _all: true } });
  await db.supplier.update({ where: { id: req.supplierId }, data: { ratingAvg: agg._avg.score ?? null, ratingCount: agg._count._all } });
  revalidatePath(`/admin/maintenance/${requestId}`);
  revalidatePath(`/super-admin/suppliers/${req.supplierId}`);
  return { ok: true };
}

/** Mark (or clear) the preferred supplier for a building, optionally per fault category. */
export async function setPreferredSupplier(buildingId: string, categoryId: string | null, supplierId: string | null) {
  const a = await actor();
  if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(a.role)) return { error: "Δεν επιτρέπεται" };
  const existing = await db.buildingPreferredSupplier.findFirst({ where: { buildingId, categoryId: categoryId ?? null }, select: { id: true } });
  if (!supplierId) {
    if (existing) await db.buildingPreferredSupplier.delete({ where: { id: existing.id } });
    return { ok: true };
  }
  const ok = await db.supplier.findFirst({ where: { id: supplierId, customerId: null, isPlatform: false }, select: { id: true } });
  if (!ok) return { error: "Μη έγκυρος συνεργάτης" };
  if (existing) await db.buildingPreferredSupplier.update({ where: { id: existing.id }, data: { supplierId } });
  else await db.buildingPreferredSupplier.create({ data: { buildingId, categoryId: categoryId ?? null, supplierId } });
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Pickers                                                             */
/* ------------------------------------------------------------------ */

/** Options for a building's expense / recurring-task supplier pickers. */
export async function listSupplierOptionsForBuilding(buildingId: string): Promise<SupplierOption[]> {
  await requireBuildingView(buildingId);
  const eff = await getEffectiveSession();
  await ensurePlatformSupplier();
  return supplierOptionsForBuilding(buildingId, eff?.user.role ?? "");
}

/** Company registry options (for staff assigning a fault to an external supplier). */
export async function listRegistrySupplierOptions(categoryId?: string | null): Promise<SupplierOption[]> {
  const a = await actor();
  if (!isStaffRole(a.role) || !can(a.perms, "suppliers", "view")) return [];
  const rows = await db.supplier.findMany({
    where: { customerId: null, isPlatform: false, isActive: true, ...(categoryId ? { categories: { some: { categoryId } } } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true, afm: true, kind: true },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, afm: r.afm, scope: "company" as const, kind: r.kind }));
}
