/**
 * Work-action model: (subject: fault / work order / RFQ) × (viewer caps) →
 * the grouped list of actions a staff user may take next. Pure + client-safe:
 * the server actions remain the real guard; this only hides what they would
 * refuse. Icons are react-icons/ri names, resolved on the client.
 */
import { STATUS_LABELS, STATUS_TRANSITIONS, type FaultStatus } from "@/lib/maintenance-shared";
import type { WorkActionViewer } from "./scope";

export type FaultFlags = {
  /** RFQ in OPEN/OFFERED. */
  openRfqId: string | null;
  /** SUBMITTED offers on open RFQs. */
  offersToForward: number;
  /** Newest work order whose status ∉ {DECLINED, CANCELLED}. */
  liveWo: { id: string; status: string } | null;
  hasAppointment: boolean;
};
export const EMPTY_FLAGS: FaultFlags = { openRfqId: null, offersToForward: 0, liveWo: null, hasAppointment: false };

export type WorkSubject =
  | { kind: "fault"; id: string; status: string; handledBy: "COMPANY" | "PROPERTY_ADMIN"; assigneeId: string | null; supplierId: string | null; flags: FaultFlags }
  | { kind: "work-order"; id: string; status: string; faultId: string | null }
  | { kind: "rfq"; id: string; status: string; faultId: string | null; offersToForward: number; hasLiveWorkOrder: boolean };

export type WorkActionSection = "status" | "assign" | "schedule" | "offers" | "communicate" | "navigate";
export const SECTION_ORDER: readonly WorkActionSection[] = ["status", "assign", "schedule", "offers", "communicate", "navigate"];
export const SECTION_LABELS: Record<WorkActionSection, string> = {
  status: "Κατάσταση", assign: "Ανάθεση", schedule: "Προγραμματισμός", offers: "Προσφορές & σύμβαση", communicate: "Επικοινωνία", navigate: "Μετάβαση",
};

export type WorkDialog =
  | "assign-employee" | "assign-supplier" | "appointment" | "status-note" | "create-rfq" | "add-rfq-suppliers"
  | "forward-offer" | "cancel-rfq" | "wo-respond" | "wo-schedule" | "wo-confirm" | "comment" | "rate-supplier";

type Base = { key: string; label: string; icon: string; section: WorkActionSection; primary?: boolean; danger?: boolean };
export type WorkAction =
  | (Base & { kind: "status"; status: FaultStatus })
  | (Base & { kind: "dialog"; dialog: WorkDialog; status?: FaultStatus })
  | (Base & { kind: "link"; href: string });

/** Transitions that ask for a note instead of applying immediately. */
export const NOTE_STATUSES: readonly FaultStatus[] = ["COMPLETED", "ON_HOLD", "CANCELLED"];
const CLOSED = ["COMPLETED", "CANCELLED"];
const RFQ_OPEN = ["OPEN", "OFFERED"];
/** A work order that still occupies the fault: not declined, cancelled or already confirmed/closed. ONE predicate for lists, subjects, guards and panels. */
export const LIVE_WO_EXCLUDED = ["DECLINED", "CANCELLED", "CONFIRMED"] as const;
export const isLiveWorkOrder = (status: string) => !(LIVE_WO_EXCLUDED as readonly string[]).includes(status);

const dialog = (key: string, label: string, icon: string, section: WorkActionSection, d: WorkDialog, extra: Partial<Base> & { status?: FaultStatus } = {}): WorkAction =>
  ({ key, label, icon, section, kind: "dialog", dialog: d, ...extra });
const link = (key: string, label: string, icon: string, href: string): WorkAction => ({ key, label, icon, section: "navigate", kind: "link", href });

