"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type ColDef, type RowAction } from "@/components/ui/data-table";
import { Modal, FormField, FieldInput, FieldSelect } from "@/components/ui/modal";
import { createUnit, updateUnit, deleteUnit, recalculateMillesimes, type UnitInput } from "@/app/actions/buildings";
import { createOccupant, assignOccupant, clearOccupant } from "@/app/actions/unit-occupants";
import { computeMillesimes } from "@/lib/millesimes";
import { UserCombo } from "@/components/ui/user-combo";
import { CUSTOMER_ROLES } from "@/lib/roles-constants";
import {
  RiHome4Line, RiStore2Line, RiCarLine, RiBox3Line, RiAddLine, RiPencilLine,
  RiDeleteBinLine, RiCheckLine, RiLoaderLine, RiCalculatorLine, RiUserStarLine, RiUserLine, RiCloseLine, RiSearchLine,
} from "react-icons/ri";

export type TOccupant = { id: string; name: string | null; email: string };
export type Unit = {
  id: string; unitNumber: string; unitType: string; floor: number | null;
  areaSqm: number | null; millesimes: number | null; customerId: string;
  owner: TOccupant | null; resident: TOccupant | null;
};

const UNIT_TYPE_LABEL: Record<string, string> = { APARTMENT: "Διαμέρισμα", SHOP: "Μαγαζί", PARKING: "Πάρκινγκ", OTHER: "Άλλο" };
const UNIT_TYPE_ICON: Record<string, React.ElementType> = { APARTMENT: RiHome4Line, SHOP: RiStore2Line, PARKING: RiCarLine, OTHER: RiBox3Line };

function typeChip(type: string) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: "var(--bg-canvas)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>{UNIT_TYPE_LABEL[type] ?? type}</span>;
}

function occCell(o: TOccupant | null) {
  if (!o) return <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>—</span>;
  return <span style={{ fontSize: 12, color: "var(--foreground)" }}>{o.name ?? o.email}</span>;
}

