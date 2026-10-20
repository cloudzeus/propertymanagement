/**
 * Pure mappers: our records → SoftOne setData payloads (Phase A entities of the
 * spec, §4.1–4.6). No DB, no network — used by the push dry-run (preview only)
 * and, after the integrator agrees, by the push engine. Each mapper returns the
 * payload plus the prerequisites/parameters that are still missing, so the UI
 * can explain why a record is not ready instead of sending a broken payload.
 */
import { SODTYPE } from "./mapping";

export type S1Params = {
  countryGr: number | null; currencyEur: number | null; paymentDefault: number | null;
  cntrTypeCustomer: number | null; cntrTypeSupplier: number | null; cntrTypeManaged: number | null; cntrType1Default: number | null;
  visitUnitMonths: number | null; seriesSales: number | null; seriesPurchase: number | null; prjType: number | null;
  vatMap: Record<string, number> | null; unitMap: Record<string, number> | null;
  codePrefixCustomer: string; codePrefixSupplier: string; codePrefixProject: string; codePrefixService: string;
  branch: number | null;
};

export type MapResult = {
  object: string;
  /** null = update not possible yet (missing prerequisites). */
  key: number | null;
  action: "insert" | "update";
  data: Record<string, Record<string, unknown>[]>;
  /** Human-readable blockers (empty = ready). */
  missing: string[];
  notes: string[];
};

const d = (v: Date | string | null | undefined): string | undefined => (v ? new Date(v).toISOString().slice(0, 10) : undefined);
const clean = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ""));

export const CONSTANTS = {
  TSODTYPE_CUSTOMER: SODTYPE.CUSTOMER, TSODTYPE_SUPPLIER: SODTYPE.SUPPLIER, MSODTYPE_SERVICE: SODTYPE.SERVICE, MSODTYPE_ITEM: SODTYPE.ITEM,
  PERIODINV_ONCE: 0, PERIODINV_MONTHLY: 1, LINENUM_NEW: 9000001, MTRTYPE_SERVICE: 1,
} as const;

export type CustomerIn = { id: string; code: string | null; name: string; afm: string | null; doy: string | null; address: string | null; postalCode: string | null; city: string | null; district: string | null; phone: string | null; fax: string | null; email: string | null; webpage: string | null; isActive: boolean; type: "INDIVIDUAL" | "COMPANY" | string; remarks: string | null; softoneTrdr: number | null; seq?: number };

export function mapCustomer(c: CustomerIn, p: S1Params): MapResult {
  const missing: string[] = [];
  if (!p.countryGr) missing.push("Παράμετρος «Χώρα (Ελλάδα)»");
  if (!p.currencyEur) missing.push("Παράμετρος «Νόμισμα (EUR)»");
  const row = clean({
    CODE: c.code || `${p.codePrefixCustomer}${String(c.seq ?? 0).padStart(5, "0")}`,
    NAME: c.name, AFM: c.afm, IRSDATA: c.doy, ADDRESS: c.address, ZIP: c.postalCode, CITY: c.city, DISTRICT: c.district,
    PHONE01: c.phone, FAX: c.fax, EMAIL: c.email, WEBPAGE: c.webpage,
    COUNTRY: p.countryGr, SOCURRENCY: p.currencyEur, PAYMENT: p.paymentDefault,
    ISACTIVE: c.isActive ? 1 : 0, CHKAFM: c.afm ? undefined : 0, REMARKS: c.remarks,
  });
  return { object: "CUSTOMER", key: c.softoneTrdr, action: c.softoneTrdr ? "update" : "insert", data: { CUSTOMER: [row] }, missing,
    notes: [c.afm ? `Πριν την εισαγωγή: αναζήτηση CUSTOMER.AFM=${c.afm} για αποφυγή διπλού` : "Χωρίς ΑΦΜ → CHKAFM=0", "CMPMODE (φυσικό/νομικό πρόσωπο) ορίζεται μετά τη συμφωνία των ids $CMPMODE"] };
}

