"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  STATUS_LABELS, STATUS_COLORS, STATUS_TRANSITIONS, PRIORITY_LABELS, HANDLER_LABELS,
  type FaultStatus,
} from "@/lib/maintenance-shared";
import {
  changeRequestStatus, assignRequest, addRequestComment, setRequestEstimate,
  offerSlots, removeSlot, bookSlot,
} from "@/app/actions/maintenance-requests";
import { FormField, FieldSelect, FieldTextarea, FieldInput } from "@/components/ui/modal";
import {
  RiTimeLine, RiUserLine, RiBuilding2Line, RiCalendarCheckLine, RiAlarmWarningLine,
  RiChat3Line, RiHistoryLine, RiAttachmentLine, RiDeleteBinLine, RiCheckLine,
} from "react-icons/ri";
import type { FaultDetail, Viewer, EmployeeOption } from "./types";

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" }) : "—";

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status as FaultStatus] ?? "#6b7280";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px",
      borderRadius: 999, fontSize: 12, fontWeight: 600, color, background: `${color}18`, border: `1px solid ${color}40`,
    }}>
      {STATUS_LABELS[status as FaultStatus] ?? status}
    </span>
  );
}

function SlaBadge({ slaDueAt, status }: { slaDueAt: string | null; status: string }) {
  if (!slaDueAt || ["COMPLETED", "CANCELLED"].includes(status)) return null;
  const due = new Date(slaDueAt).getTime();
  const overdue = due < Date.now();
  const hoursLeft = Math.round((due - Date.now()) / 3600_000);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600,
      color: overdue ? "#9f1239" : "#b45309",
    }}>
      <RiAlarmWarningLine />
      {overdue ? `SLA εκτός ορίου (${fmt(slaDueAt)})` : `SLA: ${hoursLeft} ώρες (${fmt(slaDueAt)})`}
    </span>
  );
}

const card: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)", padding: 18,
};
const h3: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: "var(--foreground)", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 };
const btn: React.CSSProperties = {
  height: 32, padding: "0 12px", border: "1px solid var(--border)", background: "var(--paper)",
  borderRadius: "var(--radius-sm)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: "var(--foreground)",
};
const btnPrimary: React.CSSProperties = { ...btn, background: "var(--primary)", color: "var(--primary-foreground)", border: "none" };

