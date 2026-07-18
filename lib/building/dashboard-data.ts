import { db } from "@/lib/db";
import { listBuildingExpenses } from "@/app/actions/building-expenses";
import { getBuildingCategorySplits } from "@/app/actions/expense-categories";
import { listHeatingReadings } from "@/app/actions/heating-readings";
import { listMaintenanceHistory } from "@/app/actions/maintenance-logs";

export type BuildingDashboardData = NonNullable<Awaited<ReturnType<typeof getBuildingDashboardData>>>;

export async function getBuildingDashboardData(id: string, opts: { heatingPeriod?: string | null } = {}) {
  const building = await db.building.findUnique({
    where: { id },
    select: {
      id: true, name: true, address: true, city: true, postalCode: true,
      floors: true, basements: true, hasElevator: true,
      elevatorSurchargePerFloor: true, elevatorExemptGroundFloor: true,
      heatingMeterUnit: true,
      property: { select: { id: true, name: true, managed: true, customer: { select: { name: true } } } },
      _count: {
        select: { units: true, files: true, infraPoints: true, contacts: true, recurringTasks: true, managedItems: true },
      },
    },
  });
  if (!building) return null;

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
      id: true, unitNumber: true, unitType: true, floor: true, areaSqm: true, millesimes: true, customerId: true,
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

  const [contacts, infraPoints, taskRows, managedItemRows, managedItemTypes] = await Promise.all([
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
    db.recurringTask.findMany({ where: { buildingId: id }, orderBy: { nextDueDate: "asc" }, select: { id: true, title: true, frequency: true, nextDueDate: true, vendor: true, notes: true, active: true, kind: true, inServicePackage: true, reminderDaysBefore: true } }),
    db.managedItem.findMany({
      where: { buildingId: id },
      orderBy: [{ location: "asc" }, { createdAt: "asc" }],
      select: { id: true, itemTypeId: true, location: true, floorLabel: true, quantity: true, photoUrl: true, notes: true, itemType: { select: { name: true } } },
    }),
    db.managedItemType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, active: true } }),
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

  // ── Heating readings (gated on metered heating) ─────────────────────────────
  const usesMeteredHeating =
    (await db.expenseCategory.count({
      where: {
        OR: [
          { defaultBasis: "METERED_70_30" },
          { overrides: { some: { buildingId: building.id, distributionBasis: "METERED_70_30" } } },
        ],
      },
    })) > 0;

  const rawHeatingPeriod = opts.heatingPeriod ?? null;
  const heatingPeriod =
    (rawHeatingPeriod && /^\d{4}-\d{2}$/.test(rawHeatingPeriod) ? rawHeatingPeriod : null)
    ?? (await db.buildingExpense.findFirst({ where: { buildingId: building.id }, orderBy: { month: "desc" }, select: { month: true } }))?.month
    ?? new Date().toISOString().slice(0, 7);

  const heatingReadingRows = usesMeteredHeating ? await listHeatingReadings(building.id, heatingPeriod) : [];

  const meterReadingRows = (await db.meterReading.findMany({
    where: { buildingId: building.id },
    orderBy: [{ periodTo: "desc" }, { createdAt: "desc" }],
    select: {
      id: true, meterType: true, meterNumber: true, periodFrom: true, periodTo: true,
      previousReading: true, currentReading: true, consumption: true, unit: true, createdAt: true,
      expense: { select: { description: true, receiptFile: { select: { url: true } } } },
    },
  })).map((r) => ({
    id: r.id,
    meterType: r.meterType as "POWER" | "WATER" | "GAS",
    meterNumber: r.meterNumber,
    periodFrom: r.periodFrom?.toISOString() ?? null,
    periodTo: r.periodTo?.toISOString() ?? null,
    previousReading: r.previousReading != null ? Number(r.previousReading) : null,
    currentReading: r.currentReading != null ? Number(r.currentReading) : null,
    consumption: r.consumption != null ? Number(r.consumption) : null,
    unit: r.unit,
    createdAt: r.createdAt.toISOString(),
    source: r.expense?.description ?? null,
    photoUrl: r.expense?.receiptFile?.url ?? null,
  }));

  // ── Overview widgets: paid/unpaid, open maintenance, upcoming tasks ──────────
  const allocs = await db.expenseAllocation.findMany({
    where: { unit: { buildingId: building.id } },
    select: { tenantAmount: true, tenantPaid: true, ownerAmount: true, ownerPaid: true },
  });
  let paidSum = 0, unpaidSum = 0;
  for (const a of allocs) {
    const t = Number(a.tenantAmount), o = Number(a.ownerAmount);
    paidSum += (a.tenantPaid ? t : 0) + (a.ownerPaid ? o : 0);
    unpaidSum += (a.tenantPaid ? 0 : t) + (a.ownerPaid ? 0 : o);
  }
  const [openRequests, openCount, upcomingTasksRaw] = await Promise.all([
    db.maintenanceRequest.findMany({
      where: { buildingId: building.id, status: { in: ["OPEN", "IN_PROGRESS"] } },
      orderBy: { createdAt: "desc" }, take: 5,
      select: { id: true, title: true, status: true, priority: true, createdAt: true },
    }),
    db.maintenanceRequest.count({ where: { buildingId: building.id, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    db.recurringTask.findMany({
      where: { buildingId: building.id, active: true }, orderBy: { nextDueDate: "asc" }, take: 5,
      select: { id: true, title: true, nextDueDate: true },
    }),
  ]);
  const overview = {
    paid: Math.round(paidSum * 100) / 100,
    unpaid: Math.round(unpaidSum * 100) / 100,
    openCount,
    openRequests: openRequests.map((r) => ({ id: r.id, title: r.title, status: r.status, priority: r.priority, createdAt: r.createdAt.toISOString() })),
    upcomingTasks: upcomingTasksRaw.map((t) => ({ id: t.id, title: t.title, nextDueDate: t.nextDueDate ? t.nextDueDate.toISOString() : null })),
  };

  const maintenanceHistory = await listMaintenanceHistory(building.id);

  // ── Fault requests (full list) + active categories ──────────────────────────
  const [maintenanceRequestRows, maintenanceCategories] = await Promise.all([
    db.maintenanceRequest.findMany({
      where: { buildingId: building.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, title: true, status: true, priority: true, createdAt: true, scheduledDate: true,
        unit: { select: { unitNumber: true } },
        categoryRef: { select: { name: true } },
      },
    }),
    db.maintenanceCategory.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const maintenanceRequests = maintenanceRequestRows.map((r) => ({
    id: r.id, title: r.title, status: r.status, priority: r.priority,
    createdAt: r.createdAt.toISOString(),
    scheduledDate: r.scheduledDate ? r.scheduledDate.toISOString() : null,
    unitNumber: r.unit?.unitNumber ?? null,
    categoryName: r.categoryRef?.name ?? null,
  }));

  return {
    building: {
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
      propertyManaged: building.property.managed,
      customerName: building.property.customer.name,
      elevatorSurchargePerFloor: building.elevatorSurchargePerFloor,
      elevatorExemptGroundFloor: building.elevatorExemptGroundFloor,
      heatingMeterUnit: building.heatingMeterUnit,
    },
    millesimeUnits: unitsHere.map((u) => ({
      id: u.id, unitNumber: u.unitNumber, floor: u.floor, areaSqm: u.areaSqm,
      millesimes: u.millesimes, millesimesElevator: u.millesimesElevator, millesimesHeating: u.millesimesHeating,
      millesimesSource: u.millesimesSource, millesimesElevatorSource: u.millesimesElevatorSource, millesimesHeatingSource: u.millesimesHeatingSource,
    })),
    exclusionUnits: unitsHere.map((u) => ({ id: u.id, unitNumber: u.unitNumber, unitType: u.unitType })),
    expenseCategories,
    categoryOverrides,
    unitExclusions,
    kpis: {
      units: building._count.units,
      millesimes: Math.round((millesimesSum._sum.millesimes ?? 0) * 100) / 100,
      files: building._count.files,
      infraPoints: building._count.infraPoints,
      contacts: building._count.contacts,
      recurringTasks: building._count.recurringTasks,
      managedItems: building._count.managedItems,
    },
    units: unitsHere.map((u) => ({
      id: u.id, unitNumber: u.unitNumber, unitType: u.unitType, floor: u.floor,
      areaSqm: u.areaSqm, millesimes: u.millesimes, customerId: u.customerId,
      owner: u.owner ? { id: u.owner.id, name: u.owner.name, email: u.owner.email } : null,
      resident: u.resident ? { id: u.resident.id, name: u.resident.name, email: u.resident.email } : null,
    })),
    files: files.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })),
    people,
    contacts,
    managedItems: managedItemRows.map((m) => ({
      id: m.id, itemTypeId: m.itemTypeId, itemTypeName: m.itemType.name,
      location: m.location, floorLabel: m.floorLabel, quantity: m.quantity,
      photoUrl: m.photoUrl, notes: m.notes,
    })),
    managedItemTypes,
    infraPoints: infra,
    floorOptions,
    tasks,
    expenses,
    categorySplits,
    usesMeteredHeating,
    heatingPeriod,
    heatingReadingRows,
    meterReadingRows,
    overview,
    maintenanceHistory,
    maintenanceRequests,
    maintenanceCategories,
    today: new Date().toISOString(),
  };
}
