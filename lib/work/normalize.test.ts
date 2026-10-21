import { describe, it, expect } from "vitest";
import { faultToWorkItem, workOrderToWorkItem, rfqToWorkItem, programmeToWorkItem, appointmentToWorkItem, faultFlags } from "./normalize";
import { EMPTY_FLAGS } from "./actions";

const now = new Date("2026-10-20T10:00:00+03:00");
const past = new Date("2026-10-19T09:00:00+03:00");
const future = new Date("2026-10-25T09:00:00+03:00");
const updatedAt = new Date("2026-10-18T12:00:00+03:00");
const building = { name: "Κτήριο Α" };

const fault = (over: Partial<Parameters<typeof faultToWorkItem>[0]> = {}) => ({
  id: "f1", title: "Διαρροή", description: "Τρέχει νερό", status: "OPEN", priority: "URGENT", handledBy: "COMPANY",
  slaDueAt: past, updatedAt, buildingId: "b1", building: { ...building, property: { customer: { name: "Πελάτης Χ" } } },
  categoryRef: { name: "Υδραυλικά" }, assignedTo: null, supplier: null, ...over,
});

describe("faultToWorkItem", () => {
  it("maps an open fault past its SLA to an overdue 'new' item", () => {
    const w = faultToWorkItem(fault(), now)!;
    expect(w.id).toBe("fault:f1");
    expect(w.source).toBe("fault");
    expect(w.stage).toBe("new");
    expect(w.overdue).toBe(true);
    expect(w.dueAt).toBe(past.toISOString());
    expect(w.priority).toBe("URGENT");
    expect(w.href).toBe("/admin/maintenance/f1");
    expect(w.subtitle).toBe("Υδραυλικά");
    expect(w.customerName).toBe("Πελάτης Χ");
    expect(w.handledBy).toBe("COMPANY");
    expect(w.description).toBe("Τρέχει νερό");
  });
  it("drops completed and cancelled faults", () => {
    expect(faultToWorkItem(fault({ status: "COMPLETED" }), now)).toBeNull();
    expect(faultToWorkItem(fault({ status: "CANCELLED" }), now)).toBeNull();
  });
  it("has no due date and is not overdue when slaDueAt is null", () => {
    const w = faultToWorkItem(fault({ slaDueAt: null, status: "IN_PROGRESS" }), now)!;
    expect(w.dueAt).toBeNull();
    expect(w.overdue).toBe(false);
    expect(w.stage).toBe("in-progress");
  });
  it("copies the assignee and falls back to NORMAL for unknown priorities", () => {
    const w = faultToWorkItem(fault({ priority: "weird", assignedTo: { id: "u1", name: "Γιώργος" } }), now)!;
    expect(w.priority).toBe("NORMAL");
    expect(w.assigneeId).toBe("u1");
    expect(w.assigneeName).toBe("Γιώργος");
  });
});

const wo = (over: Partial<Parameters<typeof workOrderToWorkItem>[0]> = {}) => ({
  id: "w1", number: "WO-2026-0042", title: "Αντικατάσταση αντλίας", description: "…", status: "PENDING_CUSTOMER",
  scheduledAt: null, validUntil: future, updatedAt, buildingId: "b1", building, customer: { name: "Πελάτης Χ" }, supplier: { name: "Υδραυλικός ΑΕ" },
  maintenanceRequestId: "f1", ...over,
});

describe("workOrderToWorkItem", () => {
  it("maps PENDING_CUSTOMER to waiting-customer with validUntil as the due date", () => {
    const w = workOrderToWorkItem(wo(), now)!;
    expect(w.id).toBe("wo:w1");
    expect(w.stage).toBe("waiting-customer");
    expect(w.dueAt).toBe(future.toISOString());
    expect(w.overdue).toBe(false);
    expect(w.subtitle).toBe("WO-2026-0042");
    expect(w.supplierName).toBe("Υδραυλικός ΑΕ");
    expect(w.priority).toBeNull();
    expect(w.href).toBe("/admin/work-orders/w1");
  });
  it("prefers scheduledAt over validUntil and maps COMPLETED to awaiting-confirmation", () => {
    const w = workOrderToWorkItem(wo({ status: "COMPLETED", scheduledAt: past }), now)!;
    expect(w.stage).toBe("awaiting-confirmation");
    expect(w.dueAt).toBe(past.toISOString());
  });
  it("links to the work-orders list when there is no fault", () => {
    expect(workOrderToWorkItem(wo({ maintenanceRequestId: null }), now)!.href).toBe("/admin/work-orders/w1");
  });
  it("drops CONFIRMED / DECLINED / CANCELLED", () => {
    for (const status of ["CONFIRMED", "DECLINED", "CANCELLED"]) expect(workOrderToWorkItem(wo({ status }), now)).toBeNull();
  });
});

const rfq = (over: Partial<Parameters<typeof rfqToWorkItem>[0]> = {}) => ({
  id: "r1", title: "Προσφορά για ανελκυστήρα", description: "…", status: "OFFERED", deadlineAt: future, updatedAt,
  buildingId: "b1", building, maintenanceRequestId: "f1", _count: { offers: 2 }, ...over,
});

