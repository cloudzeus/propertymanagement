import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { PropertyDetailClient } from "./PropertyDetailClient";
import { getDistanceZones, isStale } from "@/lib/distance/buildings";
import { getBaseStation } from "@/lib/distance/base";
import { describeBuildingDistance, zoneForKm } from "@/lib/distance/zones";
import { computePackageTotal, type PricingModel } from "@/lib/billing/service-amount";
import { isProviderVivaConfigured } from "@/lib/payments/provider-viva";

export const metadata = { title: "Ιδιοκτησία — Super Admin" };

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const me = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (me?.role !== "SUPER_ADMIN") redirect("/admin");

  const property = await db.property.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true } },
      buildings: {
        orderBy: { name: "asc" },
        include: {
          units: {
            orderBy: { unitNumber: "asc" },
            include: {
              owner: { select: { id: true, name: true, email: true } },
              resident: { select: { id: true, name: true, email: true } },
            },
          },
          commonAreas: { orderBy: [{ floor: "asc" }, { name: "asc" }] },
        },
      },
      services: true,
    },
  });
  if (!property) notFound();

  const [catalog, providerConfigured, zones, base] = await Promise.all([
    db.service.findMany({ where: { active: true }, orderBy: [{ isCore: "desc" }, { name: "asc" }] }),
    isProviderVivaConfigured(),
    getDistanceZones(),
    getBaseStation(),
  ]);

  // Same arithmetic as the payable package (lib/billing): PER_ZONE = base + the
  // zone amount of every building, so the client never has to guess it.
  const estimates = computePackageTotal(
    catalog.map((s) => ({ id: s.id, name: s.name, pricingModel: s.pricingModel as PricingModel, price: Number(s.price), zonePrices: (s.zonePrices as Record<string, number> | null) ?? null })),
    {
      buildings: property.buildings.length,
      units: property.buildings.reduce((n, b) => n + b.units.length, 0),
      commonAreas: property.buildings.reduce((n, b) => n + b.commonAreas.length, 0),
      buildingZones: property.buildings.map((b) => zoneForKm(zones, b.distanceKm)?.code ?? null),
    },
    zones,
  ).lines;
  const estimateOf = new Map(estimates.map((l) => [l.serviceId, l]));

  return (
    <PropertyDetailClient
      providerConfigured={providerConfigured}
      property={{
        id: property.id, name: property.name, customerName: property.customer.name, managed: property.managed,
        address: property.address, city: property.city, postalCode: property.postalCode, country: property.country, lat: property.lat, lng: property.lng,
      }}
      buildings={property.buildings.map((b) => ({
        id: b.id, name: b.name, address: b.address, city: b.city, postalCode: b.postalCode, country: b.country,
        floors: b.floors, basements: b.basements, hasElevator: b.hasElevator, hasBoiler: b.hasBoiler, hasFireSafety: b.hasFireSafety,
        technicalNotes: b.technicalNotes, lat: b.lat, lng: b.lng,
        // an ESTIMATE already reads «(εκτίμηση)» — do not double it with «(προς επανυπολογισμό)»
        distance: describeBuildingDistance(b, zones), distanceStale: !!base && b.distanceKm != null && b.distanceMethod !== "ESTIMATE" && isStale(b, base.key),
        units: b.units.map((u) => ({
          id: u.id, unitNumber: u.unitNumber, unitType: u.unitType, floor: u.floor,
          areaSqm: u.areaSqm, millesimes: u.millesimes,
          owner: u.owner ? { id: u.owner.id, name: u.owner.name, email: u.owner.email } : null,
          resident: u.resident ? { id: u.resident.id, name: u.resident.name, email: u.resident.email } : null,
        })),
        commonAreas: b.commonAreas.map((c) => ({ id: c.id, name: c.name, type: c.type, floor: c.floor })),
      }))}
      catalog={catalog.map((s) => ({
        id: s.id, name: s.name, code: s.code, isCore: s.isCore, pricingModel: s.pricingModel, price: Number(s.price),
        estimate: estimateOf.get(s.id)?.amount ?? 0, detail: estimateOf.get(s.id)?.detail ?? null,
      }))}
      propertyServices={property.services.map((ps) => ({
        serviceId: ps.serviceId, active: ps.active, prepaidPersonMinutes: ps.prepaidPersonMinutes,
      }))}
    />
  );
}
