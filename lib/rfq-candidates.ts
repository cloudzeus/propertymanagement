import "server-only";
import { db } from "@/lib/db";
import { rankSuppliers } from "@/lib/supplier-ranking";
import type { RfqCandidateDTO } from "@/lib/rfq-shared";

/**
 * Ranked company-registry suppliers for an RFQ on a fault (same signals as the
 * fault page: continuity, specialty, rating, proximity, 24/7), with what the
 * picker needs to filter: categories, distance, rating, whether the supplier
 * has logins and which e-mail an invitation would reach.
 */
export async function listRfqCandidates(maintenanceRequestId: string): Promise<{ candidates: RfqCandidateDTO[]; categories: { id: string; name: string }[]; defaultCategoryId: string | null }> {
  const req = await db.maintenanceRequest.findUnique({
    where: { id: maintenanceRequestId },
    select: { id: true, categoryId: true, priority: true, buildingId: true, building: { select: { lat: true, lng: true } } },
  });
  if (!req) return { candidates: [], categories: [], defaultCategoryId: null };
  const [suppliers, preferred, usedHere, categories] = await Promise.all([
    db.supplier.findMany({
      where: { customerId: null, isPlatform: false, isActive: true },
      select: {
        id: true, name: true, lat: true, lng: true, ratingAvg: true, ratingCount: true, emergency24h: true, onboardedAt: true, email: true, contactEmail: true,
        categories: { select: { categoryId: true, category: { select: { name: true } } } },
        users: { where: { role: "COLLABORATOR", status: "ACTIVE" }, select: { id: true } },
        contactPeople: { where: { active: true, receivesRfq: true, email: { not: null } }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], select: { email: true } },
      },
    }),
    db.buildingPreferredSupplier.findMany({ where: { buildingId: req.buildingId, OR: [{ categoryId: req.categoryId ?? "-" }, { categoryId: null }] }, select: { supplierId: true, categoryId: true } }),
    db.maintenanceRequest.findMany({ where: { buildingId: req.buildingId, supplierId: { not: null }, id: { not: req.id } }, distinct: ["supplierId"], select: { supplierId: true } }),
    db.maintenanceCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  const preferredId = (preferred.find((p) => p.categoryId) ?? preferred[0])?.supplierId ?? null;
  const used = new Set(usedHere.map((u) => u.supplierId));
  const ranked = rankSuppliers(
    suppliers.map((s) => ({
      id: s.id, name: s.name, lat: s.lat, lng: s.lng, ratingAvg: s.ratingAvg, ratingCount: s.ratingCount,
      emergency24h: s.emergency24h, categoryIds: s.categories.map((c) => c.categoryId),
      preferred: s.id === preferredId, lastUsedHere: used.has(s.id), onboarded: !!s.onboardedAt,
    })),
    { categoryId: req.categoryId, lat: req.building.lat, lng: req.building.lng, priority: req.priority },
  );
  const byId = new Map(suppliers.map((s) => [s.id, s]));
  return {
    candidates: ranked.map((r) => {
      const s = byId.get(r.id)!;
      const recipientEmail = s.contactPeople[0]?.email ?? s.email ?? s.contactEmail ?? null;
      return {
        id: r.id, name: r.name, categories: s.categories.map((c) => c.category.name), categoryIds: r.categoryIds,
        distanceKm: r.distanceKm == null ? null : Math.round(r.distanceKm * 10) / 10, ratingAvg: r.ratingAvg, ratingCount: r.ratingCount,
        score: r.score, reasons: r.reasons, hasAccounts: s.users.length > 0, recipientEmail: recipientEmail?.toLowerCase() ?? null, emergency24h: r.emergency24h,
      };
    }),
    categories,
    defaultCategoryId: req.categoryId,
  };
}

/**
 * Everyone an RFQ invitation e-mail should reach for a supplier: active logins ∪
 * active contacts flagged for RFQs ∪ the supplier's own e-mail addresses —
 * lowercased, deduplicated (first occurrence keeps its userId/contactId).
 */
export async function recipientsForSupplier(supplierId: string): Promise<{ email: string; userId: string | null; contactId: string | null }[]> {
  const [users, contacts, sup] = await Promise.all([
    db.user.findMany({ where: { supplierId, role: "COLLABORATOR", status: "ACTIVE" }, select: { id: true, email: true } }),
    db.supplierContact.findMany({ where: { supplierId, active: true, receivesRfq: true, email: { not: null } }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], select: { id: true, email: true } }),
    db.supplier.findUnique({ where: { id: supplierId }, select: { email: true, contactEmail: true } }),
  ]);
  const out: { email: string; userId: string | null; contactId: string | null }[] = [];
  const seen = new Set<string>();
  const add = (raw: string | null | undefined, userId: string | null, contactId: string | null) => {
    const email = raw?.trim().toLowerCase();
    if (!email || seen.has(email)) return;
    seen.add(email);
    out.push({ email, userId, contactId });
  };
  for (const u of users) add(u.email, u.id, null);
  for (const c of contacts) add(c.email, null, c.id);
  add(sup?.email, null, null);
  add(sup?.contactEmail, null, null);
  return out;
}
