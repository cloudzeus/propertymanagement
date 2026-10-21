import { describe, it, expect } from "vitest";
import { resolveWorkActions, EMPTY_FLAGS, type WorkSubject, type FaultFlags } from "./actions";
import { workActionViewer } from "./scope";

const ALL = new Set(["rfq:create", "rfq:edit", "suppliers:edit", "maintenance:view"]);
const mgr = workActionViewer("MANAGER", "u", ALL);
const emp = workActionViewer("EMPLOYEE", "u", new Set(["rfq:create", "suppliers:view", "maintenance:view"]));
const noForward = workActionViewer("ADMIN", "u", new Set(["rfq:create", "rfq:edit", "maintenance:view"]));

const fault = (over: Partial<Extract<WorkSubject, { kind: "fault" }>> = {}, flags: Partial<FaultFlags> = {}): WorkSubject => ({
  kind: "fault", id: "f1", status: "OPEN", handledBy: "COMPANY", assigneeId: null, supplierId: null, flags: { ...EMPTY_FLAGS, ...flags }, ...over,
});
const keys = (s: WorkSubject, v = mgr, where: "list" | "detail" = "list") => resolveWorkActions(s, v, { where }).map((a) => a.key);
const find = (s: WorkSubject, key: string, v = mgr) => resolveWorkActions(s, v, { where: "list" }).find((a) => a.key === key)!;

describe("resolveWorkActions — fault", () => {
  it("OPEN company fault, manager: full menu in section order", () => {
    expect(keys(fault())).toEqual([
      "status:ACKNOWLEDGED", "status:SCHEDULED", "status:IN_PROGRESS", "status:CANCELLED",
      "assign-employee", "assign-supplier", "appointment", "create-rfq", "comment", "view",
    ]);
  });
  it("marks the first non-cancel transition and the unassigned company fault as primary; CANCELLED is a danger note dialog", () => {
    expect(find(fault(), "status:ACKNOWLEDGED")).toMatchObject({ kind: "status", status: "ACKNOWLEDGED", primary: true, section: "status" });
    expect(find(fault(), "status:SCHEDULED").primary).toBeFalsy();
    expect(find(fault(), "assign-employee")).toMatchObject({ kind: "dialog", dialog: "assign-employee", primary: true, label: "Ανάθεση σε υπάλληλο…" });
    expect(find(fault(), "status:CANCELLED")).toMatchObject({ kind: "dialog", dialog: "status-note", status: "CANCELLED", danger: true });
    expect(find(fault({ assigneeId: "e1" }), "assign-employee")).toMatchObject({ primary: undefined, label: "Αλλαγή υπαλλήλου…" });
    expect(find(fault({ handledBy: "PROPERTY_ADMIN" }), "assign-employee").primary).toBeFalsy();
  });
  it("ON_HOLD / COMPLETED transitions are status-note dialogs carrying the status", () => {
    const s = fault({ status: "IN_PROGRESS" });
    expect(find(s, "status:ON_HOLD")).toMatchObject({ kind: "dialog", dialog: "status-note", status: "ON_HOLD" });
    expect(find(s, "status:COMPLETED")).toMatchObject({ kind: "dialog", dialog: "status-note", status: "COMPLETED", primary: true });
  });
  it("EMPLOYEE gets status, appointment, comment, create-rfq but no assign/forward/on-behalf", () => {
    expect(keys(fault({}, { offersToForward: 2, openRfqId: "r1" }), emp)).toEqual([
      "status:ACKNOWLEDGED", "status:SCHEDULED", "status:IN_PROGRESS", "status:CANCELLED", "appointment", "add-rfq-suppliers", "comment", "view",
    ]);
  });
  it("open RFQ replaces create-rfq with add-rfq-suppliers; submitted offers without a live WO add forward-offer (primary)", () => {
    const s = fault({}, { openRfqId: "r1", offersToForward: 1 });
    const k = keys(s);
    expect(k).not.toContain("create-rfq");
    expect(k).toContain("add-rfq-suppliers");
    expect(find(s, "forward-offer")).toMatchObject({ kind: "dialog", dialog: "forward-offer", primary: true, section: "offers" });
  });
  it("live WO PENDING_CUSTOMER → wo-respond + view-wo and no forward/create; ACCEPTED → wo-schedule; COMPLETED → wo-confirm", () => {
    const pending = fault({ status: "ACKNOWLEDGED" }, { offersToForward: 1, liveWo: { id: "w1", status: "PENDING_CUSTOMER" } });
    const k1 = keys(pending);
    expect(k1).toContain("wo-respond");
    expect(k1).toContain("view-wo");
    expect(k1).not.toContain("forward-offer");
    expect(k1).not.toContain("create-rfq");
    expect(find(pending, "view-wo")).toMatchObject({ kind: "link", href: "/admin/work-orders/w1" });
    expect(keys(fault({ status: "ACKNOWLEDGED" }, { liveWo: { id: "w1", status: "ACCEPTED" } }))).toContain("wo-schedule");
    expect(find(fault({ status: "SCHEDULED" }, { liveWo: { id: "w1", status: "SCHEDULED" } }), "wo-schedule").label).toBe("Αλλαγή ραντεβού έργου…");
    expect(keys(fault({ status: "IN_PROGRESS" }, { liveWo: { id: "w1", status: "COMPLETED" } }))).toContain("wo-confirm");
  });
  it("create-rfq is allowed after a CONFIRMED work order but not after PENDING/ACCEPTED/COMPLETED", () => {
    expect(keys(fault({}, { liveWo: { id: "w1", status: "CONFIRMED" } }))).toContain("create-rfq");
    for (const status of ["PENDING_CUSTOMER", "ACCEPTED", "SCHEDULED", "IN_PROGRESS", "COMPLETED"]) {
      expect(keys(fault({}, { liveWo: { id: "w1", status } }))).not.toContain("create-rfq");
    }
  });
  it("closed fault: no status/assign/appointment/create-rfq; COMPLETED with supplier → rate-supplier for canAssign only", () => {
    const done = fault({ status: "COMPLETED", supplierId: "s1" });
    expect(keys(done)).toEqual(["comment", "rate-supplier", "view"]);
    expect(keys(done, emp)).toEqual(["comment", "view"]);
    expect(keys(fault({ status: "CANCELLED" }))).toEqual(["comment", "view"]);
    expect(keys(fault({ status: "COMPLETED", supplierId: null }))).toEqual(["comment", "view"]);
  });
  it("where=detail drops the view link", () => {
    expect(keys(fault(), mgr, "detail")).not.toContain("view");
    expect(find(fault(), "view")).toMatchObject({ kind: "link", href: "/admin/maintenance/f1", section: "navigate" });
  });
  it("viewer without canForward never sees forward-offer even with offers", () => {
    expect(keys(fault({}, { openRfqId: "r1", offersToForward: 3 }), noForward)).not.toContain("forward-offer");
  });
  it("labels switch to «Αλλαγή συνεργάτη…» when a supplier is set", () => {
    expect(find(fault({ supplierId: "s1" }), "assign-supplier").label).toBe("Αλλαγή συνεργάτη…");
    expect(find(fault(), "assign-supplier").label).toBe("Ανάθεση σε συνεργάτη…");
  });
});

