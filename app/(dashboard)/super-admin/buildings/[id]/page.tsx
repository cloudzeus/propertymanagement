import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { BuildingDashboard } from "./BuildingDashboard";
import { listBuildingExpenses } from "@/app/actions/building-expenses";
import { getBuildingCategorySplits } from "@/app/actions/expense-categories";

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
      elevatorSurchargePerFloor: true, elevatorExemptGroundFloor: true,
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
    select: {
      id: true, unitNumber: true, unitType: true, floor: true, areaSqm: true, millesimes: true,
      millesimesElevator: true, millesimesHeating: true,
      millesimesSource: true, millesimesElevatorSource: true, millesimesHeatingSource: true,
      owner: occ, resident: occ,
    },
  });

  // ── Millesimes & distribution config ────────────────────────────────────────
  const [expenseCategories, categoryOverrides, unitExclusions] = await Promise.all([
    db.expenseCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, defaultBasis: true } }),
    db.buildingCategoryOverride.findMany({ where: { buildingId: id }, select: { categoryId: true, distributionBasis: true } }),
    db.unitCategoryExclusion.findMany({ where: { unit: { buildingId: id } }, select: { unitId: true, categoryId: true } }),
  ]);

  // Occupancy date ranges (από/έως) keyed by unit|user|role
  const occRows = await db.unitOccupancy.findMany({
    where: { unit: { buildingId: id } },
    orderBy: { startDate: "desc" },
    select: { id: true, unitId: true, userId: true, role: true, startDate: true, endDate: true },
  });
  const occKey = (unitId: string, userId: string, role: "OWNER" | "RESIDENT") => `${unitId}:${userId}:${role}`;
  const occMap = new Map<string, { id: string; from: string | null; to: string | null }>();
  for (const o of occRows) {
    const k = occKey(o.unitId, o.userId, o.role);
    if (!occMap.has(k)) occMap.set(k, { id: o.id, from: o.startDate ? o.startDate.toISOString() : null, to: o.endDate ? o.endDate.toISOString() : null });
  }

  type PUnit = { key: string; unitId: string; unitNumber: string; unitType: string; floor: number | null; areaSqm: number | null; millesimes: number | null; role: "OWNER" | "RESIDENT"; rel: string; occupancyId: string | null; from: string | null; to: string | null };
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
    const occ = occMap.get(occKey(unit.id, u.id, rel)) ?? null;
    p.unitsHere.push({
      key: `${unit.id}:${rel}`, unitId: unit.id, unitNumber: unit.unitNumber, unitType: unit.unitType,
      floor: unit.floor, areaSqm: unit.areaSqm, millesimes: unit.millesimes, role: rel,
      rel: rel === "OWNER" ? "Ιδιοκτήτης" : "Ένοικος",
      occupancyId: occ?.id ?? null, from: occ?.from ?? null, to: occ?.to ?? null,
    });
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

  const [contacts, infraPoints, taskRows] = await Promise.all([
    db.contact.findMany({ where: { buildingId: id }, orderBy: { name: "asc" }, select: { id: true, name: true, category: true, phone: true, email: true, notes: true } }),
    db.infraPoint.findMany({
      where: { buildingId: id }, orderBy: { createdAt: "asc" },
      select: {
        id: true, name: true, type: true, floorLabel: true, location: true, locked: true, notes: true,
        keyHolderUserId: true,
        keyHolderUser: { select: { id: true, name: true, email: true } },
        access: { select: { user: { select: { id: true, name: true, email: true } } } },
        media: { orderBy: { createdAt: "asc" }, select: { id: true, url: true, type: true } },
      },
    }),
    db.recurringTask.findMany({ where: { buildingId: id }, orderBy: { nextDueDate: "asc" }, select: { id: true, title: true, frequency: true, nextDueDate: true, vendor: true, notes: true, active: true } }),
  ]);
  const tasks = taskRows.map((t) => ({ ...t, nextDueDate: t.nextDueDate ? t.nextDueDate.toISOString() : null }));

  // ── Expenses (OCR) ──────────────────────────────────────────────────────────
  let expenses: Awaited<ReturnType<typeof listBuildingExpenses>> = [];
  let categorySplits: Awaited<ReturnType<typeof getBuildingCategorySplits>> = [];
  try {
    const [rawExpenses, splits] = await Promise.all([
      listBuildingExpenses(id),
      getBuildingCategorySplits(id),
    ]);
    categorySplits = splits;
    expenses = rawExpenses;
  } catch {
    expenses = [];
    categorySplits = [];
  }

  const infra = infraPoints.map((p) => ({
    id: p.id, name: p.name, type: p.type, floorLabel: p.floorLabel, location: p.location,
    locked: p.locked, notes: p.notes,
    keyHolderUserId: p.keyHolderUserId,
    keyHolderName: p.keyHolderUser ? (p.keyHolderUser.name ?? p.keyHolderUser.email) : null,
    access: p.access.map((a) => ({ id: a.user.id, name: a.user.name, email: a.user.email })),
    media: p.media.map((m) => ({ id: m.id, url: m.url, type: m.type as "IMAGE" | "VIDEO" })),
  }));

  // Floor options for the infra combo (from the building structure + roof/ground)
  const floorOptions: string[] = ["Ταράτσα"];
  for (let i = building.floors ?? 0; i >= 1; i--) floorOptions.push(`${i}ος όροφος`);
  floorOptions.push("Ισόγειο");
  for (let i = 1; i <= (building.basements ?? 0); i++) floorOptions.push(`Υπόγειο ${i}`);

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
        elevatorSurchargePerFloor: building.elevatorSurchargePerFloor,
        elevatorExemptGroundFloor: building.elevatorExemptGroundFloor,
      }}
      millesimeUnits={unitsHere.map((u) => ({
        id: u.id, unitNumber: u.unitNumber, floor: u.floor, areaSqm: u.areaSqm,
        millesimes: u.millesimes, millesimesElevator: u.millesimesElevator, millesimesHeating: u.millesimesHeating,
        millesimesSource: u.millesimesSource, millesimesElevatorSource: u.millesimesElevatorSource, millesimesHeatingSource: u.millesimesHeatingSource,
      }))}
      exclusionUnits={unitsHere.map((u) => ({ id: u.id, unitNumber: u.unitNumber, unitType: u.unitType }))}
      expenseCategories={expenseCategories}
      categoryOverrides={categoryOverrides}
      unitExclusions={unitExclusions}
      kpis={{
        units: building._count.units,
        millesimes: Math.round((millesimesSum._sum.millesimes ?? 0) * 100) / 100,
        files: building._count.files,
        infraPoints: building._count.infraPoints,
        contacts: building._count.contacts,
        recurringTasks: building._count.recurringTasks,
      }}
      units={unitsHere.map((u) => ({
        id: u.id, unitNumber: u.unitNumber, unitType: u.unitType, floor: u.floor,
        areaSqm: u.areaSqm, millesimes: u.millesimes,
        owner: u.owner ? { id: u.owner.id, name: u.owner.name, email: u.owner.email } : null,
        resident: u.resident ? { id: u.resident.id, name: u.resident.name, email: u.resident.email } : null,
      }))}
      files={files.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() }))}
      people={people}
      contacts={contacts}
      infraPoints={infra}
      floorOptions={floorOptions}
      tasks={tasks}
      expenses={expenses}
      categorySplits={categorySplits}
      today={new Date().toISOString()}
    />
  );
}
