/* Pure shared constants for the maintenance/fault-request domain (safe for client components). */

export const FAULT_STATUSES = ["OPEN", "ACKNOWLEDGED", "SCHEDULED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;
export type FaultStatus = (typeof FAULT_STATUSES)[number];

export const STATUS_LABELS: Record<FaultStatus, string> = {
  OPEN: "Νέα",
  ACKNOWLEDGED: "Σε αξιολόγηση",
  SCHEDULED: "Προγραμματισμένη",
  IN_PROGRESS: "Σε εξέλιξη",
  ON_HOLD: "Σε αναμονή",
  COMPLETED: "Ολοκληρώθηκε",
  CANCELLED: "Ακυρώθηκε",
};

/** Χρώμα badge ανά κατάσταση (tokens του dashboard). */
export const STATUS_COLORS: Record<FaultStatus, string> = {
  OPEN: "var(--color-warning)",
  ACKNOWLEDGED: "var(--color-info)",
  SCHEDULED: "var(--color-purple)",
  IN_PROGRESS: "var(--color-info)",
  ON_HOLD: "var(--muted-foreground)",
  COMPLETED: "var(--color-success)",
  CANCELLED: "var(--color-danger)",
};

/** Επιτρεπτές μεταβάσεις κατάστασης. */
export const STATUS_TRANSITIONS: Record<FaultStatus, FaultStatus[]> = {
  OPEN: ["ACKNOWLEDGED", "SCHEDULED", "IN_PROGRESS", "CANCELLED"],
  ACKNOWLEDGED: ["SCHEDULED", "IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  SCHEDULED: ["IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  IN_PROGRESS: ["ON_HOLD", "COMPLETED", "CANCELLED"],
  ON_HOLD: ["SCHEDULED", "IN_PROGRESS", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const FAULT_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type FaultPriority = (typeof FAULT_PRIORITIES)[number];
export const PRIORITY_LABELS: Record<FaultPriority, string> = {
  LOW: "Χαμηλή", NORMAL: "Κανονική", HIGH: "Υψηλή", URGENT: "Επείγουσα",
};

export const HANDLER_LABELS: Record<string, string> = {
  COMPANY: "Εταιρία διαχείρισης",
  PROPERTY_ADMIN: "Διαχειριστής ακινήτου",
};
