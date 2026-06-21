/**
 * Build a Word-compatible κοινόχρηστα analysis document for one person, for one
 * month. We emit Word-flavored HTML saved with a `.doc` extension and the
 * `application/msword` MIME type — MS Word and Google Docs open this natively,
 * with no extra dependency. Returns a Buffer ready to attach to an email.
 */

export type KoinoLine = {
  category: string | null;
  supplier: string | null;
  documentNumber: string | null;
  documentDate: string | null; // ISO
  role: "OWNER" | "TENANT";
  amount: number;
  note?: string | null;
  paid: boolean;
};

export type KoinoDocInput = {
  buildingName: string;
  buildingAddress: string | null;
  month: string;            // YYYY-MM
  personName: string;
  unitLabels: string[];     // e.g. ["Δ1", "Κατάστημα 2"]
  lines: KoinoLine[];
};

const esc = (s: unknown) =>
  String(s ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const eur = (n: number) => `${n.toFixed(2)} €`;
const date = (iso: string | null) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("el-GR"); } catch { return "—"; }
};
const roleLabel = (r: "OWNER" | "TENANT") => (r === "OWNER" ? "Ιδιοκτήτης" : "Ενοικιαστής");

export function buildKoinochristaDoc(input: KoinoDocInput): Buffer {
  const total = input.lines.reduce((s, l) => s + l.amount, 0);
  const paidTotal = input.lines.filter((l) => l.paid).reduce((s, l) => s + l.amount, 0);
  const due = total - paidTotal;

  const rows = input.lines
    .map(
      (l) => `
      <tr>
        <td>${esc(l.category)}${l.note ? `<div style="font-size:11px;color:#666">${esc(l.note)}</div>` : ""}</td>
        <td>${esc(l.supplier)}</td>
        <td>${esc(l.documentNumber)}</td>
        <td>${date(l.documentDate)}</td>
        <td>${roleLabel(l.role)}</td>
        <td style="text-align:right">${eur(l.amount)}</td>
        <td style="text-align:center">${l.paid ? "Ναι" : "Όχι"}</td>
      </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Κοινόχρηστα ${esc(input.month)}</title>
<style>
  body { font-family: 'Calibri', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; }
  h1 { font-size: 16pt; margin: 0 0 4px; }
  .sub { color: #555; font-size: 10pt; margin: 0; }
  table { border-collapse: collapse; width: 100%; margin-top: 14px; }
  th, td { border: 1px solid #bbb; padding: 6px 8px; font-size: 10pt; }
  th { background: #f0f0f0; text-align: left; }
  .totals { margin-top: 14px; font-size: 11pt; }
  .totals div { margin: 2px 0; }
  .due { font-weight: bold; color: #b91c1c; }
</style></head>
<body>
  <h1>Ανάλυση Κοινοχρήστων</h1>
  <p class="sub">${esc(input.buildingName)}${input.buildingAddress ? " — " + esc(input.buildingAddress) : ""}</p>
  <p class="sub">Περίοδος: <b>${esc(input.month)}</b></p>
  <p class="sub">Προς: <b>${esc(input.personName)}</b>${input.unitLabels.length ? " — Μονάδες: " + esc(input.unitLabels.join(", ")) : ""}</p>

  <table>
    <thead>
      <tr><th>Κατηγορία</th><th>Προμηθευτής</th><th>Αρ. παρ/κού</th><th>Ημ/νία</th><th>Ιδιότητα</th><th style="text-align:right">Ποσό</th><th>Πληρωμένο</th></tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="7" style="text-align:center">Καμία χρέωση.</td></tr>`}</tbody>
  </table>

  <div class="totals">
    <div>Σύνολο χρεώσεων: <b>${eur(total)}</b></div>
    <div>Πληρωμένα: <b>${eur(paidTotal)}</b></div>
    <div class="due">Υπόλοιπο προς πληρωμή: ${eur(due)}</div>
  </div>

  <p class="sub" style="margin-top:18px">Επισυνάπτονται τα σχετικά παραστατικά. Σας ευχαριστούμε.</p>
</body></html>`;

  return Buffer.from(html, "utf-8");
}
