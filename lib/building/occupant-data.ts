import { db } from "@/lib/db";
import { PUBLIC_FILE_CATEGORIES } from "@/lib/dashboard/owner-queries";
import { buildUnitStatement, type StatementBasis, type StatementExpense, type UnitStatementInput } from "@/lib/building/statement";

export type OccupantData = NonNullable<Awaited<ReturnType<typeof getOccupantControlCenter>>>;

/** ExpenseStatus values visible to occupants — DRAFT entries are staff work-in-progress. */
const VISIBLE_STATUSES = ["CONFIRMED", "ISSUED"] as const;

const r2 = (n: number) => Math.round(n * 100) / 100;
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/**
 * Read-only data for the occupant control center at /building/[id].
 * `userId` is assumed to have viewer "occupant" on the building (page resolves
 * access first); returns null when the building or the viewer's units vanish.
 */
export async function getOccupantControlCenter(
  buildingId: string,
  userId: string,
  opts: { month?: string | null } = {},
) {
  // ── Stage 1: building, my units, months, basis overrides ────────────────────
  const [building, unitRows, monthRows, overrides] = await Promise.all([
    db.building.findUnique({
      where: { id: buildingId },
      select: {
        id: true, name: true, address: true, city: true, postalCode: true,
        floors: true, hasElevator: true,
        property: { select: { name: true, managed: true } },
      },
    }),
    db.unit.findMany({
      where: {
        buildingId,
        OR: [{ ownerId: userId }, { residentId: userId }, { occupancies: { some: { userId, endDate: null } } }],
      },
      orderBy: { unitNumber: "asc" },
      select: {
        id: true, unitNumber: true, unitType: true, floor: true, areaSqm: true,
        millesimes: true, millesimesElevator: true, millesimesHeating: true,
        ownerId: true, residentId: true,
        occupancies: { where: { userId, endDate: null }, select: { role: true } },
      },
    }),
    db.buildingExpense.findMany({
      where: { buildingId, status: { in: [...VISIBLE_STATUSES] } },
      select: { month: true, issuedMonth: true },
    }),
    db.buildingCategoryOverride.findMany({
      where: { buildingId },
      select: { categoryId: true, distributionBasis: true },
    }),
  ]);
  if (!building || unitRows.length === 0) return null;

  // Viewer relationship per unit. Money attribution is strict: the tenant side
  // counts when the viewer IS the tenant of the unit (residentId or an open
  // RESIDENT occupancy); the owner side only when ownerId === userId.
  const myUnits = unitRows.map((u) => {
    const occRoles = new Set(u.occupancies.map((o) => o.role));
    const tenantSide = u.residentId === userId || occRoles.has("RESIDENT");
    const ownerSide = u.ownerId === userId;
    const ownerish = ownerSide || occRoles.has("OWNER");
    return {
      id: u.id, unitNumber: u.unitNumber, unitType: u.unitType, floor: u.floor, areaSqm: u.areaSqm,
      millesimes: u.millesimes, millesimesElevator: u.millesimesElevator, millesimesHeating: u.millesimesHeating,
      isOwner: ownerish, isResident: tenantSide,
      ownerSide, tenantSide,
      rel: ownerish && tenantSide ? "Ιδιοκατοίκηση" : ownerish ? "Ιδιοκτήτης" : "Ένοικος",
    };
  });
  const unitById = new Map(myUnits.map((u) => [u.id, u]));
  const myUnitIds = myUnits.map((u) => u.id);
  const isOwnerAnywhere = myUnits.some((u) => u.isOwner);
  const isResidentAnywhere = myUnits.some((u) => u.isResident);

  // ── Month picker: distinct issuance months (issuedMonth ?? month), desc ─────
  const months = [...new Set(monthRows.map((r) => r.issuedMonth ?? r.month))].sort().reverse();
  const requested = opts.month && /^\d{4}-\d{2}$/.test(opts.month) ? opts.month : null;
  const selectedMonth = requested ?? months[0] ?? new Date().toISOString().slice(0, 7);

  // Basis resolution: building override → category default → GENERAL_MILLESIMES.
  const overrideBasis = new Map(overrides.map((o) => [o.categoryId, o.distributionBasis]));
  const basisOf = (e: { categoryId: string | null; categoryRef: { defaultBasis: StatementBasis } | null }): StatementBasis =>
    (e.categoryId ? overrideBasis.get(e.categoryId) : null) ?? e.categoryRef?.defaultBasis ?? "GENERAL_MILLESIMES";

  // ── Stage 2: month expenses + section data, in parallel ─────────────────────
  const announcementAudiences =
    isOwnerAnywhere && isResidentAnywhere ? ["ALL", "OWNERS", "RESIDENTS"]
    : isOwnerAnywhere ? ["ALL", "OWNERS"]
    : ["ALL", "RESIDENTS"];

  const [
    expenseRows, infraPoints, photoFiles, assemblyRows, fileRows, contacts, announcementRows, heatingRows,
    unitRowsAll, taskRows, maintenanceRows, meterRows, managedItemRows,
  ] = await Promise.all([
    db.buildingExpense.findMany({
      where: {
        buildingId,
        status: { in: [...VISIBLE_STATUSES] },
        // Expense belongs to the selected month when (issuedMonth ?? month) matches.
        OR: [{ issuedMonth: selectedMonth }, { issuedMonth: null, month: selectedMonth }],
      },
      orderBy: [{ documentDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true, month: true, issuedMonth: true, category: true, description: true,
        supplierName: true, documentNumber: true, documentDate: true,
        netAmount: true, vatAmount: true, amount: true,
        tenantPct: true, ownerPct: true, paid: true, status: true, categoryId: true, createdAt: true,
        categoryRef: { select: { name: true, defaultBasis: true } },
        receiptFile: { select: { url: true, mimeType: true, name: true } },
        allocations: {
          where: { unitId: { in: myUnitIds } },
          select: { unitId: true, unitShare: true, tenantAmount: true, tenantPaid: true, ownerAmount: true, ownerPaid: true },
        },
      },
    }),
    db.infraPoint.findMany({
      where: { buildingId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, name: true, type: true, floorLabel: true, location: true, locked: true, notes: true,
        keyHolder: true,
        keyHolderUser: { select: { name: true } },
        access: { select: { user: { select: { name: true } } } },
        media: { where: { type: "IMAGE" }, orderBy: { createdAt: "asc" }, select: { id: true, url: true, name: true } },
      },
    }),
    db.buildingFile.findMany({
      where: { buildingId, category: "PHOTOS" },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, url: true, createdAt: true },
    }),
    db.assembly.findMany({
      where: { buildingId },
      orderBy: { scheduledAt: "desc" },
      select: { id: true, title: true, scheduledAt: true, status: true, minutesFinal: true, approvedAt: true },
    }),
    db.buildingFile.findMany({
      where: { buildingId, category: { in: [...PUBLIC_FILE_CATEGORIES] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, url: true, category: true, mimeType: true, sizeBytes: true, createdAt: true },
    }),
    db.contact.findMany({
      where: { buildingId },
      orderBy: { name: "asc" },
      // No `notes` — they can carry staff-internal remarks; the shell never renders them.
      select: { id: true, name: true, category: true, phone: true, email: true },
    }),
    db.announcement.findMany({
      where: { buildingId, status: "ACTIVE", audience: { in: announcementAudiences } },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, content: true, imageUrl: true, audience: true, createdAt: true, publishedAt: true },
    }),
    db.unitHeatingReading.findMany({
      where: { unitId: { in: myUnitIds }, period: selectedMonth },
      select: { unitId: true, previousReading: true, currentReading: true, consumption: true },
    }),
    // ── Full building info (read-only): every unit, maintenance, meters, items ──
    db.unit.findMany({
      where: { buildingId },
      orderBy: { unitNumber: "asc" },
      select: {
        id: true, unitNumber: true, unitType: true, floor: true, areaSqm: true, millesimes: true,
        owner: { select: { name: true } }, resident: { select: { name: true } },
      },
    }),
    db.recurringTask.findMany({
      where: { buildingId, active: true },
      orderBy: { nextDueDate: "asc" },
      select: { id: true, title: true, frequency: true, nextDueDate: true, vendor: true },
    }),
    db.maintenanceLog.findMany({
      where: { buildingId },
      orderBy: { performedAt: "desc" },
      take: 50,
      // No cost/performedBy — those are staff-internal.
      select: { id: true, performedAt: true, notes: true, documentFile: { select: { url: true } }, recurringTask: { select: { title: true } } },
    }),
    db.meterReading.findMany({
      where: { buildingId },
      orderBy: [{ periodTo: "desc" }, { createdAt: "desc" }],
      take: 60,
      select: {
        id: true, meterType: true, meterNumber: true, periodFrom: true, periodTo: true,
        previousReading: true, currentReading: true, consumption: true, unit: true,
        infraPoint: { select: { name: true } },
      },
    }),
    // managedItems only make sense on managed buildings; gated below by property.managed.
    db.managedItem.findMany({
      where: { buildingId },
      orderBy: [{ location: "asc" }, { createdAt: "asc" }],
      select: { id: true, location: true, floorLabel: true, quantity: true, photoUrl: true, itemType: { select: { name: true } } },
    }),
  ]);

  // ── Statement rows: aggregate share (Έξοδα list) + one notice per unit ──────
  // Per unit we keep ITS OWN allocation rows so buildUnitStatement can produce a
  // strictly per-apartment ειδοποιητήριο with the owner/tenant split — never
  // leaking another unit's amounts into this unit's notice.
  const perUnitRows = new Map<string, UnitStatementInput[]>();
  const perUnitPaid = new Map<string, { tCnt: number; tPaid: number; oCnt: number; oPaid: number }>();
  for (const u of myUnits) {
    perUnitRows.set(u.id, []);
    perUnitPaid.set(u.id, { tCnt: 0, tPaid: 0, oCnt: 0, oPaid: 0 });
  }

  const perExpense = expenseRows.map((e) => {
    const shared = {
      id: e.id,
      categoryName: e.categoryRef?.name ?? e.category ?? "Λοιπά έξοδα",
      basis: basisOf(e),
      amount: Number(e.amount),
      tenantPct: e.tenantPct,
      ownerPct: e.ownerPct,
    };
    let myShare = 0, myTenant = 0, myOwner = 0;
    let tenantAllocs = 0, tenantPaidAllocs = 0, ownerAllocs = 0, ownerPaidAllocs = 0;
    for (const a of e.allocations) {
      const u = unitById.get(a.unitId);
      if (!u) continue;
      // The apartment's αναλογία ALWAYS splits into owner + tenant amounts — a
      // property of the unit itself, independent of who the viewer is. Viewer-side
      // gating belongs ONLY to myPayable (the builder) and the paid badge.
      const ownerAmount = Number(a.ownerAmount);
      const tenantAmount = Number(a.tenantAmount);
      // Aggregate share for the Έξοδα list stays the viewer's PERSONAL portion.
      myShare += Number(a.unitShare);
      if (u.tenantSide) { myTenant += tenantAmount; tenantAllocs += 1; if (a.tenantPaid) tenantPaidAllocs += 1; }
      if (u.ownerSide) { myOwner += ownerAmount; ownerAllocs += 1; if (a.ownerPaid) ownerPaidAllocs += 1; }
      // Per-unit notice row: FULL owner/tenant split so the columns provably sum
      // (unitAmount = owner + tenant, the billed truth, not unitShare).
      perUnitRows.get(u.id)!.push({ ...shared, unitAmount: r2(ownerAmount + tenantAmount), unitTenant: r2(tenantAmount), unitOwner: r2(ownerAmount), receiptUrl: e.receiptFile?.url ?? null, description: e.description ?? e.supplierName ?? null });
      const pu = perUnitPaid.get(u.id)!;
      if (u.tenantSide) { pu.tCnt += 1; if (a.tenantPaid) pu.tPaid += 1; }
      if (u.ownerSide) { pu.oCnt += 1; if (a.ownerPaid) pu.oPaid += 1; }
    }
    return {
      row: { ...shared, myShare: r2(myShare), myTenant: r2(myTenant), myOwner: r2(myOwner) } satisfies StatementExpense,
      myTenantPaid: tenantAllocs > 0 ? tenantPaidAllocs === tenantAllocs : null,
      myOwnerPaid: ownerAllocs > 0 ? ownerPaidAllocs === ownerAllocs : null,
    };
  });

  // One UnitStatement per unit (ordered by unitNumber via myUnits), plus a
  // per-unit paid flag for each side relevant to the viewer's role.
  const statements = myUnits.map((u) => {
    const role: "OWNER" | "RESIDENT" | "BOTH" =
      u.ownerSide && u.tenantSide ? "BOTH" : u.tenantSide ? "RESIDENT" : "OWNER";
    const st = buildUnitStatement(
      {
        unitId: u.id, unitNumber: u.unitNumber, unitType: u.unitType, floor: u.floor, role,
        millesimes: u.millesimes, millesimesElevator: u.millesimesElevator, millesimesHeating: u.millesimesHeating,
      },
      perUnitRows.get(u.id)!,
    );
    const pu = perUnitPaid.get(u.id)!;
    return {
      ...st,
      tenantPaid: pu.tCnt > 0 ? pu.tPaid === pu.tCnt : null,
      ownerPaid: pu.oCnt > 0 ? pu.oPaid === pu.oCnt : null,
    };
  });

  // Building manager (for the signature line): reuse the already-fetched contacts.
  const managerName = contacts.find((c) => c.category?.includes("ιαχειρ"))?.name ?? null;

  const expenses = expenseRows.map((e, i) => ({
    id: e.id,
    month: e.month,
    issuedMonth: e.issuedMonth,
    categoryName: e.categoryRef?.name ?? e.category ?? null,
    description: e.description,
    supplierName: e.supplierName,
    documentNumber: e.documentNumber,
    documentDate: iso(e.documentDate),
    netAmount: e.netAmount != null ? Number(e.netAmount) : null,
    vatAmount: e.vatAmount != null ? Number(e.vatAmount) : null,
    amount: Number(e.amount),
    tenantPct: e.tenantPct,
    ownerPct: e.ownerPct,
    paid: e.paid,
    status: e.status,
    receipt: e.receiptFile ? { url: e.receiptFile.url, mimeType: e.receiptFile.mimeType, name: e.receiptFile.name } : null,
    myShare: perExpense[i].row.myShare,
    myTenant: perExpense[i].row.myTenant,
    myOwner: perExpense[i].row.myOwner,
    myTenantPaid: perExpense[i].myTenantPaid,
    myOwnerPaid: perExpense[i].myOwnerPaid,
    createdAt: e.createdAt.toISOString(),
  }));

  // ── Gallery: infra points with images + building photo files ────────────────
  const gallery = {
    points: infraPoints
      .filter((p) => p.media.length > 0)
      .map((p) => ({
        id: p.id, name: p.name, floorLabel: p.floorLabel,
        images: p.media.map((m) => ({ id: m.id, url: m.url, name: m.name })),
      })),
    buildingPhotos: photoFiles.map((f) => ({ id: f.id, name: f.name, url: f.url, createdAt: f.createdAt.toISOString() })),
  };

  // Assemblies: minutesFinal is the decision record, exposed only once APPROVED/SENT.
  // (No MINUTES BuildingFileCategory exists in the schema — no file attachments here.)
  const assemblies = assemblyRows.map((a) => ({
    id: a.id,
    title: a.title,
    scheduledAt: a.scheduledAt.toISOString(),
    status: a.status,
    approvedAt: iso(a.approvedAt),
    minutesFinal: a.status === "APPROVED" || a.status === "SENT" ? a.minutesFinal : null,
  }));

  // ── Full building info: serializable read-only shapes ───────────────────────
  const infra = infraPoints.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    floorLabel: p.floorLabel,
    location: p.location,
    locked: p.locked,
    notes: p.notes,
    keyHolderName: p.keyHolderUser?.name ?? p.keyHolder ?? null,
    accessNames: p.access.map((a) => a.user.name).filter((n): n is string => Boolean(n)),
    media: p.media.map((m) => ({ id: m.id, url: m.url, name: m.name })),
  }));

  const units = unitRowsAll.map((u) => ({
    id: u.id,
    unitNumber: u.unitNumber,
    unitType: u.unitType,
    floor: u.floor,
    areaSqm: u.areaSqm,
    millesimes: u.millesimes != null ? Number(u.millesimes) : null,
    ownerName: u.owner?.name ?? null,
    residentName: u.resident?.name ?? null,
  }));

  const tasks = taskRows.map((t) => ({
    id: t.id,
    title: t.title,
    frequency: t.frequency,
    nextDueDate: iso(t.nextDueDate),
    vendor: t.vendor,
  }));

  const maintenanceHistory = maintenanceRows.map((l) => ({
    id: l.id,
    taskTitle: l.recurringTask.title,
    performedAt: iso(l.performedAt),
    notes: l.notes,
    certificateUrl: l.documentFile?.url ?? null,
  }));

  const meterReadings = meterRows.map((r) => ({
    id: r.id,
    meterType: r.meterType,
    meterNumber: r.meterNumber,
    periodFrom: iso(r.periodFrom),
    periodTo: iso(r.periodTo),
    previousReading: r.previousReading != null ? Number(r.previousReading) : null,
    currentReading: r.currentReading != null ? Number(r.currentReading) : null,
    consumption: r.consumption != null ? Number(r.consumption) : null,
    unit: r.unit,
    infraName: r.infraPoint?.name ?? null,
  }));

  // Managed items are a managed-building concept only — hide entirely otherwise.
  const managedItems = building.property.managed
    ? managedItemRows.map((m) => ({
        id: m.id,
        name: m.itemType.name,
        location: m.location,
        floorLabel: m.floorLabel,
        quantity: m.quantity,
        photoUrl: m.photoUrl,
      }))
    : [];

  return {
    building: {
      id: building.id,
      name: building.name,
      address: building.address,
      city: building.city,
      postalCode: building.postalCode,
      floors: building.floors,
      hasElevator: building.hasElevator,
      managed: building.property.managed,
      propertyName: building.property.name,
    },
    myUnits: myUnits.map(({ ownerSide: _o, tenantSide: _t, ...u }) => u),
    isOwner: isOwnerAnywhere,
    isResident: isResidentAnywhere,
    months,
    selectedMonth,
    statements,
    managerName,
    expenses,
    heatingReadings: heatingRows.map((h) => ({
      unitId: h.unitId,
      unitNumber: unitById.get(h.unitId)?.unitNumber ?? "",
      previousReading: h.previousReading != null ? Number(h.previousReading) : null,
      currentReading: h.currentReading != null ? Number(h.currentReading) : null,
      consumption: h.consumption != null ? Number(h.consumption) : null,
    })),
    gallery,
    infra,
    units,
    tasks,
    maintenanceHistory,
    meterReadings,
    managedItems,
    assemblies,
    files: fileRows.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })),
    contacts,
    announcements: announcementRows.map((a) => ({
      id: a.id, title: a.title, content: a.content, imageUrl: a.imageUrl, audience: a.audience,
      createdAt: a.createdAt.toISOString(), publishedAt: iso(a.publishedAt),
    })),
  };
}
