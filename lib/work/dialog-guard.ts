/**
 * Re-validate a dialog against freshly loaded context before showing it: a row
 * may be stale (another user forwarded the offer, the status moved on…).
 */
import { EMPTY_FLAGS, isLiveWorkOrder, resolveWorkActions, type WorkDialog, type WorkSubject } from "./actions";
import type { WorkActionViewer } from "./scope";
import type { WorkActionContext } from "@/app/actions/work-actions";

const OPEN_RFQ = (status: string) => status === "OPEN" || status === "OFFERED";

export function dialogAvailable(dialog: WorkDialog, subject: WorkSubject, viewer: WorkActionViewer): boolean {
  return resolveWorkActions(subject, viewer, { where: "detail" }).some((a) => a.kind === "dialog" && a.dialog === dialog);
}

/** The subject as the context sees it now. Unknown ids are returned untouched. */
export function subjectFromContext(subject: WorkSubject, ctx: WorkActionContext): WorkSubject {
  const openRfqs = ctx.rfqs.filter((r) => OPEN_RFQ(r.status));
  const liveWo = ctx.workOrders.find((w) => isLiveWorkOrder(w.status)) ?? null;
  const offersToForward = openRfqs.reduce((n, r) => n + r.offers.filter((o) => o.status === "SUBMITTED").length, 0);

  if (subject.kind === "fault") {
    const f = ctx.fault;
    if (!f || f.id !== subject.id) return subject;
    return {
      kind: "fault", id: f.id, status: f.status, handledBy: f.handledBy === "COMPANY" ? "COMPANY" : "PROPERTY_ADMIN", assigneeId: f.assigneeId, supplierId: f.supplierId,
      flags: { ...EMPTY_FLAGS, openRfqId: openRfqs[0]?.id ?? null, offersToForward, liveWo: liveWo ? { id: liveWo.id, status: liveWo.status } : null, hasAppointment: f.appointments.length > 0 },
    };
  }
  if (subject.kind === "work-order") {
    const w = ctx.workOrders.find((x) => x.id === subject.id);
    return w ? { ...subject, status: w.status, faultId: w.maintenanceRequestId ?? subject.faultId } : subject;
  }
  const r = ctx.rfqs.find((x) => x.id === subject.id);
  if (!r) return subject;
  return { ...subject, status: r.status, offersToForward: r.offers.filter((o) => o.status === "SUBMITTED").length, hasLiveWorkOrder: !!liveWo };
}
