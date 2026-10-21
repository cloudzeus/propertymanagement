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

/** Add N business days (Mon–Fri) to a date — used for the silent-acceptance deadline. */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = Math.max(0, Math.floor(days));
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

/** Whole business days remaining until `deadline` (negative when passed). */
export function businessDaysUntil(deadline: Date, now: Date = new Date()): number {
  const a = new Date(now); a.setHours(0, 0, 0, 0);
  const b = new Date(deadline); b.setHours(0, 0, 0, 0);
  const sign = b >= a ? 1 : -1;
  let n = 0;
  const cur = new Date(a);
  while (sign > 0 ? cur < b : cur > b) {
    cur.setDate(cur.getDate() + sign);
    const wd = cur.getDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return sign * n;
}

export function withVat(net: number, vatPct: number): number {
  return Math.round(net * (1 + vatPct / 100) * 100) / 100;
}

/** Serializable DTOs */
export type RfqPanelDefaults = {
  markupPct: number; warrantyMonths: number;
  /** Το κτίριο της βλάβης ως προς τον σταθμό βάσης (για την προσυμπλήρωση της μετάβασης). */
  building: { distanceKm: number | null; distanceMinutes: number | null; distanceMethod: "ROAD" | "ESTIMATE" | null; zoneCode: string | null; zoneLabel: string; travelFee: number };
};
export type OfferDTO = {
  id: string; supplierId: string; supplierName: string; amount: number; vatPct: number;
  surveyFee: number | null; surveyWaived: boolean; description: string | null; estimatedMinutes: number | null;
  earliestDate: string | null; validUntil: string | null; status: string; createdAt: string;
  supplierRating: number | null; supplierRatingCount: number;
  /** km από την έδρα του συνεργάτη ως το κτίριο (από το cache· null όταν δεν έχει μετρηθεί) */
  supplierDistance?: { km: number; method: "ROAD" | "ESTIMATE" } | null;
};
export type RfqDTO = {
  id: string; title: string; description: string; status: string; deadlineAt: string | null; surveyRequired: boolean; notes: string | null; createdAt: string;
  invitations: {
    id: string; supplierId: string; supplierName: string; status: string; viewedAt: string | null; declineReason: string | null;
    emailCount: number; lastEmailAt: string | null; hasRecipient: boolean; recipients: InvitationRecipientDTO[]; state: InvitationState;
  }[];
  offers: OfferDTO[];
};
export type WorkOrderDTO = {
  id: string; number: string; status: string; title: string; description: string; covered: boolean;
  customerPrice: number; vatPct: number; surveyFee: number | null; surveyWaived: boolean; warrantyMonths: number | null;
  /** Χρέωση μετάβασης (μέρος του customerPrice) και η ζώνη/km του κτιρίου τη στιγμή της προώθησης. */
  travelFee: number | null; travelZone: string | null; travelKm: number | null;
  customerMessage: string | null; earliestDate: string | null; validUntil: string | null;
  customerAcceptedAt: string | null; customerDeclinedAt: string | null; customerDeclineReason: string | null; scheduledAt: string | null; createdAt: string;
  supplierAcceptedAt: string | null;
  completedAt: string | null; completionNote: string | null; completionMedia: { url: string; kind: string }[];
  customerConfirmedAt: string | null; disputeNote: string | null;
  /** company-only fields (null for customers) */
  supplierPrice: number | null; markupPct: number | null; supplierName: string | null; buildingName?: string; maintenanceRequestId?: string | null;
};

/* ------------------------------------------------------------------ */
/* Invitation tracking (e-mail + personal link)                         */
/* ------------------------------------------------------------------ */

export type InvitationState = "NO_EMAIL" | "NOT_SENT" | "SENT" | "OPENED" | "OFFERED" | "DECLINED" | "EXPIRED";

export const INVITATION_STATE_LABELS: Record<InvitationState, string> = {
  NO_EMAIL: "Χωρίς email",
  NOT_SENT: "Δεν στάλθηκε",
  SENT: "Στάλθηκε",
  OPENED: "Ανοίχτηκε",
  OFFERED: "Προσφορά υποβλήθηκε",
  DECLINED: "Απορρίφθηκε",
  EXPIRED: "Έληξε",
};

export const INVITATION_STATE_COLORS: Record<InvitationState, string> = {
  NO_EMAIL: "#9f1239",
  NOT_SENT: "#b45309",
  SENT: "#6b7280",
  OPENED: "#0369a1",
  OFFERED: "#15803d",
  DECLINED: "#b45309",
  EXPIRED: "#6b7280",
};

/** Derived, display-level state of one supplier invitation (spec §5.4). */
export function invitationState(
  i: { status: string; viewedAt: string | null; emailCount: number; hasRecipient: boolean },
  rfq: { status: string; deadlineAt: string | null },
  now: Date = new Date(),
): InvitationState {
  if (i.status === "OFFERED") return "OFFERED";
  if (i.status === "DECLINED") return "DECLINED";
  if (i.status === "EXPIRED") return "EXPIRED";
  if (["EXPIRED", "CANCELLED"].includes(rfq.status)) return "EXPIRED";
  if (rfq.deadlineAt && new Date(rfq.deadlineAt).getTime() < now.getTime()) return "EXPIRED";
  if (i.viewedAt) return "OPENED";
  if (i.emailCount === 0) return i.hasRecipient ? "NOT_SENT" : "NO_EMAIL";
  return "SENT";
}

/** One recipient of an invitation e-mail, as the company sees it. */
export type InvitationRecipientDTO = { email: string; sentAt: string; openedAt: string | null; expired: boolean };

/** A row of the /staff/rfq board: one supplier invitation of one RFQ. */
export type RfqInvitationRowDTO = {
  id: string; rfqId: string; rfqStatus: string; rfqTitle: string; deadlineAt: string | null; surveyRequired: boolean;
  maintenanceRequestId: string | null; buildingName: string; buildingId: string;
  supplierId: string; supplierName: string; status: string; sentAt: string; viewedAt: string | null; declineReason: string | null;
  emailCount: number; lastEmailAt: string | null; hasRecipient: boolean; recipients: InvitationRecipientDTO[];
  offer: { id: string; amount: number; status: string } | null;
  state: InvitationState;
  /** SUBMITTED offers on the RFQ (any supplier) and whether a live work order already exists — for the action menu. */
  offersToForward: number;
  hasLiveWorkOrder: boolean;
};

/* ------------------------------------------------------------------ */
/* Candidate suppliers for an RFQ (picker with filters)                 */
/* ------------------------------------------------------------------ */

export type RfqCandidateDTO = {
  id: string; name: string; categories: string[]; categoryIds: string[];
  distanceKm: number | null; ratingAvg: number | null; ratingCount: number;
  score: number; reasons: string[]; hasAccounts: boolean; recipientEmail: string | null; emergency24h: boolean;
};

export type CandidateFilter = { q?: string; categoryId?: string | null; maxKm?: number | null; minRating?: number | null; withAccount?: boolean };

export function filterCandidates(rows: RfqCandidateDTO[], f: CandidateFilter): RfqCandidateDTO[] {
  const q = f.q?.trim().toLowerCase();
  return rows.filter((r) => {
    if (q && !r.name.toLowerCase().includes(q)) return false;
    if (f.categoryId && !r.categoryIds.includes(f.categoryId)) return false;
    if (f.maxKm != null && (r.distanceKm == null || r.distanceKm > f.maxKm)) return false;
    if (f.minRating != null && (r.ratingAvg == null || r.ratingAvg < f.minRating)) return false;
    if (f.withAccount && !r.hasAccounts) return false;
    return true;
  });
}

/** "Στάλθηκε σε 3 παραλήπτες · χωρίς email: Χ, Υ" after a send. */
export function sentMessage(res: { sent: number; noEmail?: string[]; failed?: string[] }, candidates: RfqCandidateDTO[]): string {
  const names = (res.noEmail ?? []).map((id) => candidates.find((c) => c.id === id)?.name ?? id);
  const parts = [res.sent === 0 ? "Δεν στάλθηκε κανένα email." : `Στάλθηκε email σε ${res.sent} παραλήπτ${res.sent === 1 ? "η" : "ες"}.`];
  if (res.failed?.length) parts.push(`Απέτυχε η αποστολή σε: ${res.failed.join(", ")} — δοκιμάστε «Αποστολή ξανά».`);
  if (names.length) parts.push(`Χωρίς διεύθυνση email: ${names.join(", ")} — προσθέστε επαφή με email στην καρτέλα τους.`);
  return parts.join(" ");
}

