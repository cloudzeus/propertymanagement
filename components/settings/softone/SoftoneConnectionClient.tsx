"use client";

import { useState, useTransition } from "react";
import { RiSaveLine, RiCheckLine, RiEyeLine, RiEyeOffLine, RiPencilLine, RiDatabase2Line, RiServerLine, RiErrorWarningLine, RiPlugLine, RiLoader4Line, RiCheckboxCircleLine, RiCloseCircleLine, RiShieldKeyholeLine } from "react-icons/ri";
import { saveSoftoneConnection, testSoftoneConnection, type SoftoneConnectionView } from "@/app/actions/softone";
import type { ConnectionTest } from "@/lib/softone/client";
import { S1_LABEL, S1_INPUT, S1_CARD, S1_BTN, fmtDate } from "./SoftoneHeader";

const FIELDS: { key: "serial" | "username" | "appId" | "company" | "branch" | "module" | "refid"; label: string; hint: string; placeholder?: string }[] = [
  { key: "serial", label: "Serial / subdomain oncloud", hint: "Το όνομα πριν το .oncloud.gr — π.χ. «orithon» → https://orithon.oncloud.gr/s1services", placeholder: "orithon" },
  { key: "username", label: "Username (Web Account)", hint: "Αποκλειστικός λογαριασμός Web Services (π.χ. orithon-api)" },
  { key: "appId", label: "APPID", hint: "≥ 1000, από SoftOne → Web & Mobile → Web Services", placeholder: "1001" },
  { key: "company", label: "COMPANY", hint: "Κωδικός εταιρείας στο SoftOne", placeholder: "1000" },
  { key: "branch", label: "BRANCH", hint: "Υποκατάστημα (συνήθως 1000)", placeholder: "1000" },
  { key: "module", label: "MODULE", hint: "0 = Εμπορικό", placeholder: "0" },
  { key: "refid", label: "REFID", hint: "Ο χρήστης SoftOne που «υπογράφει» τις εγγραφές", placeholder: "1" },
];

