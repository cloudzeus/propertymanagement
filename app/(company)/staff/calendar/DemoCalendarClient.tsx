"use client";

import { useMemo, useState } from "react";
import {
  RiArrowLeftSLine, RiArrowRightSLine, RiCalendarEventLine, RiMailLine, RiPhoneLine,
  RiBuilding2Line, RiChat1Line, RiCloseLine, RiTimeLine, RiUserSmileLine, RiVideoChatLine,
} from "react-icons/ri";

export type DemoEvent = {
  id: string; name: string; email: string; phone: string | null; company: string | null;
  message: string | null; status: string; scheduledAt: string; durationMin: number;
};

const WD = ["Δευ", "Τρί", "Τετ", "Πέμ", "Παρ", "Σάβ", "Κυρ"];
const MONTHS = ["Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος", "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος"];
const MONTHS_SHORT = ["Ιαν", "Φεβ", "Μάρ", "Απρ", "Μάι", "Ιούν", "Ιούλ", "Αύγ", "Σεπ", "Οκτ", "Νοέ", "Δεκ"];

const STATUS: Record<string, { label: string; bg: string; fg: string; bar: string }> = {
  PENDING: { label: "Νέο", bg: "#FDF1DF", fg: "#9A5B00", bar: "#F2A23C" },
  CONFIRMED: { label: "Επιβεβαιωμένο", bg: "#E4F0EA", fg: "#22604A", bar: "#2E7D5B" },
  CANCELLED: { label: "Ακυρωμένο", bg: "#F0F0EE", fg: "#8a8a85", bar: "#b9b9b4" },
  COMPLETED: { label: "Ολοκληρωμένο", bg: "#E5EDF8", fg: "#234E88", bar: "#3B6BB0" },
};
const MAX_CHIPS_PER_DAY = 3;

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
const timeFmt = new Intl.DateTimeFormat("el-GR", { hour: "2-digit", minute: "2-digit", hour12: false });
const longFmt = new Intl.DateTimeFormat("el-GR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false });

function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.PENDING;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: s.bg, color: s.fg, whiteSpace: "nowrap" }}>
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: s.bar }} />
      {s.label}
    </span>
  );
}

