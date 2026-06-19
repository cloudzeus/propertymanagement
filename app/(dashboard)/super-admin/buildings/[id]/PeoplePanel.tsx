"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type ColDef, type RowAction } from "@/components/ui/data-table";
import { Modal, FormField, FieldInput } from "@/components/ui/modal";
import { updateUserContact } from "@/app/actions/unit-occupants";
import {
  RiMailLine, RiPhoneLine, RiSmartphoneLine, RiHome4Line, RiMapPin2Line,
  RiPencilLine, RiCheckLine, RiLoaderLine,
} from "react-icons/ri";

export type PUnit = { id: string; unitNumber: string; unitType: string; floor: number | null; areaSqm: number | null; millesimes: number | null; rel: string; from: string | null; to: string | null };
export type Person = {
  id: string; name: string | null; email: string; phone: string | null; mobile: string | null; role: string; status: string;
  relation: "OWNER" | "RESIDENT" | "BOTH";
  unitsHere: PUnit[];
  unitsElsewhere: { unitNumber: string; building: string; property: string; rel: string }[];
};

const UNIT_TYPE: Record<string, string> = { APARTMENT: "Διαμέρισμα", SHOP: "Μαγαζί", PARKING: "Πάρκινγκ", OTHER: "Άλλο" };
const REL_LABEL: Record<string, string> = { OWNER: "Ιδιοκτήτης", RESIDENT: "Ένοικος", BOTH: "Ιδιοκτήτης & Ένοικος" };
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("el-GR") : null);

function relChip(rel: string) {
  const owner = rel.includes("Ιδιοκτήτης");
  const bg = owner ? "var(--color-blue-soft)" : "var(--color-green-soft)";
  const fg = owner ? "var(--color-blue)" : "var(--color-green)";
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: bg, color: fg }}>{rel}</span>;
}

export function PeoplePanel({ people }: { people: Person[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Person | null>(null);
  const columns: ColDef<Person>[] = [
    {
      id: "name", header: "Όνομα", sortKey: "name", width: 220, accessor: (p) => p.name ?? p.email,
      cell: (p) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: "var(--color-primary)18", color: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
            {(p.name ?? p.email)[0]?.toUpperCase()}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name ?? "—"}</span>
        </div>
      ),
    },
    { id: "email", header: "Email", sortKey: "email", width: 220, accessor: (p) => p.email,
      cell: (p) => <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{p.email}</span> },
    { id: "phone", header: "Τηλέφωνο", width: 130, accessor: (p) => p.phone ?? "",
      cell: (p) => <span style={{ fontSize: 12, color: "var(--foreground)" }}>{p.phone ?? "—"}</span> },
    { id: "mobile", header: "Κινητό", width: 130, accessor: (p) => p.mobile ?? "",
      cell: (p) => <span style={{ fontSize: 12, color: "var(--foreground)" }}>{p.mobile ?? "—"}</span> },
    {
      id: "relation", header: "Ιδιότητα", width: 150, accessor: (p) => p.relation,
      cell: (p) => relChip(REL_LABEL[p.relation] ?? p.relation),
    },
    { id: "units", header: "Μονάδες", width: 90, accessor: (p) => p.unitsHere.length,
      cell: (p) => <span style={{ fontSize: 13, color: "var(--foreground)" }}>{p.unitsHere.length}</span> },
  ];

  const getRowActions = (_p: Person): RowAction<Person>[] => [
    { label: "Επεξεργασία", icon: <RiPencilLine />, onClick: (p) => setEditing(p) },
  ];

  return (
    <>
      <DataTable
        data={people}
        columns={columns}
        totalRows={people.length}
        page={1}
        pageSize={25}
        clientSide
        storageKey="building-people"
        searchPlaceholder="Αναζήτηση ενοίκου / ιδιοκτήτη…"
        getRowActions={getRowActions}
        expandedContent={(p) => <PersonExpanded person={p} />}
      />
      {editing && (
        <EditPersonModal person={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); router.refresh(); }} />
      )}
    </>
  );
}

