"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { uploadFile, buildingFolder } from "@/lib/bunnycdn";
import { canManageBuildingExpenses } from "@/lib/expenses/authz";
import { computeAllocation } from "@/lib/expenses/allocation";
import { resolveWeights, type BasisUnit } from "@/lib/expenses/basis";
import type { DistributionBasis } from "@/lib/prisma/enums";
import { extractDocument } from "@/lib/ocr/extract";
import { normalizeExtraction } from "@/lib/ocr/normalize";
import type { ExtractedDoc } from "@/lib/ocr/prompt";

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function assertSplit(t: number, o: number) {
  if (t < 0 || o < 0 || t + o !== 100) throw new Error("Τα ποσοστά ενοικιαστή/ιδιοκτήτη πρέπει να αθροίζουν 100.");
}

const EMPTY_EXTRACTED = (): ExtractedDoc => ({
  docType: "other", supplierName: null, supplierVat: null, supplierDoy: null,
  documentNumber: null, documentDate: null, netAmount: null, vatAmount: null,
  totalAmount: null, suggestedCategoryCode: null, meter: null, confidence: 0,
});

async function requireBuildingAccess(buildingId: string): Promise<string> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const uid = session.user.id as string;
  if (!(await canManageBuildingExpenses(uid, buildingId))) throw new Error("Forbidden");
  return uid;
}

export type ManageableBuilding = { id: string; name: string; city: string | null; propertyName: string | null };

/** Buildings the current user may register expenses for. Company staff
 *  (SUPER_ADMIN/ADMIN/MANAGER) see all; building/property managers see only the
 *  buildings reachable through their ManagementAssignments. */
