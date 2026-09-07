"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getEffectiveSession } from "@/lib/auth-effective";
import { getEffectivePermissions, can } from "@/lib/rbac/permissions";
import { notifyUsers, supplierUserIds, companyStaffIds, buildingDeciderIds } from "@/lib/notify";
import { applyMarkup } from "@/lib/rfq-shared";
import { renderContract } from "@/lib/contracts";
import { publishBuildingEvent } from "@/lib/realtime/bus";
import { STATUS_TRANSITIONS, type FaultStatus } from "@/lib/maintenance-shared";

/* ------------------------------------------------------------------ */
/* Actors                                                              */
/* ------------------------------------------------------------------ */

const STAFF = ["SUPER_ADMIN", "ADMIN", "MANAGER"];
const clean = (v?: string | null) => (v?.trim() ? v.trim() : null);
const dateOrNull = (v?: string | null) => (v ? new Date(v) : null);

async function actor() {
  const [eff, resolved] = await Promise.all([getEffectiveSession(), getEffectivePermissions()]);
  if (!eff?.user?.id || !resolved) throw new Error("Unauthorized");
  const u = await db.user.findUnique({ where: { id: eff.user.id }, select: { supplierId: true, isSupplierAdmin: true } });
  return { id: eff.user.id, role: eff.user.role as string, customerId: eff.user.customerId, supplierId: u?.supplierId ?? null, isSupplierAdmin: u?.isSupplierAdmin ?? false, perms: resolved.perms };
}
const isStaff = (a: { role: string }) => STAFF.includes(a.role);

/** PROPERTY_ADMIN who decides for this building (management assignment or the building's customer). */
async function isDecider(a: { id: string; role: string }, buildingId: string) {
  if (a.role !== "PROPERTY_ADMIN") return false;
  return (await buildingDeciderIds(buildingId)).includes(a.id);
}

function revalidate(reqId?: string | null, buildingId?: string | null) {
  revalidatePath("/admin/maintenance"); revalidatePath("/admin/work-orders");
  revalidatePath("/marketplace"); revalidatePath("/marketplace/rfq"); revalidatePath("/marketplace/work-orders");
  if (reqId) { revalidatePath(`/admin/maintenance/${reqId}`); revalidatePath(`/portal/maintenance/${reqId}`); revalidatePath(`/portal/requests/${reqId}`); }
  if (buildingId) { revalidatePath(`/building/${buildingId}`); publishBuildingEvent(buildingId, "maintenance"); }
}

async function nextWorkOrderNumber(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) {
  const year = new Date().getFullYear();
  const count = await tx.workOrder.count({ where: { number: { startsWith: `WO-${year}-` } } });
  return `WO-${year}-${String(count + 1).padStart(4, "0")}`;
}

/* ------------------------------------------------------------------ */
/* 1. Company sends an RFQ to registry suppliers                        */
/* ------------------------------------------------------------------ */

export type CreateRfqInput = { maintenanceRequestId: string; supplierIds: string[]; deadlineAt?: string | null; surveyRequired?: boolean; notes?: string | null; title?: string; description?: string };