function EditPersonModal({ person, onClose, onDone }: { person: Person; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ name: person.name ?? "", phone: person.phone ?? "", mobile: person.mobile ?? "" });
  const [isPending, startTransition] = useTransition();
  const f = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));
  function save() {
    startTransition(async () => { await updateUserContact(person.id, form); onDone(); });
  }
  return (
    <Modal open onClose={onClose} title={`Επεξεργασία — ${person.name ?? person.email}`} width={460}
      footer={<>
        <button onClick={onClose} style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: 13, color: "var(--foreground)" }}>Ακύρωση</button>
        <button onClick={save} disabled={isPending} style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Αποθήκευση</button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <FormField label="Ονοματεπώνυμο"><FieldInput value={form.name} onChange={f("name")} /></FormField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FormField label="Τηλέφωνο"><FieldInput value={form.phone} onChange={f("phone")} /></FormField>
          <FormField label="Κινητό"><FieldInput value={form.mobile} onChange={f("mobile")} /></FormField>
        </div>
        <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0 }}>Το email δεν αλλάζει εδώ (είναι το username εισόδου).</p>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

function PersonExpanded({ person }: { person: Person }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 18, padding: "4px 6px 8px" }}>
      {/* contact card */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Στοιχεία επικοινωνίας</div>
        <Kv icon={<RiMailLine />} v={person.email} />
        <Kv icon={<RiPhoneLine />} v={person.phone ?? "—"} />
        <Kv icon={<RiSmartphoneLine />} v={person.mobile ?? "—"} />
        <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {relChip(REL_LABEL[person.relation] ?? person.relation)}
          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: "var(--bg-canvas)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>{person.role}</span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: person.status === "ACTIVE" ? "var(--color-green-soft)" : "var(--bg-canvas)", color: person.status === "ACTIVE" ? "var(--color-green)" : "var(--muted-foreground)" }}>{person.status}</span>
        </div>
      </div>

      {/* units */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><RiHome4Line /> Μονάδες σε αυτό το κτήριο</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ textAlign: "left", color: "var(--muted-foreground)", fontSize: 11 }}>
              <th style={th}>Μονάδα</th><th style={th}>Τύπος</th><th style={th}>Όροφος</th><th style={{ ...th, textAlign: "right" }}>τ.μ.</th><th style={{ ...th, textAlign: "right" }}>‰</th><th style={th}>Ιδιότητα</th><th style={th}>Από</th><th style={th}>Έως</th>
            </tr></thead>
            <tbody>
              {person.unitsHere.map((u) => (
                <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={td}><b>{u.unitNumber}</b></td>
                  <td style={td}>{UNIT_TYPE[u.unitType] ?? u.unitType}</td>
                  <td style={td}>{u.floor ?? "—"}</td>
                  <td style={{ ...td, textAlign: "right" }}>{u.areaSqm ?? "—"}</td>
                  <td style={{ ...td, textAlign: "right" }}>{u.millesimes ?? "—"}</td>
                  <td style={td}>{relChip(u.rel)}</td>
                  <td style={td}>{fmtDate(u.from) ?? "—"}</td>
                  <td style={td}>{fmtDate(u.to) ?? <span style={{ color: "var(--color-green)", fontWeight: 700 }}>Τρέχον</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {person.unitsElsewhere.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><RiMapPin2Line /> Άλλες μονάδες (εκτός κτηρίου)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {person.unitsElsewhere.map((u, i) => (
                <div key={i} style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                  <b style={{ color: "var(--foreground)" }}>{u.unitNumber}</b> · {u.building} ({u.property}) — {u.rel}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Kv({ icon, v }: { icon: React.ReactNode; v: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)", padding: "3px 0" }}>
      <span style={{ color: "var(--muted-foreground)", display: "inline-flex" }}>{icon}</span> {v}
    </div>
  );
}

const th: React.CSSProperties = { padding: "6px 8px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "7px 8px", color: "var(--foreground)" };
