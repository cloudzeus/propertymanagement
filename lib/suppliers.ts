import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/prisma/client";
import { COMPANY_ROLES } from "@/lib/roles-constants";
import {
  normalizeAfm, normalizeWorkingHours,
  type SupplierDTO, type SupplierOption, type SupplierScope, type SupplierKind, type CatalogItemDTO, type SupplierUserDTO, type ServiceCatalogItemDTO,
} from "@/lib/suppliers-shared";

/* ------------------------------------------------------------------ */
/* Scoping helpers                                                     */
/*                                                                     */
/* Two isolated registries share the Supplier table:                   */
/*   customerId = null  → company registry (Orithon)                   */
/*   customerId = X     → customer X's private list                    */
/* plus the single isPlatform row (Orithon itself) that every customer */
/* sees by default. See prisma/schema.prisma → Supplier.               */
/* ------------------------------------------------------------------ */

export const isStaffRole = (role: string) => (COMPANY_ROLES as readonly string[]).includes(role);

export function scopeOf(row: { customerId: string | null; isPlatform: boolean }): SupplierScope {
  if (row.isPlatform) return "platform";
  return row.customerId ? "private" : "company";
}

/** Rows a customer may see: their private list + the platform row. Never the company registry. */
export function customerVisibleWhere(customerId: string): Prisma.SupplierWhereInput {
  return { OR: [{ customerId }, { isPlatform: true }] };
}

/** Rows company staff may see: the company registry only (never private lists — data isolation). */
export const companyRegistryWhere: Prisma.SupplierWhereInput = { customerId: null };

/**
 * The single row representing the management company itself. Created lazily
 * from the managing Company's name; idempotent.
 */
export async function ensurePlatformSupplier(): Promise<{ id: string; name: string }> {
  const existing = await db.supplier.findFirst({ where: { isPlatform: true }, select: { id: true, name: true } });
  if (existing) return existing;
  const company = await db.company.findFirst({ orderBy: { createdAt: "asc" }, select: { name: true, afm: true } });
  return db.supplier.create({
    data: {
      isPlatform: true, customerId: null, kind: "BOTH",
      name: company?.name ?? "Εταιρία διαχείρισης",
      afm: company?.afm ?? null,
      remarks: "Η εταιρία διαχείρισης — προεπιλεγμένος συνεργάτης κάθε πελάτη.",
    },
    select: { id: true, name: true },
  });
}

export async function customerIdForBuilding(buildingId: string): Promise<string | null> {
  const b = await db.building.findUnique({ where: { id: buildingId }, select: { customerId: true, property: { select: { customerId: true } } } });
  return b?.customerId ?? b?.property?.customerId ?? null;
}

/**
 * Supplier options for a building's pickers (expenses, recurring tasks).
 * Customer-side viewers get their private list + platform row; company staff
 * additionally get the company registry (they may be booking Orithon's own
 * suppliers against a managed building).
 */
export async function supplierOptionsForBuilding(buildingId: string, viewerRole: string): Promise<SupplierOption[]> {
  const customerId = await customerIdForBuilding(buildingId);
  const ors: Prisma.SupplierWhereInput[] = [{ isPlatform: true }];
  if (customerId) ors.push({ customerId });
  if (isStaffRole(viewerRole)) ors.push({ customerId: null, isPlatform: false });
  const rows = await db.supplier.findMany({
    where: { isActive: true, OR: ors },
    orderBy: [{ isPlatform: "desc" }, { name: "asc" }],
    select: { id: true, name: true, afm: true, customerId: true, isPlatform: true, kind: true },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, afm: r.afm, scope: scopeOf(r), kind: r.kind as SupplierKind }));
}

/** Find a supplier by ΑΦΜ among the rows visible for this building (OCR auto-link). */
export async function matchSupplierByAfm(buildingId: string, afm: string | null | undefined, viewerRole: string): Promise<string | null> {
  const norm = normalizeAfm(afm);
  if (!norm) return null;
  const options = await supplierOptionsForBuilding(buildingId, viewerRole);
  // Prefer the customer's own card over the company registry when both match.
  const order: SupplierScope[] = ["private", "platform", "company"];
  const hits = options.filter((o) => normalizeAfm(o.afm) === norm).sort((a, b) => order.indexOf(a.scope) - order.indexOf(b.scope));
  return hits[0]?.id ?? null;
}

/* ------------------------------------------------------------------ */
/* DTO mappers                                                         */
/* ------------------------------------------------------------------ */