describe("rfqToWorkItem", () => {
  it("maps OFFERED to triage with the offer count as subtitle", () => {
    const w = rfqToWorkItem(rfq(), now)!;
    expect(w.id).toBe("rfq:r1");
    expect(w.stage).toBe("triage");
    expect(w.subtitle).toBe("2 προσφορές");
    expect(w.dueAt).toBe(future.toISOString());
    expect(w.href).toBe("/admin/maintenance/f1");
  });
  it("maps OPEN to new and FORWARDED to waiting-customer", () => {
    expect(rfqToWorkItem(rfq({ status: "OPEN", _count: { offers: 0 } }), now)!.stage).toBe("new");
    expect(rfqToWorkItem(rfq({ status: "FORWARDED" }), now)!.stage).toBe("waiting-customer");
  });
  it("drops ACCEPTED / DECLINED / CANCELLED / EXPIRED", () => {
    for (const status of ["ACCEPTED", "DECLINED", "CANCELLED", "EXPIRED"]) expect(rfqToWorkItem(rfq({ status }), now)).toBeNull();
  });
});

const task = (over: Partial<Parameters<typeof programmeToWorkItem>[0]> = {}) => ({
  id: "t1", title: "Συντήρηση ανελκυστήρα", notes: null, nextDueDate: past, updatedAt, buildingId: "b1", building,
  supplier: null, vendor: "Kone", managedItem: { itemType: { name: "Ανελκυστήρας" } }, ...over,
});

describe("programmeToWorkItem", () => {
  it("maps a past-due schedule to overdue-programme", () => {
    const w = programmeToWorkItem(task(), now)!;
    expect(w.id).toBe("programme:t1");
    expect(w.stage).toBe("overdue-programme");
    expect(w.overdue).toBe(true);
    expect(w.subtitle).toBe("Ανελκυστήρας");
    expect(w.supplierName).toBe("Kone");
    expect(w.href).toBe("/admin/maintenance-program?building=b1");
  });
  it("maps a future schedule to scheduled and uses the vendor when there is no item", () => {
    const w = programmeToWorkItem(task({ nextDueDate: future, managedItem: null }), now)!;
    expect(w.stage).toBe("scheduled");
    expect(w.dueAt).toBe(future.toISOString());
    expect(w.subtitle).toBe("Kone");
  });
  it("drops schedules without a next due date", () => {
    expect(programmeToWorkItem(task({ nextDueDate: null }), now)).toBeNull();
  });
});

describe("appointmentToWorkItem", () => {
  it("maps a confirmed appointment to scheduled at its start time", () => {
    const w = appointmentToWorkItem({
      id: "a1", startAt: new Date("2026-10-21T09:00:00+03:00"), endAt: new Date("2026-10-21T09:30:00+03:00"), managerPresence: true,
      request: { id: "f1", title: "Διαρροή", buildingId: "b1", building, assignedTo: { id: "u1", name: "Γιώργος" } },
    }, now);
    expect(w.id).toBe("appt:a1");
    expect(w.stage).toBe("scheduled");
    expect(w.dueAt).toBe("2026-10-21T06:00:00.000Z");
    expect(w.subtitle).toBe("09:00–09:30 · παρουσία διαχειριστή");
    expect(w.assigneeId).toBe("u1");
    expect(w.href).toBe("/admin/maintenance/f1");
  });
});

describe("faultFlags", () => {
  it("is empty when the row carries no relations", () => {
    expect(faultFlags(fault())).toEqual(EMPTY_FLAGS);
    expect(faultToWorkItem(fault(), now)!.flags).toEqual(EMPTY_FLAGS);
  });
  it("derives open RFQ, submitted offers, the live work order and appointments", () => {
    const row = fault({
      supplierId: "s1",
      serviceRequests: [{ id: "r1", offers: [{ id: "o1" }, { id: "o2" }] }],
      workOrders: [{ id: "w1", status: "PENDING_CUSTOMER" }],
      _count: { appointments: 0 },
    });
    expect(faultFlags(row)).toEqual({ openRfqId: "r1", offersToForward: 2, liveWo: { id: "w1", status: "PENDING_CUSTOMER" }, hasAppointment: false });
    expect(faultFlags(fault({ _count: { appointments: 2 } })).hasAppointment).toBe(true);
    expect(faultFlags(fault({ workOrders: [{ id: "w0", status: "CONFIRMED" }, { id: "w1", status: "ACCEPTED" }] })).liveWo).toEqual({ id: "w1", status: "ACCEPTED" });
    expect(faultFlags(fault({ workOrders: [{ id: "w0", status: "CONFIRMED" }] })).liveWo).toBeNull();
    expect(faultToWorkItem(row, now)!.supplierId).toBe("s1");
  });
});

describe("rfqToWorkItem flags", () => {
  it("counts submitted offers and a live work order", () => {
    expect(rfqToWorkItem(rfq({ offers: [{ id: "o1" }], workOrders: [{ id: "w1" }] }), now)!.rfq).toEqual({ offersToForward: 1, hasLiveWorkOrder: true });
    expect(rfqToWorkItem(rfq(), now)!.rfq).toEqual({ offersToForward: 0, hasLiveWorkOrder: false });
  });
});
