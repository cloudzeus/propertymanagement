import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { BuildingDashboard } from "./BuildingDashboard";

export const metadata = { title: "Κτήριο — Super Admin" };

export default async function BuildingDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const me = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (me?.role !== "SUPER_ADMIN") redirect("/admin");

  const building = await db.building.findUnique({
    where: { id },
    select: {
      id: true, name: true, address: true, city: true, postalCode: true,
      floors: true, basements: true, hasElevator: true,
      property: { select: { id: true, name: true, customer: { select: { name: true } } } },
      _count: {
        select: { units: true, files: true, infraPoints: true, contacts: true, recurringTasks: true },
      },
    },
  });
  if (!building) notFound();

  const millesimesSum = await db.unit.aggregate({
    where: { buildingId: id },
    _sum: { millesimes: true },
  });

  const files = await db.buildingFile.findMany({
    where: { buildingId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, url: true, category: true, mimeType: true, sizeBytes: true, createdAt: true },
  });

  // ── People (owners/residents of this building) with full footprint ──────────
  const occ = { select: { id: true, name: true, email: true, phone: true, mobile: true, role: true, status: true } } as const;
  const unitsHere = await db.unit.findMany({
    where: { buildingId: id },
    orderBy: { unitNumber: "asc" },
    select: { id: true, unitNumber: true, unitType: true, floor: true, areaSqm: true, millesimes: true, owner: occ, resident: occ },
  });

  // Occupancy date ranges (από/έως) keyed by unit|user|role
  const occRows = await db.unitOccupancy.findMany({
    where: { unit: { buildingId: id } },
    orderBy: { startDate: "desc" },
    select: { unitId: true, userId: true, role: true, startDate: true, endDate: true },
  });
  const occKey = (unitId: string, userId: string, role: "OWNER" | "RESIDENT") => `${unitId}:${userId}:${role}`;
  const occMap = new Map<string, { from: string | null; to: string | null }>();
  for (const o of occRows) {
    const k = occKey(o.unitId, o.userId, o.role);
    if (!occMap.has(k)) occMap.set(k, { from: o.startDate ? o.startDate.toISOString() : null, to: o.endDate ? o.endDate.toISOString() : null });
  }

  type PUnit = { id: string; unitNumber: string; unitType: string; floor: number | null; areaSqm: number | null; millesimes: number | null; rel: string; from: string | null; to: string | null };
  type Person = {
    id: string; name: string | null; email: string; phone: string | null; mobile: string | null; role: string; status: string;
    relation: "OWNER" | "RESIDENT" | "BOTH";
    unitsHere: PUnit[];
    unitsElsewhere: { unitNumber: string; building: string; property: string; rel: string }[];
  };
  const map = new Map<string, Person>();
  const add = (u: NonNullable<(typeof unitsHere)[number]["owner"]>, unit: (typeof unitsHere)[number], rel: "OWNER" | "RESIDENT") => {
    let p = map.get(u.id);
    if (!p) { p = { id: u.id, name: u.name, email: u.email, phone: u.phone, mobile: u.mobile, role: u.role, status: u.status, relation: rel, unitsHere: [], unitsElsewhere: [] }; map.set(u.id, p); }
    else if (p.relation !== rel) p.relation = "BOTH";
    const dates = occMap.get(occKey(unit.id, u.id, rel)) ?? { from: null, to: null };
    const existing = p.unitsHere.find((x) => x.id === unit.id);
    const label = rel === "OWNER" ? "Ιδιοκτήτης" : "Ένοικος";
    if (existing) { existing.rel = "Ιδιοκτήτης & Ένοικος"; }
    else p.unitsHere.push({ id: unit.id, unitNumber: unit.unitNumber, unitType: unit.unitType, floor: unit.floor, areaSqm: unit.areaSqm, millesimes: unit.millesimes, rel: label, from: dates.from, to: dates.to });
  };
  for (const u of unitsHere) {
    if (u.owner) add(u.owner, u, "OWNER");
    if (u.resident) add(u.resident, u, "RESIDENT");
  }
  const personIds = [...map.keys()];
  if (personIds.length) {
    const elsewhere = await db.unit.findMany({
      where: { buildingId: { not: id }, OR: [{ ownerId: { in: personIds } }, { residentId: { in: personIds } }] },
      select: { unitNumber: true, ownerId: true, residentId: true, building: { select: { name: true, property: { select: { name: true } } } } },
    });
    for (const u of elsewhere) {
      if (u.ownerId && map.has(u.ownerId)) map.get(u.ownerId)!.unitsElsewhere.push({ unitNumber: u.unitNumber, building: u.building.name, property: u.building.property.name, rel: "Ιδιοκτήτης" });
      if (u.residentId && map.has(u.residentId)) map.get(u.residentId)!.unitsElsewhere.push({ unitNumber: u.unitNumber, building: u.building.name, property: u.building.property.name, rel: "Ένοικος" });
    }
  }
  const people = [...map.values()].sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email, "el"));

  return (
    <BuildingDashboard
      building={{
        id: building.id,
        name: building.name,
        address: building.address,
        city: building.city,
        postalCode: building.postalCode,
        floors: building.floors,
        basements: building.basements,
        hasElevator: building.hasElevator,
        propertyId: building.property.id,
        propertyName: building.property.name,
        customerName: building.property.customer.name,
      }}
      kpis={{
        units: building._count.units,
        millesimes: Math.round((millesimesSum._sum.millesimes ?? 0) * 100) / 100,
        files: building._count.files,
        infraPoints: building._count.infraPoints,
        contacts: building._count.contacts,
        recurringTasks: building._count.recurringTasks,
      }}
      files={files.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() }))}
      people={people}
    />
  );
}