export async function listManageableBuildings(): Promise<ManageableBuilding[]> {
  const session = await auth();
  if (!session?.user) return [];
  const uid = session.user.id as string;
  const user = await db.user.findUnique({ where: { id: uid }, select: { role: true } });
  const role = user?.role ?? "";

  const select = { id: true, name: true, city: true, property: { select: { name: true } } } as const;
  const toResult = (b: { id: string; name: string; city: string | null; property: { name: string | null } | null }): ManageableBuilding =>
    ({ id: b.id, name: b.name, city: b.city, propertyName: b.property?.name ?? null });

  if (["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role)) {
    const buildings = await db.building.findMany({ select, orderBy: { name: "asc" } });
    return buildings.map(toResult);
  }

  // Manager: buildings assigned directly, or any building under an assigned property.
  const assignments = await db.managementAssignment.findMany({
    where: { userId: uid },
    select: { buildingId: true, propertyId: true },
  });
  const buildingIds = assignments.map((a) => a.buildingId).filter((x): x is string => !!x);
  const propertyIds = assignments.map((a) => a.propertyId).filter((x): x is string => !!x);
  if (!buildingIds.length && !propertyIds.length) return [];

  const buildings = await db.building.findMany({
    where: { OR: [{ id: { in: buildingIds } }, { propertyId: { in: propertyIds } }] },
    select, orderBy: { name: "asc" },
  });
  return buildings.map(toResult);
}

export async function extractExpenseDocument(buildingId: string, formData: FormData): Promise<{ fileId: string; fileUrl: string; extracted: ExtractedDoc }> {
  const uid = await requireBuildingAccess(buildingId);
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("Δεν δόθηκε αρχείο.");
  if (file.size > MAX_BYTES) throw new Error("Το αρχείο ξεπερνά τα 15MB.");
  if (!ALLOWED.includes(file.type)) throw new Error("Μη υποστηριζόμενος τύπος αρχείου.");

  const building = await db.building.findUnique({ where: { id: buildingId }, select: { propertyId: true } });
  if (!building) throw new Error("Δεν βρέθηκε κτήριο.");

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${buildingFolder(building.propertyId, buildingId)}/expenses/${Date.now()}-${safeName}`;
  const up = await uploadFile({ path, buffer, contentType: file.type });
  if (!up.success || !up.url) throw new Error(up.error ?? "Αποτυχία ανεβάσματος.");

  const bf = await db.buildingFile.create({
    data: { buildingId, category: "RECEIPT", name: file.name, cdnPath: path, url: up.url, mimeType: file.type, sizeBytes: buffer.length, uploadedById: uid },
  });

  // Manual mode: store the file but skip OCR — the user fills the fields by hand.
  if (formData.get("manual") === "1") {
    return { fileId: bf.id, fileUrl: up.url, extracted: EMPTY_EXTRACTED() };
  }

  const codes = (await db.expenseCategory.findMany({ where: { active: true }, select: { code: true } })).map((c) => c.code);
  let extracted: ExtractedDoc;
  try {
    const out = await extractDocument({ buffer, mimeType: file.type, categoryCodes: codes });
    extracted = await normalizeExtraction(out.data, out.rawText, codes);
  } catch {
    extracted = EMPTY_EXTRACTED();
  }
  return { fileId: bf.id, fileUrl: up.url, extracted };
}

type LoadedUnit = BasisUnit & { ownerUserId: string | null; tenantUserId: string | null; floor: number | null };

async function loadAllocContext(buildingId: string, categoryId: string | null) {
  const [units, category, override, exclusions] = await Promise.all([
    db.unit.findMany({
      where: { buildingId },
      select: {
        id: true, floor: true, millesimes: true, millesimesElevator: true, millesimesHeating: true,
        ownerId: true, residentId: true,
        occupancies: { where: { endDate: null }, select: { userId: true, role: true } },
      },
    }),
    categoryId ? db.expenseCategory.findUnique({ where: { id: categoryId }, select: { defaultBasis: true } }) : null,
    categoryId ? db.buildingCategoryOverride.findUnique({ where: { buildingId_categoryId: { buildingId, categoryId } }, select: { distributionBasis: true } }) : null,
    categoryId ? db.unitCategoryExclusion.findMany({ where: { categoryId, unit: { buildingId } }, select: { unitId: true } }) : Promise.resolve([]),
  ]);

  const excludedIds = new Set(exclusions.map((e) => e.unitId));
  const loaded: LoadedUnit[] = units.map((u) => {
    const owner = u.occupancies.find((o) => o.role === "OWNER")?.userId ?? u.ownerId ?? null;
    const tenant = u.occupancies.find((o) => o.role === "RESIDENT")?.userId ?? u.residentId ?? null;
    return {
      unitId: u.id, floor: u.floor,
      millesimes: u.millesimes, millesimesElevator: u.millesimesElevator, millesimesHeating: u.millesimesHeating,
      excluded: excludedIds.has(u.id), ownerUserId: owner, tenantUserId: tenant,
    };
  });

  const basis: DistributionBasis = override?.distributionBasis ?? category?.defaultBasis ?? "GENERAL_MILLESIMES";
  return { loaded, basis };
}

const BASIS_LABEL: Record<DistributionBasis, string> = {
  GENERAL_MILLESIMES: "γενικά χιλιοστά",
  ELEVATOR_MILLESIMES: "χιλιοστά ανελκυστήρα",
  HEATING_MILLESIMES: "χιλιοστά θέρμανσης",
  EQUAL_PER_UNIT: "ισόποσα ανά μονάδα",
  METERED_70_30: "70% μέτρηση + 30% χιλιοστά",
};

function buildAllocUnits(loaded: LoadedUnit[], basis: DistributionBasis, meterReadings: Map<string, number> | null) {
  const weights = resolveWeights(basis, loaded, meterReadings);
  const allocUnits = loaded.map((u) => ({
    unitId: u.unitId, weight: weights.get(u.unitId) ?? 0,
    ownerUserId: u.ownerUserId, tenantUserId: u.tenantUserId,
  }));
  const participants = loaded.filter((u) => !u.excluded).length;
  const note = `Μέθοδος: ${BASIS_LABEL[basis]} · Συμμετέχουν ${participants}/${loaded.length} μονάδες`;
  return { allocUnits, note };
}

export async function previewExpenseAllocation(buildingId: string, args: { total: number; tenantPct: number; ownerPct: number; categoryId: string | null }) {
  await requireBuildingAccess(buildingId);
  assertSplit(args.tenantPct, args.ownerPct);
  const { loaded, basis } = await loadAllocContext(buildingId, args.categoryId);
  const { allocUnits } = buildAllocUnits(loaded, basis, null);
  return computeAllocation({ total: args.total, tenantPct: args.tenantPct, ownerPct: args.ownerPct, units: allocUnits });
}

export type CreateExpenseInput = {
  fileId: string | null;
  categoryId: string | null;
  month: string;
  supplierName?: string | null; supplierVat?: string | null;
  documentNumber?: string | null; documentDate?: string | null;
  netAmount?: number | null; vatAmount?: number | null; totalAmount: number;
  description?: string | null;
  tenantPct: number; ownerPct: number;
  ocrRaw?: any; ocrConfidence?: number | null;
  paid?: boolean; paymentMethod?: "CARD" | "CASH" | "VIVA" | "BANK_TRANSFER" | "CHECK" | "OTHER" | null; paidAt?: string | null;
  meter?: { meterType: "POWER" | "WATER" | "GAS"; meterNumber?: string | null; unit?: string | null; periodFrom?: string | null; periodTo?: string | null; previousReading?: number | null; currentReading?: number | null; consumption?: number | null } | null;
};

export type PaymentMethod = "CARD" | "CASH" | "VIVA" | "BANK_TRANSFER" | "CHECK" | "OTHER";

export async function createBuildingExpense(buildingId: string, input: CreateExpenseInput) {
  await requireBuildingAccess(buildingId);
  assertSplit(input.tenantPct, input.ownerPct);
  const { loaded, basis } = await loadAllocContext(buildingId, input.categoryId);
  const { allocUnits, note } = buildAllocUnits(loaded, basis, null);
  const rows = computeAllocation({ total: input.totalAmount, tenantPct: input.tenantPct, ownerPct: input.ownerPct, units: allocUnits });

  const expense = await db.$transaction(async (tx) => {
    const exp = await tx.buildingExpense.create({
      data: {
        buildingId, month: input.month, categoryId: input.categoryId, receiptFileId: input.fileId,
        amount: input.totalAmount, netAmount: input.netAmount ?? null, vatAmount: input.vatAmount ?? null,
        supplierName: input.supplierName ?? null, supplierVat: input.supplierVat ?? null,
        documentNumber: input.documentNumber ?? null,
        documentDate: input.documentDate ? new Date(input.documentDate) : null,
        description: input.description ?? null, status: "CONFIRMED",
        tenantPct: input.tenantPct, ownerPct: input.ownerPct,
        ocrRaw: input.ocrRaw ?? undefined, ocrConfidence: input.ocrConfidence ?? null,
        paid: input.paid ?? false,
        paymentMethod: input.paymentMethod ?? null,
        paidAt: input.paid && input.paidAt ? new Date(input.paidAt) : (input.paid ? new Date() : null),
      },
    });
    if (input.meter && input.meter.meterType) {
      await tx.meterReading.create({
        data: {
          buildingId, expenseId: exp.id, meterType: input.meter.meterType, meterNumber: input.meter.meterNumber ?? null,
          unit: input.meter.unit ?? null,
          periodFrom: input.meter.periodFrom ? new Date(input.meter.periodFrom) : null,
          periodTo: input.meter.periodTo ? new Date(input.meter.periodTo) : null,
          previousReading: input.meter.previousReading ?? null, currentReading: input.meter.currentReading ?? null,
          consumption: input.meter.consumption ?? null,
        },
      });
    }
    if (rows.length) {
      await tx.expenseAllocation.createMany({
        data: rows.map((r) => ({ expenseId: exp.id, unitId: r.unitId, unitShare: r.unitShare, tenantUserId: r.tenantUserId, tenantAmount: r.tenantAmount, ownerUserId: r.ownerUserId, ownerAmount: r.ownerAmount, breakdownNote: note })),
      });
    }
    return exp;
  });

  revalidatePath(`/super-admin/buildings/${buildingId}`);
  // Return only a plain id — Prisma rows carry Decimal fields that cannot be
  // serialized back to the calling client component.
  return { id: expense.id };
}

export type UpdateExpenseInput = {
  categoryId: string | null;
  month: string;
  supplierName?: string | null; supplierVat?: string | null;
  documentNumber?: string | null; documentDate?: string | null;
  netAmount?: number | null; vatAmount?: number | null; totalAmount: number;
  description?: string | null;
  tenantPct: number; ownerPct: number;
  paid?: boolean; paymentMethod?: PaymentMethod | null; paidAt?: string | null;
  meter?: CreateExpenseInput["meter"];
};

/** Edit an expense and regenerate its allocations. Locked (ISSUED) expenses
 *  cannot be edited — they belong to a closed κοινόχρηστα issuance. */
export async function updateBuildingExpense(id: string, input: UpdateExpenseInput) {
  const current = await db.buildingExpense.findUnique({ where: { id }, select: { buildingId: true, status: true } });
  if (!current) throw new Error("Δεν βρέθηκε το έξοδο.");
  await requireBuildingAccess(current.buildingId);
  if (current.status === "ISSUED") throw new Error("Το έξοδο έχει ήδη συμπεριληφθεί σε έκδοση κοινοχρήστων και δεν επεξεργάζεται.");
  assertSplit(input.tenantPct, input.ownerPct);

  const { loaded, basis } = await loadAllocContext(current.buildingId, input.categoryId);
  const { allocUnits, note } = buildAllocUnits(loaded, basis, null);
  const rows = computeAllocation({ total: input.totalAmount, tenantPct: input.tenantPct, ownerPct: input.ownerPct, units: allocUnits });

  await db.$transaction(async (tx) => {
    await tx.buildingExpense.update({
      where: { id },
      data: {
        categoryId: input.categoryId, month: input.month,
        amount: input.totalAmount, netAmount: input.netAmount ?? null, vatAmount: input.vatAmount ?? null,
        supplierName: input.supplierName ?? null, supplierVat: input.supplierVat ?? null,
        documentNumber: input.documentNumber ?? null,
        documentDate: input.documentDate ? new Date(input.documentDate) : null,
        description: input.description ?? null,
        tenantPct: input.tenantPct, ownerPct: input.ownerPct,
        paid: input.paid ?? false,
        paymentMethod: input.paymentMethod ?? null,
        paidAt: input.paid && input.paidAt ? new Date(input.paidAt) : (input.paid ? new Date() : null),
      },
    });
    // Regenerate meter reading (single, OCR-style) and allocations.
    await tx.meterReading.deleteMany({ where: { expenseId: id } });
    if (input.meter && input.meter.meterType) {
      await tx.meterReading.create({
        data: {
          buildingId: current.buildingId, expenseId: id, meterType: input.meter.meterType, meterNumber: input.meter.meterNumber ?? null,
          unit: input.meter.unit ?? null,
          periodFrom: input.meter.periodFrom ? new Date(input.meter.periodFrom) : null,
          periodTo: input.meter.periodTo ? new Date(input.meter.periodTo) : null,
          previousReading: input.meter.previousReading ?? null, currentReading: input.meter.currentReading ?? null,
          consumption: input.meter.consumption ?? null,
        },
      });
    }
    await tx.expenseAllocation.deleteMany({ where: { expenseId: id } });
    if (rows.length) {
      await tx.expenseAllocation.createMany({
        data: rows.map((r) => ({ expenseId: id, unitId: r.unitId, unitShare: r.unitShare, tenantUserId: r.tenantUserId, tenantAmount: r.tenantAmount, ownerUserId: r.ownerUserId, ownerAmount: r.ownerAmount, breakdownNote: note })),
      });
    }
  });

  revalidatePath(`/super-admin/buildings/${current.buildingId}`);
  return { id };
}

/** Lock selected expenses into a κοινόχρηστα issuance for `month` (YYYY-MM).
 *  Already-issued expenses are skipped so a document can't be reused next month. */
export async function includeExpensesInIssuance(buildingId: string, ids: string[], month: string) {
  await requireBuildingAccess(buildingId);
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Μη έγκυρος μήνας έκδοσης (YYYY-MM).");
  if (!ids.length) return { count: 0 };
  const res = await db.buildingExpense.updateMany({
    where: { id: { in: ids }, buildingId, status: { not: "ISSUED" } },
    data: { status: "ISSUED", issuedMonth: month },
  });
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  return { count: res.count };
}

/** Attach a payment-proof file (image/PDF) to an expense and mark it paid. */
export async function uploadExpensePayment(expenseId: string, formData: FormData): Promise<{ url: string }> {
  const exp = await db.buildingExpense.findUnique({ where: { id: expenseId }, select: { buildingId: true, paid: true, paidAt: true } });
  if (!exp) throw new Error("Δεν βρέθηκε το έξοδο.");
  const uid = await requireBuildingAccess(exp.buildingId);
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("Δεν δόθηκε αρχείο.");
  if (file.size > MAX_BYTES) throw new Error("Το αρχείο ξεπερνά τα 15MB.");
  if (!ALLOWED.includes(file.type)) throw new Error("Μη υποστηριζόμενος τύπος αρχείου.");

  const building = await db.building.findUnique({ where: { id: exp.buildingId }, select: { propertyId: true } });
  if (!building) throw new Error("Δεν βρέθηκε κτήριο.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${buildingFolder(building.propertyId, exp.buildingId)}/expenses/payments/${Date.now()}-${safeName}`;
  const up = await uploadFile({ path, buffer, contentType: file.type });
  if (!up.success || !up.url) throw new Error(up.error ?? "Αποτυχία ανεβάσματος.");

  const bf = await db.buildingFile.create({
    data: { buildingId: exp.buildingId, category: "PAYMENT", name: file.name, cdnPath: path, url: up.url, mimeType: file.type, sizeBytes: buffer.length, uploadedById: uid },
  });
  await db.buildingExpense.update({
    where: { id: expenseId },
    data: { paymentFileId: bf.id, paid: true, paidAt: exp.paidAt ?? new Date() },
  });
  revalidatePath(`/super-admin/buildings/${exp.buildingId}`);
  return { url: up.url };
}

export type ExpenseRowDTO = {
  id: string; month: string; status: string; issuedMonth: string | null;
  documentDate: string | null; supplierName: string | null; supplierVat: string | null; documentNumber: string | null;
  categoryId: string | null; categoryName: string | null;
  netAmount: number | null; vatAmount: number | null; amount: number; description: string | null;
  tenantPct: number; ownerPct: number; ocrConfidence: number | null;
  paid: boolean; paymentMethod: string | null; paidAt: string | null;
  receiptUrl: string | null; receiptName: string | null; paymentUrl: string | null; paymentName: string | null;
  allocationsCount: number;
  meter: { meterType: string; meterNumber: string | null; unit: string | null; periodFrom: string | null; periodTo: string | null; previousReading: number | null; currentReading: number | null; consumption: number | null } | null;
};

export async function listBuildingExpenses(buildingId: string): Promise<ExpenseRowDTO[]> {
  await requireBuildingAccess(buildingId);
  const rows = await db.buildingExpense.findMany({
    where: { buildingId },
    orderBy: [{ documentDate: "desc" }, { createdAt: "desc" }],
    include: {
      categoryRef: true, receiptFile: true, paymentFile: true,
      meterReadings: { take: 1, orderBy: { createdAt: "asc" } },
      _count: { select: { allocations: true } },
    },
  });
  const num = (v: unknown) => (v == null ? null : Number(v));
  return rows.map((e) => {
    const m = e.meterReadings[0];
    return {
      id: e.id, month: e.month, status: e.status, issuedMonth: e.issuedMonth,
      documentDate: e.documentDate ? e.documentDate.toISOString() : null,
      supplierName: e.supplierName, supplierVat: e.supplierVat, documentNumber: e.documentNumber,
      categoryId: e.categoryId, categoryName: e.categoryRef?.name ?? null,
      netAmount: num(e.netAmount), vatAmount: num(e.vatAmount), amount: Number(e.amount), description: e.description,
      tenantPct: e.tenantPct, ownerPct: e.ownerPct, ocrConfidence: e.ocrConfidence,
      paid: e.paid, paymentMethod: e.paymentMethod, paidAt: e.paidAt ? e.paidAt.toISOString() : null,
      receiptUrl: e.receiptFile?.url ?? null, receiptName: e.receiptFile?.name ?? null,
      paymentUrl: e.paymentFile?.url ?? null, paymentName: e.paymentFile?.name ?? null,
      allocationsCount: e._count.allocations,
      meter: m ? {
        meterType: m.meterType, meterNumber: m.meterNumber, unit: m.unit,
        periodFrom: m.periodFrom ? m.periodFrom.toISOString() : null, periodTo: m.periodTo ? m.periodTo.toISOString() : null,
        previousReading: num(m.previousReading), currentReading: num(m.currentReading), consumption: num(m.consumption),
      } : null,
    };
  });
}

export async function deleteBuildingExpense(id: string) {
  const exp = await db.buildingExpense.findUnique({ where: { id }, select: { buildingId: true, status: true } });
  if (!exp) return;
  await requireBuildingAccess(exp.buildingId);
  if (exp.status === "ISSUED") throw new Error("Το έξοδο έχει συμπεριληφθεί σε έκδοση κοινοχρήστων και δεν διαγράφεται.");
  await db.buildingExpense.delete({ where: { id } });
  revalidatePath(`/super-admin/buildings/${exp.buildingId}`);
}
