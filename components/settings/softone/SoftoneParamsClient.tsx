"use client";

import { useState, useTransition } from "react";
import { RiSaveLine, RiCheckLine, RiErrorWarningLine, RiDownloadCloud2Line, RiLoader4Line, RiAddLine, RiDeleteBinLine } from "react-icons/ri";
import { saveSoftoneParams, loadSoftoneSelector, type SoftoneParamsView, type SelectorOption } from "@/app/actions/softone";
import { S1_LABEL, S1_INPUT, S1_CARD, S1_BTN } from "./SoftoneHeader";

type Lookup = { key: string; editor: string; label: string };

const CONSTANTS: { label: string; value: string; why: string }[] = [
  { label: "TSODTYPE (σύμβαση Α — πελάτης)", value: "13", why: "SODTYPE πελάτη στο SoftOne" },
  { label: "TSODTYPE (σύμβαση Β — συνεργάτης)", value: "12", why: "SODTYPE προμηθευτή" },
  { label: "MSODTYPE γραμμής υπηρεσίας / είδους", value: "52 / 51", why: "MTRL υπηρεσία / είδος" },
  { label: "PERIODINV σύμβασης έργου / διαχείρισης", value: "0 / 1", why: "εφάπαξ / μηνιαία τιμολόγηση" },
  { label: "LINENUM νέων γραμμών", value: "≥ 9000001", why: "κανόνας setData για child tables" },
  { label: "MTRTYPE υπηρεσίας", value: "1", why: "" },
];

const DEFAULT_VAT_KEYS = ["24", "13", "6", "0"];
const DEFAULT_UNIT_KEYS = ["τεμ.", "ώρα", "επίσκεψη", "τ.μ.", "μήνας", "εργασία"];

