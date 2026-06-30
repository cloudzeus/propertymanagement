"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { DataTable, type ColDef, type RowAction } from "@/components/ui/data-table";
import { Modal, FormField, FieldInput, FieldSelect } from "@/components/ui/modal";
import { RichTextEditor } from "@/components/ui/rich-text";
import {
  listAnnouncements, createAnnouncement, deleteAnnouncement, listAnnouncementTargets,
  type AnnouncementRow, type Audience,
} from "@/app/actions/announcements";
import {
  RiMegaphoneLine, RiAddLine, RiDeleteBinLine, RiCheckLine, RiLoaderLine,
  RiCheckboxCircleFill, RiTimeLine, RiCalendarEventLine, RiUserStarLine, RiUserLine,
} from "react-icons/ri";

const AUDIENCE_LABEL: Record<Audience, string> = { ALL: "Όλοι", OWNERS: "Ιδιοκτήτες", RESIDENTS: "Ένοικοι", CUSTOM: "Επιλεγμένοι" };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("el-GR") : "—");
const fmtDT = (iso: string | null) => (iso ? new Date(iso).toLocaleString("el-GR") : "—");

export function AnnouncementsPanel({ buildingId }: { buildingId: string }) {
  const [rows, setRows] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [, startTransition] = useTransition();

  const reload = useCallback(() => listAnnouncements(buildingId).then(setRows).finally(() => setLoading(false)), [buildingId]);
  useEffect(() => { reload(); }, [reload]);

  function remove(id: string, title: string) {
    if (!confirm(`Διαγραφή ανακοίνωσης «${title}»;`)) return;
    startTransition(async () => { await deleteAnnouncement(id); await reload(); });
  }

  const columns: ColDef<AnnouncementRow>[] = [
    {
      id: "title", header: "Θέμα", sortKey: "title", width: 280, accessor: (a) => a.title,
      cell: (a) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: "var(--color-primary)18", color: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RiMegaphoneLine style={{ fontSize: 14 }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span>
        </div>
      ),
    },
    { id: "publishedAt", header: "Δημοσίευση", sortKey: "publishedAt", width: 120, accessor: (a) => a.publishedAt ?? "", cell: (a) => <span style={{ fontSize: 12, color: "var(--foreground)" }}>{fmt(a.publishedAt)}</span> },
    { id: "audience", header: "Παραλήπτες", width: 120, accessor: (a) => AUDIENCE_LABEL[a.audience], cell: (a) => <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: "var(--bg-canvas)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>{AUDIENCE_LABEL[a.audience]}</span> },
    {
      id: "ack", header: "Έλαβαν γνώση", width: 140, accessor: (a) => a.acknowledged,
      cell: (a) => {
        const pct = a.total ? Math.round((a.acknowledged / a.total) * 100) : 0;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 9999, background: "var(--bg-canvas)", overflow: "hidden", minWidth: 50 }}>
              <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "var(--color-green)" : "var(--color-primary)" }} />
            </div>
            <span style={{ fontSize: 12, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{a.acknowledged}/{a.total}</span>
          </div>
        );
      },
    },
    { id: "calendar", header: "Ημ/γιο", width: 80, accessor: (a) => (a.recurringTaskId ? 1 : 0), cell: (a) => a.recurringTaskId ? <RiCalendarEventLine style={{ color: "var(--color-green)" }} title="Στο ημερολόγιο" /> : <span style={{ color: "var(--muted-foreground)" }}>—</span> },
  ];

  const getRowActions = (_a: AnnouncementRow): RowAction<AnnouncementRow>[] => [
    { label: "Διαγραφή", icon: <RiDeleteBinLine />, danger: true, onClick: (a) => remove(a.id, a.title) },
  ];

  if (loading) {
    return <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: 40, textAlign: "center", color: "var(--muted-foreground)", fontSize: 14 }}>Φόρτωση…</div>;
  }

  return (
    <>
      <DataTable
        data={rows}
        columns={columns}
        totalRows={rows.length}
        page={1}
        pageSize={25}
        clientSide
        storageKey="building-announcements"
        searchPlaceholder="Αναζήτηση ανακοίνωσης…"
        getRowActions={getRowActions}
        expandedContent={(a) => <AnnouncementExpanded a={a} />}
        toolbar={<button onClick={() => setAdding(true)} style={{ ...btn, ...btnPrimary }}><RiAddLine /> Νέα ανακοίνωση</button>}
      />
      {adding && <CreateModal buildingId={buildingId} onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload(); }} />}
    </>
  );
}

