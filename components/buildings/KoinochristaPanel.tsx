"use client";

import { useEffect, useState, useTransition } from "react";
import {
  RiLoaderLine, RiMailSendLine, RiWallet3Line, RiArrowRightSLine, RiArrowDownSLine,
  RiGroupLine, RiFileList3Line, RiFileTextLine, RiCheckboxCircleFill, RiMore2Fill,
  RiSecurePaymentLine, RiFileListLine, RiCalendarEventLine,
} from "react-icons/ri";
import {
  listIssuances, getKoinochristaByPerson, listMonthExpenses, sendKoinochristaReminder,
  type IssuanceDTO, type KoinoPersonDTO, type MonthExpenseDTO,
} from "@/app/actions/koinochrista";
import { PersonStatementModal } from "./PersonStatementModal";
import type { BuildingCaps } from "@/lib/building-caps";

const eur = (n: number) => `${n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const GR_MONTHS = ["Ιανουαρίου", "Φεβρουαρίου", "Μαρτίου", "Απριλίου", "Μαΐου", "Ιουνίου", "Ιουλίου", "Αυγούστου", "Σεπτεμβρίου", "Οκτωβρίου", "Νοεμβρίου", "Δεκεμβρίου"];
function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return mo >= 1 && mo <= 12 ? `${GR_MONTHS[mo - 1]} ${y}` : m;
}
const fmtDate = (s: string | null) => { if (!s) return "—"; try { return new Date(s).toLocaleDateString("el-GR"); } catch { return "—"; } };
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "—";

// Scoped stylesheet for hover/transition micro-interactions (Fluent 2 motion).
const CSS = `
@keyframes kx-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes kx-in{from{opacity:0;transform:translateY(-2px)}to{opacity:1;transform:translateY(0)}}
.kx{ --kx-ease:cubic-bezier(0.33,0,0.67,1); }
.kx-num{ font-variant-numeric:tabular-nums; }
.kx-card{ border:1px solid var(--border-strong); border-radius:10px; background:var(--card); transition:box-shadow .15s var(--kx-ease),border-color .15s var(--kx-ease); }
.kx-card:hover{ border-color:color-mix(in srgb,var(--color-primary) 35%,var(--border-strong)); box-shadow:0 1px 2px rgba(0,0,0,.06),0 4px 12px rgba(0,0,0,.06); }
.kx-card[data-open="true"]{ box-shadow:0 1px 2px rgba(0,0,0,.06),0 8px 24px rgba(0,0,0,.08); }
.kx-rowbtn{ display:flex;align-items:center;justify-content:space-between;gap:14px;width:100%;padding:14px 16px;border:none;background:transparent;cursor:pointer;text-align:left;color:var(--foreground); }
.kx-chev{ display:grid;place-items:center;width:24px;height:24px;border-radius:6px;color:var(--muted-foreground);transition:background .15s var(--kx-ease),color .15s var(--kx-ease); }
.kx-rowbtn:hover .kx-chev{ background:color-mix(in srgb,var(--color-primary) 10%,transparent);color:var(--color-primary); }
.kx-trow{ transition:background .12s var(--kx-ease); }
.kx-trow:hover{ background:color-mix(in srgb,var(--color-primary) 5%,transparent); }
.kx-menuitem{ display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:7px;border:none;background:transparent;cursor:pointer;font-size:13px;color:var(--foreground);text-align:left;width:100%;transition:background .12s var(--kx-ease); }
.kx-menuitem:hover:not(:disabled){ background:color-mix(in srgb,var(--color-primary) 10%,transparent); }
.kx-menuitem:disabled{ opacity:.45;cursor:not-allowed; }
.kx-menuitem .kx-mi{ color:var(--muted-foreground);font-size:16px; }
.kx-tab{ position:relative;display:inline-flex;align-items:center;gap:7px;padding:7px 14px;font-size:13px;font-weight:600;border:none;background:transparent;cursor:pointer;border-radius:7px;color:var(--muted-foreground);transition:color .12s var(--kx-ease),background .12s var(--kx-ease); }
.kx-tab:hover{ color:var(--foreground); }
.kx-tab[data-active="true"]{ color:var(--color-primary);background:color-mix(in srgb,var(--color-primary) 12%,transparent); }
.kx-fill{ transition:width .4s var(--kx-ease); }
.kx-icon-btn{ display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:7px;border:1px solid var(--border-strong);background:var(--bg-canvas);cursor:pointer;color:var(--foreground);font-size:16px;transition:background .12s var(--kx-ease),border-color .12s var(--kx-ease); }
.kx-icon-btn:hover{ border-color:var(--color-primary);color:var(--color-primary); }
.kx-remind{ display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:7px;border:1px solid var(--color-primary);background:var(--color-primary);color:#fff;font-size:12px;font-weight:600;cursor:pointer;transition:filter .12s var(--kx-ease); }
.kx-remind:hover:not(:disabled){ filter:brightness(1.06); }
.kx-menu{ animation:kx-in .12s var(--kx-ease); }
`;

export function KoinochristaPanel({ buildingId, can }: { buildingId: string; can: BuildingCaps }) {
  const [issuances, setIssuances] = useState<IssuanceDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openMonth, setOpenMonth] = useState<string | null>(null);

  const reload = () => listIssuances(buildingId).then(setIssuances).catch(() => {});
  useEffect(() => { listIssuances(buildingId).then(setIssuances).catch((e) => setError(e instanceof Error ? e.message : "Σφάλμα")); }, [buildingId]);

  if (error) return <div style={{ fontSize: 13, color: "var(--color-danger)" }}>{error}</div>;
  if (!issuances) return <Loading />;

  const grand = issuances.reduce((a, i) => ({ total: a.total + i.total, paid: a.paid + i.paid, due: a.due + i.due }), { total: 0, paid: 0, due: 0 });

  return (
    <div className="kx">
      <style>{CSS}</style>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 10, background: "color-mix(in srgb, var(--color-primary) 14%, transparent)", color: "var(--color-primary)" }}>
            <RiWallet3Line style={{ fontSize: 20 }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>Κοινόχρηστα</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Εκδόσεις, ανάλυση & εξόφληση ανά μήνα</div>
          </div>
        </div>
        {issuances.length > 0 && (
          <div style={{ display: "flex", gap: 10 }}>
            <Stat label="Σύνολο" value={eur(grand.total)} />
            <Stat label="Πληρωμένα" value={eur(grand.paid)} tone="ok" />
            <Stat label="Ανεξόφλητα" value={eur(grand.due)} tone={grand.due > 0 ? "due" : undefined} />
          </div>
        )}
      </div>

      {issuances.length === 0 ? (
        <Empty icon={RiCalendarEventLine} text="Δεν υπάρχουν εκδόσεις κοινοχρήστων ακόμη." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {issuances.map((iss) => {
            const open = openMonth === iss.month;
            const pct = iss.total > 0 ? Math.round((iss.paid / iss.total) * 100) : 0;
            const fillColor = pct >= 100 ? "#16a34a" : pct >= 50 ? "var(--color-primary)" : "#f59e0b";
            return (
              <div key={iss.month} className="kx-card" data-open={open}>
                <button onClick={() => setOpenMonth(open ? null : iss.month)} className="kx-rowbtn">
                  <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <span className="kx-chev">{open ? <RiArrowDownSLine style={{ fontSize: 18 }} /> : <RiArrowRightSLine style={{ fontSize: 18 }} />}</span>
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <b style={{ fontSize: 15, letterSpacing: "-0.01em" }}>{monthLabel(iss.month)}</b>
                        {iss.issued && <span style={dotBadge("#16a34a")}><span style={dot("#16a34a")} /> Εκδόθηκε</span>}
                        {iss.unallocated > 0 && <span style={dotBadge("#f59e0b")} className="kx-num" title="Μερίδια χωρίς ανατεθειμένο ένοικο/ιδιοκτήτη"><span style={dot("#f59e0b")} /> Αδιάθετα {eur(iss.unallocated)}</span>}
                      </span>
                      <span style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>{iss.expenseCount} έξοδα · {iss.personCount} πρόσωπα</span>
                    </span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 22 }}>
                    <span className="koino-stats" style={{ display: "none", gap: 20 }}>
                      <Mini label="Σύνολο" value={eur(iss.total)} />
                      <Mini label="Πληρωμένα" value={eur(iss.paid)} color="#16a34a" />
                      <Mini label="Ανεξόφλητα" value={eur(iss.due)} color={iss.due > 0 ? "#b91c1c" : undefined} />
                    </span>
                    <span style={{ width: 132 }}>
                      <span style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted-foreground)", marginBottom: 4, fontWeight: 600 }}>
                        <span>Εξόφληση</span><span className="kx-num">{pct}%</span>
                      </span>
                      <span style={progressTrack}><span className="kx-fill" style={{ ...progressFill, width: `${pct}%`, background: fillColor }} /></span>
                    </span>
                  </span>
                </button>
                {open && <IssuanceDetail buildingId={buildingId} month={iss.month} unallocated={iss.unallocated} onChanged={reload} can={can} />}
              </div>
            );
          })}
        </div>
      )}
      <style>{`@media(min-width:920px){.koino-stats{display:flex !important}}`}</style>
    </div>
  );
}

function IssuanceDetail({ buildingId, month, unallocated, onChanged, can }: { buildingId: string; month: string; unallocated: number; onChanged?: () => void; can: BuildingCaps }) {
  const [tab, setTab] = useState<"people" | "expenses">("people");
  const [people, setPeople] = useState<KoinoPersonDTO[] | null>(null);
  const [expenses, setExpenses] = useState<MonthExpenseDTO[] | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ p: KoinoPersonDTO; top: number; left: number } | null>(null);
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
    <div style={{ borderTop: "1px solid var(--border)", background: "var(--card)" }}>
      <div style={{ display: "flex", gap: 4, padding: "10px 14px 0" }}>
        <button className="kx-tab" data-active={tab === "people"} onClick={() => setTab("people")}><RiGroupLine /> Πρόσωπα</button>
        <button className="kx-tab" data-active={tab === "expenses"} onClick={() => setTab("expenses")}><RiFileList3Line /> Έξοδα</button>
      </div>

      <div style={{ padding: 14 }}>
        {tab === "people" ? (
          !people ? <Loading /> : people.length === 0 ? <Empty icon={RiGroupLine} text="Καμία χρέωση." /> : (
            <div style={{ overflowX: "auto" }}>
              <table style={tbl}>
                <thead><tr style={trHead}>
                  <th style={th}>Πρόσωπο</th><th style={th}>Μονάδες</th>
                  <th style={{ ...th, textAlign: "right" }}>Σύνολο</th><th style={{ ...th, textAlign: "right" }}>Πληρωμένα</th><th style={{ ...th, textAlign: "right" }}>Υπόλοιπο</th>
                  <th style={{ ...th, textAlign: "right", width: 40 }}></th>
                </tr></thead>
                <tbody>
                  {people.map((p) => (
                    <tr key={p.userId} className="kx-trow" style={trBody}>
                      <td style={td}>
                        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={avatar(p.due > 0)}>{initials(p.name)}</span>
                          <span style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600 }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{p.email ?? "— χωρίς email —"}</div>
                          </span>
                        </span>
                      </td>
                      <td style={td}>{p.units.length ? p.units.map((u) => <span key={u} style={chip}>{u}</span>) : "—"}</td>
                      <td style={{ ...td, textAlign: "right" }} className="kx-num">{eur(p.total)}</td>
                      <td style={{ ...td, textAlign: "right", color: "#16a34a" }} className="kx-num">{eur(p.paid)}</td>
                      <td style={{ ...td, textAlign: "right" }}>
                        {p.due > 0
                          ? <span style={duePill} className="kx-num">{eur(p.due)}</span>
                          : <span style={{ color: "#16a34a", fontWeight: 700 }} className="kx-num">{eur(0)}</span>}
                      </td>
                      <td style={{ ...td, textAlign: "right" }}>
                        <button
                          onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenu(menu?.p.userId === p.userId ? null : { p, top: r.bottom + 4, left: r.right - 188 }); }}
                          className="kx-icon-btn" title="Ενέργειες"
                        >
                          {sendingId === p.userId ? <RiLoaderLine style={{ animation: "kx-spin 1s linear infinite" }} /> : <RiMore2Fill />}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {unallocated > 0 && (
                    <tr style={{ borderTop: "1px dashed var(--border-strong)" }}>
                      <td style={td}>
                        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={avatar(true)}>!</span>
                          <span><div style={{ fontWeight: 600 }}>Αδιάθετα</div><div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Μονάδες χωρίς ένοικο/ιδιοκτήτη</div></span>
                        </span>
                      </td>
                      <td style={td}>—</td>
                      <td style={{ ...td, textAlign: "right" }} className="kx-num">{eur(unallocated)}</td>
                      <td style={{ ...td, textAlign: "right" }} className="kx-num">—</td>
                      <td style={{ ...td, textAlign: "right" }}><span style={{ ...duePill, color: "#b45309", background: "color-mix(in srgb, #f59e0b 14%, transparent)" }} className="kx-num">{eur(unallocated)}</span></td>
                      <td style={td} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )
        ) : (
          !expenses ? <Loading /> : expenses.length === 0 ? <Empty icon={RiFileList3Line} text="Κανένα έξοδο." /> : (
            <div style={{ overflowX: "auto" }}>
              <table style={tbl}>
                <thead><tr style={trHead}>
                  <th style={th}>Ημ/νία</th><th style={th}>Προμηθευτής</th><th style={th}>Κατηγορία</th>
                  <th style={{ ...th, textAlign: "right" }}>Ποσό</th><th style={th}>Παραστατικό</th>
                </tr></thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="kx-trow" style={trBody}>
                      <td style={td} className="kx-num">{fmtDate(e.documentDate)}</td>
                      <td style={td}>{e.supplier ?? "—"}</td>
                      <td style={td}>{e.category ? <span style={catChip}>{e.category}</span> : "—"}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 600 }} className="kx-num">{eur(e.amount)}</td>
                      <td style={td}>{e.receiptUrl ? <a href={e.receiptUrl} target="_blank" rel="noreferrer" style={link}><RiFileTextLine /> Άνοιγμα</a> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {menu && (
        <>
          <div onClick={() => setMenu(null)} style={{ position: "fixed", inset: 0, zIndex: 9998 }} />
          <div className="kx-menu" style={{ ...fixedMenu, top: menu.top, left: Math.max(8, menu.left) }}>
            {can.managePayments && <button className="kx-menuitem" onClick={() => { setStatementUser(menu.p.userId); setMenu(null); }}><RiSecurePaymentLine className="kx-mi" /> Πληρωμή</button>}
            <button className="kx-menuitem" onClick={() => { setStatementUser(menu.p.userId); setMenu(null); }}><RiFileListLine className="kx-mi" /> Λεπτομέρειες</button>
            {can.manageKoinochrista && <button className="kx-menuitem" disabled={!menu.p.email} onClick={() => { const p = menu.p; setMenu(null); remind(p); }}><RiMailSendLine className="kx-mi" /> Υπενθύμιση</button>}
          </div>
        </>
      )}

      {statementUser && (
        <PersonStatementModal open={!!statementUser} onClose={() => setStatementUser(null)} buildingId={buildingId} userId={statementUser} canPay={can.managePayments} onChanged={() => { reloadPeople(); onChanged?.(); }} />
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "due" }) {
  const color = tone === "ok" ? "#16a34a" : tone === "due" ? "#b91c1c" : "var(--foreground)";
  return (
    <div style={{ border: "1px solid var(--border-strong)", borderRadius: 10, padding: "8px 14px", background: "var(--card)", minWidth: 118 }}>
      <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".03em" }}>{label}</div>
      <div className="kx-num" style={{ fontSize: 17, fontWeight: 800, color, marginTop: 2 }}>{value}</div>
    </div>
  );
}
function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return <span style={{ textAlign: "right" }}><span style={{ display: "block", fontSize: 10, color: "var(--muted-foreground)", fontWeight: 600 }}>{label}</span><span className="kx-num" style={{ fontSize: 13, fontWeight: 700, color: color ?? "var(--foreground)" }}>{value}</span></span>;
}
function Loading() {
  return <div style={{ fontSize: 13, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 8, padding: 16 }}><RiLoaderLine style={{ animation: "kx-spin 1s linear infinite" }} /> Φόρτωση…</div>;
}
function Empty({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "32px 16px", color: "var(--muted-foreground)" }}>
      <div style={{ display: "grid", placeItems: "center", width: 44, height: 44, borderRadius: 12, background: "var(--card)", border: "1px solid var(--border-strong)" }}><Icon style={{ fontSize: 22 }} /></div>
      <div style={{ fontSize: 13 }}>{text}</div>
    </div>
  );
}

const dot = (c: string): React.CSSProperties => ({ width: 6, height: 6, borderRadius: 999, background: c, display: "inline-block" });
const dotBadge = (c: string): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 9px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, color: c, background: `color-mix(in srgb, ${c} 12%, transparent)` });
const progressTrack: React.CSSProperties = { display: "block", height: 7, borderRadius: 999, background: "var(--border)", overflow: "hidden" };
const progressFill: React.CSSProperties = { display: "block", height: "100%", borderRadius: 999 };
const tbl: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const trHead: React.CSSProperties = { textAlign: "left", color: "var(--muted-foreground)", borderBottom: "1px solid var(--border-strong)" };
const trBody: React.CSSProperties = { borderBottom: "1px solid var(--border)" };
const th: React.CSSProperties = { padding: "9px 10px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: ".02em" };
const td: React.CSSProperties = { padding: "9px 10px", verticalAlign: "middle" };
const fixedMenu: React.CSSProperties = { position: "fixed", zIndex: 9999, minWidth: 184, background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 10, boxShadow: "0 1px 2px rgba(0,0,0,.08),0 12px 28px rgba(0,0,0,.16)", padding: 5 };
const link: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, color: "var(--color-primary)", textDecoration: "none", fontSize: 12, fontWeight: 600 };
const avatar = (due: boolean): React.CSSProperties => ({ display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 999, flexShrink: 0, fontSize: 12, fontWeight: 700, color: due ? "#b91c1c" : "var(--color-primary)", background: due ? "color-mix(in srgb, #b91c1c 12%, transparent)" : "color-mix(in srgb, var(--color-primary) 12%, transparent)" });
const chip: React.CSSProperties = { display: "inline-block", padding: "1px 8px", marginRight: 4, borderRadius: 6, fontSize: 11, fontWeight: 600, background: "var(--card)", border: "1px solid var(--border-strong)" };
const catChip: React.CSSProperties = { display: "inline-block", padding: "2px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: "color-mix(in srgb, var(--color-primary) 9%, transparent)", color: "var(--color-primary)" };
const duePill: React.CSSProperties = { display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, color: "#b91c1c", background: "color-mix(in srgb, #b91c1c 11%, transparent)" };
