"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { uploadFile, buildingFolder } from "@/lib/bunnycdn";
import { canManageBuildingExpenses } from "@/lib/expenses/authz";
import { computeAllocation, type AllocUnit } from "@/lib/expenses/allocation";
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

type UnitForAlloc = { id: string; millesimes: number | null; ownerId: string | null; residentId: string | null; occupancies: { userId: string; role: "OWNER" | "RESIDENT" }[] };

async function loadAllocUnits(buildingId: string): Promise<AllocUnit[]> {
  const units = await db.unit.findMany({
    where: { buildingId },
    select: { id: true, millesimes: true, ownerId: true, residentId: true,
      occupancies: { where: { endDate: null }, select: { userId: true, role: true } } },
  }) as unknown as UnitForAlloc[];
  return units.map((u) => {
    const owner = u.occupancies.find((o) => o.role === "OWNER")?.userId ?? u.ownerId ?? null;
    const tenant = u.occupancies.find((o) => o.role === "RESIDENT")?.userId ?? u.residentId ?? null;
    return { unitId: u.id, millesimes: u.millesimes, ownerUserId: owner, tenantUserId: tenant };
  });
}

export async function previewExpenseAllocation(buildingId: string, args: { total: number; tenantPct: number; ownerPct: number }) {
  await requireBuildingAccess(buildingId);
  assertSplit(args.tenantPct, args.ownerPct);
  const units = await loadAllocUnits(buildingId);
  return computeAllocation({ total: args.total, tenantPct: args.tenantPct, ownerPct: args.ownerPct, units });
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
  meter?: { meterType: "POWER" | "WATER" | "GAS"; meterNumber?: string | null; unit?: string | null; periodFrom?: string | null; periodTo?: string | null; previousReading?: number | null; currentReading?: number | null; consumption?: number | null } | null;
};

export async function createBuildingExpense(buildingId: string, input: CreateExpenseInput) {
  await requireBuildingAccess(buildingId);
  assertSplit(input.tenantPct, input.ownerPct);
  const units = await loadAllocUnits(buildingId);
  const rows = computeAllocation({ total: input.totalAmount, tenantPct: input.tenantPct, ownerPct: input.ownerPct, units });

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
        data: rows.map((r) => ({ expenseId: exp.id, unitId: r.unitId, unitShare: r.unitShare, tenantUserId: r.tenantUserId, tenantAmount: r.tenantAmount, ownerUserId: r.ownerUserId, ownerAmount: r.ownerAmount })),
      });
    }
    return exp;
  });

  revalidatePath(`/super-admin/buildings/${buildingId}`);
  // Return only a plain id — Prisma rows carry Decimal fields that cannot be
  // serialized back to the calling client component.
  return { id: expense.id };
}

export async function listBuildingExpenses(buildingId: string) {
  await requireBuildingAccess(buildingId);
  return db.buildingExpense.findMany({
    where: { buildingId },
    orderBy: [{ documentDate: "desc" }, { createdAt: "desc" }],
    include: { categoryRef: true, receiptFile: true, _count: { select: { allocations: true } } },
  });
}

export async function deleteBuildingExpense(id: string) {
  const exp = await db.buildingExpense.findUnique({ where: { id }, select: { buildingId: true } });
  if (!exp) return;
  await requireBuildingAccess(exp.buildingId);
  await db.buildingExpense.delete({ where: { id } });
  revalidatePath(`/super-admin/buildings/${exp.buildingId}`);
}