function AnnouncementExpanded({ a }: { a: AnnouncementRow }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18, padding: "4px 6px 8px" }}>
      <div>
        <SectionTitle>Κείμενο ανακοίνωσης</SectionTitle>
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14, background: "var(--card)", fontSize: 13, lineHeight: 1.6, color: "var(--foreground)" }}
          dangerouslySetInnerHTML={{ __html: a.content }} />
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted-foreground)", display: "flex", gap: 14, flexWrap: "wrap" }}>
          <span>Δημοσίευση: <b style={{ color: "var(--foreground)" }}>{fmt(a.publishedAt)}</b></span>
          <span>Ομάδα: <b style={{ color: "var(--foreground)" }}>{AUDIENCE_LABEL[a.audience]}</b></span>
          {a.createdByName && <span>Από: <b style={{ color: "var(--foreground)" }}>{a.createdByName}</b></span>}
          {a.recurringTaskId && <span style={{ color: "var(--color-green)", display: "inline-flex", alignItems: "center", gap: 4 }}><RiCalendarEventLine /> Στο ημερολόγιο</span>}
        </div>
      </div>

      <div>
        <SectionTitle>Παραλήπτες — {a.acknowledged}/{a.total} έλαβαν γνώση</SectionTitle>
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ textAlign: "left", color: "var(--muted-foreground)", fontSize: 11, background: "var(--bg-canvas)" }}>
              <th style={th}>Όνομα</th><th style={th}>Ιδιότητα</th><th style={th}>Κατάσταση</th><th style={th}>IP</th>
            </tr></thead>
            <tbody>
              {a.recipients.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600, color: "var(--foreground)" }}>{r.name ?? "—"}</div>
                    <div style={{ color: "var(--muted-foreground)" }}>{r.email}</div>
                  </td>
                  <td style={td}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--muted-foreground)" }}>
                      {r.role === "OWNER" ? <RiUserStarLine /> : r.role === "RESIDENT" ? <RiUserLine /> : null}
                      {r.role === "OWNER" ? "Ιδιοκτήτης" : r.role === "RESIDENT" ? "Ένοικος" : "—"}
                    </span>
                  </td>
                  <td style={td}>
                    {r.acknowledgedAt ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--color-green)", fontWeight: 600 }} title={fmtDT(r.acknowledgedAt)}>
                        <RiCheckboxCircleFill /> {fmtDT(r.acknowledgedAt)}
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--muted-foreground)" }}><RiTimeLine /> Εκκρεμεί</span>
                    )}
                  </td>
                  <td style={{ ...td, fontFamily: "monospace", color: "var(--muted-foreground)" }} title={r.userAgent ?? ""}>{r.ipAddress ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CreateModal({ buildingId, onClose, onDone }: { buildingId: string; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [publishedAt, setPublishedAt] = useState(new Date().toISOString().slice(0, 10));
  const [audience, setAudience] = useState<Audience>("ALL");
  const [addToCalendar, setAddToCalendar] = useState(false);
  const [targets, setTargets] = useState<{ id: string; name: string | null; email: string; roles: ("OWNER" | "RESIDENT")[] }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => { listAnnouncementTargets(buildingId).then(setTargets); }, [buildingId]);

  function toggle(id: string) {
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function save() {
    setError(null);
    if (!title.trim()) { setError("Το θέμα είναι υποχρεωτικό"); return; }
    if (content.replace(/<[^>]*>/g, "").trim() === "") { setError("Το κείμενο είναι υποχρεωτικό"); return; }
    if (audience === "CUSTOM" && selected.size === 0) { setError("Επιλέξτε τουλάχιστον έναν παραλήπτη"); return; }
    startTransition(async () => {
      const res = await createAnnouncement(buildingId, {
        title, content, publishedAt, audience,
        recipientUserIds: audience === "CUSTOM" ? [...selected] : undefined,
        addToCalendar,
      });
      if (res && "error" in res && res.error) { setError(res.error); return; }
      setSent(res.sent ?? 0);
      setTimeout(onDone, 900);
    });
  }

  return (
    <Modal open onClose={onClose} title="Νέα ανακοίνωση" width={640}
      footer={<>
        <button onClick={onClose} style={btnCancel}>Ακύρωση</button>
        <button onClick={save} disabled={isPending || sent != null} style={btnSave}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Δημοσίευση & αποστολή</button>
      </>}>
      {error && <div style={errBox}>{error}</div>}
      {sent != null && <div style={{ padding: "8px 12px", borderRadius: 6, background: "#16a34a18", color: "#16a34a", fontSize: 12, marginBottom: 12, fontWeight: 600 }}>Στάλθηκε σε {sent} παραλήπτες ✓</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <FormField label="Θέμα" required><FieldInput value={title} onChange={setTitle} placeholder="π.χ. Διακοπή νερού" /></FormField>
        <FormField label="Κείμενο" required>
          <RichTextEditor value={content} onChange={setContent} placeholder="Γράψτε το κείμενο της ανακοίνωσης…" />
        </FormField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FormField label="Ημερομηνία δημοσίευσης"><FieldInput type="date" value={publishedAt} onChange={setPublishedAt} /></FormField>
          <FormField label="Παραλήπτες">
            <FieldSelect value={audience} onChange={(v) => setAudience(v as Audience)} options={[
              { value: "ALL", label: "Όλοι (ιδιοκτήτες & ένοικοι)" },
              { value: "OWNERS", label: "Μόνο ιδιοκτήτες" },
              { value: "RESIDENTS", label: "Μόνο ένοικοι" },
              { value: "CUSTOM", label: "Επιλεγμένα πρόσωπα" },
            ]} />
          </FormField>
        </div>

        {audience === "CUSTOM" && (
          <div style={{ border: "1px solid var(--border)", borderRadius: 6, maxHeight: 200, overflowY: "auto" }}>
            {targets.length === 0 && <div style={{ padding: 12, fontSize: 12, color: "var(--muted-foreground)" }}>Δεν υπάρχουν ιδιοκτήτες/ένοικοι.</div>}
            {targets.map((t) => (
              <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
                <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{t.name ?? t.email}</span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--muted-foreground)" }}>{t.email}</span>
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)" }}>{t.roles.map((r) => (r === "OWNER" ? "Ιδιοκτήτης" : "Ένοικος")).join(" & ")}</span>
              </label>
            ))}
          </div>
        )}

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)", cursor: "pointer" }}>
          <input type="checkbox" checked={addToCalendar} onChange={(e) => setAddToCalendar(e.target.checked)} />
          <RiCalendarEventLine /> Προσθήκη στο ημερολόγιο (στην ημ/νία δημοσίευσης)
        </label>
        <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0 }}>
          Θα σταλεί email σε κάθε παραλήπτη με σύνδεσμο «Έλαβα γνώση». Καταχωρείται η πραγματική IP, η ώρα και το λειτουργικό κατά την επιβεβαίωση.
        </p>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>{children}</div>;
}

const th: React.CSSProperties = { padding: "7px 8px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "7px 8px", color: "var(--foreground)", verticalAlign: "top" };
const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 6, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnPrimary: React.CSSProperties = { background: "var(--color-primary)", color: "#fff", borderColor: "var(--color-primary)" };
const btnCancel: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: 13, color: "var(--foreground)" };
const btnSave: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 };
const errBox: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, marginBottom: 12 };
