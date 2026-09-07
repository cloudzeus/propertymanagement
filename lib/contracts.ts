import "server-only";
import { db } from "@/lib/db";
import { eur } from "@/lib/rfq-shared";

export type ContractKey = "WO_CUSTOMER" | "WO_SUPPLIER";

/**
 * Default back-to-back contract templates (Markdown + {{placeholders}}).
 * Editable by the super-admin at /super-admin/settings/contracts; the DB copy
 * wins when present. A rendered copy is frozen on the WorkOrder at acceptance.
 */
export const DEFAULT_TEMPLATES: Record<ContractKey, { title: string; body: string }> = {
  WO_CUSTOMER: {
    title: "Σύμβαση έργου {{wo.number}}-A — Πελάτης ↔ {{company.name}}",
    body: `# Σύμβαση εκτέλεσης εργασιών {{wo.number}}-A

**Μεταξύ:** {{customer.name}} (ΑΦΜ {{customer.afm}}), εφεξής «ο Πελάτης», και {{company.name}} (ΑΦΜ {{company.afm}}), εφεξής «η Εταιρεία».

## 1. Αντικείμενο
Η Εταιρεία αναλαμβάνει την εκτέλεση της παρακάτω εργασίας στο κτήριο **{{building.name}}**, {{building.address}}:

{{wo.description}}

{{covered_clause}}

## 2. Τίμημα
Συμφωνημένο τίμημα: **{{price.net}}** πλέον ΦΠΑ {{price.vatPct}}% = **{{price.gross}}**.
{{survey_clause}}
Η πληρωμή γίνεται μετά την επιβεβαίωση παραλαβής (άρθρο 4), με τους τρόπους πληρωμής που διαθέτει η Εταιρεία.

## 3. Χρόνος εκτέλεσης
Νωρίτερη δυνατή έναρξη: {{wo.earliestDate}}. Η ακριβής ημερομηνία/ώρα ορίζεται με ραντεβού μέσω της πλατφόρμας. Η προσφορά ισχύει έως {{wo.validUntil}}.

## 4. Παραλαβή
Με την ολοκλήρωση, η Εταιρεία καταθέτει απόδειξη επισκευής (φωτογραφίες, αναφορά). Ο Πελάτης επιβεβαιώνει την παραλαβή ή την αμφισβητεί εγγράφως εντός {{silentDays}} εργάσιμων ημερών· άλλως η παραλαβή θεωρείται σιωπηρή.

## 5. Εγγύηση
Η Εταιρεία εγγυάται την εργασία για **{{wo.warrantyMonths}} μήνες** από την παραλαβή, για ελαττώματα που οφείλονται σε πλημμελή εκτέλεση.

## 6. Ακύρωση
Ακύρωση πριν το ραντεβού: χωρίς χρέωση. Μετά το ραντεβού: χρεώνεται το κόστος αυτοψίας/μετάβασης, εφόσον προβλέπεται.

## 7. Αποδοχή
Η σύμβαση συνάπτεται με την ηλεκτρονική αποδοχή της προσφοράς από τον Πελάτη μέσα από την πλατφόρμα. Καταγράφονται χρήστης, ημερομηνία/ώρα και διεύθυνση IP.

{{acceptance_block}}`,
  },
  WO_SUPPLIER: {
    title: "Σύμβαση έργου {{wo.number}}-B — {{company.name}} ↔ Συνεργάτης",
    body: `# Σύμβαση υπεργολαβίας {{wo.number}}-B

**Μεταξύ:** {{company.name}} (ΑΦΜ {{company.afm}}), εφεξής «η Εταιρεία», και {{supplier.name}} (ΑΦΜ {{supplier.afm}}, ΔΟΥ {{supplier.doy}}), εφεξής «ο Συνεργάτης».

## 1. Αντικείμενο
Ο Συνεργάτης αναλαμβάνει, για λογαριασμό της Εταιρείας, την εκτέλεση της παρακάτω εργασίας στο κτήριο **{{building.name}}**, {{building.address}}:

{{wo.description}}

## 2. Τίμημα
Συμφωνημένο τίμημα: **{{supplierPrice.net}}** πλέον ΦΠΑ {{price.vatPct}}% = **{{supplierPrice.gross}}**, με βάση την προσφορά του Συνεργάτη.
{{survey_clause}}
Πληρωμή εντός {{supplier.paymentTermsDays}} ημερών από την επιβεβαίωση παραλαβής από τον τελικό πελάτη (άρθρο 4), με έκδοση τιμολογίου προς την Εταιρεία.

## 3. Χρόνος εκτέλεσης
Νωρίτερη δυνατή έναρξη: {{wo.earliestDate}}. Το ραντεβού ορίζεται μέσω της πλατφόρμας. Ο Συνεργάτης ενημερώνει αμέσως για κάθε καθυστέρηση.

## 4. Απόδειξη επισκευής & παραλαβή
Ο Συνεργάτης καταθέτει στην πλατφόρμα απόδειξη επισκευής: φωτογραφίες «μετά», σύντομη αναφορά εργασιών/υλικών. Χωρίς απόδειξη η εργασία δεν θεωρείται ολοκληρωμένη. Σε αμφισβήτηση από τον τελικό πελάτη, ο Συνεργάτης αποκαθιστά χωρίς επιπλέον χρέωση.

## 5. Εγγύηση & ευθύνη
Εγγύηση εργασίας **{{wo.warrantyMonths}} μήνες**. Ο Συνεργάτης τηρεί την ισχύουσα νομοθεσία και τους κανόνες ασφαλείας, φέρει την ευθύνη για ζημιές από δική του υπαιτιότητα και δεν αναθέτει σε τρίτους χωρίς έγκριση της Εταιρείας.

## 6. Εμπιστευτικότητα
Ο Συνεργάτης δεν επικοινωνεί οικονομικούς όρους με τον τελικό πελάτη ούτε συμβάλλεται απευθείας μαζί του για το ίδιο αντικείμενο.

## 7. Αποδοχή
Η σύμβαση συνάπτεται με την ηλεκτρονική αποδοχή της ανάθεσης από τον διαχειριστή του Συνεργάτη μέσα από την πλατφόρμα.

{{acceptance_block}}`,
  },
};

