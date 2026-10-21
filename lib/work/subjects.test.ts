import { describe, it, expect } from "vitest";
import { subjectFromWorkItem, subjectFromFaultListItem, subjectFromFaultDetail, subjectFromWorkOrderDTO, subjectFromRfqInvitationRow } from "./subjects";
import { EMPTY_FLAGS } from "./actions";
import type { WorkItem } from "./types";
import type { FaultListItem, FaultDetail } from "@/components/maintenance/types";
import type { WorkOrderDTO, RfqInvitationRowDTO, RfqDTO } from "@/lib/rfq-shared";

const item = (over: Partial<WorkItem> = {}): WorkItem => ({
  id: "fault:f1", source: "fault", sourceId: "f1", title: "Διαρροή", subtitle: null, buildingId: "b1", buildingName: "Κ", customerName: null,
  stage: "new", rawStatus: "OPEN", priority: "NORMAL", dueAt: null, overdue: false, assigneeId: "e1", assigneeName: "Ε", supplierName: null, supplierId: null,
  handledBy: "COMPANY", href: "/admin/maintenance/f1", updatedAt: "2026-10-20T10:00:00.000Z", description: null, ...over,
});

describe("subjectFromWorkItem", () => {
  it("maps a fault item with its flags", () => {
    const flags = { ...EMPTY_FLAGS, openRfqId: "r1" };
    expect(subjectFromWorkItem(item({ flags, supplierId: "s1" }))).toEqual({ kind: "fault", id: "f1", status: "OPEN", handledBy: "COMPANY", assigneeId: "e1", supplierId: "s1", flags });
    expect(subjectFromWorkItem(item())!).toMatchObject({ flags: EMPTY_FLAGS, supplierId: null });
  });
  it("maps work-order and rfq items; programme/appointment give null", () => {
    expect(subjectFromWorkItem(item({ id: "wo:w1", source: "work-order", sourceId: "w1", rawStatus: "ACCEPTED", href: "/admin/work-orders/w1", faultId: "f1" })))
      .toEqual({ kind: "work-order", id: "w1", status: "ACCEPTED", faultId: "f1" });
    expect(subjectFromWorkItem(item({ id: "rfq:r1", source: "rfq", sourceId: "r1", rawStatus: "OFFERED", faultId: "f1", rfq: { offersToForward: 2, hasLiveWorkOrder: false } })))
      .toEqual({ kind: "rfq", id: "r1", status: "OFFERED", faultId: "f1", offersToForward: 2, hasLiveWorkOrder: false });
    expect(subjectFromWorkItem(item({ id: "programme:t1", source: "programme", sourceId: "t1" }))).toBeNull();
    expect(subjectFromWorkItem(item({ id: "appt:a1", source: "appointment", sourceId: "a1" }))).toBeNull();
  });
});

const listItem = (over: Partial<FaultListItem> = {}): FaultListItem => ({
  id: "f1", title: "Διαρροή", status: "ACKNOWLEDGED", priority: "NORMAL", handledBy: "PROPERTY_ADMIN", categoryName: null, buildingName: "Κ", unitLabel: null,
  reporterName: null, assigneeName: null, slaDueAt: null, scheduledDate: null, createdAt: "2026-10-20T10:00:00.000Z", ...over,
});

describe("subjectFromFaultListItem", () => {
  it("defaults missing flags/ids to empty", () => {
    expect(subjectFromFaultListItem(listItem())).toEqual({ kind: "fault", id: "f1", status: "ACKNOWLEDGED", handledBy: "PROPERTY_ADMIN", assigneeId: null, supplierId: null, flags: EMPTY_FLAGS });
    const flags = { ...EMPTY_FLAGS, liveWo: { id: "w1", status: "ACCEPTED" } };
    expect(subjectFromFaultListItem(listItem({ assigneeId: "e1", supplierId: "s1", flags }))).toMatchObject({ assigneeId: "e1", supplierId: "s1", flags });
  });
});

