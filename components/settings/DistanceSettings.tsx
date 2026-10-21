"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RiMapPin2Line, RiErrorWarningLine, RiSaveLine, RiCheckLine, RiAddLine, RiDeleteBinLine, RiRefreshLine, RiLoader4Line, RiExternalLinkLine,
} from "react-icons/ri";
import { PropertyMap } from "@/components/maps/PropertyMap";
import { geocodeCompanyAddress } from "@/app/actions/company-profile";
import { saveDistanceZones, recomputeAllDistances, type DistanceOverview } from "@/app/actions/distance-settings";
import { MAX_ZONES, type DistanceZone } from "@/lib/distance/zones";

const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 18, display: "flex", flexDirection: "column", gap: 12 };
const h2: React.CSSProperties = { fontSize: "var(--fs-15)", fontWeight: 700, margin: 0, color: "var(--foreground)", display: "flex", alignItems: "center", gap: 8 };
const muted: React.CSSProperties = { fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)" };
const input: React.CSSProperties = { width: "100%", padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: "var(--fs-13)", color: "var(--foreground)", background: "var(--bg-canvas)", outline: "none", boxSizing: "border-box", minHeight: 36 };
const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: "var(--fs-12-5)", fontWeight: 600, color: "var(--foreground)", minHeight: 40 };
const btnPrimary: React.CSSProperties = { ...btn, background: "var(--color-primary)", color: "#fff", border: "1px solid var(--color-primary)" };
const th: React.CSSProperties = { textAlign: "left", fontSize: "var(--fs-11)", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted-foreground)", padding: "4px 6px" };
const td: React.CSSProperties = { padding: "4px 6px", verticalAlign: "middle" };

const GREEK = ["Α", "Β", "Γ", "Δ", "Ε", "Ζ", "Η", "Θ"];
const LATIN = ["A", "B", "C", "D", "E", "F", "G", "H"];

type Row = { code: string; label: string; maxKm: string; travelFee: string };
const toRows = (z: DistanceZone[]): Row[] => z.map((x) => ({ code: x.code, label: x.label, maxKm: x.maxKm == null ? "" : String(x.maxKm), travelFee: String(x.travelFee) }));

