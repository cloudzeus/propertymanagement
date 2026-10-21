import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/prisma/client";
import { invitationState, type RfqDTO, type OfferDTO, type WorkOrderDTO, type RfqInvitationRowDTO, type InvitationRecipientDTO, type RfqPanelDefaults } from "@/lib/rfq-shared";
import { getDistanceZones } from "@/lib/distance/buildings";
import { zoneForKm, zoneFee, zoneLabel } from "@/lib/distance/zones";

const place = (...parts: (string | null | undefined)[]) => [...new Set(parts.filter(Boolean) as string[])].join(", ");
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const num = (v: Prisma.Decimal | null | undefined) => (v == null ? null : Number(v));

const linkSelect = { select: { email: true, sentAt: true, openedAt: true, expiresAt: true, revokedAt: true, usedAt: true }, where: { revokedAt: null }, orderBy: { sentAt: "desc" as const } };

/** The company sees who was mailed, when, and whether they opened the link. */
function recipientsOf(links: { email: string; sentAt: Date; openedAt: Date | null; expiresAt: Date }[]): InvitationRecipientDTO[] {
  const seen = new Set<string>();
  return links.filter((l) => (seen.has(l.email) ? false : (seen.add(l.email), true))).map((l) => ({ email: l.email, sentAt: l.sentAt.toISOString(), openedAt: iso(l.openedAt), expired: l.expiresAt.getTime() < Date.now() }));
}

/** Same predicate as recipientsForSupplier (lib/rfq-candidates.ts): is there anyone an invitation e-mail could reach? */
const supplierRecipientSelect = { select: { name: true, email: true, contactEmail: true, _count: { select: { users: { where: { role: "COLLABORATOR" as const, status: "ACTIVE" as const } }, contactPeople: { where: { active: true, receivesRfq: true, email: { not: null } } } } } } };

export const rfqInclude = {
  invitations: { include: { supplier: supplierRecipientSelect, links: linkSelect }, orderBy: { sentAt: "asc" as const } },
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
    invitations: r.invitations.map((i) => {
      const hasRecipient = !!(i.supplier.email || i.supplier.contactEmail || i.supplier._count.users || i.supplier._count.contactPeople);
      return {
        id: i.id, supplierId: i.supplierId, supplierName: i.supplier.name, status: i.status, viewedAt: iso(i.viewedAt), declineReason: i.declineReason,
        emailCount: i.emailCount, lastEmailAt: iso(i.lastEmailAt), hasRecipient, recipients: recipientsOf(i.links),
        state: invitationState({ status: i.status, viewedAt: iso(i.viewedAt), emailCount: i.emailCount, hasRecipient }, { status: r.status, deadlineAt: iso(r.deadlineAt) }),
      };
    }),
    offers: r.offers.map(offerToDTO),
  };
}