export type SupplierIn = CustomerIn & { paymentTermsDays: number | null; iban: string | null; bank: string | null };

export function mapSupplier(s: SupplierIn, p: S1Params): MapResult {
  const r = mapCustomer({ ...s, code: s.code || `${p.codePrefixSupplier}${String(s.seq ?? 0).padStart(5, "0")}` }, p);
  const row = r.data.CUSTOMER[0];
  const notes = [...r.notes];
  if (s.paymentTermsDays != null) notes.push(`Ημέρες πίστωσης ${s.paymentTermsDays} → PAYMENT: εκκρεμεί πίνακας αντιστοίχισης (§11.6)`);
  if (s.iban) notes.push("IBAN: child table τραπεζικών λογαριασμών — εκκρεμεί όνομα πίνακα από integrator (§11.5)");
  return { ...r, object: "SUPPLIER", data: { SUPPLIER: [{ ...row, INPAYVAT: 0 }] }, notes };
}

export type BuildingIn = { id: string; name: string; address: string; city: string; postalCode: string; floors: number | null; unitsCount: number; hasElevator: boolean; softonePrjc: number | null; customerTrdr: number | null; managedSince: Date | string | null; seq?: number };

export function mapBuilding(b: BuildingIn, p: S1Params): MapResult {
  const missing: string[] = [];
  if (!b.customerTrdr) missing.push("Ο πελάτης του κτηρίου δεν έχει συγχρονιστεί (TRDR)");
  if (!p.prjType) missing.push("Παράμετρος «Τύπος έργου»");
  const row = clean({
    CODE: `${p.codePrefixProject}${String(b.seq ?? 0).padStart(5, "0")}`,
    NAME: `${b.name} — ${b.address}, ${b.city}`.slice(0, 100),
    TRDR: b.customerTrdr, PRJTYPE: p.prjType, ISACTIVE: 1, BLOCKED: 0, FROMDATE: d(b.managedSince),
    REMARKS: [b.floors != null ? `${b.floors} όροφοι` : null, `${b.unitsCount} μονάδες`, b.hasElevator ? "ανελκυστήρας" : null, `ΤΚ ${b.postalCode}`].filter(Boolean).join(", "),
  });
  return { object: "PRJC", key: b.softonePrjc, action: b.softonePrjc ? "update" : "insert", data: { PRJC: [row] }, missing, notes: ["Συμβάσεις και παραστατικά αναφέρουν το PRJC του κτηρίου"] };
}

export type ServiceIn = { id: string; code: string | null; name: string; vatPct: number | null; unit: string | null; customerPrice: number | null; supplierPrice: number | null; active: boolean; softoneMtrl: number | null; seq?: number };

export function mapService(s: ServiceIn, p: S1Params): MapResult {
  const missing: string[] = [];
  const vat = s.vatPct != null ? p.vatMap?.[String(s.vatPct)] : undefined;
  const unit = s.unit ? p.unitMap?.[s.unit] : undefined;
  if (vat == null) missing.push(`Παράμετρος ΦΠΑ ${s.vatPct ?? "?"} % → VAT id`);
  if (unit == null) missing.push(`Παράμετρος μονάδας «${s.unit ?? "—"}» → MTRUNIT id`);
  const row = clean({
    CODE: s.code || `${p.codePrefixService}${String(s.seq ?? 0).padStart(5, "0")}`, NAME: s.name,
    VAT: vat, MTRUNIT1: unit, MTRTYPE: CONSTANTS.MTRTYPE_SERVICE, PRICEW: s.supplierPrice, PRICER: s.customerPrice, ISACTIVE: s.active ? 1 : 0,
  });
  return { object: "SERVICE", key: s.softoneMtrl, action: s.softoneMtrl ? "update" : "insert", data: { SERVICE: [row] }, missing, notes: ["Ένα MTRL ανά υπηρεσία καταλόγου (προτεινόμενο, §11.3)"] };
}