const fmtDT = (iso: string | null) => (iso ? new Date(iso).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" }) : "—");

export function DistanceSettings({ overview, canEdit }: { overview: DistanceOverview; canEdit: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(toRows(overview.zones));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [recalc, setRecalc] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [geoPending, startGeo] = useTransition();
  const [recPending, startRec] = useTransition();

  const setRow = (i: number, patch: Partial<Row>) => setRows((p) => p.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const removeRow = (i: number) => setRows((p) => p.filter((_, j) => j !== i));
  const addRow = () => setRows((p) => {
    if (p.length >= MAX_ZONES) return p;
    const used = new Set(p.map((r) => r.code));
    const idx = LATIN.findIndex((c) => !used.has(c));
    const code = idx >= 0 ? LATIN[idx] : `Z${p.length + 1}`;
    const label = idx >= 0 ? `Ζώνη ${GREEK[idx]}` : `Ζώνη ${p.length + 1}`;
    // insert before the open last zone
    return [...p.slice(0, -1), { code, label, maxKm: "", travelFee: "0" }, p[p.length - 1]];
  });

  function save() {
    setError(null); setSaved(false);
    start(async () => {
      const r = await saveDistanceZones(rows.map((x) => ({ code: x.code, label: x.label, maxKm: x.maxKm === "" ? null : Number(x.maxKm.replace(",", ".")), travelFee: Number(x.travelFee.replace(",", ".")) || 0 })));
      if ("error" in r) setError(r.error); else { setSaved(true); router.refresh(); }
    });
  }

  function geocode() {
    if (!overview.companyId) return;
    setGeoMsg(null);
    startGeo(async () => {
      const r = await geocodeCompanyAddress(overview.companyId!);
      setGeoMsg("error" in r ? r.error! : "Οι συντεταγμένες της έδρας ενημερώθηκαν.");
      router.refresh();
    });
  }

  function recompute() {
    setRecalc(null);
    startRec(async () => {
      const r = await recomputeAllDistances();
      setRecalc("error" in r ? r.error : `Ενημερώθηκαν ${r.result.updated} κτήρια (${r.result.estimated} κατ' εκτίμηση, ${r.result.skipped} εκτός ορίου/χωρίς στίγμα).`);
      router.refresh();
    });
  }

  const base = overview.base;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Base station */}
      <section style={card}>
        <h2 style={h2}><RiMapPin2Line style={{ color: "var(--color-primary)" }} /> Σταθμός βάσης</h2>
        {base ? (
          <>
            <div style={{ fontSize: "var(--fs-13)", color: "var(--foreground)" }}>{base.address || "Έδρα εταιρείας"} <span style={muted}>· {base.lat.toFixed(5)}, {base.lng.toFixed(5)}</span></div>
            <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}><PropertyMap lat={base.lat} lng={base.lng} name="Σταθμός βάσης" zoom={13} height={220} /></div>
          </>
        ) : (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: "var(--fs-13)", color: "var(--color-warning)", background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px" }}>
            <RiErrorWarningLine style={{ marginTop: 2, flexShrink: 0 }} /> Δεν έχει οριστεί σταθμός βάσης — οι αποστάσεις και οι χρεώσεις ζώνης δεν υπολογίζονται. Συμπληρώστε τη διεύθυνση της εταιρείας και πατήστε «Geocode από τη διεύθυνση».
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {canEdit && (
            <button type="button" style={btn} disabled={geoPending || !overview.companyId} onClick={geocode}>
              {geoPending ? <RiLoader4Line className="spin" /> : <RiMapPin2Line />} Geocode από τη διεύθυνση
            </button>
          )}
          <Link href="/super-admin/settings/company" style={{ ...btn, textDecoration: "none" }}><RiExternalLinkLine /> Αλλαγή διεύθυνσης</Link>
          {geoMsg && <span style={muted}>{geoMsg}</span>}
        </div>
        <p style={{ ...muted, margin: 0 }}>Η βάση είναι η διεύθυνση της εταιρείας (Ρυθμίσεις → Εταιρία). Όταν αλλάξει, όλες οι αποστάσεις σημαίνονται «προς επανυπολογισμό» και ξαναμετριούνται από τη νυχτερινή εργασία ή με το κουμπί παρακάτω.</p>
      </section>

      {/* Zones */}
      <section style={card}>
        <h2 style={h2}>Ζώνες απόστασης</h2>
        <p style={{ ...muted, margin: 0 }}>Κάθε κτήριο ανήκει στην πρώτη ζώνη της οποίας το όριο καλύπτει την οδική του απόσταση. Η τελευταία ζώνη είναι ανοιχτή. Η «χρέωση μετάβασης» μπαίνει ως γραμμή στις προσφορές προς τον πελάτη· οι ίδιες ζώνες τιμολογούν τις υπηρεσίες «ανά ζώνη» και την αυτοψία των συνεργατών.</p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
            <thead><tr><th style={th}>Κωδ.</th><th style={th}>Όνομα</th><th style={th}>Έως km</th><th style={th}>Χρέωση μετάβασης (€ καθ.)</th><th style={th}></th></tr></thead>
            <tbody>
              {rows.map((r, i) => {
                const last = i === rows.length - 1;
                return (
                  <tr key={r.code}>
                    <td style={{ ...td, width: 60, fontWeight: 700, fontSize: "var(--fs-13)" }}>{r.code}</td>
                    <td style={td}><input style={input} value={r.label} disabled={!canEdit} onChange={(e) => setRow(i, { label: e.target.value })} /></td>
                    <td style={{ ...td, width: 130 }}>
                      {last ? <span style={{ ...muted, fontStyle: "italic" }}>και άνω</span> : <input style={input} type="number" min={0} step="0.1" value={r.maxKm} disabled={!canEdit} onChange={(e) => setRow(i, { maxKm: e.target.value })} />}
                    </td>
                    <td style={{ ...td, width: 190 }}><input style={input} type="number" min={0} step="0.01" value={r.travelFee} disabled={!canEdit} onChange={(e) => setRow(i, { travelFee: e.target.value })} /></td>
                    <td style={{ ...td, width: 44 }}>
                      {canEdit && rows.length > 1 && !last && (
                        <button type="button" title="Αφαίρεση ζώνης" onClick={() => removeRow(i)} style={{ ...btn, padding: "6px 8px", color: "var(--color-danger)" }}><RiDeleteBinLine /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" style={btn} onClick={addRow} disabled={rows.length >= MAX_ZONES}><RiAddLine /> Προσθήκη ζώνης</button>
            <button type="button" style={btnPrimary} onClick={save} disabled={pending}>{pending ? <RiLoader4Line className="spin" /> : saved ? <RiCheckLine /> : <RiSaveLine />} Αποθήκευση</button>
            {error && <span style={{ fontSize: "var(--fs-12-5)", color: "var(--color-danger)" }}>{error}</span>}
            {saved && !error && <span style={{ fontSize: "var(--fs-12-5)", color: "var(--color-success)" }}>Αποθηκεύτηκε.</span>}
          </div>
        )}
      </section>

      {/* Status */}
      <section style={card}>
        <h2 style={h2}>Κατάσταση αποστάσεων</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {overview.perZone.map((z) => (
            <span key={z.code} style={{ fontSize: "var(--fs-12-5)", padding: "4px 10px", borderRadius: 999, background: "var(--paper)", border: "1px solid var(--border)" }}>{z.label}: <b>{z.count}</b></span>
          ))}
          <span style={{ fontSize: "var(--fs-12-5)", padding: "4px 10px", borderRadius: 999, background: "var(--paper)", border: "1px solid var(--border)" }}>Χωρίς απόσταση: <b>{overview.missing}</b></span>
          <span style={{ fontSize: "var(--fs-12-5)", padding: "4px 10px", borderRadius: 999, background: "var(--paper)", border: "1px solid var(--border)" }}>Κατ' εκτίμηση: <b>{overview.estimated}</b></span>
          <span style={{ fontSize: "var(--fs-12-5)", padding: "4px 10px", borderRadius: 999, background: "var(--paper)", border: "1px solid var(--border)" }}>Προς επανυπολογισμό: <b>{overview.stale}</b></span>
        </div>
        <div style={muted}>{overview.total} κτήρια συνολικά · τελευταίος υπολογισμός: {fmtDT(overview.lastComputedAt)}</div>
        {canEdit && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" style={btn} onClick={recompute} disabled={recPending || !base}>{recPending ? <RiLoader4Line className="spin" /> : <RiRefreshLine />} Επανυπολογισμός όλων</button>
            {recalc && <span style={muted}>{recalc}</span>}
          </div>
        )}
        <p style={{ ...muted, margin: 0 }}>Η οδική απόσταση έρχεται από δωρεάν routing API (1 κλήση/δευτ., με cache)· όταν το API δεν απαντά, κρατιέται εκτίμηση (ευθεία × 1,3) που ξαναδοκιμάζεται από την εργασία «Αποστάσεις από τη βάση» κάθε νύχτα.</p>
      </section>
      <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
