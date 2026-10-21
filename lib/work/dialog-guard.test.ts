import { describe, it, expect } from "vitest";
import { dialogAvailable, subjectFromContext } from "./dialog-guard";
import { EMPTY_FLAGS, type WorkSubject } from "./actions";
import { workActionViewer } from "./scope";
import type { WorkActionContext } from "@/app/actions/work-actions";
import type { WorkOrderDTO } from "@/lib/rfq-shared";

const mgr = workActionViewer("MANAGER", "u", new Set(["rfq:create", "rfq:edit", "suppliers:edit", "maintenance:view"]));
const fault = (flags = EMPTY_FLAGS): WorkSubject => ({ kind: "fault", id: "f1", status: "ACKNOWLEDGED", handledBy: "COMPANY", assigneeId: null, supplierId: null, flags });
const ctx = (over: Partial<WorkActionContext> = {}): WorkActionContext => ({
  fault: { id: "f1", title: "", status: "ACKNOWLEDGED", handledBy: "COMPANY", assigneeId: "e1", supplierId: null, buildingId: "b1", categoryId: null, categoryName: null, restrictedAccess: false, estimatedMinutes: null, managerPresence: false, slots: [], appointments: [] },
  employees: [], suppliers: [], preferredSupplierId: null, picker: { candidates: [], categories: [], defaultCategoryId: null }, rfqs: [], workOrders: [], defaults: { markupPct: 15, warrantyMonths: 6, building: { distanceKm: null, distanceMinutes: null, distanceMethod: null, zoneCode: null, zoneLabel: "", travelFee: 0 } }, ...over,
});
const wo = (id: string, status: string) => ({ id, status, number: "WO-1", title: "", description: "", covered: false, customerPrice: 0, vatPct: 24, surveyFee: null, surveyWaived: true, warrantyMonths: null, customerMessage: null, earliestDate: null, validUntil: null, customerAcceptedAt: null, customerDeclinedAt: null, customerDeclineReason: null, scheduledAt: null, createdAt: "", supplierAcceptedAt: null, completedAt: null, completionNote: null, completionMedia: [], customerConfirmedAt: null, disputeNote: null, supplierPrice: null, markupPct: null, supplierName: null, maintenanceRequestId: "f1" } as unknown as WorkOrderDTO);
const rfq = (id: string, status: string, offers: string[]) => ({ id, status, title: "", description: "", deadlineAt: null, surveyRequired: false, notes: null, createdAt: "", invitations: [], offers: offers.map((s, i) => ({ id: `o${i}`, supplierId: "s", supplierName: "", amount: 1, vatPct: 24, surveyFee: null, surveyWaived: true, description: null, estimatedMinutes: null, earliestDate: null, validUntil: null, status: s, createdAt: "", supplierRating: null, supplierRatingCount: 0 })) });

describe("dialogAvailable", () => {
  it("is true when the resolver still offers that dialog for the subject", () => {
    expect(dialogAvailable("forward-offer", fault({ ...EMPTY_FLAGS, openRfqId: "r1", offersToForward: 1 }), mgr)).toBe(true);
    expect(dialogAvailable("assign-employee", fault(), mgr)).toBe(true);
    expect(dialogAvailable("status-note", fault(), mgr)).toBe(true);
  });
  it("is false once the state moved on (a work order now exists) or the viewer lacks the cap", () => {
    expect(dialogAvailable("forward-offer", fault({ ...EMPTY_FLAGS, offersToForward: 1, liveWo: { id: "w1", status: "PENDING_CUSTOMER" } }), mgr)).toBe(false);
    expect(dialogAvailable("assign-employee", fault(), workActionViewer("EMPLOYEE", "u", new Set()))).toBe(false);
  });
});

describe("subjectFromContext", () => {
  it("rebuilds fault flags and ids from the freshly loaded context", () => {
    const fresh = subjectFromContext(fault(), ctx({
      rfqs: [rfq("r1", "OFFERED", ["SUBMITTED", "WITHDRAWN"]), rfq("r0", "CANCELLED", ["SUBMITTED"])],
      workOrders: [wo("w0", "DECLINED"), wo("w1", "ACCEPTED")],
      fault: { ...ctx().fault!, assigneeId: "e1", supplierId: "s1", status: "SCHEDULED", appointments: [{ id: "a", startAt: "", endAt: "", status: "CONFIRMED", managerPresence: false }] },
    }));
    expect(fresh).toEqual({ kind: "fault", id: "f1", status: "SCHEDULED", handledBy: "COMPANY", assigneeId: "e1", supplierId: "s1",
      flags: { openRfqId: "r1", offersToForward: 1, liveWo: { id: "w1", status: "ACCEPTED" }, hasAppointment: true } });
  });
  it("refreshes a work order's status and an RFQ's offers from the context", () => {
    expect(subjectFromContext({ kind: "work-order", id: "w1", status: "ACCEPTED", faultId: "f1" }, ctx({ workOrders: [wo("w1", "SCHEDULED")] })))
      .toEqual({ kind: "work-order", id: "w1", status: "SCHEDULED", faultId: "f1" });
    expect(subjectFromContext({ kind: "rfq", id: "r1", status: "OPEN", faultId: "f1", offersToForward: 0, hasLiveWorkOrder: false }, ctx({ rfqs: [rfq("r1", "OFFERED", ["SUBMITTED"])], workOrders: [wo("w1", "ACCEPTED")] })))
      .toEqual({ kind: "rfq", id: "r1", status: "OFFERED", faultId: "f1", offersToForward: 1, hasLiveWorkOrder: true });
  });
  it("does not treat a CONFIRMED work order as live", () => {
    const fresh = subjectFromContext(fault(), ctx({ rfqs: [rfq("r1", "OFFERED", ["SUBMITTED"])], workOrders: [wo("w0", "CONFIRMED")] }));
    expect(fresh.kind === "fault" && fresh.flags.liveWo).toBeNull();
    expect(dialogAvailable("forward-offer", fresh, mgr)).toBe(true);
  });
  it("leaves the subject untouched when the context does not know it", () => {
    const s: WorkSubject = { kind: "work-order", id: "w9", status: "ACCEPTED", faultId: null };
    expect(subjectFromContext(s, ctx())).toEqual(s);
  });
});