export function UnitsPanel({ buildingId, units }: { buildingId: string; units: Unit[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Unit | null>(null);
  const [adding, setAdding] = useState(false);
  const [recalc, setRecalc] = useState(false);
  const [occUnit, setOccUnit] = useState<Unit | null>(null);
  const refresh = () => router.refresh();

  const totalMil = Math.round(units.reduce((s, u) => s + (u.millesimes ?? 0), 0) * 100) / 100;

  const columns: ColDef<Unit>[] = [
    {
      id: "unitNumber", header: "Μονάδα", sortKey: "unitNumber", width: 180, accessor: (u) => u.unitNumber,
      cell: (u) => {
        const Icon = UNIT_TYPE_ICON[u.unitType] ?? RiBox3Line;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: "var(--color-primary)18", color: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon style={{ fontSize: 15 }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.unitNumber}</span>
          </div>
        );
      },
    },
    { id: "unitType", header: "Τύπος", width: 120, accessor: (u) => UNIT_TYPE_LABEL[u.unitType] ?? u.unitType, cell: (u) => typeChip(u.unitType) },
    { id: "floor", header: "Όροφος", width: 90, accessor: (u) => u.floor ?? -999, cell: (u) => <span style={{ fontSize: 13, color: "var(--foreground)" }}>{u.floor ?? "—"}</span> },
    { id: "areaSqm", header: "τ.μ.", width: 90, accessor: (u) => u.areaSqm ?? 0, cell: (u) => <span style={{ fontSize: 13, color: "var(--foreground)" }}>{u.areaSqm ?? "—"}</span> },
    { id: "millesimes", header: "Χιλιοστά", width: 100, accessor: (u) => u.millesimes ?? 0, cell: (u) => <span style={{ fontSize: 13, color: "var(--foreground)" }}>{u.millesimes != null ? `${u.millesimes}‰` : "—"}</span> },
    { id: "owner", header: "Ιδιοκτήτης", width: 170, accessor: (u) => u.owner?.name ?? u.owner?.email ?? "", cell: (u) => occCell(u.owner) },
    { id: "resident", header: "Ένοικος", width: 170, accessor: (u) => u.resident?.name ?? u.resident?.email ?? "", cell: (u) => occCell(u.resident) },
  ];

  const getRowActions = (_u: Unit): RowAction<Unit>[] => [
    { label: "Ιδιοκτήτης / Ένοικος", icon: <RiUserStarLine />, onClick: (u) => setOccUnit(u) },
    { label: "Επεξεργασία", icon: <RiPencilLine />, onClick: (u) => setEditing(u) },
    { label: "Διαγραφή", icon: <RiDeleteBinLine />, danger: true, onClick: (u) => { if (confirm(`Διαγραφή μονάδας «${u.unitNumber}»;`)) deleteUnit(u.id).then(refresh); } },
  ];

  return (
    <>
      <DataTable
        data={units}
        columns={columns}
        totalRows={units.length}
        page={1}
        pageSize={25}
        clientSide
        storageKey="building-units"
        searchPlaceholder="Αναζήτηση μονάδας…"
        getRowActions={getRowActions}
        toolbar={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Σύνολο χιλιοστών: <b style={{ color: totalMil === 1000 ? "var(--color-green)" : "var(--foreground)" }}>{totalMil}‰</b></span>
            <button onClick={() => setRecalc(true)} style={btn}><RiCalculatorLine /> Υπολογισμός χιλιοστών</button>
            <button onClick={() => setAdding(true)} style={{ ...btn, ...btnPrimary }}><RiAddLine /> Νέα μονάδα</button>
          </div>
        }
      />
      {(adding || editing) && (
        <UnitModal buildingId={buildingId} editing={editing} onClose={() => { setAdding(false); setEditing(null); }} onDone={() => { setAdding(false); setEditing(null); refresh(); }} />
      )}
      {recalc && <MillesimesModal units={units} buildingId={buildingId} onClose={() => setRecalc(false)} onDone={() => { setRecalc(false); refresh(); }} />}
      {occUnit && <OccupantsModal unit={occUnit} onClose={() => setOccUnit(null)} onDone={refresh} />}
    </>
  );
}

function OccupantsModal({ unit, onClose, onDone }: { unit: Unit; onClose: () => void; onDone: () => void }) {
  return (
    <Modal open onClose={onClose} title={`Ιδιοκτήτης / Ένοικος — Μονάδα ${unit.unitNumber}`} width={520}
      footer={<button onClick={onClose} style={btnCancel}>Κλείσιμο</button>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Slot unitId={unit.id} customerId={unit.customerId} role="OWNER" label="Ιδιοκτήτης" current={unit.owner} onDone={onDone} />
        <Slot unitId={unit.id} customerId={unit.customerId} role="RESIDENT" label="Ένοικος" current={unit.resident} onDone={onDone} />
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

const emptyForm = { name: "", email: "", password: "", phone: "", mobile: "", startDate: "", afm: "", doy: "", contactName: "", contactEmail: "", contactPhone: "" };

function Slot({ unitId, customerId, role, label, current, onDone }: { unitId: string; customerId: string; role: "OWNER" | "RESIDENT"; label: string; current: TOccupant | null; onDone: () => void }) {
  const [occupant, setOccupant] = useState<TOccupant | null>(current);
  const [adding, setAdding] = useState(false);
  const [isCompany, setIsCompany] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [error, setError] = useState<string | null>(null);
  const [aadeLoading, setAadeLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const f = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function aadeLookup() {
    const afm = form.afm.replace(/\D/g, "");
    if (afm.length !== 9) { setError("Συμπληρώστε έγκυρο ΑΦΜ (9 ψηφία)"); return; }
    setAadeLoading(true); setError(null);
    try {
      const res = await fetch("/api/aade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ afm }) });
      const data: { data?: Record<string, string>; error?: string } = await res.json();
      if (!res.ok || !data.data) { setError(data.error ?? "Δεν βρέθηκαν στοιχεία ΑΑΔΕ"); return; }
      setForm((p) => ({ ...p, name: data.data!.name || p.name, doy: data.data!.taxOffice || p.doy }));
    } catch { setError("Σφάλμα αναζήτησης ΑΑΔΕ"); } finally { setAadeLoading(false); }
  }

  function create() {
    setError(null);
    startTransition(async () => { const res = await createOccupant(unitId, role, { ...form, isCompany }); if ("error" in res && res.error) { setError(res.error); return; } setOccupant(res.occupant ?? null); setAdding(false); setIsCompany(false); setForm({ ...emptyForm }); onDone(); });
  }
  function pickExisting(userId: string) {
    setError(null);
    startTransition(async () => { const res = await assignOccupant(unitId, role, userId); if ("error" in res && res.error) { setError(res.error); return; } setOccupant(res.occupant ?? null); onDone(); });
  }
  function clear() { if (!confirm(`Αφαίρεση ${label.toLowerCase()};`)) return; startTransition(async () => { await clearOccupant(unitId, role); setOccupant(null); onDone(); }); }
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        {role === "OWNER" ? <RiUserStarLine /> : <RiUserLine />} {label}
      </div>
      {occupant ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{occupant.name || "—"}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{occupant.email}</div>
          </div>
          <button onClick={clear} disabled={isPending} style={{ ...btnSmall, color: "#c50f1f" }}><RiCloseLine /> Αφαίρεση</button>
        </div>
      ) : adding ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {error && <div style={errBox}>{error}</div>}
          <FormField label="Τύπος">
            <FieldSelect value={isCompany ? "COMPANY" : "INDIVIDUAL"} onChange={(v) => setIsCompany(v === "COMPANY")}
              options={[{ value: "INDIVIDUAL", label: "Ιδιώτης" }, { value: "COMPANY", label: "Εταιρεία" }]} />
          </FormField>

          {isCompany ? (
            <>
              <FormField label="Επωνυμία" required><FieldInput value={form.name} onChange={f("name")} placeholder="π.χ. Εταιρεία ΕΠΕ" /></FormField>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "end" }}>
                <FormField label="ΑΦΜ"><FieldInput value={form.afm} onChange={f("afm")} placeholder="123456789" /></FormField>
                <button type="button" onClick={aadeLookup} disabled={aadeLoading} title="Άντληση στοιχείων από ΑΑΔΕ" style={{ ...btnSmall, height: 34 }}>
                  {aadeLoading ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiSearchLine />} ΑΑΔΕ
                </button>
                <FormField label="ΔΟΥ"><FieldInput value={form.doy} onChange={f("doy")} /></FormField>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>Πρόσωπο επικοινωνίας</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <FormField label="Ονοματεπώνυμο"><FieldInput value={form.contactName} onChange={f("contactName")} /></FormField>
                <FormField label="Email επικοινωνίας"><FieldInput type="email" value={form.contactEmail} onChange={f("contactEmail")} /></FormField>
              </div>
              <FormField label="Τηλέφωνο επικοινωνίας"><FieldInput value={form.contactPhone} onChange={f("contactPhone")} /></FormField>
            </>
          ) : (
            <>
              <FormField label="Ονοματεπώνυμο" required><FieldInput value={form.name} onChange={f("name")} /></FormField>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <FormField label="Τηλέφωνο"><FieldInput value={form.phone} onChange={f("phone")} /></FormField>
                <FormField label="Κινητό"><FieldInput value={form.mobile} onChange={f("mobile")} /></FormField>
              </div>
            </>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <FormField label={isCompany ? "Email σύνδεσης" : "Email"} required><FieldInput type="email" value={form.email} onChange={f("email")} /></FormField>
            <FormField label="Κωδικός εισόδου" required><FieldInput type="password" value={form.password} onChange={f("password")} placeholder="Τουλάχιστον 6 χαρακτήρες" /></FormField>
          </div>
          <FormField label={role === "OWNER" ? "Ιδιοκτήτης από" : "Ένοικος από"}><FieldInput type="date" value={form.startDate} onChange={f("startDate")} /></FormField>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setAdding(false)} style={btnCancel}>Άκυρο</button>
            <button onClick={create} disabled={isPending} style={btnSave}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Δημιουργία</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {error && <div style={errBox}>{error}</div>}
          <UserCombo
            selected={null}
            onSelect={(u) => { if (u) pickExisting(u.id); }}
            placeholder="Αναζήτηση με email ή όνομα…"
            roles={CUSTOMER_ROLES}
            customerId={customerId}
          />
          <button onClick={() => setAdding(true)} style={btnSmall}><RiAddLine /> Δημιουργία νέου</button>
        </div>
      )}
    </div>
  );
}

function UnitModal({ buildingId, editing, onClose, onDone }: { buildingId: string; editing: Unit | null; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    unitNumber: editing?.unitNumber ?? "",
    unitType: editing?.unitType ?? "APARTMENT",
    floor: editing?.floor != null ? String(editing.floor) : "",
    areaSqm: editing?.areaSqm != null ? String(editing.areaSqm) : "",
    millesimes: editing?.millesimes != null ? String(editing.millesimes) : "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const f = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  function save() {
    setError(null);
    if (!form.unitNumber.trim()) { setError("Ο αριθμός μονάδας είναι υποχρεωτικός"); return; }
    const payload: UnitInput = {
      unitNumber: form.unitNumber,
      unitType: form.unitType as UnitInput["unitType"],
      floor: form.floor ? parseInt(form.floor) : null,
      areaSqm: form.areaSqm ? parseFloat(form.areaSqm) : null,
      millesimes: form.millesimes ? parseFloat(form.millesimes) : null,
    };
    startTransition(async () => {
      const res = editing ? await updateUnit(editing.id, payload) : await createUnit(buildingId, payload);
      if (res && "error" in res && res.error) { setError(res.error); return; }
      onDone();
    });
  }

  return (
    <Modal open onClose={onClose} title={editing ? `Μονάδα ${editing.unitNumber}` : "Νέα μονάδα"} width={480}
      footer={<>
        <button onClick={onClose} style={btnCancel}>Ακύρωση</button>
        <button onClick={save} disabled={isPending} style={btnSave}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Αποθήκευση</button>
      </>}>
      {error && <div style={{ padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, marginBottom: 12 }}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FormField label="Αριθμός" required><FieldInput value={form.unitNumber} onChange={f("unitNumber")} /></FormField>
          <FormField label="Τύπος"><FieldSelect value={form.unitType} onChange={f("unitType")} options={Object.entries(UNIT_TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))} /></FormField>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <FormField label="Όροφος"><FieldInput type="number" value={form.floor} onChange={f("floor")} /></FormField>
          <FormField label="Τετραγωνικά"><FieldInput type="number" value={form.areaSqm} onChange={f("areaSqm")} /></FormField>
          <FormField label="Χιλιοστά"><FieldInput type="number" value={form.millesimes} onChange={f("millesimes")} /></FormField>
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

function MillesimesModal({ units, buildingId, onClose, onDone }: { units: Unit[]; buildingId: string; onClose: () => void; onDone: () => void }) {
  const computed = computeMillesimes(units.map((u) => ({ id: u.id, areaSqm: u.areaSqm })));
  const newById = Object.fromEntries(computed.map((c) => [c.id, c.millesimes]));
  const totalSqm = units.reduce((s, u) => s + (u.areaSqm ?? 0), 0);
  const totalNew = computed.reduce((s, c) => s + (c.millesimes ?? 0), 0);
  const missing = units.filter((u) => !(u.areaSqm != null && u.areaSqm > 0)).length;
  const canApply = units.some((u) => u.areaSqm != null && u.areaSqm > 0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function apply() {
    setError(null);
    startTransition(async () => {
      const res = await recalculateMillesimes(buildingId);
      if (res && "error" in res && res.error) { setError(res.error); return; }
      onDone();
    });
  }

  return (
    <Modal open onClose={onClose} title="Υπολογισμός χιλιοστών" width={560}
      footer={<>
        <button onClick={onClose} style={btnCancel}>Ακύρωση</button>
        <button onClick={apply} disabled={isPending || !canApply} style={{ ...btnSave, opacity: canApply ? 1 : 0.5 }}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Εφαρμογή</button>
      </>}>
      {error && <div style={{ padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, marginBottom: 12 }}>{error}</div>}
      <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--muted-foreground)" }}>
        Αναλογική κατανομή 1000‰ βάσει τετραγωνικών. Σύνολο τ.μ.: <b style={{ color: "var(--foreground)" }}>{totalSqm}</b> · Νέο σύνολο: <b style={{ color: "var(--foreground)" }}>{totalNew}‰</b>
        {missing > 0 && <> · <span style={{ color: "#dc2626" }}>{missing} μονάδες χωρίς τ.μ. (θα μηδενιστούν)</span></>}
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr style={{ textAlign: "left", color: "var(--muted-foreground)", fontSize: 11 }}>
          <th style={{ padding: "6px 8px" }}>Μονάδα</th>
          <th style={{ padding: "6px 8px", textAlign: "right" }}>τ.μ.</th>
          <th style={{ padding: "6px 8px", textAlign: "right" }}>Τρέχον ‰</th>
          <th style={{ padding: "6px 8px", textAlign: "right" }}>Νέο ‰</th>
        </tr></thead>
        <tbody>
          {units.map((u) => {
            const next = newById[u.id];
            const changed = next != null && next !== u.millesimes;
            return (
              <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "6px 8px" }}>{u.unitNumber} · {UNIT_TYPE_LABEL[u.unitType] ?? u.unitType}</td>
                <td style={{ padding: "6px 8px", textAlign: "right" }}>{u.areaSqm ?? "—"}</td>
                <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--muted-foreground)" }}>{u.millesimes ?? "—"}</td>
                <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: changed ? 700 : 400, color: changed ? "var(--color-primary)" : "var(--foreground)" }}>{next ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

const btn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--border)",
  background: "var(--card)", color: "var(--foreground)", borderRadius: 6, padding: "7px 13px",
  fontSize: 13, fontWeight: 600, cursor: "pointer",
};
const btnPrimary: React.CSSProperties = { background: "var(--color-primary)", color: "#fff", borderColor: "var(--color-primary)" };
const btnCancel: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: 13, color: "var(--foreground)" };
const btnSave: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 };
const btnSmall: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 6, padding: "6px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer" };
const errBox: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12 };
