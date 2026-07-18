"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type ColDef } from "@/components/ui/data-table";
import { Modal, FormField, FieldInput, FieldSelect } from "@/components/ui/modal";
import { createOccupant, assignOccupant, clearOccupant, updateUserContact, setOccupancyDates } from "@/app/actions/unit-occupants";
import {
  RiBuilding2Line, RiCommunityLine, RiUserAddLine, RiPencilLine, RiUserUnfollowLine,
  RiCheckLine, RiLoaderLine, RiCalendarEventLine, RiHome4Line, RiKeyLine, RiUserLine,
} from "react-icons/ri";

export type Occupant = { id: string; name: string | null; email: string; phone: string | null; mobile: string | null; since: string | null };
export type UnitRow = { id: string; unitNumber: string; unitType: string; floor: number | null; owner: Occupant | null; resident: Occupant | null };
export type BuildingRow = { id: string; name: string; address: string | null; units: UnitRow[] };
export type PropertyRow = {
  id: string; name: string; address: string; customerId: string; customerName: string;
  buildingsCount: number; unitsCount: number; ownersCount: number; residentsCount: number; vacantCount: number;
  buildings: BuildingRow[];
};
export type Assignable = { id: string; name: string | null; email: string; customerId: string | null };

type Perms = { canCreate: boolean; canEdit: boolean; canDelete: boolean };

const UNIT_TYPE: Record<string, string> = { APARTMENT: "Διαμέρισμα", SHOP: "Μαγαζί", PARKING: "Πάρκινγκ", OTHER: "Άλλο" };
const ROLE_LABEL = { OWNER: "Ιδιοκτήτης", RESIDENT: "Ένοικος" } as const;
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("el-GR") : null);

export function ResidentsClient({ rows, assignables, canCreate, canEdit, canDelete }: {
  rows: PropertyRow[]; assignables: Assignable[];
} & Perms) {
  const columns: ColDef<PropertyRow>[] = [
    {
      id: "name", header: "Ιδιοκτησία", sortKey: "name", width: 260, accessor: (p) => p.name,
      cell: (p) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: "var(--color-primary)14", color: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
            <RiCommunityLine />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.address || "—"}</div>
          </div>
        </div>
      ),
    },
    { id: "customer", header: "Πελάτης", sortKey: "customer", width: 180, accessor: (p) => p.customerName,
      cell: (p) => <span style={{ fontSize: 12, color: "var(--foreground)" }}>{p.customerName}</span> },
    { id: "buildings", header: "Κτήρια", width: 90, accessor: (p) => p.buildingsCount,
      cell: (p) => <Count icon={<RiBuilding2Line />} n={p.buildingsCount} /> },
    { id: "units", header: "Μονάδες", width: 100, accessor: (p) => p.unitsCount,
      cell: (p) => <Count icon={<RiHome4Line />} n={p.unitsCount} /> },
    { id: "owners", header: "Ιδιοκτήτες", width: 100, accessor: (p) => p.ownersCount,
      cell: (p) => <Chip n={p.ownersCount} of={p.unitsCount} tone="blue" /> },
    { id: "residents", header: "Ένοικοι", width: 100, accessor: (p) => p.residentsCount,
      cell: (p) => <Chip n={p.residentsCount} of={p.unitsCount} tone="green" /> },
    { id: "vacant", header: "Κενές", width: 90, accessor: (p) => p.vacantCount,
      cell: (p) => p.vacantCount > 0
        ? <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: "var(--color-orange-soft, #f9731618)", color: "var(--color-orange, #ea580c)" }}>{p.vacantCount}</span>
        : <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>—</span> },
  ];

  return (
    <DataTable
      data={rows}
      columns={columns}
      totalRows={rows.length}
      page={1}
      pageSize={25}
      clientSide
      storageKey="admin-residents"
      searchPlaceholder="Αναζήτηση ιδιοκτησίας ή πελάτη…"
      expandedContent={(p) => (
        <PropertyExpanded property={p} assignables={assignables.filter((a) => a.customerId === p.customerId)}
          canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
      )}
    />
  );
}

// ─── Expanded: buildings → units → occupants ─────────────────────────────────