const detail = (over: Partial<FaultDetail> = {}): FaultDetail => ({
  ...listItem(), description: "", buildingId: "b1", categoryId: null, restrictedAccess: false, managerPresence: false, estimatedMinutes: null, completedAt: null,
  attachments: [], comments: [], events: [], slots: [], appointments: [], ...over,
});
const rfqDto = (over: Partial<RfqDTO> = {}): RfqDTO => ({ id: "r1", title: "", description: "", status: "OFFERED", deadlineAt: null, surveyRequired: false, notes: null, createdAt: "", invitations: [], offers: [], ...over });
const offer = (status: string) => ({ id: `o-${status}`, supplierId: "s1", supplierName: "Σ", amount: 100, vatPct: 24, surveyFee: null, surveyWaived: true, description: null, estimatedMinutes: null, earliestDate: null, validUntil: null, status, createdAt: "", supplierRating: null, supplierRatingCount: 0 });
const woDto = (status: string): WorkOrderDTO => ({
  id: `w-${status}`, number: "WO-2026-0001", status, title: "", description: "", covered: false, customerPrice: 0, vatPct: 24, surveyFee: null, surveyWaived: true, warrantyMonths: null,
  customerMessage: null, earliestDate: null, validUntil: null, customerAcceptedAt: null, customerDeclinedAt: null, customerDeclineReason: null, scheduledAt: null, createdAt: "",
  supplierAcceptedAt: null, completedAt: null, completionNote: null, completionMedia: [], customerConfirmedAt: null, disputeNote: null, supplierPrice: null, markupPct: null, supplierName: null, maintenanceRequestId: "f1",
} as unknown as WorkOrderDTO);

describe("subjectFromFaultDetail", () => {
  it("derives flags from the RFQ panel data and the appointments", () => {
    const s = subjectFromFaultDetail(detail({ supplierId: "s1", assigneeId: "e1", appointments: [{ id: "a1", startAt: "", endAt: "", status: "CONFIRMED", managerPresence: false }] }), {
      rfqs: [rfqDto({ offers: [offer("SUBMITTED"), offer("WITHDRAWN")] }), rfqDto({ id: "r0", status: "CANCELLED", offers: [offer("SUBMITTED")] })],
      workOrders: [woDto("DECLINED"), woDto("ACCEPTED")],
    });
    expect(s).toEqual({ kind: "fault", id: "f1", status: "ACKNOWLEDGED", handledBy: "PROPERTY_ADMIN", assigneeId: "e1", supplierId: "s1",
      flags: { openRfqId: "r1", offersToForward: 1, liveWo: { id: "w-ACCEPTED", status: "ACCEPTED" }, hasAppointment: true } });
  });
  it("gives empty flags without panel data", () => {
    expect(subjectFromFaultDetail(detail(), null).flags).toEqual(EMPTY_FLAGS);
  });
});

describe("subjectFromWorkOrderDTO / subjectFromRfqInvitationRow", () => {
  it("map status and fault id", () => {
    expect(subjectFromWorkOrderDTO(woDto("SCHEDULED"))).toEqual({ kind: "work-order", id: "w-SCHEDULED", status: "SCHEDULED", faultId: "f1" });
    const row: RfqInvitationRowDTO = {
      id: "i1", rfqId: "r1", rfqStatus: "OFFERED", rfqTitle: "", deadlineAt: null, surveyRequired: false, maintenanceRequestId: "f1", buildingName: "", buildingId: "b1",
      supplierId: "s1", supplierName: "", status: "OFFERED", sentAt: "", viewedAt: null, declineReason: null, emailCount: 1, lastEmailAt: null, hasRecipient: true, recipients: [],
      offer: null, state: "OFFERED", offersToForward: 2, hasLiveWorkOrder: false,
    };
    expect(subjectFromRfqInvitationRow(row)).toEqual({ kind: "rfq", id: "r1", status: "OFFERED", faultId: "f1", offersToForward: 2, hasLiveWorkOrder: false });
  });
});