export function resolveWorkActions(subject: WorkSubject, viewer: WorkActionViewer, ctx: { where: "list" | "detail" }): WorkAction[] {
  const out =
    subject.kind === "fault" ? faultActions(subject, viewer, ctx.where)
    : subject.kind === "work-order" ? workOrderActions(subject, viewer, ctx.where)
    : rfqActions(subject, viewer);
  // Stable sort by section; table order is kept inside each section.
  return out.map((a, i) => [a, i] as const)
    .sort((x, y) => SECTION_ORDER.indexOf(x[0].section) - SECTION_ORDER.indexOf(y[0].section) || x[1] - y[1])
    .map(([a]) => a);
}

function faultActions(s: Extract<WorkSubject, { kind: "fault" }>, v: WorkActionViewer, where: "list" | "detail"): WorkAction[] {
  const out: WorkAction[] = [];
  const closed = CLOSED.includes(s.status);
  const { flags } = s;

  if (v.canManage && !closed) {
    const transitions = STATUS_TRANSITIONS[s.status as FaultStatus] ?? [];
    const firstNonCancel = transitions.find((t) => t !== "CANCELLED" && t !== "ON_HOLD"); // the "natural next" step, never a pause or a cancel
    for (const t of transitions) {
      const base = { key: `status:${t}`, label: `→ ${STATUS_LABELS[t]}`, section: "status" as const, primary: t === firstNonCancel || undefined };
      if (t === "CANCELLED") out.push({ ...base, icon: "RiCloseCircleLine", kind: "dialog", dialog: "status-note", status: t, danger: true });
      else if (NOTE_STATUSES.includes(t)) out.push({ ...base, icon: "RiArrowRightLine", kind: "dialog", dialog: "status-note", status: t });
      else out.push({ ...base, icon: "RiArrowRightLine", kind: "status", status: t });
    }
  }
  if (v.canAssign && !closed) {
    out.push(dialog("assign-employee", s.assigneeId ? "Αλλαγή υπαλλήλου…" : "Ανάθεση σε υπάλληλο…", "RiUserAddLine", "assign", "assign-employee",
      { primary: !s.assigneeId && s.handledBy === "COMPANY" || undefined }));
    out.push(dialog("assign-supplier", s.supplierId ? "Αλλαγή συνεργάτη…" : "Ανάθεση σε συνεργάτη…", "RiTeamLine", "assign", "assign-supplier"));
  }
  if (v.canManage && !closed) out.push(dialog("appointment", "Ραντεβού…", "RiCalendarCheckLine", "schedule", "appointment"));

  // Stale rows may still carry a confirmed WO; the predicate decides, not the presence of the object.
  const live = flags.liveWo && isLiveWorkOrder(flags.liveWo.status) ? flags.liveWo : null;
  if (v.canRfqCreate && !closed && !flags.openRfqId && !live) out.push(dialog("create-rfq", "Αίτημα προσφοράς σε συνεργάτες…", "RiMoneyEuroCircleLine", "offers", "create-rfq"));
  if (v.canRfqCreate && flags.openRfqId) out.push(dialog("add-rfq-suppliers", "Προσθήκη συνεργατών στο αίτημα…", "RiUserAddLine", "offers", "add-rfq-suppliers"));
  if (v.canForward && flags.offersToForward > 0 && !live) out.push(dialog("forward-offer", "Προώθηση προσφοράς στον πελάτη…", "RiSendPlaneLine", "offers", "forward-offer", { primary: true }));
  if (v.canRfqEdit && flags.openRfqId) out.push(dialog("cancel-rfq", "Ακύρωση αιτήματος προσφοράς", "RiCloseCircleLine", "offers", "cancel-rfq", { danger: true }));
  if (live) {
    if (v.canOnBehalf && live.status === "PENDING_CUSTOMER") out.push(dialog("wo-respond", "Αποδοχή / απόρριψη εκ μέρους πελάτη…", "RiCheckDoubleLine", "offers", "wo-respond"));
    if (v.canAssign && (live.status === "ACCEPTED" || live.status === "SCHEDULED")) {
      out.push(dialog("wo-schedule", live.status === "SCHEDULED" ? "Αλλαγή ραντεβού έργου…" : "Προγραμματισμός έργου…", "RiCalendarEventLine", "schedule", "wo-schedule"));
    }
    if (v.canOnBehalf && live.status === "COMPLETED") out.push(dialog("wo-confirm", "Παραλαβή έργου εκ μέρους πελάτη…", "RiShieldCheckLine", "offers", "wo-confirm"));
  }
  if (v.canManage) out.push(dialog("comment", "Μήνυμα / σημείωση…", "RiChat3Line", "communicate", "comment"));
  if (v.canAssign && s.status === "COMPLETED" && s.supplierId) out.push(dialog("rate-supplier", "Αξιολόγηση συνεργάτη…", "RiStarLine", "communicate", "rate-supplier"));
  if (where === "list") out.push(link("view", "Προβολή βλάβης", "RiEyeLine", `/admin/maintenance/${s.id}`));
  if (live) out.push(link("view-wo", "Σύμβαση έργου", "RiFileTextLine", `/admin/work-orders/${live.id}`));
  return out;
}

