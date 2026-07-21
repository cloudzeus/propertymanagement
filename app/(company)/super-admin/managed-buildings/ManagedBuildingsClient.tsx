"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { DataTable, type ColDef } from "@/components/ui/data-table";
import { Modal, FormField, FieldSelect } from "@/components/ui/modal";
import { createManagedItem, listBuildingCommonAreas } from "@/app/actions/managed-items";
import { createRecurringTask, type TaskFrequency } from "@/app/actions/recurring-tasks";
import { fetchBuildingDrilldown } from "@/app/actions/managed-buildings";
import {
  RiBuilding2Line, RiToolsLine, RiStackLine, RiAlarmWarningLine, RiCalendarCheckLine, RiExternalLinkLine,
  RiAddLine, RiCheckLine, RiLoaderLine, RiCalendarLine,
} from "react-icons/ri";
import type { ManagedBuildingRow, ObligationRow, RecentLogRow, ObligationStatus, BuildingDrilldown } from "@/lib/dashboard/managed-buildings";

const STATUS_STYLE: Record<ObligationStatus, { label: string; bg: string; fg: string }> = {
  overdue: { label: "Εκπρόθεσμη", bg: "#FBE4E4", fg: "#9A2B2B" },
  "due-soon": { label: "Επικείμενη", bg: "#FDF1DF", fg: "#9A5B00" },
  scheduled: { label: "Προγραμματισμένη", bg: "#E4F0EA", fg: "#22604A" },
  none: { label: "—", bg: "#F0F0EE", fg: "#8a8a85" },
};

function fmtDate(iso: string | null) { return iso ? new Date(iso).toLocaleDateString("el-GR") : "—"; }

function StatusPill({ status }: { status: ObligationStatus }) {
  const s = STATUS_STYLE[status];
  return <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: s.bg, color: s.fg, whiteSpace: "nowrap" }}>{s.label}</span>;
}

