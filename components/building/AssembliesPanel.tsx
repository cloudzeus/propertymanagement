"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import { DataTable, type ColDef } from "@/components/ui/data-table";
import { Modal, FormField, FieldInput } from "@/components/ui/modal";
import { listAssemblies, createAssembly, createTestAssembly, type AssemblyRow } from "@/app/actions/assemblies";
import { RiVideoChatLine, RiAddLine, RiCheckLine, RiLoaderLine, RiFlaskLine } from "react-icons/ri";
import type { BuildingCaps } from "@/lib/building-caps";

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Προγραμματισμένη",
  LIVE: "Σε εξέλιξη",
  ENDED: "Ολοκληρώθηκε",
  DRAFT_READY: "Πρόχειρα πρακτικά",
  SENT: "Απεστάλη",
};

export function AssembliesPanel({ buildingId, can }: { buildingId: string; can: BuildingCaps }) {
  const [rows, setRows] = useState<AssemblyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [testing, setTesting] = useState(false);

  const reload = useCallback(() => listAssemblies(buildingId).then(setRows).finally(() => setLoading(false)), [buildingId]);
  useEffect(() => { reload(); }, [reload]);

  const columns: ColDef<AssemblyRow>[] = [
    {
      id: "title", header: "Τίτλος", sortKey: "title", width: 280, accessor: (a) => a.title,
      cell: (a) => (
        <Link href={`/super-admin/buildings/${buildingId}/assemblies/${a.id}`} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, textDecoration: "none" }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: "var(--color-primary)18", color: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RiVideoChatLine style={{ fontSize: 14 }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span>
        </Link>
      ),
    },
    { id: "scheduledAt", header: "Ημερομηνία", sortKey: "scheduledAt", width: 170, accessor: (a) => a.scheduledAt, cell: (a) => <span style={{ fontSize: 12, color: "var(--foreground)" }}>{new Date(a.scheduledAt).toLocaleString("el-GR")}</span> },
    { id: "status", header: "Κατάσταση", width: 150, accessor: (a) => STATUS_LABEL[a.status] ?? a.status, cell: (a) => <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: "var(--bg-canvas)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>{STATUS_LABEL[a.status] ?? a.status}</span> },
    { id: "participantCount", header: "Συμμετέχοντες", width: 120, accessor: (a) => a.participantCount, cell: (a) => <span style={{ fontSize: 12, color: "var(--foreground)" }}>{a.participantCount}</span> },
    { id: "cost", header: "Κόστος", sortKey: "cost", width: 100, accessor: (a) => a.cost, cell: (a) => <span style={{ fontSize: 12, color: "var(--foreground)", whiteSpace: "nowrap" }}>{a.cost.toFixed(2)} €</span> },
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
        storageKey="building-assemblies"
        searchPlaceholder="Αναζήτηση συνέλευσης…"
        toolbar={can.manageAssemblies ? <>
          <button onClick={() => setAdding(true)} style={{ ...btn, ...btnPrimary }}><RiAddLine /> Νέα Συνέλευση</button>
          <button onClick={() => setTesting(true)} style={btn}><RiFlaskLine /> Δοκιμή (Super Admin)</button>
        </> : undefined}
      />
      {adding && <CreateModal buildingId={buildingId} onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload(); }} />}
      {testing && <TestModal buildingId={buildingId} onClose={() => setTesting(false)} onDone={() => { setTesting(false); reload(); }} />}
    </>
  );
}

function CreateModal({ buildingId, onClose, onDone }: { buildingId: string; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    if (!title.trim()) { setError("Ο τίτλος είναι υποχρεωτικός"); return; }
    if (!scheduledAt) { setError("Η ημερομηνία/ώρα είναι υποχρεωτική"); return; }
    startTransition(async () => {
      try {
        await createAssembly({ buildingId, title, scheduledAt: new Date(scheduledAt).toISOString() });
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Σφάλμα");
      }
    });
  }

  return (
    <Modal open onClose={onClose} title="Νέα Συνέλευση" width={520}
      footer={<>
        <button onClick={onClose} style={btnCancel}>Ακύρωση</button>
        <button onClick={save} disabled={isPending} style={btnSave}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Δημιουργία</button>
      </>}>
      {error && <div style={errBox}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <FormField label="Τίτλος" required><FieldInput value={title} onChange={setTitle} placeholder="π.χ. Τακτική Γενική Συνέλευση" /></FormField>
        <FormField label="Ημερομηνία/Ώρα" required><FieldInput type="datetime-local" value={scheduledAt} onChange={setScheduledAt} /></FormField>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

function TestModal({ buildingId, onClose, onDone }: { buildingId: string; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [hostEmail, setHostEmail] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    if (!title.trim()) { setError("Ο τίτλος είναι υποχρεωτικός"); return; }
    if (!scheduledAt) { setError("Η ημερομηνία/ώρα είναι υποχρεωτική"); return; }
    if (!hostEmail.trim()) { setError("Το email διαχειριστή είναι υποχρεωτικό"); return; }
    if (!guestEmail.trim()) { setError("Το email συμμετέχοντα είναι υποχρεωτικό"); return; }
    startTransition(async () => {
      try {
        await createTestAssembly({ buildingId, title, scheduledAt: new Date(scheduledAt).toISOString(), hostEmail, guestEmail });
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Σφάλμα");
      }
    });
  }

  return (
    <Modal open onClose={onClose} title="Δοκιμαστική Συνέλευση (Super Admin)" width={520}
      footer={<>
        <button onClick={onClose} style={btnCancel}>Ακύρωση</button>
        <button onClick={save} disabled={isPending} style={btnSave}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Δημιουργία</button>
      </>}>
      {error && <div style={errBox}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <FormField label="Τίτλος" required><FieldInput value={title} onChange={setTitle} placeholder="π.χ. Δοκιμαστική Γενική Συνέλευση" /></FormField>
        <FormField label="Ημερομηνία/Ώρα" required><FieldInput type="datetime-local" value={scheduledAt} onChange={setScheduledAt} /></FormField>
        <FormField label="Email διαχειριστή" required><FieldInput type="email" value={hostEmail} onChange={setHostEmail} placeholder="host@example.com" /></FormField>
        <FormField label="Email συμμετέχοντα" required><FieldInput type="email" value={guestEmail} onChange={setGuestEmail} placeholder="guest@example.com" /></FormField>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 6, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnPrimary: React.CSSProperties = { background: "var(--color-primary)", color: "#fff", borderColor: "var(--color-primary)" };
const btnCancel: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: 13, color: "var(--foreground)" };
const btnSave: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 };
const errBox: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, marginBottom: 12 };
