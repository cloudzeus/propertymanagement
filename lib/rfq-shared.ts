/* Pure labels/helpers for the RFQ → offer → work-order flow (client-safe). */

export const RFQ_STATUS_LABELS: Record<string, string> = {
  OPEN: "Αναμένει προσφορές",
  OFFERED: "Ελήφθησαν προσφορές",
  FORWARDED: "Προωθήθηκε στον πελάτη",
  ACCEPTED: "Αποδεκτή από πελάτη",
  DECLINED: "Απορρίφθηκε από πελάτη",
  CANCELLED: "Ακυρώθηκε",
  EXPIRED: "Έληξε",
};

export const INVITATION_STATUS_LABELS: Record<string, string> = {
  INVITED: "Αναμένεται απάντηση",
  OFFERED: "Έστειλε προσφορά",
  DECLINED: "Δεν ενδιαφέρεται",
};

export const OFFER_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Υποβλήθηκε",
  WITHDRAWN: "Αποσύρθηκε",
  SELECTED: "Επιλέχθηκε",
  REJECTED: "Δεν επιλέχθηκε",
};

export const WO_STATUS_LABELS: Record<string, string> = {
  PENDING_CUSTOMER: "Αναμένει αποδοχή πελάτη",
  ACCEPTED: "Αποδεκτή",
  DECLINED: "Απορρίφθηκε",
  SCHEDULED: "Προγραμματισμένη",
  IN_PROGRESS: "Σε εξέλιξη",
  COMPLETED: "Ολοκληρώθηκε",
  CONFIRMED: "Παραλήφθηκε",
  DISPUTED: "Υπό αμφισβήτηση",
  CANCELLED: "Ακυρώθηκε",
};

export const WO_STATUS_COLORS: Record<string, string> = {
  PENDING_CUSTOMER: "#b45309",
  ACCEPTED: "#0369a1",
  DECLINED: "#9f1239",
  SCHEDULED: "#7c3aed",
  IN_PROGRESS: "#1d4ed8",
  COMPLETED: "#15803d",
  CONFIRMED: "#15803d",
  DISPUTED: "#9f1239",
  CANCELLED: "#6b7280",
};

export const eur = (n: number | null | undefined) =>
  n == null ? "—" : `${n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/** Customer price from a supplier price and a markup % (rounded to cents). */
export function applyMarkup(supplierPrice: number, markupPct: number): number {
  return Math.round(supplierPrice * (1 + markupPct / 100) * 100) / 100;
}

export function withVat(net: number, vatPct: number): number {
  return Math.round(net * (1 + vatPct / 100) * 100) / 100;
}

/** Serializable DTOs */
export type OfferDTO = {
  id: string; supplierId: string; supplierName: string; amount: number; vatPct: number;
  surveyFee: number | null; surveyWaived: boolean; description: string | null; estimatedMinutes: number | null;
  earliestDate: string | null; validUntil: string | null; status: string; createdAt: string;
  supplierRating: number | null; supplierRatingCount: number;
};
export type RfqDTO = {
  id: string; title: string; description: string; status: string; deadlineAt: string | null; surveyRequired: boolean; notes: string | null; createdAt: string;
  invitations: { supplierId: string; supplierName: string; status: string; viewedAt: string | null; declineReason: string | null }[];
  offers: OfferDTO[];
};
export type WorkOrderDTO = {
  id: string; number: string; status: string; title: string; description: string; covered: boolean;
  customerPrice: number; vatPct: number; surveyFee: number | null; surveyWaived: boolean; warrantyMonths: number | null;
  customerMessage: string | null; earliestDate: string | null; validUntil: string | null;
  customerAcceptedAt: string | null; customerDeclinedAt: string | null; customerDeclineReason: string | null; scheduledAt: string | null; createdAt: string;
  supplierAcceptedAt: string | null;
  completedAt: string | null; completionNote: string | null; completionMedia: { url: string; kind: string }[];
  customerConfirmedAt: string | null; disputeNote: string | null;
  /** company-only fields (null for customers) */
  supplierPrice: number | null; markupPct: number | null; supplierName: string | null; buildingName?: string; maintenanceRequestId?: string | null;
};