/** Company view of a work order (both prices). */
export function workOrderToCompanyDTO(w: Prisma.WorkOrderGetPayload<{ include: { supplier: { select: { name: true } }; building: { select: { name: true } } } }>): WorkOrderDTO {
  return {
    id: w.id, number: w.number, status: w.status, title: w.title, description: w.description, covered: w.covered,
    customerPrice: Number(w.customerPrice), vatPct: w.vatPct, surveyFee: num(w.surveyFee), surveyWaived: w.surveyWaived, warrantyMonths: w.warrantyMonths,
    travelFee: num(w.travelFee), travelZone: w.travelZone ?? null, travelKm: w.travelKm ?? null,
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
export async function loadRfqPanel(maintenanceRequestId: string): Promise<{ rfqs: RfqDTO[]; workOrders: WorkOrderDTO[]; defaults: RfqPanelDefaults }> {
  const [rfqs, workOrders, settings, req, zones] = await Promise.all([
    db.serviceRequest.findMany({ where: { maintenanceRequestId }, include: rfqInclude, orderBy: { createdAt: "desc" } }),
    db.workOrder.findMany({ where: { maintenanceRequestId }, include: woInclude, orderBy: { createdAt: "desc" } }),
    db.appSettings.findUnique({ where: { id: "singleton" }, select: { offerMarkupPct: true, warrantyMonths: true } }),
    db.maintenanceRequest.findUnique({ where: { id: maintenanceRequestId }, select: { building: { select: { distanceKm: true, distanceMinutes: true, distanceMethod: true } } } }),
    getDistanceZones(),
  ]);
  const b = req?.building;
  const zone = zoneForKm(zones, b?.distanceKm);
  return {
    rfqs: rfqs.map(rfqToDTO),
    workOrders: workOrders.map(workOrderToCompanyDTO),
    defaults: {
      markupPct: Number(settings?.offerMarkupPct ?? 15), warrantyMonths: settings?.warrantyMonths ?? 6,
      building: {
        distanceKm: b?.distanceKm ?? null, distanceMinutes: b?.distanceMinutes ?? null,
        distanceMethod: b?.distanceMethod === "ESTIMATE" ? "ESTIMATE" : b?.distanceMethod === "ROAD" ? "ROAD" : null,
        zoneCode: zone?.code ?? null, zoneLabel: zoneLabel(zones, zone?.code), travelFee: zoneFee(zones, zone?.code),
      },
    },
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
    building: place(i.rfq.building.name, i.rfq.building.address, i.rfq.building.city), category: i.rfq.category?.name ?? null,
    myOffer: i.rfq.offers[0] ? { id: i.rfq.offers[0].id, amount: Number(i.rfq.offers[0].amount), status: i.rfq.offers[0].status } : null,
  }));
}

export async function loadSupplierRfq(rfqId: string, supplierId: string) {
  const inv = await db.rfqInvitation.findUnique({ where: { rfqId_supplierId: { rfqId, supplierId } }, include: { rfq: { include: { building: { select: { name: true, address: true, city: true } }, category: { select: { name: true } }, maintenanceRequest: { select: { id: true, priority: true, restrictedAccess: true, attachments: { select: { url: true, kind: true } } } }, offers: { where: { supplierId } } } } } });
  if (!inv) return null;
  const r = inv.rfq; const o = r.offers[0] ?? null;
  return {
    invitation: { id: inv.id, status: inv.status, viewedAt: iso(inv.viewedAt), declineReason: inv.declineReason },
    rfq: { id: r.id, title: r.title, description: r.description, status: r.status, deadlineAt: iso(r.deadlineAt), surveyRequired: r.surveyRequired, building: place(r.building.name, r.building.address, r.building.city), category: r.category?.name ?? null, priority: r.maintenanceRequest?.priority ?? null, restrictedAccess: r.maintenanceRequest?.restrictedAccess ?? false, attachments: r.maintenanceRequest?.attachments ?? [] },
    myOffer: o ? { id: o.id, amount: Number(o.amount), vatPct: o.vatPct, surveyFee: num(o.surveyFee), surveyWaived: o.surveyWaived, description: o.description, estimatedMinutes: o.estimatedMinutes, earliestDate: iso(o.earliestDate), validUntil: iso(o.validUntil), status: o.status } : null,
  };
}

/** Supplier's work orders (their side: supplierPrice, no customer price). */
export async function listSupplierWorkOrders(supplierId: string) {
  const rows = await db.workOrder.findMany({ where: { supplierId, status: { notIn: ["DECLINED", "CANCELLED"] } }, include: { building: { select: { name: true, address: true, city: true } } }, orderBy: { createdAt: "desc" } });
  return rows.map((w) => ({
    id: w.id, number: w.number, status: w.status, title: w.title, description: w.description,
    supplierPrice: Number(w.supplierPrice), vatPct: w.vatPct, surveyFee: num(w.surveyFee), surveyWaived: w.surveyWaived, warrantyMonths: w.warrantyMonths,
    earliestDate: iso(w.earliestDate), scheduledAt: iso(w.scheduledAt), supplierAcceptedAt: iso(w.supplierAcceptedAt), supplierAcceptedName: w.supplierAcceptedName, completedAt: iso(w.completedAt), completionNote: w.completionNote,
    completionMedia: (w.completionMediaIds as { url: string; kind: string }[] | null) ?? [], customerConfirmedAt: iso(w.customerConfirmedAt), disputeNote: w.disputeNote,
    building: place(w.building.name, w.building.address, w.building.city), maintenanceRequestId: w.maintenanceRequestId, createdAt: w.createdAt.toISOString(),
  }));
}
export type SupplierWorkOrderDTO = Awaited<ReturnType<typeof listSupplierWorkOrders>>[number];