export type WorkOrderIn = {
  id: string; number: string; title: string; description: string; createdAt: Date | string; customerAcceptedAt: Date | string | null; supplierAcceptedAt: Date | string | null; scheduledAt: Date | string | null; completedAt: Date | string | null;
  warrantyMonths: number | null; customerPrice: number; supplierPrice: number; customerMessage: string | null;
  customerTrdr: number | null; supplierTrdr: number | null; buildingPrjc: number | null; serviceMtrl: number | null; softoneCntrA: number | null; softoneCntrB: number | null;
};

function cntrLine(mtrl: number | null, price: number, from: string | undefined, to: string | undefined, p: S1Params, months: number | null, periodinv: number, qty = 1, comments?: string) {
  return clean({ LINENUM: CONSTANTS.LINENUM_NEW, LINETYPE1: 1, MSODTYPE: CONSTANTS.MSODTYPE_SERVICE, MTRL: mtrl, FROMDATE: from, TODATE: to, VISITUNIT: p.visitUnitMonths, VISITNUM: months, PERIODINV: periodinv, QTY1: qty, QTY2: qty, PRICE: price, ISACTIVE: 1, COMMENTS: comments });
}

/** Σύμβαση έργου → ΔΥΟ CNTR: Α (πελάτης, TSODTYPE 13) και Β (συνεργάτης, TSODTYPE 12, CNTRS → Α). */
export function mapWorkOrder(w: WorkOrderIn, p: S1Params): { a: MapResult; b: MapResult } {
  const missing: string[] = [];
  if (!w.customerTrdr) missing.push("Πελάτης χωρίς TRDR");
  if (!w.supplierTrdr) missing.push("Συνεργάτης χωρίς TRDR");
  if (!w.serviceMtrl) missing.push("Η υπηρεσία της προσφοράς δεν έχει MTRL");
  if (!p.cntrTypeCustomer) missing.push("Παράμετρος «Τύπος σύμβασης Α»");
  if (!p.cntrTypeSupplier) missing.push("Παράμετρος «Τύπος σύμβασης Β»");
  if (!p.cntrType1Default) missing.push("Παράμετρος «Χαρακτηρισμός σύμβασης»");
  if (!p.visitUnitMonths) missing.push("Παράμετρος «Μονάδα χρόνου “μήνες”»");
  if (!p.branch) missing.push("BRANCH (Σύνδεση)");
  const from = d(w.customerAcceptedAt ?? w.scheduledAt ?? w.createdAt);
  const toDate = w.completedAt && w.warrantyMonths ? (() => { const x = new Date(w.completedAt!); x.setUTCMonth(x.getUTCMonth() + w.warrantyMonths!); return d(x); })() : undefined;
  const head = (suffix: "A" | "B", cntrtype: number | null, tsodtype: number, trdr: number | null, value: number, extra: Record<string, unknown>) => clean({
    CODE: `${w.number}-${suffix}`, NAME: w.title, TRNDATE: d(w.createdAt), FROMDATE: from, TODATE: toDate,
    CNTRTYPE: cntrtype, CNTRTYPE1: p.cntrType1Default, TSODTYPE: tsodtype, TRDR: trdr, PRJC: w.buildingPrjc, BRANCH: p.branch,
    CNTRVALUE: value, SOVALUE: value, COMMENTS: w.customerMessage, REMARKS: w.description, ISACTIVE: 1, REFCODE: w.number, VARCHAR01: w.id, ...extra,
  });
  const a: MapResult = {
    object: "CNTR", key: w.softoneCntrA, action: w.softoneCntrA ? "update" : "insert", missing: [...missing],
    data: { CNTR: [head("A", p.cntrTypeCustomer, CONSTANTS.TSODTYPE_CUSTOMER, w.customerTrdr, w.customerPrice, {})], CNTRLINES: [cntrLine(w.serviceMtrl, w.customerPrice, from, toDate, p, w.warrantyMonths, CONSTANTS.PERIODINV_ONCE, 1, w.description)] },
    notes: ["Α = τιμή πελάτη (τι χρεώνει η Orithon)"],
  };
  const b: MapResult = {
    object: "CNTR", key: w.softoneCntrB, action: w.softoneCntrB ? "update" : "insert", missing: [...missing, ...(w.softoneCntrA ? [] : ["Η σύμβαση Α πρέπει να έχει σταλεί πρώτα (CNTRS → Α)"])],
    data: { CNTR: [head("B", p.cntrTypeSupplier, CONSTANTS.TSODTYPE_SUPPLIER, w.supplierTrdr, w.supplierPrice, { CNTRS: w.softoneCntrA ?? undefined })], CNTRLINES: [cntrLine(w.serviceMtrl, w.supplierPrice, from, toDate, p, w.warrantyMonths, CONSTANTS.PERIODINV_ONCE, 1, w.description)] },
    notes: ["Β = τιμή συνεργάτη (τι πληρώνει η Orithon) · CNTRS δείχνει στην Α"],
  };
  return { a, b };
}

