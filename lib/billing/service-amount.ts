import { db } from "@/lib/db";

export type PricingModel = "PER_UNIT" | "PER_BUILDING" | "PER_COMMON_AREA" | "FLAT" | "METERED_PREPAID";
export type BillableService = { id: string; name: string; pricingModel: PricingModel; price: number };
export type PropertyCounts = { units: number; buildings: number; commonAreas: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function serviceLineAmount(s: BillableService, c: PropertyCounts): number {
  switch (s.pricingModel) {
    case "PER_UNIT": return round2(s.price * c.units);
    case "PER_BUILDING": return round2(s.price * c.buildings);
    case "PER_COMMON_AREA": return round2(s.price * c.commonAreas);
    case "FLAT": return round2(s.price);
    case "METERED_PREPAID": return 0;
  }
}

export type PackageLine = {
  serviceId: string;
  name: string;
  pricingModel: PricingModel;
  unitPrice: number;
  qty: number;
  amount: number;
};

export function computePackageTotal(services: BillableService[], c: PropertyCounts): {
  lines: PackageLine[];
  totalCents: number;
  total: number;
} {
  const lines: PackageLine[] = services.map((s) => {
    const qty = s.pricingModel === "PER_UNIT" ? c.units
      : s.pricingModel === "PER_BUILDING" ? c.buildings
      : s.pricingModel === "PER_COMMON_AREA" ? c.commonAreas
      : s.pricingModel === "FLAT" ? 1
      : 0;
    return { serviceId: s.id, name: s.name, pricingModel: s.pricingModel, unitPrice: s.price, qty, amount: serviceLineAmount(s, c) };
  });
  const total = lines.reduce((t, l) => t + l.amount, 0);
  return { lines, totalCents: Math.round(total * 100), total: round2(total) };
}

// ─────────────────────────────────────────────────────────────────────────────
// DB loader — resolves the property's live counts + company service catalog +
// per-property enabled flags, and computes the authoritative monthly package.
// The amount here is the SINGLE source of truth for payment; the client never
// supplies it.
// ─────────────────────────────────────────────────────────────────────────────

export type PackageService = BillableService & { code: string; isCore: boolean; enabled: boolean };

export type PropertyPackage = {
  counts: PropertyCounts;
  services: PackageService[];
  enabled: BillableService[];
  lines: PackageLine[];
  total: number;
  totalCents: number;
};

export async function getPropertyPackage(propertyId: string): Promise<PropertyPackage> {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: {
      companyId: true,
      buildings: {
        select: { _count: { select: { units: true, commonAreas: true } } },
      },
      services: { select: { serviceId: true, active: true } },
    },
  });
  if (!property) throw new Error("Property not found");

  const counts: PropertyCounts = {
    buildings: property.buildings.length,
    units: property.buildings.reduce((s, b) => s + b._count.units, 0),
    commonAreas: property.buildings.reduce((s, b) => s + b._count.commonAreas, 0),
  };

  const activeServiceIds = new Set(property.services.filter((ps) => ps.active).map((ps) => ps.serviceId));

  const catalog = await db.service.findMany({
    where: { companyId: property.companyId, active: true },
    orderBy: [{ isCore: "desc" }, { name: "asc" }],
    select: { id: true, name: true, code: true, isCore: true, pricingModel: true, price: true },
  });

  const services: PackageService[] = catalog.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    isCore: s.isCore,
    pricingModel: s.pricingModel as PricingModel,
    price: Number(s.price),
    enabled: activeServiceIds.has(s.id),
  }));

  const enabled: BillableService[] = services
    .filter((s) => s.enabled)
    .map((s) => ({ id: s.id, name: s.name, pricingModel: s.pricingModel, price: s.price }));

  const { lines, total, totalCents } = computePackageTotal(enabled, counts);

  return { counts, services, enabled, lines, total, totalCents };
}