type ModalState =
  | { kind: "add"; unit: UnitRow; role: "OWNER" | "RESIDENT" }
  | { kind: "edit"; unit: UnitRow; role: "OWNER" | "RESIDENT"; occupant: Occupant }
  | null;

function PropertyExpanded({ property, assignables, canCreate, canEdit, canDelete }: {
  property: PropertyRow; assignables: Assignable[];
} & Perms) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);
  const [isPending, startTransition] = useTransition();
  const [removing, setRemoving] = useState<string | null>(null);

  function remove(unit: UnitRow, role: "OWNER" | "RESIDENT", occ: Occupant) {
    if (!confirm(`Αφαίρεση: ${occ.name ?? occ.email} ως ${ROLE_LABEL[role]} από τη μονάδα ${unit.unitNumber};\nΗ περίοδος κλείνει με σημερινή ημερομηνία λήξης.`)) return;
    setRemoving(`${unit.id}:${role}`);
    startTransition(async () => {
      await clearOccupant(unit.id, role);
      setRemoving(null);
      router.refresh();
    });
  }

  if (property.buildings.length === 0) {
    return <div style={{ padding: "12px 6px", fontSize: 13, color: "var(--muted-foreground)" }}>Δεν υπάρχουν κτήρια σε αυτή την ιδιοκτησία.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "4px 6px 8px" }}>
      {property.buildings.map((b) => (
        <div key={b.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderBottom: "1px solid var(--border)", background: "var(--bg-canvas)" }}>
            <RiBuilding2Line style={{ color: "var(--color-primary)", fontSize: 15 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{b.name}</span>
            {b.address && <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>· {b.address}</span>}
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted-foreground)" }}>{b.units.length} μονάδες</span>
          </div>
          {b.units.length === 0 ? (
            <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--muted-foreground)" }}>Χωρίς μονάδες.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--muted-foreground)", fontSize: 11 }}>
                  <th style={{ ...th, width: 110 }}>Μονάδα</th>
                  <th style={{ ...th, width: 110 }}>Τύπος</th>
                  <th style={{ ...th, width: 70 }}>Όροφος</th>
                  <th style={th}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><RiKeyLine /> Ιδιοκτήτης</span></th>
                  <th style={th}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><RiUserLine /> Ένοικος</span></th>
                </tr>
              </thead>
              <tbody>
                {b.units.map((u) => (
                  <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={td}><b>{u.unitNumber}</b></td>
                    <td style={td}>{UNIT_TYPE[u.unitType] ?? u.unitType}</td>
                    <td style={td}>{u.floor ?? "—"}</td>
                    <OccupantCell unit={u} role="OWNER" occ={u.owner} busy={isPending && removing === `${u.id}:OWNER`}
                      canCreate={canCreate} canEdit={canEdit} canDelete={canDelete}
                      onAdd={() => setModal({ kind: "add", unit: u, role: "OWNER" })}
                      onEdit={(o) => setModal({ kind: "edit", unit: u, role: "OWNER", occupant: o })}
                      onRemove={(o) => remove(u, "OWNER", o)} />
                    <OccupantCell unit={u} role="RESIDENT" occ={u.resident} busy={isPending && removing === `${u.id}:RESIDENT`}
                      canCreate={canCreate} canEdit={canEdit} canDelete={canDelete}
                      onAdd={() => setModal({ kind: "add", unit: u, role: "RESIDENT" })}
                      onEdit={(o) => setModal({ kind: "edit", unit: u, role: "RESIDENT", occupant: o })}
                      onRemove={(o) => remove(u, "RESIDENT", o)} />
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}

      {modal?.kind === "add" && (
        <AddOccupantModal unit={modal.unit} role={modal.role} assignables={assignables}
          onClose={() => setModal(null)} onDone={() => { setModal(null); router.refresh(); }} />
      )}
      {modal?.kind === "edit" && (
        <EditOccupantModal unit={modal.unit} role={modal.role} occupant={modal.occupant}
          onClose={() => setModal(null)} onDone={() => { setModal(null); router.refresh(); }} />
      )}
    </div>
  );
}

function OccupantCell({ unit, role, occ, busy, canCreate, canEdit, canDelete, onAdd, onEdit, onRemove }: {
  unit: UnitRow; role: "OWNER" | "RESIDENT"; occ: Occupant | null; busy: boolean;
  onAdd: () => void; onEdit: (o: Occupant) => void; onRemove: (o: Occupant) => void;
} & Perms) {
  if (!occ) {
    return (
      <td style={td}>
        {canCreate ? (
          <button onClick={onAdd} style={ghostBtn} title={`Προσθήκη ${ROLE_LABEL[role].toLowerCase()} — ${unit.unitNumber}`}>
            <RiUserAddLine /> Προσθήκη
          </button>
        ) : (
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>—</span>
        )}
      </td>
    );
  }
  const tone = role === "OWNER" ? "var(--color-blue, #2563eb)" : "var(--color-green, #16a34a)";
  return (
    <td style={td}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, background: `${role === "OWNER" ? "var(--color-blue-soft, #2563eb18)" : "var(--color-green-soft, #16a34a18)"}`, color: tone, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>
          {(occ.name ?? occ.email)[0]?.toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{occ.name ?? occ.email}</div>
          <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {occ.email}{occ.since ? ` · από ${fmtDate(occ.since)}` : ""}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4, flexShrink: 0 }}>
          {canEdit && (
            <button onClick={() => onEdit(occ)} style={iconBtn} title="Επεξεργασία">
              <RiPencilLine />
            </button>
          )}
          {canDelete && (
            <button onClick={() => onRemove(occ)} disabled={busy} style={{ ...iconBtn, color: "var(--color-destructive, #dc2626)" }} title="Αφαίρεση από τη μονάδα">
              {busy ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiUserUnfollowLine />}
            </button>
          )}
        </div>
      </div>
    </td>
  );
}

// ─── Add: new user OR link existing ──────────────────────────────────────────

function AddOccupantModal({ unit, role, assignables, onClose, onDone }: {
  unit: UnitRow; role: "OWNER" | "RESIDENT"; assignables: Assignable[]; onClose: () => void; onDone: () => void;
}) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", mobile: "", startDate: today, existingId: "" });
  const f = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  function save() {
    setError(null);
    startTransition(async () => {
      const res = mode === "new"
        ? await createOccupant(unit.id, role, { name: form.name, email: form.email, password: form.password, phone: form.phone, mobile: form.mobile, startDate: form.startDate })
        : form.existingId
          ? await assignOccupant(unit.id, role, form.existingId, form.startDate)
          : { error: "Επιλέξτε χρήστη" };
      if (res && "error" in res && res.error) { setError(res.error); return; }
      onDone();
    });
  }

  return (
    <Modal open onClose={onClose} title={`${ROLE_LABEL[role]} — Μονάδα ${unit.unitNumber}`} width={520}
      footer={<>
        <button onClick={onClose} style={cancelBtn}>Ακύρωση</button>
        <button onClick={save} disabled={isPending} style={primaryBtn}>
          {isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Αποθήκευση
        </button>
      </>}>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <TabBtn active={mode === "new"} onClick={() => setMode("new")}>Νέος χρήστης</TabBtn>
        <TabBtn active={mode === "existing"} onClick={() => setMode("existing")}>Υπάρχων χρήστης</TabBtn>
      </div>
      {error && <div style={errBox}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {mode === "new" ? (
          <>
            <FormField label="Ονοματεπώνυμο" required><FieldInput value={form.name} onChange={f("name")} /></FormField>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <FormField label="Email" required><FieldInput type="email" value={form.email} onChange={f("email")} /></FormField>
              <FormField label="Κωδικός (min 6)" required><FieldInput type="password" value={form.password} onChange={f("password")} /></FormField>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <FormField label="Τηλέφωνο"><FieldInput value={form.phone} onChange={f("phone")} /></FormField>
              <FormField label="Κινητό"><FieldInput value={form.mobile} onChange={f("mobile")} /></FormField>
            </div>
          </>
        ) : (
          <FormField label="Χρήστης (μόνο του ίδιου πελάτη)" required>
            <FieldSelect value={form.existingId} onChange={f("existingId")}
              options={[{ value: "", label: "— Επιλέξτε —" }, ...assignables.map((a) => ({ value: a.id, label: `${a.name ?? a.email} (${a.email})` }))]} />
          </FormField>
        )}
        <FormField label="Έναρξη (από)" required><FieldInput type="date" value={form.startDate} onChange={f("startDate")} /></FormField>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

// ─── Edit: contact + occupancy dates ─────────────────────────────────────────

function EditOccupantModal({ unit, role, occupant, onClose, onDone }: {
  unit: UnitRow; role: "OWNER" | "RESIDENT"; occupant: Occupant; onClose: () => void; onDone: () => void;
}) {
  const toInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");
  const [form, setForm] = useState({ name: occupant.name ?? "", phone: occupant.phone ?? "", mobile: occupant.mobile ?? "", from: toInput(occupant.since), to: "" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const f = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  function save() {
    setError(null);
    startTransition(async () => {
      await updateUserContact(occupant.id, { name: form.name, phone: form.phone, mobile: form.mobile });
      if (form.from) {
        const res = await setOccupancyDates({ unitId: unit.id, userId: occupant.id, role, startDate: form.from, endDate: form.to || null });
        if (res && "error" in res && res.error) { setError(res.error); return; }
      }
      onDone();
    });
  }

  return (
    <Modal open onClose={onClose} title={`Επεξεργασία — ${occupant.name ?? occupant.email} (${ROLE_LABEL[role]}, ${unit.unitNumber})`} width={500}
      footer={<>
        <button onClick={onClose} style={cancelBtn}>Ακύρωση</button>
        <button onClick={save} disabled={isPending} style={primaryBtn}>
          {isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Αποθήκευση
        </button>
      </>}>
      {error && <div style={errBox}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <FormField label="Ονοματεπώνυμο"><FieldInput value={form.name} onChange={f("name")} /></FormField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FormField label="Τηλέφωνο"><FieldInput value={form.phone} onChange={f("phone")} /></FormField>
          <FormField label="Κινητό"><FieldInput value={form.mobile} onChange={f("mobile")} /></FormField>
        </div>
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <RiCalendarEventLine /> Περίοδος στη μονάδα
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <FormField label="Από"><FieldInput type="date" value={form.from} onChange={f("from")} /></FormField>
            <FormField label="Έως (κενό = τρέχον)"><FieldInput type="date" value={form.to} onChange={f("to")} /></FormField>
          </div>
        </div>
        <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0 }}>Το email δεν αλλάζει εδώ (είναι το username εισόδου).</p>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

// ─── Small presentational bits ────────────────────────────────────────────────

function Count({ icon, n }: { icon: React.ReactNode; n: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--foreground)" }}>
      <span style={{ color: "var(--muted-foreground)", display: "inline-flex" }}>{icon}</span>{n}
    </span>
  );
}

function Chip({ n, of, tone }: { n: number; of: number; tone: "blue" | "green" }) {
  const bg = tone === "blue" ? "var(--color-blue-soft, #2563eb18)" : "var(--color-green-soft, #16a34a18)";
  const fg = tone === "blue" ? "var(--color-blue, #2563eb)" : "var(--color-green, #16a34a)";
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: bg, color: fg }}>{n}/{of}</span>;
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 14px", borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
      border: `1px solid ${active ? "var(--color-primary)" : "var(--border)"}`,
      background: active ? "var(--color-primary)14" : "var(--card)",
      color: active ? "var(--color-primary)" : "var(--muted-foreground)",
    }}>{children}</button>
  );
}

const th: React.CSSProperties = { padding: "7px 12px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "8px 12px", color: "var(--foreground)", verticalAlign: "middle" };
const ghostBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, border: "1px dashed var(--border)", background: "transparent", color: "var(--muted-foreground)", borderRadius: 6, padding: "5px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" };
const iconBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 5, fontSize: 13, cursor: "pointer" };
const cancelBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: 13, color: "var(--foreground)" };
const primaryBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 };
const errBox: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, background: "#fee2e240", color: "#dc2626", fontSize: 12, marginBottom: 12 };
