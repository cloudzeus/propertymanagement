import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/prisma/client";
import type { RfqDTO, OfferDTO, WorkOrderDTO } from "@/lib/rfq-shared";

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const num = (v: Prisma.Decimal | null | undefined) => (v == null ? null : Number(v));

export const rfqInclude = {
  invitations: { include: { supplier: { select: { name: true } } }, orderBy: { sentAt: "asc" as const } },
  offers: { include: { supplier: { select: { name: true, ratingAvg: true, ratingCount: true } } }, orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.ServiceRequestInclude;

type RfqRow = Prisma.ServiceRequestGetPayload<{ include: typeof rfqInclude }>;

export function offerToDTO(o: RfqRow["offers"][number]): OfferDTO {
  return {
    id: o.id, supplierId: o.supplierId, supplierName: o.supplier.name, amount: Number(o.amount), vatPct: o.vatPct,
    surveyFee: num(o.surveyFee), surveyWaived: o.surveyWaived, description: o.description, estimatedMinutes: o.estimatedMinutes,
    earliestDate: iso(o.earliestDate), validUntil: iso(o.validUntil), status: o.status, createdAt: o.createdAt.toISOString(),
    supplierRating: o.supplier.ratingAvg, supplierRatingCount: o.supplier.ratingCount,
  };
}

export function rfqToDTO(r: RfqRow): RfqDTO {
  return {
    id: r.id, title: r.title, description: r.description, status: r.status, deadlineAt: iso(r.deadlineAt), surveyRequired: r.surveyRequired, notes: r.notes, createdAt: r.createdAt.toISOString(),
    invitations: r.invitations.map((i) => ({ supplierId: i.supplierId, supplierName: i.supplier.name, status: i.status, viewedAt: iso(i.viewedAt), declineReason: i.declineReason })),
    offers: r.offers.map(offerToDTO),
  };
}

/** Company view of a work order (both prices). */
export function workOrderToCompanyDTO(w: Prisma.WorkOrderGetPayload<{ include: { supplier: { select: { name: true } }; building: { select: { name: true } } } }>): WorkOrderDTO {
  return {
    id: w.id, number: w.number, status: w.status, title: w.title, description: w.description, covered: w.covered,
    customerPrice: Number(w.customerPrice), vatPct: w.vatPct, surveyFee: num(w.surveyFee), surveyWaived: w.surveyWaived, warrantyMonths: w.warrantyMonths,
    customerMessage: w.customerMessage, earliestDate: iso(w.earliestDate), validUntil: iso(w.validUntil),
    customerAcceptedAt: iso(w.customerAcceptedAt), customerDeclinedAt: iso(w.customerDeclinedAt), customerDeclineReason: w.customerDeclineReason,
    scheduledAt: iso(w.scheduledAt), createdAt: w.createdAt.toISOString(),
    supplierAcceptedAt: iso(w.supplierAcceptedAt),
    completedAt: iso(w.completedAt), completionNote: w.completionNote, completionMedia: (w.completionMediaIds as { url: string; kind: string }[] | null) ?? [],
    customerConfirmedAt: iso(w.customerConfirmedAt), disputeNote: w.disputeNote,
    supplierPrice: Number(w.supplierPrice), markupPct: num(w.markupPct), supplierName: w.supplier.name, buildingName: w.building.name, maintenanceRequestId: w.maintenanceRequestId,
  };
}

/** Customer view: the company is the only counterpart — no supplier price, no supplier name. */
export function workOrderToCustomerDTO(w: Parameters<typeof workOrderToCompanyDTO>[0]): WorkOrderDTO {
  return { ...workOrderToCompanyDTO(w), supplierPrice: null, markupPct: null, supplierName: null };
}

export const woInclude = { supplier: { select: { name: true } }, building: { select: { name: true } } } satisfies Prisma.WorkOrderInclude;

/** Everything the staff fault page needs for the offers panel. */
export async function loadRfqPanel(maintenanceRequestId: string) {
  const [rfqs, workOrders, settings] = await Promise.all([
    db.serviceRequest.findMany({ where: { maintenanceRequestId }, include: rfqInclude, orderBy: { createdAt: "desc" } }),
    db.workOrder.findMany({ where: { maintenanceRequestId }, include: woInclude, orderBy: { createdAt: "desc" } }),
    db.appSettings.findUnique({ where: { id: "singleton" }, select: { offerMarkupPct: true, warrantyMonths: true } }),
  ]);
  return {
    rfqs: rfqs.map(rfqToDTO),
    workOrders: workOrders.map(workOrderToCompanyDTO),
    defaults: { markupPct: Number(settings?.offerMarkupPct ?? 15), warrantyMonths: settings?.warrantyMonths ?? 6 },
  };
}

/** The customer's pending/active work orders for a fault (customer-safe DTO). */
export async function loadCustomerWorkOrders(maintenanceRequestId: string): Promise<WorkOrderDTO[]> {
  const rows = await db.workOrder.findMany({ where: { maintenanceRequestId, status: { not: "CANCELLED" } }, include: woInclude, orderBy: { createdAt: "desc" } });
  return rows.map(workOrderToCustomerDTO);
}

/** Supplier inbox: invitations for this supplier with the RFQ and its own offer. */
export async function listSupplierRfqs(supplierId: string) {
  const inv = await db.rfqInvitation.findMany({
    where: { supplierId },
    include: { rfq: { include: { building: { select: { name: true, address: true, city: true } }, category: { select: { name: true } }, offers: { where: { supplierId }, select: { id: true, amount: true, status: true } } } } },
    orderBy: { sentAt: "desc" },
  });
  return inv.map((i) => ({
    invitationId: i.id, rfqId: i.rfqId, status: i.status, sentAt: i.sentAt.toISOString(), viewedAt: iso(i.viewedAt),
    title: i.rfq.title, description: i.rfq.description, rfqStatus: i.rfq.status, deadlineAt: iso(i.rfq.deadlineAt), surveyRequired: i.rfq.surveyRequired,
    building: [i.rfq.building.name, i.rfq.building.address, i.rfq.building.city].filter(Boolean).join(", "), category: i.rfq.category?.name ?? null,
    myOffer: i.rfq.offers[0] ? { id: i.rfq.offers[0].id, amount: Number(i.rfq.offers[0].amount), status: i.rfq.offers[0].status } : null,
  }));
}

export async function loadSupplierRfq(rfqId: string, supplierId: string) {
  const inv = await db.rfqInvitation.findUnique({ where: { rfqId_supplierId: { rfqId, supplierId } }, include: { rfq: { include: { building: { select: { name: true, address: true, city: true } }, category: { select: { name: true } }, maintenanceRequest: { select: { id: true, priority: true, restrictedAccess: true, attachments: { select: { url: true, kind: true } } } }, offers: { where: { supplierId } } } } } });
  if (!inv) return null;
  const r = inv.rfq; const o = r.offers[0] ?? null;
  return {
    invitation: { id: inv.id, status: inv.status, viewedAt: iso(inv.viewedAt), declineReason: inv.declineReason },
    rfq: { id: r.id, title: r.title, description: r.description, status: r.status, deadlineAt: iso(r.deadlineAt), surveyRequired: r.surveyRequired, building: [r.building.name, r.building.address, r.building.city].filter(Boolean).join(", "), category: r.category?.name ?? null, priority: r.maintenanceRequest?.priority ?? null, restrictedAccess: r.maintenanceRequest?.restrictedAccess ?? false, attachments: r.maintenanceRequest?.attachments ?? [] },
    myOffer: o ? { id: o.id, amount: Number(o.amount), vatPct: o.vatPct, surveyFee: num(o.surveyFee), surveyWaived: o.surveyWaived, description: o.description, estimatedMinutes: o.estimatedMinutes, earliestDate: iso(o.earliestDate), validUntil: iso(o.validUntil), status: o.status } : null,
  };
}

/** Supplier's work orders (their side: supplierPrice, no customer price). */
export async function listSupplierWorkOrders(supplierId: string) {
  const rows = await db.workOrder.findMany({ where: { supplierId, status: { notIn: ["DECLINED", "CANCELLED"] } }, include: { building: { select: { name: true, address: true, city: true } } }, orderBy: { createdAt: "desc" } });
  return rows.map((w) => ({
    id: w.id, number: w.number, status: w.status, title: w.title, description: w.description,
    supplierPrice: Number(w.supplierPrice), vatPct: w.vatPct, surveyFee: num(w.surveyFee), surveyWaived: w.surveyWaived, warrantyMonths: w.warrantyMonths,
    earliestDate: iso(w.earliestDate), scheduledAt: iso(w.scheduledAt), supplierAcceptedAt: iso(w.supplierAcceptedAt), completedAt: iso(w.completedAt), completionNote: w.completionNote,
    completionMedia: (w.completionMediaIds as { url: string; kind: string }[] | null) ?? [], customerConfirmedAt: iso(w.customerConfirmedAt), disputeNote: w.disputeNote,
    building: [w.building.name, w.building.address, w.building.city].filter(Boolean).join(", "), maintenanceRequestId: w.maintenanceRequestId, createdAt: w.createdAt.toISOString(),
  }));
}
export type SupplierWorkOrderDTO = Awaited<ReturnType<typeof listSupplierWorkOrders>>[number];