describe("resolveWorkActions — work order", () => {
  const wo = (status: string, faultId: string | null = "f1"): WorkSubject => ({ kind: "work-order", id: "w1", status, faultId });
  it("offers respond/schedule/confirm by status, contracts and fault links", () => {
    expect(keys(wo("PENDING_CUSTOMER"))).toEqual(["wo-respond", "view", "contract-customer", "contract-supplier", "view-fault"]);
    expect(find(wo("PENDING_CUSTOMER"), "wo-respond").primary).toBe(true);
    expect(keys(wo("ACCEPTED"))).toEqual(["wo-schedule", "view", "contract-customer", "contract-supplier", "view-fault"]);
    expect(find(wo("SCHEDULED"), "wo-schedule").label).toBe("Αλλαγή ραντεβού έργου…");
    expect(keys(wo("COMPLETED"))).toEqual(["wo-confirm", "view", "contract-customer", "contract-supplier", "view-fault"]);
    expect(keys(wo("CONFIRMED", null))).toEqual(["view", "contract-customer", "contract-supplier"]);
    expect(find(wo("ACCEPTED"), "view")).toMatchObject({ kind: "link", href: "/admin/work-orders/w1" });
    expect(find(wo("ACCEPTED"), "contract-supplier")).toMatchObject({ kind: "link", href: "/admin/work-orders/w1/contract/supplier" });
    expect(find(wo("ACCEPTED"), "view-fault")).toMatchObject({ kind: "link", href: "/admin/maintenance/f1" });
  });
  it("EMPLOYEE cannot respond/schedule/confirm; detail view drops the view link", () => {
    expect(keys(wo("PENDING_CUSTOMER"), emp)).toEqual(["view", "contract-customer", "contract-supplier", "view-fault"]);
    expect(keys(wo("ACCEPTED"), mgr, "detail")).toEqual(["wo-schedule", "contract-customer", "contract-supplier", "view-fault"]);
  });
});

describe("resolveWorkActions — rfq", () => {
  const rfq = (over: Partial<Extract<WorkSubject, { kind: "rfq" }>> = {}): WorkSubject => ({ kind: "rfq", id: "r1", status: "OPEN", faultId: "f1", offersToForward: 0, hasLiveWorkOrder: false, ...over });
  it("add/forward/cancel by status and perms; view-fault needs canViewFault", () => {
    expect(keys(rfq())).toEqual(["add-rfq-suppliers", "cancel-rfq", "view-fault"]);
    expect(keys(rfq({ status: "OFFERED", offersToForward: 2 }))).toEqual(["add-rfq-suppliers", "forward-offer", "cancel-rfq", "view-fault"]);
    expect(find(rfq({ status: "OFFERED", offersToForward: 2 }), "forward-offer").primary).toBe(true);
    expect(keys(rfq({ status: "OFFERED", offersToForward: 2, hasLiveWorkOrder: true }))).not.toContain("forward-offer");
    expect(find(rfq(), "cancel-rfq")).toMatchObject({ kind: "dialog", dialog: "cancel-rfq", danger: true });
    expect(keys(rfq({ status: "FORWARDED" }))).toEqual(["view-fault"]);
    expect(keys(rfq({ status: "CANCELLED", faultId: null }))).toEqual([]);
    expect(keys(rfq(), emp)).toEqual(["add-rfq-suppliers", "view-fault"]);
    const noFault = workActionViewer("EMPLOYEE", "u", new Set(["rfq:create"]));
    expect(keys(rfq(), noFault)).toEqual(["add-rfq-suppliers"]);
  });
});