export async function getTemplate(key: ContractKey): Promise<{ title: string; body: string; version: number }> {
  const row = await db.contractTemplate.findUnique({ where: { key } });
  return row ? { title: row.title, body: row.body, version: row.version } : { ...DEFAULT_TEMPLATES[key], version: 0 };
}

const fmtDate = (d: Date | null | undefined) => (d ? d.toLocaleDateString("el-GR", { day: "2-digit", month: "long", year: "numeric" }) : "—");
const fmtDT = (d: Date | null | undefined) => (d ? d.toLocaleString("el-GR", { dateStyle: "long", timeStyle: "short" }) : "—");

/** Minimal Markdown → HTML (headings, bold, lists, paragraphs) — enough for contracts, no external dep. */
export function mdToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
  const out: string[] = [];
  let para: string[] = [], list: string[] = [];
  const flushP = () => { if (para.length) { out.push(`<p>${para.map(inline).join("<br/>")}</p>`); para = []; } };
  const flushL = () => { if (list.length) { out.push(`<ul>${list.map((l) => `<li>${inline(l)}</li>`).join("")}</ul>`); list = []; } };
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) { flushP(); flushL(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }
    const li = line.match(/^[-*]\s+(.*)$/);
    if (li) { flushP(); list.push(li[1]); continue; }
    if (line.trim() === "") { flushP(); flushL(); continue; }
    flushL(); para.push(line);
  }
  flushP(); flushL();
  return out.join("\n");
}