export function ManagedBuildingsClient({ buildings, obligations, recent, itemTypes }: { buildings: ManagedBuildingRow[]; obligations: ObligationRow[]; recent: RecentLogRow[]; itemTypes: { id: string; name: string }[] }) {
  const overdue = useMemo(() => obligations.filter((o) => o.status === "overdue"), [obligations]);
  const dueSoon = useMemo(() => obligations.filter((o) => o.status === "due-soon"), [obligations]);
  const [assignOpen, setAssignOpen] = useState(false);

  const columns: ColDef<ManagedBuildingRow>[] = [
    { id: "name", header: "Κτήριο", accessor: (b) => b.name, cell: (b) => (
      <div>
        <Link href={`/super-admin/buildings/${b.id}`} style={{ fontWeight: 700, color: "var(--foreground)", textDecoration: "none" }}>{b.name}</Link>
        <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>{b.customerName}{b.address ? ` · ${b.address}` : ""}</div>
      </div>
    ) },
    { id: "items", header: "Στοιχεία", accessor: (b) => b.itemCount, cell: (b) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{b.itemCount} <span style={{ color: "var(--muted-foreground)" }}>({b.totalQuantity} τεμ.)</span></span> },
    { id: "schedules", header: "Προγράμματα", accessor: (b) => b.scheduleCount, cell: (b) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{b.scheduleCount}</span> },
    { id: "next", header: "Επόμενη υποχρέωση", accessor: (b) => b.nextDueDate ?? "", cell: (b) => fmtDate(b.nextDueDate) },
    { id: "overdue", header: "Εκπρόθεσμες", accessor: (b) => b.overdueCount, cell: (b) => b.overdueCount > 0
      ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700, color: "#9A2B2B" }}><RiAlarmWarningLine /> {b.overdueCount}</span>
      : <span style={{ color: "var(--muted-foreground)" }}>0</span> },
  ];

  return (
    <div style={{ padding: "22px 24px 40px", maxWidth: 1240 }}>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-.01em", color: "var(--foreground)", display: "flex", alignItems: "center", gap: 9 }}>
          <RiBuilding2Line /> Διαχειριζόμενα κτήρια
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--muted-foreground)" }}>Στοιχεία, προγράμματα συντήρησης και υποχρεώσεις των κτηρίων που διαχειρίζεται η εταιρεία.</p>
        <button onClick={() => setAssignOpen(true)} style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 7, border: "none", background: "var(--color-primary)", color: "#fff", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <RiAddLine /> Ανάθεση στοιχείου
        </button>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 20 }}>
        <StatCard icon={<RiBuilding2Line />} tint="#3B6BB0" value={buildings.length} label="Κτήρια" />
        <StatCard icon={<RiStackLine />} tint="#2E7D5B" value={buildings.reduce((s, b) => s + b.itemCount, 0)} label="Στοιχεία" />
        <StatCard icon={<RiToolsLine />} tint="#9A5B00" value={dueSoon.length} label="Επικείμενες" />
        <StatCard icon={<RiAlarmWarningLine />} tint="#C0392B" value={overdue.length} label="Εκπρόθεσμες" />
      </div>

      {overdue.length > 0 && (
        <section style={panel}>
          <div style={panelTitle}><RiAlarmWarningLine style={{ color: "#C0392B" }} /> Εκπρόθεσμες υποχρεώσεις</div>
          {overdue.map((o) => <ObligationLine key={o.taskId} o={o} />)}
        </section>
      )}
      {dueSoon.length > 0 && (
        <section style={panel}>
          <div style={panelTitle}><RiToolsLine style={{ color: "#9A5B00" }} /> Επικείμενες υποχρεώσεις</div>
          {dueSoon.map((o) => <ObligationLine key={o.taskId} o={o} />)}
        </section>
      )}

      {recent.length > 0 && (
        <section style={panel}>
          <div style={panelTitle}><RiCalendarCheckLine style={{ color: "#3B6BB0" }} /> Πρόσφατη δραστηριότητα</div>
          {recent.slice(0, 10).map((l) => (
            <div key={l.id} style={rowLine}>
              <Link href={`/super-admin/buildings/${l.buildingId}`} style={{ fontWeight: 600, color: "var(--foreground)", textDecoration: "none" }}>{l.buildingName}</Link>
              <span style={{ color: "var(--muted-foreground)" }}>· {l.title}</span>
              <span style={{ marginLeft: "auto", color: "var(--muted-foreground)" }}>{fmtDate(l.performedAt)}{l.performedBy ? ` · ${l.performedBy}` : ""}{l.cost ? ` · ${l.cost}€` : ""}</span>
            </div>
          ))}
        </section>
      )}

      <DataTable
        data={buildings}
        columns={columns}
        totalRows={buildings.length}
        page={1}
        pageSize={25}
        clientSide
        storageKey="managed-buildings"
        searchPlaceholder="Αναζήτηση κτηρίου…"
        expandedContent={(b) => <BuildingDrilldownPanel building={b} obligations={obligations} />}
      />

      {assignOpen && <AssignItemModal buildings={buildings} itemTypes={itemTypes} onClose={() => setAssignOpen(false)} />}
    </div>
  );
}

