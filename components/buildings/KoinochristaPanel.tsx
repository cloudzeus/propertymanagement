"use client";

import { useEffect, useState, useTransition } from "react";
import {
  RiLoaderLine, RiMailSendLine, RiWallet3Line, RiArrowRightSLine, RiArrowDownSLine,
  RiGroupLine, RiFileList3Line, RiFileTextLine, RiCheckboxCircleFill, RiMore2Fill,
  RiSecurePaymentLine, RiFileListLine,
} from "react-icons/ri";
import {
  listIssuances, getKoinochristaByPerson, listMonthExpenses, sendKoinochristaReminder,
  type IssuanceDTO, type KoinoPersonDTO, type MonthExpenseDTO,
} from "@/app/actions/koinochrista";
import { PersonStatementModal } from "./PersonStatementModal";

const eur = (n: number) => `${n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const GR_MONTHS = ["Ιανουαρίου", "Φεβρουαρίου", "Μαρτίου", "Απριλίου", "Μαΐου", "Ιουνίου", "Ιουλίου", "Αυγούστου", "Σεπτεμβρίου", "Οκτωβρίου", "Νοεμβρίου", "Δεκεμβρίου"];
function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return mo >= 1 && mo <= 12 ? `${GR_MONTHS[mo - 1]} ${y}` : m;
}
const fmtDate = (s: string | null) => { if (!s) return "—"; try { return new Date(s).toLocaleDateString("el-GR"); } catch { return "—"; } };

export function KoinochristaPanel({ buildingId }: { buildingId: string }) {
  const [issuances, setIssuances] = useState<IssuanceDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openMonth, setOpenMonth] = useState<string | null>(null);

  useEffect(() => {
    listIssuances(buildingId).then(setIssuances).catch((e) => setError(e instanceof Error ? e.message : "Σφάλμα"));
  }, [buildingId]);

  if (error) return <div style={{ fontSize: 13, color: "var(--color-danger)" }}>{error}</div>;
  if (!issuances) return <Loading />;

  const grand = issuances.reduce((a, i) => ({ total: a.total + i.total, paid: a.paid + i.paid, due: a.due + i.due }), { total: 0, paid: 0, due: 0 });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700 }}>
          <RiWallet3Line style={{ color: "var(--color-primary)" }} /> Εκδόσεις κοινοχρήστων
        </div>
        {issuances.length > 0 && (
          <div style={{ display: "flex", gap: 8 }}>
            <Stat label="Σύνολο" value={eur(grand.total)} />
            <Stat label="Πληρωμένα" value={eur(grand.paid)} tone="ok" />
            <Stat label="Ανεξόφλητα" value={eur(grand.due)} tone={grand.due > 0 ? "due" : undefined} />
          </div>
        )}
      </div>

      {issuances.length === 0 ? (
        <div style={empty}>Δεν υπάρχουν εκδόσεις κοινοχρήστων ακόμη.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {issuances.map((iss) => {
            const open = openMonth === iss.month;
            const pct = iss.total > 0 ? Math.round((iss.paid / iss.total) * 100) : 0;
            return (
              <div key={iss.month} style={{ border: "1px solid var(--border-strong)", borderRadius: 10, overflow: "hidden", background: "var(--bg-surface)" }}>
                <button onClick={() => setOpenMonth(open ? null : iss.month)} style={rowBtn}>
                  <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    {open ? <RiArrowDownSLine style={{ fontSize: 18 }} /> : <RiArrowRightSLine style={{ fontSize: 18 }} />}
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <b style={{ fontSize: 14 }}>{monthLabel(iss.month)}</b>
                        {iss.issued && <span style={issuedBadge}><RiCheckboxCircleFill style={{ fontSize: 12 }} /> Εκδόθηκε</span>}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{iss.expenseCount} έξοδα · {iss.personCount} πρόσωπα</span>
                    </span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 18 }}>
                    <span style={{ display: "none", gap: 16 }} className="koino-stats">
                      <Mini label="Σύνολο" value={eur(iss.total)} />
                      <Mini label="Πληρωμένα" value={eur(iss.paid)} color="#16a34a" />
                      <Mini label="Ανεξόφλητα" value={eur(iss.due)} color={iss.due > 0 ? "#b91c1c" : undefined} />
                    </span>
                    <span style={{ width: 130 }}>
                      <span style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted-foreground)", marginBottom: 3 }}>
                        <span>Εξόφληση</span><span>{pct}%</span>
                      </span>
                      <span style={progressTrack}><span style={{ ...progressFill, width: `${pct}%` }} /></span>
                    </span>
                  </span>
                </button>
                {open && <IssuanceDetail buildingId={buildingId} month={iss.month} onChanged={() => listIssuances(buildingId).then(setIssuances).catch(() => {})} />}
              </div>
            );
          })}
        </div>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}@media(min-width:900px){.koino-stats{display:flex !important}}`}</style>
    </div>
  );
}