function workOrderActions(s: Extract<WorkSubject, { kind: "work-order" }>, v: WorkActionViewer, where: "list" | "detail"): WorkAction[] {
  const out: WorkAction[] = [];
  if (v.canOnBehalf && s.status === "PENDING_CUSTOMER") out.push(dialog("wo-respond", "Αποδοχή / απόρριψη εκ μέρους πελάτη…", "RiCheckDoubleLine", "offers", "wo-respond", { primary: true }));
  if (v.canAssign && (s.status === "ACCEPTED" || s.status === "SCHEDULED")) {
    out.push(dialog("wo-schedule", s.status === "SCHEDULED" ? "Αλλαγή ραντεβού έργου…" : "Προγραμματισμός έργου…", "RiCalendarEventLine", "schedule", "wo-schedule", { primary: true }));
  }
  if (v.canOnBehalf && s.status === "COMPLETED") out.push(dialog("wo-confirm", "Παραλαβή έργου εκ μέρους πελάτη…", "RiShieldCheckLine", "offers", "wo-confirm", { primary: true }));
  if (where === "list") out.push(link("view", "Προβολή σύμβασης", "RiEyeLine", `/admin/work-orders/${s.id}`));
  out.push(link("contract-customer", "Σύμβαση Α (πελάτης)", "RiFileTextLine", `/admin/work-orders/${s.id}/contract/customer`));
  out.push(link("contract-supplier", "Σύμβαση Β (συνεργάτης)", "RiFileTextLine", `/admin/work-orders/${s.id}/contract/supplier`));
  if (s.faultId && v.canViewFault) out.push(link("view-fault", "Άνοιγμα βλάβης", "RiEyeLine", `/admin/maintenance/${s.faultId}`));
  return out;
}

function rfqActions(s: Extract<WorkSubject, { kind: "rfq" }>, v: WorkActionViewer): WorkAction[] {
  const out: WorkAction[] = [];
  const open = RFQ_OPEN.includes(s.status);
  if (v.canRfqCreate && open) out.push(dialog("add-rfq-suppliers", "Προσθήκη συνεργατών…", "RiUserAddLine", "offers", "add-rfq-suppliers"));
  if (v.canForward && open && s.offersToForward > 0 && !s.hasLiveWorkOrder) out.push(dialog("forward-offer", "Προώθηση προσφοράς στον πελάτη…", "RiSendPlaneLine", "offers", "forward-offer", { primary: true }));
  if (v.canRfqEdit && open) out.push(dialog("cancel-rfq", "Ακύρωση αιτήματος", "RiCloseCircleLine", "offers", "cancel-rfq", { danger: true }));
  if (s.faultId && v.canViewFault) out.push(link("view-fault", "Άνοιγμα βλάβης", "RiEyeLine", `/admin/maintenance/${s.faultId}`));
  return out;
}