export function RequestDetail({ request, viewer, employees }: {
  request: FaultDetail;
  viewer: Viewer;
  employees: EmployeeOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [comment, setComment] = useState("");
  const [internal, setInternal] = useState(false);
  const [assignee, setAssignee] = useState("");
  const [estMinutes, setEstMinutes] = useState(request.estimatedMinutes ? String(request.estimatedMinutes) : "");
  const [estPresence, setEstPresence] = useState(request.managerPresence);
  const [slotDate, setSlotDate] = useState("");
  const [slotTime, setSlotTime] = useState("");

  const transitions = STATUS_TRANSITIONS[request.status as FaultStatus] ?? [];
  const canChangeStatus = viewer.canManage;
  const mySide = viewer.isStaff ? "COMPANY" : "MANAGER";
  const closed = ["COMPLETED", "CANCELLED"].includes(request.status);

  const visibleComments = useMemo(
    () => request.comments.filter((c) => !c.internal || viewer.isStaff),
    [request.comments, viewer.isStaff],
  );

  async function run(fn: () => Promise<{ error?: string } | { ok?: boolean }>) {
    setBusy(true); setError(null);
    const res = await fn();
    setBusy(false);
    if (res && "error" in res && res.error) { setError(res.error); return false; }
    router.refresh();
    return true;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={card}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <h1 style={{ fontSize: 19, fontWeight: 700, color: "var(--foreground)", margin: 0, flex: 1 }}>{request.title}</h1>
          <StatusBadge status={request.status} />
          <SlaBadge slaDueAt={request.slaDueAt} status={request.status} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12.5, color: "var(--muted-foreground)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><RiBuilding2Line /> {request.buildingName}{request.unitLabel ? ` · ${request.unitLabel}` : " · Κοινόχρηστος χώρος"}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><RiUserLine /> Δήλωση: {request.reporterName ?? "—"}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><RiTimeLine /> {fmt(request.createdAt)}</span>
          <span>Κατηγορία: {request.categoryName ?? "—"}</span>
          <span>Προτεραιότητα: {PRIORITY_LABELS[request.priority as keyof typeof PRIORITY_LABELS] ?? request.priority}</span>
          <span>Υπεύθυνος: {HANDLER_LABELS[request.handledBy] ?? request.handledBy}</span>
          {request.assigneeName && <span>Ανατέθηκε: {request.assigneeName}</span>}
          {request.scheduledDate && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><RiCalendarCheckLine /> Ραντεβού: {fmt(request.scheduledDate)}</span>}
        </div>
        <p style={{ fontSize: 13.5, color: "var(--foreground)", marginTop: 12, whiteSpace: "pre-wrap" }}>{request.description}</p>

        {request.attachments.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ ...h3, marginBottom: 8 }}><RiAttachmentLine /> Συνημμένα</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {request.attachments.map((a) =>
                a.kind === "VIDEO" ? (
                  <video key={a.id} src={a.url} controls style={{ width: 220, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }} />
                ) : (
                  <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                    <img src={a.url} alt="" style={{ width: 120, height: 90, objectFit: "cover", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }} />
                  </a>
                ),
              )}
            </div>
          </div>
        )}
      </div>

      {error && <div style={{ color: "var(--destructive)", fontSize: 13 }}>{error}</div>}

      {/* Actions: status change + assignment */}
      {(canChangeStatus || viewer.canAssign) && !closed && (
        <div style={card}>
          <div style={h3}><RiCheckLine /> Ενέργειες</div>
          {canChangeStatus && transitions.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <FieldInput value={statusNote} onChange={setStatusNote} placeholder="Σημείωση αλλαγής κατάστασης (προαιρετικά)" />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {transitions.map((s) => (
                  <button key={s} disabled={busy} style={s === "COMPLETED" ? btnPrimary : btn}
                    onClick={() => run(() => changeRequestStatus(request.id, s, statusNote))}>
                    → {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          )}
          {viewer.canAssign && (
            <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "flex-end", maxWidth: 420 }}>
              <div style={{ flex: 1 }}>
                <FormField label="Ανάθεση σε υπάλληλο">
                  <FieldSelect value={assignee} onChange={setAssignee} placeholder="Επιλέξτε υπάλληλο"
                    options={employees.map((e) => ({ value: e.id, label: e.name }))} />
                </FormField>
              </div>
              <button disabled={busy || !assignee} style={btn} onClick={() => run(() => assignRequest(request.id, assignee))}>
                Ανάθεση
              </button>
            </div>
          )}
        </div>
      )}

      {/* Appointment scheduling (restricted access) */}
      {request.restrictedAccess && !closed && (
        <div style={card}>
          <div style={h3}><RiCalendarCheckLine /> Ραντεβού πρόσβασης</div>
          <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 0 }}>
            Η βλάβη αφορά εξοπλισμό με περιορισμένη πρόσβαση. Κάθε πλευρά δηλώνει διαθέσιμα slots 30 λεπτών —
            η άλλη πλευρά επιλέγει ένα για να κλειστεί το ραντεβού.
            {request.estimatedMinutes ? ` Εκτιμώμενη διάρκεια εργασιών: ${request.estimatedMinutes}′.` : ""}
            {request.managerPresence ? " Απαιτείται παρουσία διαχειριστή." : ""}
          </p>

          {viewer.isStaff && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ width: 140 }}>
                <FormField label="Διάρκεια (λεπτά)">
                  <FieldInput value={estMinutes} onChange={setEstMinutes} type="number" placeholder="60" />
                </FormField>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, height: 36, color: "var(--foreground)" }}>
                <input type="checkbox" checked={estPresence} onChange={(e) => setEstPresence(e.target.checked)} />
                Παρουσία διαχειριστή
              </label>
              <button disabled={busy} style={btn}
                onClick={() => run(() => setRequestEstimate(request.id, estMinutes ? Number(estMinutes) : null, estPresence))}>
                Αποθήκευση εκτίμησης
              </button>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ width: 160 }}>
              <FormField label="Ημερομηνία">
                <FieldInput value={slotDate} onChange={setSlotDate} type="date" />
              </FormField>
            </div>
            <div style={{ width: 120 }}>
              <FormField label="Ώρα (30′)">
                <FieldInput value={slotTime} onChange={setSlotTime} type="time" />
              </FormField>
            </div>
            <button disabled={busy || !slotDate || !slotTime} style={btn}
              onClick={async () => {
                const iso = new Date(`${slotDate}T${slotTime}`).toISOString();
                if (await run(() => offerSlots(request.id, [iso]))) { setSlotDate(""); setSlotTime(""); }
              }}>
              Δήλωση διαθεσιμότητας
            </button>
          </div>

          {request.slots.filter((s) => s.status === "OPEN").length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {request.slots.filter((s) => s.status === "OPEN").map((s) => (
                <div key={s.id} style={{
                  display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--foreground)",
                  border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "6px 10px",
                }}>
                  <span style={{ fontWeight: 600 }}>{fmt(s.startAt)}</span>
                  <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>
                    {s.side === "COMPANY" ? "Εταιρία" : "Διαχειριστής"}{s.offeredByName ? ` · ${s.offeredByName}` : ""}
                  </span>
                  <span style={{ flex: 1 }} />
                  {s.side !== mySide && (
                    <button disabled={busy} style={btnPrimary} onClick={() => run(() => bookSlot(s.id))}>Κλείσιμο ραντεβού</button>
                  )}
                  {s.side === mySide && (
                    <button disabled={busy} style={{ ...btn, color: "var(--destructive)" }} onClick={() => run(() => removeSlot(s.id))}>
                      <RiDeleteBinLine />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>Δεν υπάρχουν ανοιχτά slots.</p>
          )}

          {request.appointments.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {request.appointments.map((a) => (
                <div key={a.id} style={{ fontSize: 13, color: "var(--foreground)", display: "flex", gap: 8, alignItems: "center" }}>
                  <RiCalendarCheckLine style={{ color: "#15803d" }} />
                  Ραντεβού: {fmt(a.startAt)} – {new Date(a.endAt).toLocaleTimeString("el-GR", { timeStyle: "short" })}
                  {a.managerPresence && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>(με παρουσία διαχειριστή)</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Communication */}
      <div style={card}>
        <div style={h3}><RiChat3Line /> Επικοινωνία</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          {visibleComments.length === 0 && <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", margin: 0 }}>Δεν υπάρχουν μηνύματα.</p>}
          {visibleComments.map((c) => (
            <div key={c.id} style={{
              border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "8px 12px",
              background: c.internal ? "var(--paper)" : c.authorId === viewer.id ? "var(--accent, var(--paper))" : "var(--card)",
            }}>
              <div style={{ display: "flex", gap: 8, fontSize: 11.5, color: "var(--muted-foreground)", marginBottom: 4 }}>
                <strong style={{ color: "var(--foreground)" }}>{c.authorName ?? "—"}</strong>
                <span>{fmt(c.createdAt)}</span>
                {c.internal && <span style={{ color: "#b45309", fontWeight: 600 }}>Εσωτερικό</span>}
              </div>
              <div style={{ fontSize: 13, color: "var(--foreground)", whiteSpace: "pre-wrap" }}>{c.body}</div>
            </div>
          ))}
        </div>
        <FieldTextarea value={comment} onChange={setComment} rows={2} placeholder="Γράψτε μήνυμα…" />
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          {viewer.isStaff && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--foreground)" }}>
              <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
              Εσωτερικό σχόλιο
            </label>
          )}
          <span style={{ flex: 1 }} />
          <button disabled={busy || !comment.trim()} style={btnPrimary}
            onClick={async () => { if (await run(() => addRequestComment(request.id, comment, internal))) setComment(""); }}>
            Αποστολή
          </button>
        </div>
      </div>

      {/* History */}
      <div style={card}>
        <div style={h3}><RiHistoryLine /> Ιστορικό καταστάσεων</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {request.events.map((e) => (
            <div key={e.id} style={{ display: "flex", gap: 10, fontSize: 12.5, color: "var(--muted-foreground)" }}>
              <span style={{ minWidth: 118 }}>{fmt(e.createdAt)}</span>
              <span style={{ color: "var(--foreground)", fontWeight: 600 }}>
                {e.fromStatus ? `${STATUS_LABELS[e.fromStatus as FaultStatus] ?? e.fromStatus} → ` : ""}
                {STATUS_LABELS[e.toStatus as FaultStatus] ?? e.toStatus}
              </span>
              {e.byName && <span>{e.byName}</span>}
              {e.note && <span style={{ fontStyle: "italic" }}>{e.note}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