function IssuanceDetail({ buildingId, month, onChanged }: { buildingId: string; month: string; onChanged?: () => void }) {
  const [tab, setTab] = useState<"people" | "expenses">("people");
  const [people, setPeople] = useState<KoinoPersonDTO[] | null>(null);
  const [expenses, setExpenses] = useState<MonthExpenseDTO[] | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [statementUser, setStatementUser] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const reloadPeople = () => getKoinochristaByPerson(buildingId, month).then(setPeople).catch(() => setPeople([]));
  useEffect(() => { reloadPeople(); /* eslint-disable-next-line */ }, [buildingId, month]);
  useEffect(() => { if (tab === "expenses" && !expenses) listMonthExpenses(buildingId, month).then(setExpenses).catch(() => setExpenses([])); }, [tab, expenses, buildingId, month]);

  function remind(p: KoinoPersonDTO) {
    if (!p.email) { alert("Ο παραλήπτης δεν έχει email."); return; }
    if (!confirm(`Αποστολή υπενθύμισης κοινοχρήστων ${monthLabel(month)} στον/στην ${p.name} (${p.email});`)) return;
    setSendingId(p.userId);
    startTransition(async () => {
      try { const r = await sendKoinochristaReminder(buildingId, month, p.userId); alert(`Στάλθηκε στο ${r.to}.`); }
      catch (e) { alert(e instanceof Error ? e.message : "Σφάλμα αποστολής"); }
      finally { setSendingId(null); }
    });
  }

  return (
    <div style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--bg-canvas)" }}>
      <div style={{ display: "flex", gap: 4, padding: "8px 12px 0" }}>
        <TabBtn active={tab === "people"} onClick={() => setTab("people")} icon={RiGroupLine} label="Πρόσωπα" />
        <TabBtn active={tab === "expenses"} onClick={() => setTab("expenses")} icon={RiFileList3Line} label="Έξοδα" />
      </div>

      <div style={{ padding: 12 }}>
        {tab === "people" ? (
          !people ? <Loading /> : people.length === 0 ? <div style={empty}>Καμία χρέωση.</div> : (
            <div style={{ overflowX: "auto" }}>
              <table style={tbl}>
                <thead><tr style={trHead}>
                  <th style={th}>Πρόσωπο</th><th style={th}>Μονάδες</th>
                  <th style={{ ...th, textAlign: "right" }}>Σύνολο</th><th style={{ ...th, textAlign: "right" }}>Πληρωμένα</th><th style={{ ...th, textAlign: "right" }}>Υπόλοιπο</th>
                  <th style={{ ...th, textAlign: "right" }}></th>
                </tr></thead>
                <tbody>
                  {people.map((p) => (
                    <tr key={p.userId} style={trBody}>
                      <td style={td}><div style={{ fontWeight: 600 }}>{p.name}</div><div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{p.email ?? "— χωρίς email —"}</div></td>
                      <td style={td}>{p.units.join(", ") || "—"}</td>
                      <td style={{ ...td, textAlign: "right" }}>{eur(p.total)}</td>
                      <td style={{ ...td, textAlign: "right", color: "#16a34a" }}>{eur(p.paid)}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700, color: p.due > 0 ? "#b91c1c" : "inherit" }}>{eur(p.due)}</td>
                      <td style={{ ...td, textAlign: "right", position: "relative" }}>
                        <button onClick={() => setMenuId(menuId === p.userId ? null : p.userId)} style={iconBtn} title="Ενέργειες">
                          {sendingId === p.userId ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiMore2Fill />}
                        </button>
                        {menuId === p.userId && (
                          <>
                            <div onClick={() => setMenuId(null)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                            <div style={menu}>
                              <button style={menuItem} onClick={() => { setStatementUser(p.userId); setMenuId(null); }}><RiSecurePaymentLine /> Πληρωμή</button>
                              <button style={menuItem} onClick={() => { setStatementUser(p.userId); setMenuId(null); }}><RiFileListLine /> Λεπτομέρειες</button>
                              <button style={menuItem} disabled={!p.email} onClick={() => { setMenuId(null); remind(p); }}><RiMailSendLine /> Υπενθύμιση</button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          !expenses ? <Loading /> : expenses.length === 0 ? <div style={empty}>Κανένα έξοδο.</div> : (
            <div style={{ overflowX: "auto" }}>
              <table style={tbl}>
                <thead><tr style={trHead}>
                  <th style={th}>Ημ/νία</th><th style={th}>Προμηθευτής</th><th style={th}>Κατηγορία</th>
                  <th style={{ ...th, textAlign: "right" }}>Ποσό</th><th style={th}>Παραστατικό</th>
                </tr></thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} style={trBody}>
                      <td style={td}>{fmtDate(e.documentDate)}</td>
                      <td style={td}>{e.supplier ?? "—"}</td>
                      <td style={td}>{e.category ?? "—"}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{eur(e.amount)}</td>
                      <td style={td}>{e.receiptUrl ? <a href={e.receiptUrl} target="_blank" rel="noreferrer" style={link}><RiFileTextLine /> Άνοιγμα</a> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
      {statementUser && (
        <PersonStatementModal
          open={!!statementUser}
          onClose={() => setStatementUser(null)}
          buildingId={buildingId}
          month={month}
          userId={statementUser}
          onChanged={() => { reloadPeople(); onChanged?.(); }}
        />
      )}
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600,
      border: "none", background: "transparent", cursor: "pointer",
      color: active ? "var(--color-primary)" : "var(--muted-foreground)",
      borderBottom: `2px solid ${active ? "var(--color-primary)" : "transparent"}`,
    }}><Icon /> {label}</button>
  );
}
function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "due" }) {
  const color = tone === "ok" ? "#16a34a" : tone === "due" ? "#b91c1c" : "var(--foreground)";
  return (
    <div style={{ border: "1px solid var(--border-strong)", borderRadius: 8, padding: "6px 12px", background: "var(--bg-surface)", minWidth: 110 }}>
      <div style={{ fontSize: 10, color: "var(--muted-foreground)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}
function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return <span style={{ textAlign: "right" }}><span style={{ display: "block", fontSize: 10, color: "var(--muted-foreground)" }}>{label}</span><span style={{ fontSize: 13, fontWeight: 700, color: color ?? "var(--foreground)" }}>{value}</span></span>;
}
function Loading() {
  return <div style={{ fontSize: 13, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 6, padding: 12 }}><RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> Φόρτωση…</div>;
}

const rowBtn: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%", padding: "12px 14px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", color: "var(--foreground)" };
const issuedBadge: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, color: "#16a34a", background: "color-mix(in srgb, #16a34a 12%, transparent)" };
const progressTrack: React.CSSProperties = { display: "block", height: 6, borderRadius: 999, background: "var(--border-subtle)", overflow: "hidden" };
const progressFill: React.CSSProperties = { display: "block", height: "100%", borderRadius: 999, background: "#16a34a" };
const empty: React.CSSProperties = { padding: 24, textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 };
const tbl: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const trHead: React.CSSProperties = { textAlign: "left", color: "var(--muted-foreground)", borderBottom: "1px solid var(--border-strong)" };
const trBody: React.CSSProperties = { borderBottom: "1px solid var(--border-subtle)" };
const th: React.CSSProperties = { padding: "8px 10px", fontWeight: 600, fontSize: 12 };
const td: React.CSSProperties = { padding: "8px 10px", verticalAlign: "middle" };
const link: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, color: "var(--color-primary)", textDecoration: "none", fontSize: 12 };
const iconBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 6, border: "1px solid var(--border-strong)", background: "var(--bg-canvas)", cursor: "pointer", color: "var(--foreground)", fontSize: 16 };
const menu: React.CSSProperties = { position: "absolute", right: 8, top: 38, zIndex: 41, minWidth: 180, background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.14)", padding: 4, display: "flex", flexDirection: "column" };
const menuItem: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--foreground)", textAlign: "left", width: "100%" };