export function SoftoneConnectionClient({ initial }: { initial: SoftoneConnectionView }) {
  const [form, setForm] = useState({ serial: initial.serial, username: initial.username, appId: initial.appId, company: initial.company, branch: initial.branch, module: initial.module, refid: initial.refid });
  const [enabled, setEnabled] = useState(initial.enabled);
  const [syncEnabled, setSyncEnabled] = useState(initial.syncEnabled);
  const [syncHour, setSyncHour] = useState(initial.syncHour);
  const [pwEditing, setPwEditing] = useState(!initial.hasPassword);
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<ConnectionTest | null>(null);
  const [source, setSource] = useState(initial.source);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function onSave(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    startSave(async () => {
      const r = await saveSoftoneConnection({ ...form, enabled, syncEnabled, syncHour, password: pwEditing ? password : undefined });
      if ("error" in r) { setError(r.error); return; }
      setSaved(true); setTimeout(() => setSaved(false), 2500);
      if (pwEditing && password) setPwEditing(false);
      setSource(enabled && form.serial && form.username && (pwEditing ? !!password : initial.hasPassword) ? "db" : initial.envComplete ? "env" : null);
    });
  }

  function onTest() {
    setTest(null); setError(null);
    startTest(async () => {
      try { setTest(await testSoftoneConnection({ ...form, password: pwEditing && password ? password : undefined })); }
      catch (e) { setTest({ ok: false, message: e instanceof Error ? e.message : String(e), companies: [] }); }
    });
  }

  const sourceLabel = source === "db" ? "Βάση δεδομένων (DB)" : source === "env" ? "Μεταβλητές περιβάλλοντος (ENV)" : "Μη ρυθμισμένο";
  const SourceIcon = source === "db" ? RiDatabase2Line : source === "env" ? RiServerLine : RiErrorWarningLine;
  const sourceColor = source === "db" ? "var(--color-success)" : source === "env" ? "var(--color-warning)" : "var(--color-danger)";

  return (
    <form onSubmit={onSave} style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 860 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--card)", flexWrap: "wrap" }}>
        <SourceIcon size={18} style={{ color: sourceColor }} />
        <div style={{ fontSize: "var(--fs-13)" }}>Ενεργή πηγή ρύθμισης: <strong style={{ color: sourceColor }}>{sourceLabel}</strong></div>
        <span style={{ marginLeft: "auto", fontSize: "var(--fs-11)", color: "var(--muted-foreground)" }}>DB-first · fallback σε SOFTONE_* / S1_* env</span>
      </div>

      {!initial.encryptionReady && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 14px", borderRadius: 8, background: "color-mix(in srgb, var(--color-warning) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)", color: "var(--color-warning)", fontSize: "var(--fs-12-5)" }}>
          <RiShieldKeyholeLine style={{ marginTop: 2, flexShrink: 0 }} />
          <span>Δεν έχει οριστεί <code>SECRETS_ENCRYPTION_KEY</code> σε αυτόν τον server: η αποθήκευση κωδικού θα αποτύχει. Η «Δοκιμή σύνδεσης» δουλεύει κανονικά με τον κωδικό που πληκτρολογείτε.</span>
        </div>
      )}

      <div style={S1_CARD}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: "var(--fs-15)", fontWeight: 600, margin: 0 }}>Στοιχεία Web Services</h2>
            <p style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)", margin: "4px 0 0" }}>Το SoftOne της Orithon (oncloud). Ροή: login → authenticate· το clientID επαναχρησιμοποιείται όλη την ημέρα.</p>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <span style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--muted-foreground)" }}>Διασύνδεση ενεργή</span>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--color-primary)" }} />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label style={S1_LABEL}>{f.label}</label>
              <input value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} autoComplete="off" inputMode={["company", "branch", "module", "refid", "appId"].includes(f.key) ? "numeric" : undefined} style={S1_INPUT} />
              <div style={{ fontSize: "var(--fs-11)", color: "var(--muted-foreground)", marginTop: 4 }}>{f.hint}</div>
            </div>
          ))}
          <div>
            <label style={S1_LABEL}>Password (Web Account)</label>
            {initial.hasPassword && !pwEditing ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ ...S1_INPUT, flex: 1, fontFamily: "monospace", color: "var(--muted-foreground)", background: "var(--card)", display: "flex", alignItems: "center" }}>{initial.passwordMask ?? "••••"}</span>
                <button type="button" onClick={() => setPwEditing(true)} style={S1_BTN("ghost")}><RiPencilLine size={14} /> Αλλαγή</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type={reveal ? "text" : "password"} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={initial.hasPassword ? "Κενό = διαγραφή" : "—"} style={{ ...S1_INPUT, flex: 1, fontFamily: "monospace" }} />
                <button type="button" onClick={() => setReveal((r) => !r)} title={reveal ? "Απόκρυψη" : "Εμφάνιση"} style={{ ...S1_BTN("ghost"), padding: "0 10px" }}>{reveal ? <RiEyeOffLine size={15} /> : <RiEyeLine size={15} />}</button>
              </div>
            )}
            <div style={{ fontSize: "var(--fs-11)", color: "var(--muted-foreground)", marginTop: 4 }}>Αποθηκεύεται κρυπτογραφημένος (AES-256-GCM)· δεν εμφανίζεται ποτέ ολόκληρος, δεν καταγράφεται.</div>
          </div>
        </div>
      </div>

      <div style={S1_CARD}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: "var(--fs-15)", fontWeight: 600, margin: 0 }}>Αυτόματος συγχρονισμός master data</h2>
            <p style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)", margin: "4px 0 0" }}>Καθημερινή εργασία (ΦΠΑ, μονάδες, ΔΟΥ, σειρές, νομοί, ΤΚ) μέσα από την εφαρμογή — βλ. Ρυθμίσεις → Αυτόματες εργασίες. Τρέχει μόνο αν η διασύνδεση είναι ενεργή και η δοκιμή σύνδεσης περνά.</p>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <span style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--muted-foreground)" }}>Ενεργός</span>
            <input type="checkbox" checked={syncEnabled} onChange={(e) => setSyncEnabled(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--color-primary)" }} />
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          <div>
            <label style={S1_LABEL}>Ώρα εκτέλεσης (Ελλάδας)</label>
            <select value={syncHour} onChange={(e) => setSyncHour(Number(e.target.value))} style={S1_INPUT}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>μετά τις {String(h).padStart(2, "0")}:00</option>)}
            </select>
          </div>
          <div>
            <label style={S1_LABEL}>Τελευταίος συγχρονισμός</label>
            <div style={{ fontSize: "var(--fs-13)", minHeight: 38, display: "flex", alignItems: "center" }}>{fmtDate(initial.lastMasterSyncAt)}</div>
          </div>
        </div>
      </div>

      {error && <div style={{ fontSize: "var(--fs-13)", color: "var(--color-danger)", display: "flex", alignItems: "center", gap: 6 }}><RiErrorWarningLine size={15} /> {error}</div>}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="submit" disabled={saving} style={{ ...S1_BTN("primary", saving), background: saved ? "var(--color-success)" : "var(--color-primary)" }}>
          {saved ? <RiCheckLine size={15} /> : <RiSaveLine size={15} />} {saving ? "Αποθήκευση..." : saved ? "Αποθηκεύτηκε!" : "Αποθήκευση"}
        </button>
        <button type="button" onClick={onTest} disabled={testing} style={S1_BTN("ghost", testing)}>
          {testing ? <RiLoader4Line style={{ animation: "s1spin 1s linear infinite" }} /> : <RiPlugLine size={15} />} {testing ? "Δοκιμή..." : "Δοκιμή σύνδεσης"}
        </button>
      </div>

      {(test || initial.lastPingAt) && (
        <div style={{ ...S1_CARD, borderColor: test ? (test.ok ? "color-mix(in srgb, var(--color-success) 38%, transparent)" : "color-mix(in srgb, var(--color-danger) 38%, transparent)") : "var(--border)" }}>
          {test ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--fs-14)", fontWeight: 700, color: test.ok ? "var(--color-success)" : "var(--color-danger)" }}>
                {test.ok ? <RiCheckboxCircleLine /> : <RiCloseCircleLine />} {test.message}
              </div>
              {!test.ok && (
                <div style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)" }}>
                  Βήμα: <strong>{test.step ?? "—"}</strong>{test.errorcode != null && <> · κωδικός σφάλματος <strong>{test.errorcode}</strong></>}
                  {test.errorcode === 101 && " — ελέγξτε τα δικαιώματα του Web Account στο SoftOne."}
                  {(test.errorcode === -100 || test.errorcode === -101) && " — η συνεδρία έληξε· η εφαρμογή επαναλαμβάνει login → authenticate αυτόματα."}
                  {test.step === "login" && test.errorcode == null && " — ελέγξτε serial, username, κωδικό και APPID."}
                  {test.step === "authenticate" && " — ελέγξτε COMPANY / BRANCH / MODULE / REFID (δείτε τις διαθέσιμες εταιρείες στο login)."}
                </div>
              )}
              {test.companies.length > 0 && (
                <div>
                  <div style={{ ...S1_LABEL, marginBottom: 8 }}>Εταιρείες / υποκαταστήματα που επιστρέφει το login</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "var(--fs-12-5)" }}>
                      <thead><tr>{["COMPANY", "Εταιρεία", "BRANCH", "Υποκατάστημα", "MODULE", "REFID", "Χρήστης"].map((h) => <th key={h} style={{ textAlign: "left", padding: "6px 10px", borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {test.companies.map((c, i) => {
                          const sel = test.selected === c;
                          return (
                            <tr key={i} style={{ background: sel ? "color-mix(in srgb, var(--color-success) 8%, transparent)" : undefined }}>
                              <td style={{ padding: "6px 10px" }}>{String(c.COMPANY ?? "")}</td><td style={{ padding: "6px 10px" }}>{String(c.COMPANYNAME ?? "")}</td>
                              <td style={{ padding: "6px 10px" }}>{String(c.BRANCH ?? "")}</td><td style={{ padding: "6px 10px" }}>{String(c.BRANCHNAME ?? "")}</td>
                              <td style={{ padding: "6px 10px" }}>{String(c.MODULE ?? "")}{c.MODULENAME ? ` · ${c.MODULENAME}` : ""}</td>
                              <td style={{ padding: "6px 10px" }}>{String(c.REFID ?? "")}</td><td style={{ padding: "6px 10px" }}>{String(c.REFIDNAME ?? "")}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 8 }}>
              {initial.lastPingOk ? <RiCheckboxCircleLine style={{ color: "var(--color-success)" }} /> : <RiCloseCircleLine style={{ color: "var(--color-danger)" }} />}
              Τελευταία δοκιμή {fmtDate(initial.lastPingAt)}: {initial.lastPingMessage}
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes s1spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </form>
  );
}
