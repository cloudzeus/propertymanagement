/** Pure converters: list/detail DTOs → the WorkSubject the action resolver reads. */
import { EMPTY_FLAGS, isLiveWorkOrder, type FaultFlags, type WorkSubject } from "./actions";
import type { WorkItem } from "./types";
import type { FaultDetail, FaultListItem } from "@/components/maintenance/types";
import type { RfqDTO, RfqInvitationRowDTO, WorkOrderDTO } from "@/lib/rfq-shared";

const OPEN_RFQ = (status: string) => status === "OPEN" || status === "OFFERED";

export function subjectFromWorkItem(w: WorkItem): WorkSubject | null {
  switch (w.source) {
    case "fault":
      return { kind: "fault", id: w.sourceId, status: w.rawStatus, handledBy: w.handledBy ?? "COMPANY", assigneeId: w.assigneeId, supplierId: w.supplierId ?? null, flags: w.flags ?? EMPTY_FLAGS };
    case "work-order":
      return { kind: "work-order", id: w.sourceId, status: w.rawStatus, faultId: w.faultId ?? null };
    case "rfq":
      return { kind: "rfq", id: w.sourceId, status: w.rawStatus, faultId: w.faultId ?? null, offersToForward: w.rfq?.offersToForward ?? 0, hasLiveWorkOrder: w.rfq?.hasLiveWorkOrder ?? false };
    default:
      return null;
  }
}

export type FaultSubject = Extract<WorkSubject, { kind: "fault" }>;

export function subjectFromFaultListItem(f: FaultListItem): FaultSubject {
  return { kind: "fault", id: f.id, status: f.status, handledBy: f.handledBy === "COMPANY" ? "COMPANY" : "PROPERTY_ADMIN", assigneeId: f.assigneeId ?? null, supplierId: f.supplierId ?? null, flags: f.flags ?? EMPTY_FLAGS };
}

/** Detail page: flags come from the RFQ panel data (open RFQs, their SUBMITTED offers, the newest live work order). */
export function subjectFromFaultDetail(d: FaultDetail, rfq: { rfqs: RfqDTO[]; workOrders: WorkOrderDTO[] } | null): FaultSubject {
  let flags: FaultFlags = { ...EMPTY_FLAGS, hasAppointment: d.appointments.length > 0 };
  if (rfq) {
    const open = rfq.rfqs.filter((r) => OPEN_RFQ(r.status));
    const live = rfq.workOrders.find((w) => isLiveWorkOrder(w.status)) ?? null;
    flags = {
      ...flags,
      openRfqId: open[0]?.id ?? null,
      offersToForward: open.reduce((n, r) => n + r.offers.filter((o) => o.status === "SUBMITTED").length, 0),
      liveWo: live ? { id: live.id, status: live.status } : null,
    };
  }
  return { ...subjectFromFaultListItem(d), flags };
}

export function subjectFromWorkOrderDTO(w: WorkOrderDTO): WorkSubject {
  return { kind: "work-order", id: w.id, status: w.status, faultId: w.maintenanceRequestId ?? null };
}

export function subjectFromRfqInvitationRow(r: RfqInvitationRowDTO): WorkSubject {
  return { kind: "rfq", id: r.rfqId, status: r.rfqStatus, faultId: r.maintenanceRequestId, offersToForward: r.offersToForward, hasLiveWorkOrder: r.hasLiveWorkOrder };
}