/** Render one side of the contract for a work order. */
export async function renderContract(key: ContractKey, woId: string): Promise<{ title: string; html: string; version: number }> {
  const [tpl, wo, company, settings] = await Promise.all([
    getTemplate(key),
    db.workOrder.findUnique({
      where: { id: woId },
      include: { building: { select: { name: true, address: true, city: true } }, customer: { select: { name: true, afm: true } }, supplier: { select: { name: true, afm: true, doy: true, paymentTermsDays: true } } },
    }),
    db.company.findFirst({ orderBy: { createdAt: "asc" }, select: { name: true, afm: true } }),
    db.appSettings.findUnique({ where: { id: "singleton" }, select: { silentAcceptDays: true, warrantyMonths: true } }),
  ]);
  if (!wo) throw new Error("Work order not found");
  const net = key === "WO_CUSTOMER" ? Number(wo.customerPrice) : Number(wo.supplierPrice);
  const gross = Math.round(net * (1 + wo.vatPct / 100) * 100) / 100;
  const survey = wo.surveyFee != null ? Number(wo.surveyFee) : null;
  const acceptedLine = key === "WO_CUSTOMER"
    ? (wo.customerAcceptedAt ? `**Αποδοχή Πελάτη:** ${fmtDT(wo.customerAcceptedAt)} · IP ${wo.customerAcceptedIp ?? "—"}` : "_Εκκρεμεί αποδοχή από τον Πελάτη._")
    : (wo.supplierAcceptedAt ? `**Αποδοχή Συνεργάτη:** ${fmtDT(wo.supplierAcceptedAt)}` : "_Εκκρεμεί αποδοχή από τον Συνεργάτη._");
  const vars: Record<string, string> = {
    "wo.number": wo.number,
    "wo.description": wo.description,
    "wo.earliestDate": fmtDate(wo.earliestDate),
    "wo.validUntil": fmtDate(wo.validUntil),
    "wo.warrantyMonths": String(wo.warrantyMonths ?? settings?.warrantyMonths ?? 6),
    "company.name": company?.name ?? "Εταιρεία διαχείρισης",
    "company.afm": company?.afm ?? "—",
    "customer.name": wo.customer.name,
    "customer.afm": wo.customer.afm ?? "—",
    "supplier.name": wo.supplier.name,
    "supplier.afm": wo.supplier.afm ?? "—",
    "supplier.doy": wo.supplier.doy ?? "—",
    "supplier.paymentTermsDays": String(wo.supplier.paymentTermsDays ?? 30),
    "building.name": wo.building.name,
    "building.address": [wo.building.address, wo.building.city].filter(Boolean).join(", ") || "—",
    "price.net": wo.covered && key === "WO_CUSTOMER" ? "0,00 € (καλύπτεται από τη σύμβαση διαχείρισης)" : eur(net),
    "price.gross": wo.covered && key === "WO_CUSTOMER" ? "0,00 €" : eur(gross),
    "price.vatPct": String(wo.vatPct),
    "supplierPrice.net": eur(Number(wo.supplierPrice)),
    "supplierPrice.gross": eur(Math.round(Number(wo.supplierPrice) * (1 + wo.vatPct / 100) * 100) / 100),
    silentDays: String(settings?.silentAcceptDays ?? 5),
    covered_clause: wo.covered ? "Η εργασία **καλύπτεται από τη σύμβαση διαχείρισης** του κτηρίου· δεν προκύπτει πρόσθετη χρέωση για τον Πελάτη." : "",
    survey_clause: survey != null && survey > 0 ? `Χρέωση αυτοψίας: ${eur(survey)}${wo.surveyWaived ? " (συμψηφίζεται με το τίμημα εφόσον εκτελεστεί η εργασία)" : ""}.` : "",
    acceptance_block: `---\n\n${acceptedLine}\n\n_Έκδοση προτύπου ${tpl.version} · Σύμβαση δημιουργήθηκε ${fmtDate(wo.createdAt)}_`,
  };
  const fill = (s: string) => s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => vars[k] ?? "");
  return { title: fill(tpl.title), html: mdToHtml(fill(tpl.body)), version: tpl.version };
}