export type PropertyServiceIn = { id: string; buildingName: string; serviceName: string; serviceMtrl: number | null; price: number; qty: number; startedAt: Date | string | null; endedAt: Date | string | null; customerTrdr: number | null; buildingPrjc: number | null; softoneCntr: number | null; seq?: number };

/** Πακέτο διαχείρισης ακινήτου → CNTR με περιοδική (μηνιαία) τιμολόγηση. */
export function mapPropertyService(ps: PropertyServiceIn, p: S1Params): MapResult {
  const missing: string[] = [];
  if (!ps.customerTrdr) missing.push("Πελάτης χωρίς TRDR");
  if (!ps.serviceMtrl) missing.push("Η υπηρεσία δεν έχει MTRL");
  if (!p.cntrTypeManaged) missing.push("Παράμετρος «Τύπος σύμβασης διαχείρισης»");
  if (!p.visitUnitMonths) missing.push("Παράμετρος «Μονάδα χρόνου “μήνες”»");
  if (!p.branch) missing.push("BRANCH (Σύνδεση)");
  const from = d(ps.startedAt), to = d(ps.endedAt);
  const months = ps.startedAt && ps.endedAt ? Math.max(1, Math.round((new Date(ps.endedAt).getTime() - new Date(ps.startedAt).getTime()) / (30.44 * 86400_000))) : null;
  const head = clean({
    CODE: `${p.codePrefixProject}${String(ps.seq ?? 0).padStart(5, "0")}-${ps.serviceName.slice(0, 10).toUpperCase()}`, NAME: `${ps.buildingName} — ${ps.serviceName}`.slice(0, 100),
    TRNDATE: from, FROMDATE: from, TODATE: to, CNTRTYPE: p.cntrTypeManaged, CNTRTYPE1: p.cntrType1Default, TSODTYPE: CONSTANTS.TSODTYPE_CUSTOMER, TRDR: ps.customerTrdr, PRJC: ps.buildingPrjc, BRANCH: p.branch, ISACTIVE: 1, VARCHAR01: ps.id,
  });
  return { object: "CNTR", key: ps.softoneCntr, action: ps.softoneCntr ? "update" : "insert", missing,
    data: { CNTR: [head], CNTRLINES: [cntrLine(ps.serviceMtrl, ps.price, from, to, p, months, CONSTANTS.PERIODINV_MONTHLY, ps.qty)] },
    notes: ["PERIODINV = 1 (μηνιαία) · QTY1 = μονάδες κτηρίου για CORE", "Ποιος εκδίδει τα περιοδικά παραστατικά: προς συμφωνία (§11.2)"] };
}
