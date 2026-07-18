"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormField, FieldInput, FieldSelect, FieldTextarea } from "@/components/ui/modal";
import {
  createRecurringTask, updateRecurringTask, deleteRecurringTask, type TaskFrequency, type TaskInput,
} from "@/app/actions/recurring-tasks";
import { completeMaintenance } from "@/app/actions/maintenance-logs";
import type { BuildingCaps } from "@/lib/building-caps";
import {
  RiAddLine, RiArrowLeftSLine, RiArrowRightSLine, RiCheckLine, RiLoaderLine,
  RiDeleteBinLine, RiCheckboxCircleLine,
} from "react-icons/ri";

export type TaskRow = { id: string; title: string; frequency: TaskFrequency; nextDueDate: string | null; vendor: string | null; notes: string | null; active: boolean; kind: string; inServicePackage: boolean; reminderDaysBefore: number };

const FREQ_OPTS: { value: TaskFrequency; label: string }[] = [
  { value: "WEEKLY", label: "Εβδομαδιαία" }, { value: "MONTHLY", label: "Μηνιαία" },
  { value: "QUARTERLY", label: "Τριμηνιαία" }, { value: "SEMIANNUAL", label: "Εξαμηνιαία" },
  { value: "ANNUAL", label: "Ετήσια" }, { value: "CUSTOM", label: "Μία φορά" },
];
const KIND_OPTS = [
  { value: "GENERAL", label: "Γενική" }, { value: "ELEVATOR", label: "Ανελκυστήρας" },
  { value: "BOILER", label: "Λέβητας/Καυστήρας" }, { value: "FIRE_SAFETY", label: "Πυρασφάλεια" },
  { value: "HVAC", label: "Κλιματισμός" }, { value: "ELECTRICAL", label: "Ηλεκτρολογικά" },
  { value: "PLUMBING", label: "Υδραυλικά" }, { value: "OTHER", label: "Άλλο" },
];
const FREQ_LABEL = Object.fromEntries(FREQ_OPTS.map((f) => [f.value, f.label]));
const FREQ_COLOR: Record<string, [string, string]> = {
  WEEKLY: ["var(--color-green-soft)", "var(--color-green)"],
  MONTHLY: ["var(--color-blue-soft)", "var(--color-blue)"],
  QUARTERLY: ["var(--color-purple-soft)", "var(--color-purple)"],
  SEMIANNUAL: ["var(--color-orange-soft)", "var(--color-orange)"],
  ANNUAL: ["var(--color-orange-soft)", "var(--color-orange)"],
  CUSTOM: ["var(--bg-canvas)", "var(--muted-foreground)"],
};
const WD = ["Δε", "Τρ", "Τε", "Πε", "Πα", "Σα", "Κυ"];
const MONTHS = ["Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος", "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος"];

