/**
 * Unified "work item" view-model for the company work center (/admin/work).
 * Client-safe: labels, colours and types only — no server imports.
 */
import type { FaultFlags } from "./actions";
export type WorkSource = "fault" | "work-order" | "rfq" | "programme" | "appointment";
export type WorkStage =
  | "new" | "triage" | "scheduled" | "in-progress"
  | "waiting-customer" | "awaiting-confirmation" | "on-hold" | "overdue-programme";
export type WorkPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type WorkItem = {
  /** Synthetic unique id: `fault:<id>` | `wo:<id>` | `rfq:<id>` | `programme:<taskId>` | `appt:<id>`. */
  id: string;
  source: WorkSource;
  sourceId: string;
  title: string;
  subtitle: string | null;
  buildingId: string;
  buildingName: string;
  customerName: string | null;
  stage: WorkStage;
  rawStatus: string;
  priority: WorkPriority | null;
  /** ISO — fault: slaDueAt · WO: scheduledAt ?? validUntil · RFQ: deadlineAt · programme: nextDueDate · appointment: startAt */
  dueAt: string | null;
  overdue: boolean;
  assigneeId: string | null;
  assigneeName: string | null;
  supplierName: string | null;
  handledBy: "COMPANY" | "PROPERTY_ADMIN" | null;
  href: string;
  updatedAt: string;
  description: string | null;
  /** fault rows: assigned registry supplier */
  supplierId?: string | null;
  /** work-order / rfq rows: the fault they belong to */
  faultId?: string | null;
  /** fault rows: what the action menu needs (open RFQ, offers, live work order, appointments) */
  flags?: FaultFlags;
  /** rfq rows */
  rfq?: { offersToForward: number; hasLiveWorkOrder: boolean };
};

export const WORK_SOURCES: readonly WorkSource[] = ["fault", "work-order", "rfq", "programme", "appointment"];
export const WORK_STAGES: readonly WorkStage[] = ["new", "triage", "scheduled", "in-progress", "waiting-customer", "awaiting-confirmation", "on-hold", "overdue-programme"];
export const WORK_PRIORITIES: readonly WorkPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

export const SOURCE_LABELS: Record<WorkSource, string> = {
  fault: "Βλάβη",
  "work-order": "Σύμβαση έργου",
  rfq: "Αίτημα προσφοράς",
  programme: "Πρόγραμμα",
  appointment: "Ραντεβού",
};

export const SOURCE_COLORS: Record<WorkSource, string> = {
  fault: "#CA5D00",
  "work-order": "#0F6CBD",
  rfq: "#107C10",
  programme: "#8764B8",
  appointment: "#038387",
};

export const STAGE_LABELS: Record<WorkStage, string> = {
  new: "Νέο",
  triage: "Σε αξιολόγηση",
  scheduled: "Προγραμματισμένο",
  "in-progress": "Σε εξέλιξη",
  "waiting-customer": "Αναμένει πελάτη",
  "awaiting-confirmation": "Αναμένει παραλαβή",
  "on-hold": "Σε αναμονή",
  "overdue-programme": "Εκπρόθεσμη συντήρηση",
};

export const STAGE_COLORS: Record<WorkStage, string> = {
  new: "#b45309",
  triage: "#0369a1",
  scheduled: "#7c3aed",
  "in-progress": "#1d4ed8",
  "waiting-customer": "#0f766e",
  "awaiting-confirmation": "#a16207",
  "on-hold": "#6b7280",
  "overdue-programme": "#9f1239",
};