export function SoftoneParamsClient({ initial, lookups }: { initial: SoftoneParamsView; lookups: Lookup[] }) {
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(Object.entries(initial.values).map(([k, v]) => [k, v == null ? "" : String(v)])));
  const [vatMap, setVatMap] = useState<Record<string, string>>(Object.fromEntries([...new Set([...DEFAULT_VAT_KEYS, ...Object.keys(initial.vatMap)])].map((k) => [k, initial.vatMap[k] != null ? String(initial.vatMap[k]) : ""])));
  const [unitMap, setUnitMap] = useState<Record<string, string>>(Object.fromEntries([...new Set([...DEFAULT_UNIT_KEYS, ...Object.keys(initial.unitMap)])].map((k) => [k, initial.unitMap[k] != null ? String(initial.unitMap[k]) : ""])));
  const [prefix, setPrefix] = useState({ codePrefixCustomer: initial.codePrefixCustomer, codePrefixSupplier: initial.codePrefixSupplier, codePrefixProject: initial.codePrefixProject, codePrefixService: initial.codePrefixService });
  const [live, setLive] = useState<Record<string, SelectorOption[] | { error: string }>>({});
  const [loadingEditor, setLoadingEditor] = useState<string | null>(null);
  const [newUnit, setNewUnit] = useState("");
  const [saving, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localOptions = (editor: string): SelectorOption[] | null => {
    if (editor === "SERIES") return initial.local.series.map((s) => ({ value: s.s1Key, label: `${s.code ?? ""} ${s.name}${s.sosourceLabel ? ` · ${s.sosourceLabel}` : ""}`.trim() }));
    return null;
  };
  const optionsFor = (editor: string): SelectorOption[] | null => {
    const l = live[editor];
    if (l && Array.isArray(l) && l.length) return l;
    return localOptions(editor);
  };

  async function fetchLive(editor: string) {
    setLoadingEditor(editor);
    const r = await loadSoftoneSelector(editor);
    setLive((m) => ({ ...m, [editor]: r.ok ? r.options : { error: r.error } }));
    setLoadingEditor(null);
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const toNum = (v: string) => (v.trim() === "" ? null : Number(v));
    start(async () => {
      const r = await saveSoftoneParams({
        values: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, toNum(v)])),
        vatMap: Object.fromEntries(Object.entries(vatMap).filter(([, v]) => v.trim() !== "").map(([k, v]) => [k, Number(v)])),
        unitMap: Object.fromEntries(Object.entries(unitMap).filter(([, v]) => v.trim() !== "").map(([k, v]) => [k, Number(v)])),
        ...prefix,
      });
      if ("error" in r) { setError(r.error); return; }
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    });
  }

  const SelectOrNumber = ({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: SelectorOption[] | null; placeholder?: string }) => options && options.length ? (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={S1_INPUT}>
      <option value="">— μη ορισμένο —</option>
      {options.map((o) => <option key={o.value} value={String(o.value)}>{o.label} ({o.value})</option>)}
      {value && !options.some((o) => String(o.value) === value) && <option value={value}>id {value} (εκτός λίστας)</option>}
    </select>
  ) : (
    <input value={value} onChange={(e) => onChange(e.target.value)} inputMode="numeric" placeholder={placeholder ?? "SoftOne id"} style={S1_INPUT} />
  );

  const LiveButton = ({ editor }: { editor: string }) => {
    const l = live[editor];
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, fontSize: "var(--fs-11)", color: "var(--muted-foreground)", flexWrap: "wrap" }}>
        <button type="button" disabled={!initial.configured || loadingEditor === editor} onClick={() => fetchLive(editor)} style={{ ...S1_BTN("ghost", !initial.configured), minHeight: 28, padding: "0 10px", fontSize: "var(--fs-11)" }}>
          {loadingEditor === editor ? <RiLoader4Line style={{ animation: "s1spin 1s linear infinite" }} /> : <RiDownloadCloud2Line />} Λίστα από SoftOne
        </button>
        {l && !Array.isArray(l) && <span style={{ color: "var(--color-danger)" }}>{l.error}</span>}
        {l && Array.isArray(l) && <span>{l.length} εγγραφές</span>}
      </div>
    );
  };

  return (
    <form onSubmit={onSave} style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 980 }}>
      {!initial.configured && <div style={{ padding: "10px 14px", borderRadius: 8, background: "color-mix(in srgb, var(--color-warning) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)", color: "var(--color-warning)", fontSize: "var(--fs-12-5)" }}>Η σύνδεση SoftOne δεν είναι ενεργή: οι λίστες δεν μπορούν να φορτωθούν live. Μπορείτε να καταχωρίσετε τα ids χειροκίνητα.</div>}

      <div style={S1_CARD}>
        <div>
          <h2 style={{ fontSize: "var(--fs-15)", fontWeight: 600, margin: 0 }}>Ids της εγκατάστασης</h2>
          <p style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)", margin: "4px 0 0" }}>Τιμές που απαιτεί η αντιστοίχιση (προδιαγραφή §7). Οι σειρές έρχονται από τον συγχρονισμό master data· οι υπόλοιπες λίστες φορτώνονται live με το κουμπί.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          {lookups.map((l) => (
            <div key={l.key}>
              <label style={S1_LABEL}>{l.label} <span style={{ fontWeight: 400 }}>({l.editor})</span></label>
              <SelectOrNumber value={values[l.key] ?? ""} onChange={(v) => setValues((m) => ({ ...m, [l.key]: v }))} options={optionsFor(l.editor)} />
              <LiveButton editor={l.editor} />
            </div>
          ))}
        </div>
      </div>

      <div style={S1_CARD}>
        <div>
          <h2 style={{ fontSize: "var(--fs-15)", fontWeight: 600, margin: 0 }}>ΦΠΑ % → VAT id</h2>
          <p style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)", margin: "4px 0 0" }}>Από τους συντελεστές που έχουν συγχρονιστεί ({initial.local.vat.length} ενεργοί). Αν η λίστα είναι κενή, τρέξτε πρώτα τον συγχρονισμό «Συντελεστές ΦΠΑ».</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {Object.keys(vatMap).map((pct) => (
            <div key={pct}>
              <label style={S1_LABEL}>ΦΠΑ {pct} %</label>
              <SelectOrNumber value={vatMap[pct]} onChange={(v) => setVatMap((m) => ({ ...m, [pct]: v }))} options={initial.local.vat.length ? initial.local.vat.map((v) => ({ value: v.s1Key, label: `${v.name} (${v.percent} %)` })) : null} />
            </div>
          ))}
        </div>
      </div>

      <div style={S1_CARD}>
        <div>
          <h2 style={{ fontSize: "var(--fs-15)", fontWeight: 600, margin: 0 }}>Μονάδα Orithon → MTRUNIT id</h2>
          <p style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)", margin: "4px 0 0" }}>Από τις μονάδες που έχουν συγχρονιστεί ({initial.local.unit.length} ενεργές).</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {Object.keys(unitMap).map((u) => (
            <div key={u}>
              <label style={{ ...S1_LABEL, display: "flex", justifyContent: "space-between" }}>{u}
                {!DEFAULT_UNIT_KEYS.includes(u) && <button type="button" onClick={() => setUnitMap((m) => { const c = { ...m }; delete c[u]; return c; })} title="Αφαίρεση" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)" }}><RiDeleteBinLine /></button>}
              </label>
              <SelectOrNumber value={unitMap[u]} onChange={(v) => setUnitMap((m) => ({ ...m, [u]: v }))} options={initial.local.unit.length ? initial.local.unit.map((x) => ({ value: x.s1Key, label: `${x.name}${x.shortcut ? ` (${x.shortcut})` : ""}` })) : null} />
            </div>
          ))}
          <div>
            <label style={S1_LABEL}>Νέα μονάδα</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="π.χ. χλμ." style={S1_INPUT} />
              <button type="button" onClick={() => { const k = newUnit.trim(); if (k && !(k in unitMap)) setUnitMap((m) => ({ ...m, [k]: "" })); setNewUnit(""); }} style={{ ...S1_BTN("ghost"), padding: "0 12px" }}><RiAddLine /></button>
            </div>
          </div>
        </div>
      </div>

      <div style={S1_CARD}>
        <div>
          <h2 style={{ fontSize: "var(--fs-15)", fontWeight: 600, margin: 0 }}>Προθέματα κωδικών</h2>
          <p style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)", margin: "4px 0 0" }}>Οι κωδικοί (CODE) στο SoftOne είναι σταθεροί και μοναδικοί (§6). Σχήμα προς συμφωνία με τον integrator (§11.4).</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          {([["codePrefixCustomer", "Πελάτες"], ["codePrefixSupplier", "Συνεργάτες"], ["codePrefixProject", "Έργα (κτήρια)"], ["codePrefixService", "Υπηρεσίες"]] as const).map(([k, label]) => (
            <div key={k}><label style={S1_LABEL}>{label}</label><input value={prefix[k]} onChange={(e) => setPrefix((p) => ({ ...p, [k]: e.target.value }))} style={{ ...S1_INPUT, fontFamily: "monospace" }} /></div>
          ))}
        </div>
      </div>

      <div style={S1_CARD}>
        <div>
          <h2 style={{ fontSize: "var(--fs-15)", fontWeight: 600, margin: 0 }}>Σταθερές (ορίζονται στον κώδικα)</h2>
          <p style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)", margin: "4px 0 0" }}>Τιμές που ορίζει το ίδιο το SoftOne — δεν χρειάζονται ρύθμιση.</p>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "var(--fs-12-5)" }}>
            <tbody>{CONSTANTS.map((c) => <tr key={c.label} style={{ borderBottom: "1px solid var(--border)" }}><td style={{ padding: "6px 8px" }}>{c.label}</td><td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 600 }}>{c.value}</td><td style={{ padding: "6px 8px", color: "var(--muted-foreground)" }}>{c.why}</td></tr>)}</tbody>
          </table>
        </div>
      </div>

      {error && <div style={{ fontSize: "var(--fs-13)", color: "var(--color-danger)", display: "flex", alignItems: "center", gap: 6 }}><RiErrorWarningLine size={15} /> {error}</div>}
      <div>
        <button type="submit" disabled={saving} style={{ ...S1_BTN("primary", saving), background: saved ? "var(--color-success)" : "var(--color-primary)" }}>
          {saved ? <RiCheckLine size={15} /> : <RiSaveLine size={15} />} {saving ? "Αποθήκευση..." : saved ? "Αποθηκεύτηκε!" : "Αποθήκευση"}
        </button>
      </div>
      <style>{`@keyframes s1spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </form>
  );
}