export const supplierListInclude = {
  categories: { select: { categoryId: true, category: { select: { name: true } } } },
  _count: { select: { users: true, services: true, products: true } },
} satisfies Prisma.SupplierInclude;

type SupplierRow = Prisma.SupplierGetPayload<{ include: typeof supplierListInclude }>;

export function supplierToDTO(r: SupplierRow): SupplierDTO {
  return {
    id: r.id,
    scope: scopeOf(r),
    customerId: r.customerId,
    kind: r.kind as SupplierKind,
    code: r.code, name: r.name, afm: r.afm, doy: r.doy, email: r.email, phone: r.phone, phone2: r.phone2, webpage: r.webpage,
    address: r.address, city: r.city, district: r.district, postalCode: r.postalCode, country: r.country,
    isActive: r.isActive, remarks: r.remarks,
    contactName: r.contactName, contactPhone: r.contactPhone, contactEmail: r.contactEmail,
    iban: r.iban, bank: r.bank, paymentTermsDays: r.paymentTermsDays,
    siteSurveyFee: r.siteSurveyFee != null ? Number(r.siteSurveyFee) : null,
    siteSurveyFeeWaived: r.siteSurveyFeeWaived,
    workingHours: r.workingHours ? normalizeWorkingHours(r.workingHours) : null,
    emergency24h: r.emergency24h,
    lat: r.lat, lng: r.lng, ratingAvg: r.ratingAvg, ratingCount: r.ratingCount,
    onboardedAt: r.onboardedAt ? r.onboardedAt.toISOString() : null,
    categoryIds: r.categories.map((c) => c.categoryId),
    categoryNames: r.categories.map((c) => c.category.name),
    usersCount: r._count.users, servicesCount: r._count.services, productsCount: r._count.products,
    createdAt: r.createdAt.toISOString(),
  };
}

export function catalogToDTO(r: { id: string; sku?: string | null; catalogItemId?: string | null; name: string; description: string | null; unit: string | null; price: Prisma.Decimal | null; vatPct: number; active: boolean; sortOrder: number }): CatalogItemDTO {
  return { id: r.id, sku: r.sku ?? null, catalogItemId: r.catalogItemId ?? null, name: r.name, description: r.description, unit: r.unit, price: r.price != null ? Number(r.price) : null, vatPct: r.vatPct, active: r.active, sortOrder: r.sortOrder };
}

export async function listServiceCatalog(activeOnly = true): Promise<ServiceCatalogItemDTO[]> {
  const rows = await db.serviceCatalogItem.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { category: { select: { name: true } } },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, description: r.description, unit: r.unit, categoryId: r.categoryId, categoryName: r.category?.name ?? null, active: r.active, sortOrder: r.sortOrder }));
}

/**
 * Best-effort geocoding of a supplier's address → lat/lng (proximity ranking).
 * Never throws; returns null when the address is empty or lookup fails.
 */
export async function geocodeSupplierAddress(parts: { address?: string | null; postalCode?: string | null; city?: string | null; country?: string | null }): Promise<{ lat: number; lng: number } | null> {
  const q = [parts.address, parts.postalCode, parts.city, parts.country].filter((p) => p?.trim()).join(", ");
  if (!parts.address?.trim() || !parts.city?.trim()) return null;
  try {
    const { geocodeAddress } = await import("@/lib/geocoding");
    const hit = (await geocodeAddress(q))[0];
    return hit ? { lat: hit.lat, lng: hit.lng } : null;
  } catch {
    return null;
  }
}

export function supplierUserToDTO(u: { id: string; name: string | null; email: string; phone: string | null; status: string; isSupplierAdmin: boolean; lastLoginAt: Date | null }): SupplierUserDTO {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, status: u.status, isSupplierAdmin: u.isSupplierAdmin, lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null };
}

/** Everything a supplier detail page / the marketplace profile needs. */
export async function loadSupplierFull(id: string) {
  const row = await db.supplier.findUnique({
    where: { id },
    include: {
      ...supplierListInclude,
      services: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
      products: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
      users: { orderBy: { name: "asc" }, select: { id: true, name: true, email: true, phone: true, status: true, isSupplierAdmin: true, lastLoginAt: true } },
    },
  });
  if (!row) return null;
  return {
    supplier: supplierToDTO(row),
    services: row.services.map(catalogToDTO),
    products: row.products.map(catalogToDTO),
    users: row.users.map(supplierUserToDTO),
  };
}