function BuildingDrilldownPanel({ building, obligations }: { building: ManagedBuildingRow; obligations: ObligationRow[] }) {
  const rows = obligations.filter((o) => o.buildingId === building.id);
  const [data, setData] = useState<BuildingDrilldown | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    fetchBuildingDrilldown(building.id).then((d) => { if (alive) { setData(d); setLoading(false); } }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [building.id]);
  const logs = data?.history.slice(0, 8) ?? [];
  return (
    <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <div>
        <div style={sectionTitle}><RiToolsLine /> Προγράμματα συντήρησης</div>
        {rows.length === 0 ? <div style={muted}>Χωρίς προγράμματα</div> : rows.map((o) => (
          <div key={o.taskId} style={rowLine}>
            <span>{o.title}{o.itemName ? ` · ${o.itemName}` : ""}</span>
            <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8 }}>{fmtDate(o.nextDueDate)} <StatusPill status={o.status} /></span>
          </div>
        ))}
      </div>
      <div>
        <div style={sectionTitle}><RiCalendarCheckLine /> Ιστορικό συντήρησης</div>
        {loading ? <div style={muted}>Φόρτωση…</div> : logs.length === 0 ? <div style={muted}>Χωρίς καταχωρήσεις</div> : logs.map((l) => (
          <div key={l.id} style={rowLine}>
            <span>{l.title}</span>
            <span style={{ marginLeft: "auto", color: "var(--muted-foreground)" }}>{fmtDate(l.performedAt)}{l.performedBy ? ` · ${l.performedBy}` : ""}</span>
          </div>
        ))}
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <Link href={`/super-admin/buildings/${building.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--color-primary)", textDecoration: "none" }}>
          Άνοιγμα καρτέλας κτηρίου <RiExternalLinkLine />
        </Link>
      </div>
    </div>
  );
}

function ObligationLine({ o }: { o: ObligationRow }) {
  return (
    <div style={rowLine}>
      <Link href={`/super-admin/buildings/${o.buildingId}`} style={{ fontWeight: 600, color: "var(--foreground)", textDecoration: "none" }}>{o.buildingName}</Link>
      <span style={{ color: "var(--muted-foreground)" }}>· {o.title}{o.itemName ? ` (${o.itemName})` : ""}</span>
      <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8 }}>{fmtDate(o.nextDueDate)} <StatusPill status={o.status} /></span>
    </div>
  );
}

function StatCard({ icon, tint, value, label }: { icon: React.ReactNode; tint: string; value: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 10, background: `${tint}1A`, color: tint, flex: "none" }}>{icon}</span>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1, color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 1 }}>{label}</div>
      </div>
    </div>
  );
}

const panel: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 };
const panelTitle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "var(--foreground)", marginBottom: 10 };
const sectionTitle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: "var(--foreground)", marginBottom: 8 };
const rowLine: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 13, color: "var(--foreground)", padding: "6px 0", borderTop: "1px solid var(--border)" };
const muted: React.CSSProperties = { fontSize: 12.5, color: "var(--muted-foreground)", padding: "6px 0" };

const FREQ_OPTIONS: { value: TaskFrequency; label: string }[] = [
  { value: "WEEKLY", label: "Εβδομαδιαία" }, { value: "MONTHLY", label: "Μηνιαία" }, { value: "QUARTERLY", label: "Τριμηνιαία" },
  { value: "SEMIANNUAL", label: "Εξαμηνιαία" }, { value: "ANNUAL", label: "Ετήσια" }, { value: "CUSTOM", label: "Προσαρμοσμένη" },
];

function AssignItemModal({ buildings, itemTypes, onClose }: { buildings: ManagedBuildingRow[]; itemTypes: { id: string; name: string }[]; onClose: () => void }) {
  const [buildingId, setBuildingId] = useState("");
  const [areas, setAreas] = useState<{ id: string; name: string; floor: number | null }[]>([]);
  const [form, setForm] = useState({ itemTypeId: "", commonAreaId: "", location: "", quantity: 1 });
  const [sched, setSched] = useState({ enabled: false, frequency: "MONTHLY" as TaskFrequency, nextDueDate: "" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onBuilding(v: string) {
    setBuildingId(v);
    setForm((p) => ({ ...p, commonAreaId: "" }));
    setAreas([]);
    if (v) startTransition(async () => { setAreas(await listBuildingCommonAreas(v)); });
  }

  function save() {
    setError(null);
    if (!buildingId) { setError("Επίλεξε κτήριο"); return; }
    startTransition(async () => {
      const res = await createManagedItem(buildingId, {
        itemTypeId: form.itemTypeId, location: form.location, quantity: form.quantity,
        commonAreaId: form.commonAreaId || null,
      });
      if (res && "error" in res && res.error) { setError(res.error); return; }
      const itemId = (res as { itemId?: string }).itemId;
      if (itemId && sched.enabled) {
        try {
          const sres = await createRecurringTask(buildingId, {
            title: itemTypes.find((t) => t.id === form.itemTypeId)?.name ?? "Συντήρηση",
            frequency: sched.frequency, nextDueDate: sched.nextDueDate || null, managedItemId: itemId, active: true,
          });
          if (sres && "error" in sres && sres.error) { setError(`Το στοιχείο αποθηκεύτηκε, αλλά το πρόγραμμα απέτυχε: ${sres.error}`); return; }
        } catch (e) {
          setError(`Το στοιχείο αποθηκεύτηκε, αλλά το πρόγραμμα απέτυχε: ${e instanceof Error ? e.message : "σφάλμα"}`);
          return;
        }
      }
      onClose();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).location?.reload?.();
    });
  }

  return (
    <Modal open onClose={onClose} title="Ανάθεση διαχειριζόμενου στοιχείου" width={520}
      footer={<>
        <button onClick={onClose} style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: 13, color: "var(--foreground)" }}>Ακύρωση</button>
        <button onClick={save} disabled={isPending} style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Αποθήκευση</button>
      </>}>
      {error && <div style={{ padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, border: "1px solid #fca5a530", marginBottom: 12 }} role="alert">{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <FormField label="Κτήριο" required>
          <FieldSelect value={buildingId} onChange={onBuilding} placeholder="— Επίλεξε κτήριο —" options={buildings.map((b) => ({ value: b.id, label: b.name }))} />
        </FormField>
        <FormField label="Στοιχείο" required hint="Από τον κατάλογο «Στοιχεία Διαχείρισης»">
          <FieldSelect value={form.itemTypeId} onChange={(v) => setForm((p) => ({ ...p, itemTypeId: v }))} placeholder="— Επίλεξε στοιχείο —" options={itemTypes.map((t) => ({ value: t.id, label: t.name }))} />
        </FormField>
        {areas.length > 0 && (
          <FormField label="Κοινόχρηστος χώρος" hint="Προαιρετικό">
            <FieldSelect value={form.commonAreaId} onChange={(v) => setForm((p) => ({ ...p, commonAreaId: v, location: p.location.trim() ? p.location : (areas.find((a) => a.id === v)?.name ?? p.location) }))} placeholder="— Χωρίς σύνδεση —" options={areas.map((a) => ({ value: a.id, label: a.floor != null ? `${a.name} (όροφος ${a.floor})` : a.name }))} />
          </FormField>
        )}
        <FormField label="Τοποθεσία" required>
          <input value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} placeholder="π.χ. Κοινόχρηστοι χώροι" style={{ width: "100%", height: 36, padding: "0 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 13, color: "var(--foreground)", background: "var(--card)", outline: "none", boxSizing: "border-box" }} />
        </FormField>
        <FormField label="Ποσότητα" required>
          <input type="number" min={1} value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: Math.max(1, Math.round(Number(e.target.value)) || 1) }))} style={{ width: 120, height: 36, padding: "0 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 13, color: "var(--foreground)", background: "var(--card)", outline: "none", boxSizing: "border-box", textAlign: "center", fontVariantNumeric: "tabular-nums" }} />
        </FormField>
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--foreground)", cursor: "pointer" }}>
            <input type="checkbox" checked={sched.enabled} onChange={(e) => setSched((p) => ({ ...p, enabled: e.target.checked }))} />
            <RiCalendarLine style={{ color: "var(--muted-foreground)" }} /> Πρόγραμμα συντήρησης
          </label>
          {sched.enabled && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <FormField label="Συχνότητα" required>
                <FieldSelect value={sched.frequency} onChange={(v) => setSched((p) => ({ ...p, frequency: v as TaskFrequency }))} options={FREQ_OPTIONS} />
              </FormField>
              <FormField label="Επόμενη ημερομηνία">
                <input type="date" value={sched.nextDueDate} onChange={(e) => setSched((p) => ({ ...p, nextDueDate: e.target.value }))} style={{ width: "100%", height: 36, padding: "0 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 13, color: "var(--foreground)", background: "var(--card)", outline: "none", boxSizing: "border-box" }} />
              </FormField>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}