export function DemoCalendarClient({ events, today }: { events: DemoEvent[]; today: string }) {
  const now = useMemo(() => new Date(today), [today]);
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selected, setSelected] = useState<DemoEvent | null>(null);
  const [dayFocus, setDayFocus] = useState<Date | null>(null);

  const byDay = useMemo(() => {
    const m = new Map<string, DemoEvent[]>();
    for (const e of events) {
      const k = startOfDay(new Date(e.scheduledAt)).toDateString();
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    for (const list of m.values()) list.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    return m;
  }, [events]);

  const cells = useMemo(() => {
    const first = new Date(cursor);
    const lead = (first.getDay() + 6) % 7; // Monday-first
    const start = new Date(first); start.setDate(1 - lead);
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [cursor]);

  const active = events.filter((e) => e.status !== "CANCELLED");
  const upcoming = useMemo(
    () => active.filter((e) => new Date(e.scheduledAt) >= now).slice(0, 8),
    [active, now],
  );
  const monthCount = active.filter((e) => { const d = new Date(e.scheduledAt); return d.getMonth() === cursor.getMonth() && d.getFullYear() === cursor.getFullYear(); }).length;
  const weekEnd = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  const weekCount = active.filter((e) => { const d = new Date(e.scheduledAt); return d >= now && d <= weekEnd; }).length;
  const pendingCount = events.filter((e) => e.status === "PENDING" && new Date(e.scheduledAt) >= now).length;

  const isCurrentMonth = cursor.getMonth() === now.getMonth() && cursor.getFullYear() === now.getFullYear();

  return (
    <div style={{ padding: "22px 24px 32px", maxWidth: 1240 }}>
      <style>{`
        .dcal-btn { transition: background .15s ease, border-color .15s ease, box-shadow .15s ease, transform .15s ease; cursor: pointer; }
        .dcal-btn:hover { background: var(--paper, #FBFAF5); }
        .dcal-btn:focus-visible, .dcal-chip:focus-visible, .dcal-card:focus-visible { outline: 2px solid var(--primary, #15161a); outline-offset: 2px; }
        .dcal-chip { transition: filter .15s ease, transform .15s ease; cursor: pointer; }
        .dcal-chip:hover { filter: brightness(.96); }
        .dcal-chip:active { transform: scale(.98); }
        .dcal-card { transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease; cursor: pointer; }
        .dcal-card:hover { border-color: rgba(27,28,26,.22); box-shadow: 0 8px 20px -14px rgba(27,28,26,.3); transform: translateY(-1px); }
        .dcal-cell { transition: background .15s ease; }
        .dcal-cell:hover { background: rgba(27,28,26,.025); }
        .dcal-modal-in { animation: dcalIn .18s ease-out both; }
        @keyframes dcalIn { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) {
          .dcal-modal-in { animation: none; }
          .dcal-btn, .dcal-chip, .dcal-card, .dcal-cell { transition: none; }
        }
        @media (max-width: 1024px) { .dcal-layout { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-.01em", color: "var(--foreground)" }}>Ημερολόγιο ραντεβού</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--muted-foreground)" }}>
            Κρατήσεις demo από τη σελίδα — κάθε κράτηση στέλνει email και πρόσκληση ημερολογίου (.ics) στο προσωπικό.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!isCurrentMonth && (
            <button type="button" className="dcal-btn" onClick={() => setCursor(new Date(now.getFullYear(), now.getMonth(), 1))}
              style={{ ...navBtn, padding: "7px 12px", fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>
              Σήμερα
            </button>
          )}
          <button type="button" className="dcal-btn" aria-label="Προηγούμενος μήνας" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} style={navBtn}><RiArrowLeftSLine size={18} /></button>
          <span style={{ minWidth: 168, textAlign: "center", fontWeight: 700, fontSize: 15, color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </span>
          <button type="button" className="dcal-btn" aria-label="Επόμενος μήνας" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} style={navBtn}><RiArrowRightSLine size={18} /></button>
        </div>
      </div>

      {/* Stat tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, margin: "18px 0" }}>
        {[
          { icon: RiCalendarEventLine, label: "Αυτόν τον μήνα", value: monthCount, tint: "#F2A23C" },
          { icon: RiTimeLine, label: "Επόμενες 7 ημέρες", value: weekCount, tint: "#3B6BB0" },
          { icon: RiUserSmileLine, label: "Νέα (εκκρεμή)", value: pendingCount, tint: "#2E7D5B" },
        ].map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--card)", padding: "12px 14px" }}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 9, background: `${s.tint}1A`, color: s.tint, flex: "none" }}>
              <s.icon size={18} />
            </span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1, color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 1 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="dcal-layout" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, alignItems: "start" }}>
        {/* Month grid */}
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--card)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
            {WD.map((w, i) => (
              <div key={w} style={{ padding: "10px 0", textAlign: "center", fontSize: 11.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: i >= 5 ? "rgba(27,28,26,.35)" : "var(--muted-foreground)", borderBottom: "1px solid var(--border)", background: "var(--paper, #FBFAF5)" }}>{w}</div>
            ))}
            {cells.map((d, i) => {
              const inMonth = d.getMonth() === cursor.getMonth();
              const key = startOfDay(d).toDateString();
              const evts = byDay.get(key) ?? [];
              const shown = evts.slice(0, MAX_CHIPS_PER_DAY);
              const extra = evts.length - shown.length;
              const isToday = sameDay(d, now);
              const weekend = i % 7 >= 5;
              return (
                <div key={i} className="dcal-cell"
                  style={{
                    minHeight: 96, padding: "6px 6px 8px",
                    borderBottom: i < 35 ? "1px solid var(--border)" : undefined,
                    borderRight: i % 7 < 6 ? "1px solid var(--border)" : undefined,
                    background: !inMonth ? "rgba(27,28,26,.028)" : weekend ? "rgba(27,28,26,.012)" : "transparent",
                  }}>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <span style={{
                      fontSize: 12, fontWeight: isToday ? 800 : 500, fontVariantNumeric: "tabular-nums",
                      color: isToday ? "#fff" : inMonth ? "var(--foreground)" : "rgba(27,28,26,.35)",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 23, height: 23, borderRadius: "50%",
                      background: isToday ? "var(--primary, #15161a)" : "transparent",
                    }}>{d.getDate()}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 3 }}>
                    {shown.map((e) => {
                      const s = STATUS[e.status] ?? STATUS.PENDING;
                      return (
                        <button key={e.id} type="button" className="dcal-chip" onClick={() => setSelected(e)}
                          title={`${timeFmt.format(new Date(e.scheduledAt))} — ${e.name} (${s.label})`}
                          style={{
                            display: "flex", alignItems: "center", gap: 5, textAlign: "left",
                            fontSize: 11, fontWeight: 600, padding: "3px 7px 3px 6px", borderRadius: 6,
                            border: "none", borderLeft: `3px solid ${s.bar}`,
                            background: s.bg, color: s.fg,
                            overflow: "hidden", whiteSpace: "nowrap",
                            textDecoration: e.status === "CANCELLED" ? "line-through" : "none",
                          }}>
                          <span style={{ fontVariantNumeric: "tabular-nums", flex: "none" }}>{timeFmt.format(new Date(e.scheduledAt))}</span>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</span>
                        </button>
                      );
                    })}
                    {extra > 0 && (
                      <button type="button" className="dcal-chip" onClick={() => setDayFocus(startOfDay(d))}
                        style={{ border: "none", background: "transparent", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", padding: "1px 7px" }}>
                        +{extra} ακόμη
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, padding: "10px 14px", borderTop: "1px solid var(--border)", background: "var(--paper, #FBFAF5)" }}>
            {Object.entries(STATUS).map(([k, s]) => (
              <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--muted-foreground)" }}>
                <span aria-hidden style={{ width: 8, height: 8, borderRadius: 3, background: s.bar }} /> {s.label}
              </span>
            ))}
          </div>
        </div>

        {/* Upcoming list */}
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--card)", padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)", display: "flex", alignItems: "center", gap: 7 }}>
            <RiCalendarEventLine style={{ color: "var(--muted-foreground)" }} /> Επερχόμενα
            <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 700, background: "var(--paper, #FBFAF5)", border: "1px solid var(--border)", borderRadius: 999, padding: "1px 9px", color: "var(--muted-foreground)", fontVariantNumeric: "tabular-nums" }}>{upcoming.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {upcoming.length === 0 && (
              <div style={{ textAlign: "center", padding: "26px 8px", color: "var(--muted-foreground)" }}>
                <RiVideoChatLine size={26} style={{ opacity: .5 }} />
                <div style={{ fontSize: 13, marginTop: 8 }}>Κανένα προγραμματισμένο demo.</div>
                <div style={{ fontSize: 12, marginTop: 3, opacity: .8 }}>Οι νέες κρατήσεις από τη σελίδα θα εμφανιστούν εδώ.</div>
              </div>
            )}
            {upcoming.map((e) => {
              const d = new Date(e.scheduledAt);
              return (
                <button key={e.id} type="button" className="dcal-card" onClick={() => setSelected(e)}
                  style={{ display: "flex", gap: 11, alignItems: "center", textAlign: "left", border: "1px solid var(--border)", borderRadius: 10, background: "var(--card)", padding: "9px 11px" }}>
                  <span style={{ flex: "none", width: 42, textAlign: "center", border: "1px solid var(--border)", borderRadius: 9, background: "var(--paper, #FBFAF5)", padding: "5px 0" }}>
                    <span style={{ display: "block", fontSize: 16, fontWeight: 800, lineHeight: 1.1, color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>{d.getDate()}</span>
                    <span style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--muted-foreground)" }}>{MONTHS_SHORT[d.getMonth()]}</span>
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: "block", fontWeight: 700, fontSize: 13.5, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
                    <span style={{ display: "block", fontSize: 12, color: "var(--muted-foreground)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                      {timeFmt.format(d)} · {e.durationMin}′{e.company ? ` · ${e.company}` : ""}
                    </span>
                  </span>
                  <StatusPill status={e.status} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Day-overflow popup */}
      {dayFocus && (
        <Overlay onClose={() => setDayFocus(null)}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--foreground)" }}>
            {new Intl.DateTimeFormat("el-GR", { weekday: "long", day: "numeric", month: "long" }).format(dayFocus)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
            {(byDay.get(dayFocus.toDateString()) ?? []).map((e) => (
              <button key={e.id} type="button" className="dcal-card" onClick={() => { setDayFocus(null); setSelected(e); }}
                style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", border: "1px solid var(--border)", borderRadius: 10, background: "var(--card)", padding: "9px 11px" }}>
                <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 13, color: "var(--foreground)" }}>{timeFmt.format(new Date(e.scheduledAt))}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
                <StatusPill status={e.status} />
              </button>
            ))}
          </div>
        </Overlay>
      )}

      {/* Detail modal */}
      {selected && (
        <Overlay onClose={() => setSelected(null)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: "var(--foreground)" }}>{selected.name}</span>
                <StatusPill status={selected.status} />
              </div>
              <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                {longFmt.format(new Date(selected.scheduledAt))} · {selected.durationMin}′
              </div>
            </div>
            <button type="button" className="dcal-btn" aria-label="Κλείσιμο" onClick={() => setSelected(null)} style={{ ...navBtn, padding: 6 }}><RiCloseLine size={16} /></button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 16, fontSize: 13.5, color: "var(--foreground)" }}>
            <div style={rowStyle}><RiMailLine style={iconStyle} aria-hidden /> <span style={{ overflowWrap: "anywhere" }}>{selected.email}</span></div>
            {selected.phone && <div style={rowStyle}><RiPhoneLine style={iconStyle} aria-hidden /> {selected.phone}</div>}
            {selected.company && <div style={rowStyle}><RiBuilding2Line style={iconStyle} aria-hidden /> {selected.company}</div>}
            {selected.message && (
              <div style={{ ...rowStyle, alignItems: "flex-start", background: "var(--paper, #FBFAF5)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
                <RiChat1Line style={{ ...iconStyle, marginTop: 2 }} aria-hidden />
                <span style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{selected.message}</span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <a href={`mailto:${selected.email}`} className="dcal-btn"
              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 0", borderRadius: 10, background: "var(--primary, #15161a)", color: "#fff", fontWeight: 700, fontSize: 13.5, textDecoration: "none" }}>
              <RiMailLine size={15} /> Απάντηση με email
            </a>
            {selected.phone && (
              <a href={`tel:${selected.phone}`} className="dcal-btn"
                style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 0", borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontWeight: 700, fontSize: 13.5, textDecoration: "none" }}>
                <RiPhoneLine size={15} /> Κλήση
              </a>
            )}
          </div>
        </Overlay>
      )}
    </div>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" onClick={onClose}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(27,28,26,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="dcal-modal-in" onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 440, maxHeight: "88vh", overflowY: "auto", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 22, boxShadow: "0 24px 60px -24px rgba(27,28,26,.45)" }}>
        {children}
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  border: "1px solid var(--border)", background: "var(--card)", borderRadius: 9,
  padding: "7px 8px", color: "var(--foreground)", lineHeight: 0,
};
const rowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 9 };
const iconStyle: React.CSSProperties = { color: "var(--muted-foreground)", flex: "none" };
