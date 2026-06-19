"use client";

import { useEffect, useState, useTransition } from "react";
import { RiLoaderLine, RiMailSendLine, RiWallet3Line } from "react-icons/ri";
import { getKoinochristaByPerson, listExpenseMonths, sendKoinochristaReminder, type KoinoPersonDTO } from "@/app/actions/koinochrista";

const eur = (n: number) => `${n.toFixed(2)} €`;

export function KoinochristaPanel({ buildingId }: { buildingId: string }) {
  const [months, setMonths] = useState<string[] | null>(null);
  const [month, setMonth] = useState<string>("");
  const [people, setPeople] = useState<KoinoPersonDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    listExpenseMonths(buildingId)
      .then((m) => { setMonths(m); if (m.length) setMonth(m[0]); else setPeople([]); })
      .catch((e) => setError(e instanceof Error ? e.message : "Σφάλμα"));
  }, [buildingId]);

  useEffect(() => {
    if (!month) return;
    setPeople(null);
    getKoinochristaByPerson(buildingId, month)
      .then(setPeople)
      .catch((e) => setError(e instanceof Error ? e.message : "Σφάλμα"));
  }, [buildingId, month]);

  function remind(p: KoinoPersonDTO) {
    if (!p.email) { alert("Ο παραλήπτης δεν έχει email."); return; }
    if (!confirm(`Αποστολή υπενθύμισης κοινοχρήστων ${month} στον/στην ${p.name} (${p.email});`)) return;
    setSendingId(p.userId);
    startTransition(async () => {
      try { const r = await sendKoinochristaReminder(buildingId, month, p.userId); alert(`Στάλθηκε στο ${r.to}.`); }
      catch (e) { alert(e instanceof Error ? e.message : "Σφάλμα αποστολής"); }
      finally { setSendingId(null); }
    });
  }

  if (error) return <div style={{ fontSize: 13, color: "var(--color-danger)" }}>{error}</div>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 6 }}>
          <RiWallet3Line /> Κοινόχρηστα ανά πρόσωπο
        </div>
        {months && months.length > 0 && (
          <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            Μήνας:
            <select value={month} onChange={(e) => setMonth(e.target.value)} style={{ height: 34, padding: "0 10px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "var(--bg-canvas)", fontSize: 13 }}>
              {months.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
        )}
      </div>

      {months && months.length === 0 ? (
        <div style={empty}>Δεν υπάρχουν έξοδα για έκδοση κοινοχρήστων.</div>
      ) : !people ? (
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 6 }}><RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> Φόρτωση…</div>
      ) : people.length === 0 ? (
        <div style={empty}>Καμία χρέωση για τον μήνα {month}.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted-foreground)", borderBottom: "1px solid var(--border-strong)" }}>
                <th style={th}>Πρόσωπο</th>
                <th style={th}>Μονάδες</th>
                <th style={{ ...th, textAlign: "right" }}>Σύνολο</th>
                <th style={{ ...th, textAlign: "right" }}>Πληρωμένα</th>
                <th style={{ ...th, textAlign: "right" }}>Υπόλοιπο</th>
                <th style={{ ...th, textAlign: "right" }}>Ενέργειες</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.userId} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td style={td}><div style={{ fontWeight: 600 }}>{p.name}</div><div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{p.email ?? "— χωρίς email —"}</div></td>
                  <td style={td}>{p.units.join(", ") || "—"}</td>
                  <td style={{ ...td, textAlign: "right" }}>{eur(p.total)}</td>
                  <td style={{ ...td, textAlign: "right", color: "#16a34a" }}>{eur(p.paid)}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: p.due > 0 ? "#b91c1c" : "inherit" }}>{eur(p.due)}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <button onClick={() => remind(p)} disabled={!p.email || sendingId === p.userId} style={btnRemind}>
                      {sendingId === p.userId ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiMailSendLine />} Υπενθύμιση
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const th: React.CSSProperties = { padding: "8px 10px", fontWeight: 600, fontSize: 12 };
const td: React.CSSProperties = { padding: "8px 10px", verticalAlign: "middle" };
const empty: React.CSSProperties = { padding: 28, textAlign: "center", color: "var(--muted-foreground)", fontSize: 13, border: "1px dashed var(--border-strong)", borderRadius: 8 };
const btnRemind: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", borderRadius: 6, border: "1px solid var(--color-primary)", background: "var(--color-primary)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" };