/* ------------------------------------------------------------------ */
/* /staff/rfq board                                                     */
/* ------------------------------------------------------------------ */

/** Every supplier invitation, newest first (one row per supplier × RFQ). */
export async function listRfqInvitationRows(): Promise<RfqInvitationRowDTO[]> {
  const rows = await db.rfqInvitation.findMany({
    include: {
      supplier: supplierRecipientSelect,
      links: linkSelect,
      rfq: { select: { id: true, status: true, title: true, deadlineAt: true, surveyRequired: true, maintenanceRequestId: true, buildingId: true, building: { select: { name: true } }, offers: { select: { id: true, supplierId: true, amount: true, status: true } }, workOrders: { where: { status: { notIn: ["DECLINED", "CANCELLED"] } }, select: { id: true } } } },
    },
    orderBy: { sentAt: "desc" },
    take: 1000,
  });
  return rows.map((i) => {
    const hasRecipient = !!(i.supplier.email || i.supplier.contactEmail || i.supplier._count.users || i.supplier._count.contactPeople);
    const offer = i.rfq.offers.find((o) => o.supplierId === i.supplierId && o.status !== "WITHDRAWN") ?? null;
    const rfq = { status: i.rfq.status, deadlineAt: iso(i.rfq.deadlineAt) };
    return {
      id: i.id, rfqId: i.rfq.id, rfqStatus: i.rfq.status, rfqTitle: i.rfq.title, deadlineAt: rfq.deadlineAt, surveyRequired: i.rfq.surveyRequired,
      maintenanceRequestId: i.rfq.maintenanceRequestId, buildingName: i.rfq.building.name, buildingId: i.rfq.buildingId,
      supplierId: i.supplierId, supplierName: i.supplier.name, status: i.status, sentAt: i.sentAt.toISOString(), viewedAt: iso(i.viewedAt), declineReason: i.declineReason,
      emailCount: i.emailCount, lastEmailAt: iso(i.lastEmailAt), hasRecipient, recipients: recipientsOf(i.links),
      offer: offer ? { id: offer.id, amount: Number(offer.amount), status: offer.status } : null,
      state: invitationState({ status: i.status, viewedAt: iso(i.viewedAt), emailCount: i.emailCount, hasRecipient }, rfq),
      offersToForward: i.rfq.offers.filter((o) => o.status === "SUBMITTED").length,
      hasLiveWorkOrder: i.rfq.workOrders.length > 0,
    };
  });
}

/** Faults a company user may still send an RFQ for: open, not yet covered by an active work order. */
export async function listOpenFaultsForRfq(): Promise<{ id: string; title: string; building: string; createdAt: string }[]> {
  const rows = await db.maintenanceRequest.findMany({
    where: { status: { in: ["OPEN", "ACKNOWLEDGED", "ON_HOLD"] }, workOrders: { none: { status: { notIn: ["DECLINED", "CANCELLED"] } } }, serviceRequests: { none: { status: { in: ["OPEN", "OFFERED"] } } } },
    orderBy: { createdAt: "desc" }, take: 300,
    select: { id: true, title: true, createdAt: true, building: { select: { name: true, city: true } } },
  });
  return rows.map((r) => ({ id: r.id, title: r.title, building: place(r.building.name, r.building.city), createdAt: r.createdAt.toISOString() }));
}