export async function createRfq(input: CreateRfqInput) {
  const a = await actor();
  if (!isStaff(a) || !can(a.perms, "suppliers", "edit")) return { error: "Δεν επιτρέπεται" };
  const req = await db.maintenanceRequest.findUnique({ where: { id: input.maintenanceRequestId }, select: { id: true, title: true, description: true, buildingId: true, categoryId: true, building: { select: { name: true, address: true, city: true } } } });
  if (!req) return { error: "Δεν βρέθηκε η βλάβη" };
  const ids = [...new Set(input.supplierIds.filter(Boolean))];
  if (ids.length === 0) return { error: "Επιλέξτε τουλάχιστον έναν συνεργάτη" };
  const suppliers = await db.supplier.findMany({ where: { id: { in: ids }, customerId: null, isPlatform: false, isActive: true }, select: { id: true } });
  if (suppliers.length !== ids.length) return { error: "Κάποιος συνεργάτης δεν είναι στο μητρώο ή είναι ανενεργός" };

  const rfq = await db.serviceRequest.create({
    data: {
      buildingId: req.buildingId, maintenanceRequestId: req.id, categoryId: req.categoryId,
      title: clean(input.title) ?? req.title, description: clean(input.description) ?? req.description,
      deadlineAt: dateOrNull(input.deadlineAt), surveyRequired: !!input.surveyRequired, notes: clean(input.notes), createdById: a.id,
      invitations: { create: ids.map((supplierId) => ({ supplierId })) },
    },
    select: { id: true },
  });
  await db.maintenanceStatusEvent.create({ data: { requestId: req.id, toStatus: "RFQ_SENT", byUserId: a.id, note: `Αίτημα προσφοράς σε ${ids.length} συνεργάτ${ids.length === 1 ? "η" : "ες"}` } });
  const crew = (await Promise.all(ids.map(supplierUserIds))).flat();
  await notifyUsers(crew, {
    type: "RFQ", title: `Αίτημα προσφοράς: ${req.title}`,
    body: `Η εταιρεία διαχείρισης ζητά προσφορά για εργασία στο κτήριο ${[req.building.name, req.building.city].filter(Boolean).join(", ")}${input.deadlineAt ? ` — απάντηση έως ${new Date(input.deadlineAt).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" })}` : ""}.`,
    href: `/marketplace/rfq/${rfq.id}`, requestId: req.id,
  });
  revalidate(req.id, req.buildingId);
  return { id: rfq.id };
}

export async function cancelRfq(rfqId: string) {
  const a = await actor();
  if (!isStaff(a)) return { error: "Δεν επιτρέπεται" };
  const r = await db.serviceRequest.update({ where: { id: rfqId }, data: { status: "CANCELLED" }, select: { maintenanceRequestId: true, buildingId: true, invitations: { select: { supplierId: true } }, title: true } });
  const crew = (await Promise.all(r.invitations.map((i) => supplierUserIds(i.supplierId)))).flat();
  await notifyUsers(crew, { type: "RFQ", title: `Ακυρώθηκε το αίτημα προσφοράς: ${r.title}`, href: "/marketplace/rfq" });
  revalidate(r.maintenanceRequestId, r.buildingId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* 2. Supplier answers                                                  */
/* ------------------------------------------------------------------ */

async function requireInvitation(rfqId: string, a: Awaited<ReturnType<typeof actor>>) {
  if (a.role !== "COLLABORATOR" || !a.supplierId) throw new Error("Δεν επιτρέπεται");
  const inv = await db.rfqInvitation.findUnique({ where: { rfqId_supplierId: { rfqId, supplierId: a.supplierId } }, include: { rfq: { select: { status: true, maintenanceRequestId: true, buildingId: true, title: true } } } });
  if (!inv) throw new Error("Δεν βρέθηκε το αίτημα");
  return inv;
}

export async function markRfqViewed(rfqId: string) {
  try {
    const a = await actor();
    const inv = await requireInvitation(rfqId, a);
    if (!inv.viewedAt) await db.rfqInvitation.update({ where: { id: inv.id }, data: { viewedAt: new Date() } });
    return { ok: true };
  } catch (e) { return { error: (e as Error).message }; }
}

export type OfferInput = { amount: number; vatPct?: number; surveyFee?: number | null; surveyWaived?: boolean; description?: string | null; estimatedMinutes?: number | null; earliestDate?: string | null; validUntil?: string | null };

export async function submitOffer(rfqId: string, input: OfferInput) {
  try {
    const a = await actor();
    const inv = await requireInvitation(rfqId, a);
    if (!["OPEN", "OFFERED"].includes(inv.rfq.status)) return { error: "Το αίτημα δεν δέχεται πλέον προσφορές" };
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) return { error: "Δώστε έγκυρο ποσό" };
    const vat = Number.isFinite(input.vatPct) ? Number(input.vatPct) : 24;
    const data = {
      amount, vatPct: vat, surveyFee: input.surveyFee == null ? null : Math.max(0, Number(input.surveyFee)), surveyWaived: input.surveyWaived ?? true,
      description: clean(input.description), estimatedMinutes: input.estimatedMinutes ? Math.round(Number(input.estimatedMinutes)) : null,
      earliestDate: dateOrNull(input.earliestDate), validUntil: dateOrNull(input.validUntil), status: "SUBMITTED" as const, submittedById: a.id,
    };
    const existing = await db.supplierOffer.findFirst({ where: { rfqId, supplierId: a.supplierId!, status: { in: ["SUBMITTED", "WITHDRAWN"] } }, select: { id: true } });
    if (existing) await db.supplierOffer.update({ where: { id: existing.id }, data });
    else await db.supplierOffer.create({ data: { ...data, rfqId, supplierId: a.supplierId! } });
    await db.rfqInvitation.update({ where: { id: inv.id }, data: { status: "OFFERED", viewedAt: inv.viewedAt ?? new Date() } });
    await db.serviceRequest.update({ where: { id: rfqId }, data: { status: "OFFERED" } });
    const sup = await db.supplier.findUnique({ where: { id: a.supplierId! }, select: { name: true } });
    await notifyUsers(await companyStaffIds(), { type: "OFFER", title: `Νέα προσφορά από ${sup?.name}: ${inv.rfq.title}`, body: `Ποσό ${amount.toLocaleString("el-GR", { minimumFractionDigits: 2 })} € (καθ.)`, href: inv.rfq.maintenanceRequestId ? `/admin/maintenance/${inv.rfq.maintenanceRequestId}` : "/admin/work-orders", requestId: inv.rfq.maintenanceRequestId });
    revalidate(inv.rfq.maintenanceRequestId, inv.rfq.buildingId);
    return { ok: true };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function declineRfq(rfqId: string, reason?: string | null) {
  try {
    const a = await actor();
    const inv = await requireInvitation(rfqId, a);
    await db.rfqInvitation.update({ where: { id: inv.id }, data: { status: "DECLINED", declineReason: clean(reason), viewedAt: inv.viewedAt ?? new Date() } });
    revalidate(inv.rfq.maintenanceRequestId, inv.rfq.buildingId);
    return { ok: true };
  } catch (e) { return { error: (e as Error).message }; }
}

/* ------------------------------------------------------------------ */
/* 3. Company picks an offer, adds markup, forwards → WorkOrder         */
/* ------------------------------------------------------------------ */

export type ForwardInput = { markupPct?: number | null; customerPrice?: number | null; message?: string | null; covered?: boolean; warrantyMonths?: number | null };

export async function forwardOffer(offerId: string, input: ForwardInput) {
  const a = await actor();
  if (!isStaff(a) || !can(a.perms, "suppliers", "edit")) return { error: "Δεν επιτρέπεται" };
  const offer = await db.supplierOffer.findUnique({ where: { id: offerId }, include: { rfq: { include: { building: { select: { id: true, customerId: true, name: true } }, maintenanceRequest: { select: { id: true, status: true, handledBy: true } } } }, workOrder: { select: { id: true } } } });
  if (!offer) return { error: "Δεν βρέθηκε η προσφορά" };
  if (offer.workOrder) return { error: "Η προσφορά έχει ήδη προωθηθεί" };
  if (offer.status === "WITHDRAWN") return { error: "Η προσφορά έχει αποσυρθεί" };
  const settings = await db.appSettings.findUnique({ where: { id: "singleton" }, select: { offerMarkupPct: true, warrantyMonths: true } });
  const covered = !!input.covered;
  const markup = input.markupPct == null ? Number(settings?.offerMarkupPct ?? 15) : Math.max(0, Number(input.markupPct));
  const supplierPrice = Number(offer.amount);
  const customerPrice = covered ? 0 : input.customerPrice != null && Number.isFinite(Number(input.customerPrice)) ? Math.max(0, Number(input.customerPrice)) : applyMarkup(supplierPrice, markup);
  const req = offer.rfq.maintenanceRequest;

  const wo = await db.$transaction(async (tx) => {
    const number = await nextWorkOrderNumber(tx);
    const created = await tx.workOrder.create({
      data: {
        number, buildingId: offer.rfq.building.id, customerId: offer.rfq.building.customerId, supplierId: offer.supplierId,
        maintenanceRequestId: req?.id ?? null, rfqId: offer.rfqId, offerId: offer.id,
        title: offer.rfq.title, description: offer.description ? `${offer.rfq.description}\n\nΠεριγραφή προσφοράς: ${offer.description}` : offer.rfq.description,
        covered, supplierPrice, customerPrice, vatPct: offer.vatPct, markupPct: covered ? null : markup,
        surveyFee: offer.surveyFee, surveyWaived: offer.surveyWaived, warrantyMonths: input.warrantyMonths ?? settings?.warrantyMonths ?? 6,
        status: covered ? "ACCEPTED" : "PENDING_CUSTOMER", customerMessage: clean(input.message),
        earliestDate: offer.earliestDate, validUntil: offer.validUntil, createdById: a.id,
        ...(covered ? { customerAcceptedAt: new Date(), customerAcceptedById: a.id } : {}),
      },
      select: { id: true, number: true },
    });
    await tx.supplierOffer.update({ where: { id: offer.id }, data: { status: "SELECTED" } });
    await tx.supplierOffer.updateMany({ where: { rfqId: offer.rfqId, id: { not: offer.id }, status: "SUBMITTED" }, data: { status: "REJECTED" } });
    await tx.serviceRequest.update({ where: { id: offer.rfqId }, data: { status: covered ? "ACCEPTED" : "FORWARDED" } });
    if (covered && req) {
      await tx.maintenanceRequest.update({ where: { id: req.id }, data: { supplierId: offer.supplierId, ...(req.status === "OPEN" ? { status: "ACKNOWLEDGED", firstResponseAt: new Date() } : {}) } });
      await tx.maintenanceStatusEvent.create({ data: { requestId: req.id, toStatus: "ASSIGNED", byUserId: a.id, note: `Σύμβαση έργου ${number} (καλύπτεται από σύμβαση διαχείρισης)` } });
    }
    return created;
  });

  if (covered) {
    // no customer decision needed — the supplier gets the job straight away
    await db.workOrder.update({ where: { id: wo.id }, data: { supplierContractHtml: (await renderContract("WO_SUPPLIER", wo.id)).html, customerContractHtml: (await renderContract("WO_CUSTOMER", wo.id)).html } });
    await notifyUsers(await supplierUserIds(offer.supplierId), { type: "WORK_ORDER", title: `Ανάθεση ${wo.number}: ${offer.rfq.title}`, body: "Η προσφορά σας έγινε δεκτή. Αποδεχθείτε την ανάθεση για να ξεκινήσει ο προγραμματισμός.", href: `/marketplace/work-orders/${wo.id}`, requestId: req?.id });
    await notifyUsers(await buildingDeciderIds(offer.rfq.building.id), { type: "WORK_ORDER", title: `Προγραμματίζεται εργασία: ${offer.rfq.title}`, body: "Η εργασία καλύπτεται από τη σύμβαση διαχείρισης. Θα ενημερωθείτε για το ραντεβού.", href: req ? `/portal/maintenance/${req.id}` : "/building", requestId: req?.id });
  } else {
    await notifyUsers(await buildingDeciderIds(offer.rfq.building.id), {
      type: "OFFER", title: `Προσφορά για: ${offer.rfq.title}`,
      body: `Κόστος ${customerPrice.toLocaleString("el-GR", { minimumFractionDigits: 2 })} € + ΦΠΑ. Δείτε τη σύμβαση και αποδεχθείτε ή απορρίψτε από την εφαρμογή.`,
      href: req ? `/portal/maintenance/${req.id}` : "/building", requestId: req?.id,
    });
  }
  revalidate(req?.id, offer.rfq.building.id);
  return { id: wo.id, number: wo.number };
}

/* ------------------------------------------------------------------ */
/* 4. Customer accepts / declines (click + IP/UA trail)                  */
/* ------------------------------------------------------------------ */

export async function respondWorkOrder(woId: string, accept: boolean, reason?: string | null) {
  const a = await actor();
  const wo = await db.workOrder.findUnique({ where: { id: woId }, select: { id: true, number: true, title: true, status: true, buildingId: true, supplierId: true, maintenanceRequestId: true, validUntil: true } });
  if (!wo) return { error: "Δεν βρέθηκε" };
  if (wo.status !== "PENDING_CUSTOMER") return { error: "Η προσφορά δεν εκκρεμεί πλέον" };
  if (!(await isDecider(a, wo.buildingId)) && !isStaff(a)) return { error: "Μόνο ο διαχειριστής του κτηρίου μπορεί να απαντήσει" };
  if (accept && wo.validUntil && wo.validUntil < new Date()) return { error: "Η προσφορά έχει λήξει — ζητήστε νέα από την εταιρεία" };

  if (accept) {
    const h = await headers();
    const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0].trim() || null;
    const ua = h.get("user-agent");
    await db.$transaction(async (tx) => {
      await tx.workOrder.update({ where: { id: woId }, data: { status: "ACCEPTED", customerAcceptedAt: new Date(), customerAcceptedById: a.id, customerAcceptedIp: ip, customerAcceptedUa: ua } });
      if (wo.maintenanceRequestId) {
        const req = await tx.maintenanceRequest.findUnique({ where: { id: wo.maintenanceRequestId }, select: { status: true } });
        await tx.maintenanceRequest.update({ where: { id: wo.maintenanceRequestId }, data: { supplierId: wo.supplierId, ...(req?.status === "OPEN" ? { status: "ACKNOWLEDGED", firstResponseAt: new Date() } : {}) } });
        await tx.maintenanceStatusEvent.create({ data: { requestId: wo.maintenanceRequestId, toStatus: "ASSIGNED", byUserId: a.id, note: `Ο πελάτης αποδέχθηκε την προσφορά — σύμβαση έργου ${wo.number}` } });
      }
    });
    // freeze the customer-side contract as accepted; supplier side freezes on the supplier's acceptance
    await db.workOrder.update({ where: { id: woId }, data: { customerContractHtml: (await renderContract("WO_CUSTOMER", woId)).html } });
    await notifyUsers(await supplierUserIds(wo.supplierId), { type: "WORK_ORDER", title: `Νέα ανάθεση ${wo.number}: ${wo.title}`, body: "Ο πελάτης αποδέχθηκε την προσφορά σας. Αποδεχθείτε την ανάθεση για να ορίσετε ραντεβού.", href: `/marketplace/work-orders/${woId}`, requestId: wo.maintenanceRequestId });
    await notifyUsers(await companyStaffIds(), { type: "WORK_ORDER", title: `Αποδοχή προσφοράς ${wo.number}: ${wo.title}`, href: wo.maintenanceRequestId ? `/admin/maintenance/${wo.maintenanceRequestId}` : "/admin/work-orders", requestId: wo.maintenanceRequestId, excludeUserId: a.id });
  } else {
    await db.workOrder.update({ where: { id: woId }, data: { status: "DECLINED", customerDeclinedAt: new Date(), customerDeclineReason: clean(reason) } });
    await db.serviceRequest.updateMany({ where: { workOrders: { some: { id: woId } } }, data: { status: "DECLINED" } });
    await notifyUsers(await companyStaffIds(), { type: "WORK_ORDER", title: `Ο πελάτης απέρριψε την προσφορά ${wo.number}`, body: clean(reason) ?? undefined, href: wo.maintenanceRequestId ? `/admin/maintenance/${wo.maintenanceRequestId}` : "/admin/work-orders", requestId: wo.maintenanceRequestId, excludeUserId: a.id });
  }
  revalidate(wo.maintenanceRequestId, wo.buildingId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* 5. Supplier accepts the assignment, schedules, executes, proves      */
/* ------------------------------------------------------------------ */

async function requireSupplierWo(woId: string, a: Awaited<ReturnType<typeof actor>>) {
  if (a.role !== "COLLABORATOR" || !a.supplierId) throw new Error("Δεν επιτρέπεται");
  const wo = await db.workOrder.findFirst({ where: { id: woId, supplierId: a.supplierId }, select: { id: true, number: true, title: true, status: true, buildingId: true, maintenanceRequestId: true, supplierAcceptedAt: true } });
  if (!wo) throw new Error("Δεν βρέθηκε η ανάθεση");
  return wo;
}

export async function supplierAcceptWorkOrder(woId: string) {
  try {
    const a = await actor();
    const wo = await requireSupplierWo(woId, a);
    if (!a.isSupplierAdmin) return { error: "Μόνο ο διαχειριστής του συνεργάτη αποδέχεται αναθέσεις" };
    if (wo.supplierAcceptedAt) return { ok: true };
    if (wo.status !== "ACCEPTED") return { error: "Η ανάθεση δεν είναι ακόμη αποδεκτή από τον πελάτη" };
    await db.workOrder.update({ where: { id: woId }, data: { supplierAcceptedAt: new Date(), supplierAcceptedById: a.id, supplierContractHtml: (await renderContract("WO_SUPPLIER", woId)).html } });
    await notifyUsers(await companyStaffIds(), { type: "WORK_ORDER", title: `Ο συνεργάτης αποδέχθηκε την ανάθεση ${wo.number}`, href: wo.maintenanceRequestId ? `/admin/maintenance/${wo.maintenanceRequestId}` : "/admin/work-orders", requestId: wo.maintenanceRequestId });
    revalidate(wo.maintenanceRequestId, wo.buildingId);
    return { ok: true };
  } catch (e) { return { error: (e as Error).message }; }
}

/** Company staff or the supplier set the repair/supply date. */
export async function scheduleWorkOrder(woId: string, isoDate: string) {
  try {
    const a = await actor();
    const wo = isStaff(a) ? await db.workOrder.findUnique({ where: { id: woId }, select: { id: true, number: true, title: true, status: true, buildingId: true, maintenanceRequestId: true, supplierAcceptedAt: true } }) : await requireSupplierWo(woId, a);
    if (!wo) return { error: "Δεν βρέθηκε" };
    if (!["ACCEPTED", "SCHEDULED"].includes(wo.status)) return { error: "Η ανάθεση δεν μπορεί να προγραμματιστεί σε αυτή την κατάσταση" };
    const when = new Date(isoDate);
    if (isNaN(when.getTime())) return { error: "Μη έγκυρη ημερομηνία" };
    await db.$transaction(async (tx) => {
      await tx.workOrder.update({ where: { id: woId }, data: { status: "SCHEDULED", scheduledAt: when } });
      if (wo.maintenanceRequestId) {
        const req = await tx.maintenanceRequest.findUnique({ where: { id: wo.maintenanceRequestId }, select: { status: true } });
        const canSched = STATUS_TRANSITIONS[req?.status as FaultStatus]?.includes("SCHEDULED");
        await tx.maintenanceRequest.update({ where: { id: wo.maintenanceRequestId }, data: { scheduledDate: when, ...(canSched ? { status: "SCHEDULED", statusEvents: { create: { fromStatus: req?.status, toStatus: "SCHEDULED", byUserId: a.id, note: `Ραντεβού ${when.toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" })}` } } } : {}) } });
      }
    });
    const whenTxt = when.toLocaleString("el-GR", { dateStyle: "full", timeStyle: "short" });
    await notifyUsers([...(await buildingDeciderIds(wo.buildingId)), ...(await companyStaffIds())], { type: "WORK_ORDER", title: `Ραντεβού για ${wo.title}: ${whenTxt}`, href: wo.maintenanceRequestId ? `/portal/maintenance/${wo.maintenanceRequestId}` : "/building", requestId: wo.maintenanceRequestId, excludeUserId: a.id });
    revalidate(wo.maintenanceRequestId, wo.buildingId);
    return { ok: true };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function startWorkOrder(woId: string) {
  try {
    const a = await actor();
    const wo = await requireSupplierWo(woId, a);
    if (!["ACCEPTED", "SCHEDULED", "DISPUTED"].includes(wo.status)) return { error: "Δεν μπορεί να ξεκινήσει σε αυτή την κατάσταση" };
    await db.$transaction(async (tx) => {
      await tx.workOrder.update({ where: { id: woId }, data: { status: "IN_PROGRESS" } });
      if (wo.maintenanceRequestId) {
        const req = await tx.maintenanceRequest.findUnique({ where: { id: wo.maintenanceRequestId }, select: { status: true } });
        if (STATUS_TRANSITIONS[req?.status as FaultStatus]?.includes("IN_PROGRESS")) await tx.maintenanceRequest.update({ where: { id: wo.maintenanceRequestId }, data: { status: "IN_PROGRESS", statusEvents: { create: { fromStatus: req?.status, toStatus: "IN_PROGRESS", byUserId: a.id } } } });
      }
    });
    revalidate(wo.maintenanceRequestId, wo.buildingId);
    return { ok: true };
  } catch (e) { return { error: (e as Error).message }; }
}

export type CompletionInput = { note: string; media: { url: string; kind: "IMAGE" | "VIDEO" }[] };

/** Proof of repair: after-photos + report. Required before the customer can confirm. */
export async function completeWorkOrder(woId: string, input: CompletionInput) {
  try {
    const a = await actor();
    const wo = await requireSupplierWo(woId, a);
    if (!["IN_PROGRESS", "SCHEDULED", "ACCEPTED", "DISPUTED"].includes(wo.status)) return { error: "Η ανάθεση δεν είναι σε εξέλιξη" };
    if (!input.note?.trim()) return { error: "Γράψτε σύντομη αναφορά εργασιών" };
    if (!input.media?.length) return { error: "Ανεβάστε τουλάχιστον μία φωτογραφία «μετά»" };
    await db.$transaction(async (tx) => {
      await tx.workOrder.update({ where: { id: woId }, data: { status: "COMPLETED", completedAt: new Date(), completionNote: input.note.trim(), completionMediaIds: input.media, disputeNote: null } });
      if (wo.maintenanceRequestId) {
        const req = await tx.maintenanceRequest.findUnique({ where: { id: wo.maintenanceRequestId }, select: { status: true } });
        if (STATUS_TRANSITIONS[req?.status as FaultStatus]?.includes("COMPLETED")) await tx.maintenanceRequest.update({ where: { id: wo.maintenanceRequestId }, data: { status: "COMPLETED", completedAt: new Date(), statusEvents: { create: { fromStatus: req?.status, toStatus: "COMPLETED", byUserId: a.id, note: "Απόδειξη επισκευής κατατέθηκε" } } } });
        await tx.maintenanceComment.create({ data: { requestId: wo.maintenanceRequestId, authorId: a.id, body: `Απόδειξη επισκευής (${wo.number}): ${input.note.trim()}` } });
        await tx.maintenanceAttachment.createMany({ data: input.media.map((m) => ({ requestId: wo.maintenanceRequestId!, url: m.url, kind: m.kind })) });
      }
    });
    await notifyUsers(await buildingDeciderIds(wo.buildingId), { type: "WORK_ORDER", title: `Ολοκληρώθηκε: ${wo.title} — επιβεβαιώστε την παραλαβή`, body: "Δείτε τις φωτογραφίες και την αναφορά και πατήστε «Η εργασία έγινε σωστά» ή «Αμφισβήτηση».", href: wo.maintenanceRequestId ? `/portal/maintenance/${wo.maintenanceRequestId}` : "/building", requestId: wo.maintenanceRequestId });
    await notifyUsers(await companyStaffIds(), { type: "WORK_ORDER", title: `Απόδειξη επισκευής ${wo.number}: ${wo.title}`, href: wo.maintenanceRequestId ? `/admin/maintenance/${wo.maintenanceRequestId}` : "/admin/work-orders", requestId: wo.maintenanceRequestId });
    revalidate(wo.maintenanceRequestId, wo.buildingId);
    return { ok: true };
  } catch (e) { return { error: (e as Error).message }; }
}

/* ------------------------------------------------------------------ */
/* 6. Customer confirms receipt or disputes                             */
/* ------------------------------------------------------------------ */

export async function confirmWorkOrder(woId: string, confirm: boolean, note?: string | null) {
  const a = await actor();
  const wo = await db.workOrder.findUnique({ where: { id: woId }, select: { id: true, number: true, title: true, status: true, buildingId: true, supplierId: true, maintenanceRequestId: true } });
  if (!wo) return { error: "Δεν βρέθηκε" };
  if (wo.status !== "COMPLETED") return { error: "Η εργασία δεν έχει δηλωθεί ολοκληρωμένη" };
  if (!(await isDecider(a, wo.buildingId)) && !isStaff(a)) return { error: "Μόνο ο διαχειριστής του κτηρίου επιβεβαιώνει την παραλαβή" };
  if (confirm) {
    await db.workOrder.update({ where: { id: woId }, data: { status: "CONFIRMED", customerConfirmedAt: new Date(), customerConfirmedById: a.id } });
    if (wo.maintenanceRequestId) await db.maintenanceStatusEvent.create({ data: { requestId: wo.maintenanceRequestId, toStatus: "CONFIRMED", byUserId: a.id, note: `Επιβεβαίωση παραλαβής ${wo.number}` } });
    await notifyUsers([...(await supplierUserIds(wo.supplierId)), ...(await companyStaffIds())], { type: "WORK_ORDER", title: `Παραλαβή επιβεβαιώθηκε: ${wo.number} ${wo.title}`, body: "Μπορεί να ξεκινήσει η τιμολόγηση.", href: `/marketplace/work-orders/${woId}`, requestId: wo.maintenanceRequestId, excludeUserId: a.id });
  } else {
    if (!note?.trim()) return { error: "Γράψτε τι δεν έγινε σωστά" };
    await db.$transaction(async (tx) => {
      await tx.workOrder.update({ where: { id: woId }, data: { status: "DISPUTED", disputeNote: note.trim() } });
      if (wo.maintenanceRequestId) {
        await tx.maintenanceRequest.update({ where: { id: wo.maintenanceRequestId }, data: { status: "IN_PROGRESS", completedAt: null, statusEvents: { create: { fromStatus: "COMPLETED", toStatus: "IN_PROGRESS", byUserId: a.id, note: `Αμφισβήτηση παραλαβής: ${note.trim()}` } } } });
        await tx.maintenanceComment.create({ data: { requestId: wo.maintenanceRequestId, authorId: a.id, body: `Αμφισβήτηση παραλαβής (${wo.number}): ${note.trim()}` } });
      }
    });
    await notifyUsers([...(await supplierUserIds(wo.supplierId)), ...(await companyStaffIds())], { type: "WORK_ORDER", title: `Αμφισβήτηση παραλαβής ${wo.number}: ${wo.title}`, body: note.trim().slice(0, 300), href: `/marketplace/work-orders/${woId}`, requestId: wo.maintenanceRequestId, excludeUserId: a.id });
  }
  revalidate(wo.maintenanceRequestId, wo.buildingId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* 7. Settings & contract templates (super-admin)                        */
/* ------------------------------------------------------------------ */

export async function saveOfferSettings(input: { offerMarkupPct: number; warrantyMonths: number; silentAcceptDays: number }) {
  const a = await actor();
  if (a.role !== "SUPER_ADMIN") return { error: "Δεν επιτρέπεται" };
  await db.appSettings.upsert({ where: { id: "singleton" }, update: { offerMarkupPct: Math.max(0, Number(input.offerMarkupPct)), warrantyMonths: Math.max(0, Math.round(Number(input.warrantyMonths))), silentAcceptDays: Math.max(0, Math.round(Number(input.silentAcceptDays))), updatedById: a.id }, create: { id: "singleton", offerMarkupPct: Number(input.offerMarkupPct), warrantyMonths: Number(input.warrantyMonths), silentAcceptDays: Number(input.silentAcceptDays), updatedById: a.id } });
  revalidatePath("/super-admin/settings/contracts");
  return { ok: true };
}

export async function saveContractTemplate(key: "WO_CUSTOMER" | "WO_SUPPLIER", input: { title: string; body: string }) {
  const a = await actor();
  if (a.role !== "SUPER_ADMIN") return { error: "Δεν επιτρέπεται" };
  if (!input.title?.trim() || !input.body?.trim()) return { error: "Τίτλος και κείμενο είναι υποχρεωτικά" };
  const existing = await db.contractTemplate.findUnique({ where: { key }, select: { id: true, version: true } });
  if (existing) await db.contractTemplate.update({ where: { key }, data: { title: input.title.trim(), body: input.body, version: existing.version + 1, updatedById: a.id } });
  else await db.contractTemplate.create({ data: { key, title: input.title.trim(), body: input.body, version: 1, updatedById: a.id } });
  revalidatePath("/super-admin/settings/contracts");
  return { ok: true };
}