function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function mondayOf(d: Date) { const x = startOfDay(d); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function step(d: Date, freq: TaskFrequency, dir: number) {
  const x = new Date(d);
  if (freq === "WEEKLY") x.setDate(x.getDate() + 7 * dir);
  else if (freq === "MONTHLY") x.setMonth(x.getMonth() + dir);
  else if (freq === "QUARTERLY") x.setMonth(x.getMonth() + 3 * dir);
  else if (freq === "SEMIANNUAL") x.setMonth(x.getMonth() + 6 * dir);
  else if (freq === "ANNUAL") x.setFullYear(x.getFullYear() + dir);
  return x;
}
/** Occurrences of a task within [start,end] inclusive. */
function occurrences(t: TaskRow, start: Date, end: Date): Date[] {
  if (!t.active || !t.nextDueDate) return [];
  const base = startOfDay(new Date(t.nextDueDate));
  if (t.frequency === "CUSTOM") return base >= start && base <= end ? [base] : [];
  const res: Date[] = [];
  let cur = new Date(base);
  let guard = 0;
  while (cur > start && guard++ < 400) cur = step(cur, t.frequency, -1);
  while (cur < start && guard++ < 400) cur = step(cur, t.frequency, 1);
  while (cur <= end && guard++ < 400) { res.push(new Date(cur)); cur = step(cur, t.frequency, 1); }
  return res;
}

type View = "month" | "week" | "day";

export function CalendarPanel({ buildingId, tasks, today, can }: { buildingId: string; tasks: TaskRow[]; today: string; can: BuildingCaps }) {
  const router = useRouter();
  const now = useMemo(() => startOfDay(new Date(today)), [today]);
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState<Date>(now);
  const [edit, setEdit] = useState<TaskRow | null | "new">(null);
  const [completing, setCompleting] = useState<TaskRow | null>(null);
  const onEvent = can.manageCalendar ? (t: TaskRow) => setEdit(t) : () => {};

  const move = (dir: number) => {
    if (view === "month") { const d = new Date(cursor); d.setMonth(d.getMonth() + dir); setCursor(d); }
    else if (view === "week") setCursor(addDays(cursor, 7 * dir));
    else setCursor(addDays(cursor, dir));
  };

  const title = view === "month" ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
    : view === "week" ? `Εβδομάδα ${mondayOf(cursor).toLocaleDateString("el-GR")}`
    : cursor.toLocaleDateString("el-GR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div>
      {/* toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => move(-1)} style={iconBtn}><RiArrowLeftSLine /></button>
          <button onClick={() => setCursor(now)} style={btn}>Σήμερα</button>
          <button onClick={() => move(1)} style={iconBtn}><RiArrowRightSLine /></button>
          <div style={{ fontSize: 16, fontWeight: 800, marginLeft: 6, textTransform: "capitalize" }}>{title}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4, background: "var(--bg-canvas)", border: "1px solid var(--border)", borderRadius: 6, padding: 3 }}>
            {(["day", "week", "month"] as View[]).map((v) => (
              <button key={v} onClick={() => setView(v)} style={{ border: "none", borderRadius: 4, padding: "5px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", background: view === v ? "var(--card)" : "transparent", color: view === v ? "var(--color-primary)" : "var(--muted-foreground)", boxShadow: view === v ? "0 1px 2px rgba(0,0,0,.06)" : "none" }}>
                {v === "day" ? "Ημέρα" : v === "week" ? "Εβδομάδα" : "Μήνας"}
              </button>
            ))}
          </div>
          {can.manageCalendar && <button onClick={() => setEdit("new")} style={{ ...btn, ...btnPrimary }}><RiAddLine /> Εργασία</button>}
        </div>
      </div>

      {view === "month" && <MonthView cursor={cursor} now={now} tasks={tasks} onEvent={onEvent} />}
      {view === "week" && <WeekView cursor={cursor} now={now} tasks={tasks} onEvent={onEvent} />}
      {view === "day" && <DayView cursor={cursor} now={now} tasks={tasks} onEvent={onEvent} />}

      {edit !== null && (
        <TaskModal buildingId={buildingId} editing={edit === "new" ? null : edit} onClose={() => setEdit(null)} onComplete={(t) => { setEdit(null); setCompleting(t); }} onDone={() => { setEdit(null); router.refresh(); }} />
      )}
      {completing && (
        <CompleteModal task={completing} onClose={() => setCompleting(null)} onDone={() => { setCompleting(null); router.refresh(); }} />
      )}
    </div>
  );
}

function EventChip({ t, onClick }: { t: TaskRow; onClick: () => void }) {
  const [bg, fg] = FREQ_COLOR[t.frequency] ?? FREQ_COLOR.CUSTOM;
  return (
    <button onClick={onClick} title={`${t.title} · ${FREQ_LABEL[t.frequency]}`} style={{ display: "block", width: "100%", textAlign: "left", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 11, fontWeight: 600, background: bg, color: fg, cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
      {t.title}
    </button>
  );
}

function MonthView({ cursor, now, tasks, onEvent }: { cursor: Date; now: Date; tasks: TaskRow[]; onEvent: (t: TaskRow) => void }) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = mondayOf(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const end = cells[41];
  const evByDay = useMemo(() => {
    const m = new Map<string, TaskRow[]>();
    for (const t of tasks) for (const d of occurrences(t, gridStart, end)) {
      const k = d.toDateString(); if (!m.has(k)) m.set(k, []); m.get(k)!.push(t);
    }
    return m;
  }, [tasks, gridStart.getTime(), end.getTime()]);

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "var(--card)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: "1px solid var(--border)" }}>
        {WD.map((d) => <div key={d} style={{ padding: "8px 10px", fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textAlign: "center" }}>{d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = sameDay(d, now);
          const evs = evByDay.get(d.toDateString()) ?? [];
          return (
            <div key={i} style={{ minHeight: 92, borderRight: (i % 7 !== 6) ? "1px solid var(--border)" : "none", borderBottom: i < 35 ? "1px solid var(--border)" : "none", padding: 5, background: inMonth ? "var(--card)" : "var(--bg-canvas)", opacity: inMonth ? 1 : 0.6 }}>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <span style={{ fontSize: 12, fontWeight: isToday ? 800 : 600, width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: isToday ? "var(--color-primary)" : "transparent", color: isToday ? "#fff" : "var(--foreground)" }}>{d.getDate()}</span>
              </div>
              {evs.slice(0, 3).map((t, j) => <EventChip key={j} t={t} onClick={() => onEvent(t)} />)}
              {evs.length > 3 && <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>+{evs.length - 3} ακόμα</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ cursor, now, tasks, onEvent }: { cursor: Date; now: Date; tasks: TaskRow[]; onEvent: (t: TaskRow) => void }) {
  const start = mondayOf(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8 }}>
      {days.map((d, i) => {
        const evs = tasks.flatMap((t) => occurrences(t, d, d).map(() => t));
        const isToday = sameDay(d, now);
        return (
          <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 8, background: "var(--card)", minHeight: 160, overflow: "hidden" }}>
            <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", background: isToday ? "var(--color-primary-soft)" : "var(--bg-canvas)" }}>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 700 }}>{WD[i]}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: isToday ? "var(--color-primary)" : "var(--foreground)" }}>{d.getDate()}</div>
            </div>
            <div style={{ padding: 6 }}>
              {evs.length === 0 ? <div style={{ fontSize: 11, color: "var(--muted-foreground)", padding: 4 }}>—</div> : evs.map((t, j) => <EventChip key={j} t={t} onClick={() => onEvent(t)} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayView({ cursor, now, tasks, onEvent }: { cursor: Date; now: Date; tasks: TaskRow[]; onEvent: (t: TaskRow) => void }) {
  const evs = tasks.filter((t) => occurrences(t, cursor, cursor).length > 0);
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, background: "var(--card)", padding: 16 }}>
      {evs.length === 0 ? (
        <div style={{ color: "var(--muted-foreground)", fontSize: 13, textAlign: "center", padding: 24 }}>Καμία εργασία για αυτή την ημέρα.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {evs.map((t) => {
            const [bg, fg] = FREQ_COLOR[t.frequency] ?? FREQ_COLOR.CUSTOM;
            return (
              <button key={t.id} onClick={() => onEvent(t)} style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", background: "var(--card)", cursor: "pointer", textAlign: "left" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: fg, flexShrink: 0 }} />
                <span style={{ flex: 1 }}><span style={{ fontSize: 14, fontWeight: 600 }}>{t.title}</span>{t.vendor && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}> · {t.vendor}</span>}</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: bg, color: fg }}>{FREQ_LABEL[t.frequency]}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TaskModal({ buildingId, editing, onClose, onComplete, onDone }: { buildingId: string; editing: TaskRow | null; onClose: () => void; onComplete: (t: TaskRow) => void; onDone: () => void }) {
  const toInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");
  const [form, setForm] = useState({ title: editing?.title ?? "", frequency: (editing?.frequency ?? "MONTHLY") as TaskFrequency, nextDueDate: toInput(editing?.nextDueDate ?? null), vendor: editing?.vendor ?? "", notes: editing?.notes ?? "" });
  const [kind, setKind] = useState(editing?.kind ?? "GENERAL");
  const [inServicePackage, setInServicePackage] = useState(editing?.inServicePackage ?? false);
  const [reminderDaysBefore, setReminderDaysBefore] = useState(editing?.reminderDaysBefore ?? 7);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const f = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));
  function save() {
    setError(null);
    const payload = { ...form, kind: kind as TaskInput["kind"], inServicePackage, reminderDaysBefore };
    startTransition(async () => {
      const res = editing ? await updateRecurringTask(editing.id, payload) : await createRecurringTask(buildingId, payload);
      if (res && "error" in res && res.error) { setError(res.error); return; }
      onDone();
    });
  }
  function del() { if (!editing || !confirm("Διαγραφή εργασίας;")) return; startTransition(async () => { await deleteRecurringTask(editing.id); onDone(); }); }

  return (
    <Modal open onClose={onClose} title={editing ? "Επεξεργασία εργασίας" : "Νέα επαναλαμβανόμενη εργασία"} width={500}
      footer={<>
        {editing && <button onClick={del} disabled={isPending} style={{ ...cancelBtn, color: "#c50f1f", marginRight: "auto" }}><RiDeleteBinLine /> Διαγραφή</button>}
        {editing && <button onClick={() => onComplete(editing)} disabled={isPending} style={cancelBtn}><RiCheckboxCircleLine /> Ολοκλήρωση</button>}
        <button onClick={onClose} style={cancelBtn}>Ακύρωση</button>
        <button onClick={save} disabled={isPending} style={saveBtn}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Αποθήκευση</button>
      </>}>
      {error && <div style={errBox}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <FormField label="Τίτλος" required><FieldInput value={form.title} onChange={f("title")} placeholder="π.χ. Συντήρηση ανελκυστήρα" /></FormField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FormField label="Συχνότητα"><FieldSelect value={form.frequency} onChange={(v) => f("frequency")(v)} options={FREQ_OPTS} /></FormField>
          <FormField label="Επόμενη ημ/νία"><FieldInput type="date" value={form.nextDueDate} onChange={f("nextDueDate")} /></FormField>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FormField label="Τύπος συντήρησης"><FieldSelect value={kind} onChange={(v) => setKind(v)} options={KIND_OPTS} /></FormField>
          <FormField label="Υπενθύμιση (ημέρες πριν)"><FieldInput type="number" value={String(reminderDaysBefore)} onChange={(v) => setReminderDaysBefore(Number(v) || 0)} /></FormField>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)", cursor: "pointer" }}>
          <input type="checkbox" checked={inServicePackage} onChange={(e) => setInServicePackage(e.target.checked)} />
          Εντός πακέτου υπηρεσιών
        </label>
        <FormField label="Ανάδοχος / συνεργείο"><FieldInput value={form.vendor} onChange={f("vendor")} placeholder="π.χ. KLEEMANN" /></FormField>
        <FormField label="Σημειώσεις"><FieldTextarea value={form.notes} onChange={f("notes")} rows={2} /></FormField>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

export function CompleteModal({ task, onClose, onDone }: { task: TaskRow; onClose: () => void; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [performedAt, setPerformedAt] = useState(new Date().toISOString().slice(0, 10));
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  function submit() {
    start(async () => {
      const fd = new FormData();
      if (file) fd.set("file", file);
      await completeMaintenance(task.id, { performedAt, cost, notes }, fd);
      onDone();
    });
  }
  return (
    <Modal open onClose={onClose} title="Ολοκλήρωση συντήρησης" width={500}
      footer={<>
        <button onClick={onClose} style={cancelBtn}>Ακύρωση</button>
        <button onClick={submit} disabled={pending} style={saveBtn}>{pending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Καταχώριση</button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <FormField label="Ημερομηνία"><FieldInput type="date" value={performedAt} onChange={setPerformedAt} /></FormField>
        <FormField label="Κόστος (€)"><FieldInput type="number" value={cost} onChange={setCost} /></FormField>
        <FormField label="Σημειώσεις"><FieldTextarea value={notes} onChange={setNotes} rows={2} /></FormField>
        <FormField label="Πιστοποιητικό (προαιρετικό)"><input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></FormField>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 6, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnPrimary: React.CSSProperties = { background: "var(--color-primary)", color: "#fff", borderColor: "var(--color-primary)" };
const iconBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 6, cursor: "pointer" };
const cancelBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: 13, color: "var(--foreground)" };
const saveBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 };
const errBox: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, marginBottom: 12 };
