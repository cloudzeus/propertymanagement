"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormField, FieldInput } from "@/components/ui/modal";
import { saveOfferSettings, saveContractTemplate } from "@/app/actions/rfq";
import { RiFileTextLine, RiCheckLine, RiLoaderLine, RiPercentLine } from "react-icons/ri";

type Tpl = { title: string; body: string; version: number };
const PLACEHOLDERS = ["wo.number", "wo.description", "wo.earliestDate", "wo.validUntil", "wo.warrantyMonths", "company.name", "company.afm", "customer.name", "customer.afm", "supplier.name", "supplier.afm", "supplier.doy", "supplier.paymentTermsDays", "building.name", "building.address", "price.net", "price.gross", "price.vatPct", "supplierPrice.net", "supplierPrice.gross", "silentDays", "covered_clause", "survey_clause", "acceptance_block"];

export function ContractsSettingsClient({ settings, templates }: { settings: { offerMarkupPct: number; warrantyMonths: number; silentAcceptDays: number }; templates: Record<"WO_CUSTOMER" | "WO_SUPPLIER", Tpl> }) {
  const router = useRouter();
  const [s, setS] = useState({ offerMarkupPct: String(settings.offerMarkupPct), warrantyMonths: String(settings.warrantyMonths), silentAcceptDays: String(settings.silentAcceptDays) });
  const [tpl, setTpl] = useState(templates);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function saveSettings() {
    setMsg(null); setErr(null);
    startTransition(async () => {
      const res = await saveOfferSettings({ offerMarkupPct: Number(s.offerMarkupPct), warrantyMonths: Number(s.warrantyMonths), silentAcceptDays: Number(s.silentAcceptDays) });
      if (res && "error" in res && res.error) { setErr(res.error); return; }
      setMsg("Οι ρυθμίσεις αποθηκεύτηκαν."); router.refresh();
    });
  }
  function saveTpl(key: "WO_CUSTOMER" | "WO_SUPPLIER") {
    setMsg(null); setErr(null);
    startTransition(async () => {
      const res = await saveContractTemplate(key, { title: tpl[key].title, body: tpl[key].body });
      if (res && "error" in res && res.error) { setErr(res.error); return; }
      setMsg("Το πρότυπο αποθηκεύτηκε ως νέα έκδοση. Οι συμβάσεις που έχουν ήδη γίνει αποδεκτές δεν αλλάζουν."); router.refresh();
    });
  }

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1000 }}>
      <div>
        <h1 style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "var(--fs-22)", fontWeight: 800, margin: 0, color: "var(--foreground)" }}><RiFileTextLine style={{ color: "var(--color-primary)" }} /> Προσφορές & συμβάσεις έργου</h1>
        <p style={{ margin: "4px 0 0", fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>Προεπιλογές για τις προσφορές προς πελάτες και τα πρότυπα των δύο συμβάσεων (Α: πελάτης ↔ εταιρεία, Β: εταιρεία ↔ συνεργάτης).</p>
      </div>
      {msg && <div style={{ padding: "8px 12px", borderRadius: 6, background: "#15803d14", color: "#15803d", fontSize: "var(--fs-13)" }}>{msg}</div>}
      {err && <div style={{ padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: "var(--fs-13)" }}>{err}</div>}

      <div style={card}>
        <div style={h3}><RiPercentLine /> Προεπιλογές προσφορών</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
          <FormField label="Περιθώριο εταιρείας (%)" hint="Προστίθεται στην τιμή του συνεργάτη· αλλάζει ανά προσφορά"><FieldInput type="number" value={s.offerMarkupPct} onChange={(v) => setS((p) => ({ ...p, offerMarkupPct: v }))} /></FormField>
          <FormField label="Εγγύηση εργασίας (μήνες)"><FieldInput type="number" value={s.warrantyMonths} onChange={(v) => setS((p) => ({ ...p, warrantyMonths: v }))} /></FormField>
          <FormField label="Σιωπηρή παραλαβή (εργάσιμες ημέρες)" hint="Χωρίς απάντηση του διαχειριστή η παραλαβή θεωρείται δεδομένη"><FieldInput type="number" value={s.silentAcceptDays} onChange={(v) => setS((p) => ({ ...p, silentAcceptDays: v }))} /></FormField>
        </div>
        <button onClick={saveSettings} disabled={isPending} style={{ ...btnPrimary, marginTop: 12 }}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Αποθήκευση</button>
      </div>

      {(["WO_CUSTOMER", "WO_SUPPLIER"] as const).map((key) => (
        <div key={key} style={card}>
          <div style={h3}><RiFileTextLine /> {key === "WO_CUSTOMER" ? "Σύμβαση Α — Πελάτης ↔ Εταιρεία" : "Σύμβαση Β — Εταιρεία ↔ Συνεργάτης"} <span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}>· έκδοση {tpl[key].version || "προεπιλογή"}</span></div>
          <FormField label="Τίτλος"><FieldInput value={tpl[key].title} onChange={(v) => setTpl((p) => ({ ...p, [key]: { ...p[key], title: v } }))} /></FormField>
          <div style={{ marginTop: 10 }}>
            <FormField label="Κείμενο (Markdown)" hint="Επικεφαλίδες με #, έντονα με **, λίστες με -. Οι μεταβλητές {{…}} συμπληρώνονται αυτόματα.">
              <textarea value={tpl[key].body} onChange={(e) => setTpl((p) => ({ ...p, [key]: { ...p[key], body: e.target.value } }))} rows={22} style={{ width: "100%", padding: 12, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontFamily: "ui-monospace, Menlo, monospace", fontSize: "var(--fs-12-5)", lineHeight: 1.5, color: "var(--foreground)", background: "var(--card)", boxSizing: "border-box" }} />
            </FormField>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
            {PLACEHOLDERS.map((p) => <code key={p} style={{ fontSize: "var(--fs-11)", padding: "2px 6px", borderRadius: 4, background: "var(--paper)", border: "1px solid var(--border)" }}>{`{{${p}}}`}</code>)}
          </div>
          <button onClick={() => saveTpl(key)} disabled={isPending} style={{ ...btnPrimary, marginTop: 12 }}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Αποθήκευση προτύπου</button>
        </div>
      ))}
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 18 };
const h3: React.CSSProperties = { fontSize: "var(--fs-14)", fontWeight: 700, color: "var(--foreground)", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 };
const btnPrimary: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 16px", border: "none", background: "var(--color-primary)", color: "#fff", borderRadius: 6, fontSize: "var(--fs-13)", fontWeight: 600, cursor: "pointer" };
