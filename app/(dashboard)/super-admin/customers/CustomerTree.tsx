"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormField, FieldInput, FieldSelect, FieldTextarea } from "@/components/ui/modal";
import {
  createBuilding, updateBuilding, deleteBuilding,
  createUnit, updateUnit, deleteUnit,
  createCommonArea, deleteCommonArea,
  recalculateMillesimes,
} from "@/app/actions/buildings";
import { computeMillesimes } from "@/lib/millesimes";
import { createOccupant, clearOccupant } from "@/app/actions/unit-occupants";
import { deleteProperty } from "@/app/actions/properties";
import {
  RiArrowRightSLine, RiArrowUpSLine, RiArrowDownSLine, RiCommunityLine, RiBuildingLine, RiStairsLine, RiHome2Line,
  RiStore2Line, RiParkingBoxLine, RiBox3Line, RiDoorOpenLine, RiMoreFill,
  RiAddLine, RiPencilLine, RiDeleteBinLine, RiSettings3Line, RiUserStarLine, RiUserLine,
  RiCheckLine, RiLoaderLine, RiCloseLine, RiMapPin2Line, RiCalculatorLine,
} from "react-icons/ri";

export type TOccupant = { id: string; name: string | null; email: string };
export type TUnit = { id: string; unitNumber: string; unitType: string; floor: number | null; areaSqm: number | null; millesimes: number | null; owner: TOccupant | null; resident: TOccupant | null };
export type TCommonArea = { id: string; name: string; type: string | null; floor: number | null };
export type TBuilding = { id: string; name: string; address: string; city: string; postalCode: string; country: string; floors: number | null; basements: number | null; hasElevator: boolean; hasBoiler: boolean; hasFireSafety: boolean; technicalNotes: string | null; lat: number | null; lng: number | null; commonAreas: TCommonArea[]; units: TUnit[] };
export type TPropertyAddress = { address: string | null; city: string | null; postalCode: string | null; country: string | null; lat: number | null; lng: number | null };
export type TProperty = TPropertyAddress & { id: string; name: string; buildingCount: number; unitCount: number; buildings: TBuilding[] };

const UNIT_TYPE_LABEL: Record<string, string> = { APARTMENT: "Διαμέρισμα", SHOP: "Μαγαζί", PARKING: "Πάρκινγκ", OTHER: "Άλλο" };
const UNIT_TYPE_ICON: Record<string, React.ElementType> = { APARTMENT: RiHome2Line, SHOP: RiStore2Line, PARKING: RiParkingBoxLine, OTHER: RiBox3Line };

type Modal_ =
  | { kind: "building"; propertyId: string; editing: TBuilding | null }
  | { kind: "unit"; buildingId: string; editing: TUnit | null; defaultFloor?: number | null }
  | { kind: "commonArea"; buildingId: string; defaultFloor?: number | null }
  | { kind: "occupants"; unit: TUnit }
  | { kind: "millesimes"; building: TBuilding }
  | null;

export function CustomerTree({ properties }: { properties: TProperty[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const toggle = (id: string) => setOpen((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  function act(fn: () => Promise<unknown>) { startTransition(async () => { await fn(); router.refresh(); }); }

  if (properties.length === 0) {
    return <div style={{ padding: "12px 16px", fontSize: 12, color: "var(--muted-foreground)" }}>Δεν υπάρχουν ιδιοκτησίες.</div>;
  }

  return (
    <div style={{ padding: "8px 8px 8px 0" }}>
      {properties.map((p) => {
        const pOpen = open.has(p.id);
        return (
          <div key={p.id}>
            <Row depth={0} expandable open={pOpen} onToggle={() => toggle(p.id)}
              icon={<RiCommunityLine style={{ color: "#8764B8" }} />}
              title={p.name} subtitle={`${p.buildingCount} κτήρια · ${p.unitCount} μονάδες${p.city ? ` · ${p.city}` : ""}`}
              actions={[
                { label: "Διαχείριση", icon: <RiSettings3Line />, onClick: () => router.push(`/super-admin/properties/${p.id}`) },
                { label: "Διαγραφή", icon: <RiDeleteBinLine />, danger: true, onClick: () => { if (confirm(`Διαγραφή ιδιοκτησίας «${p.name}»;`)) act(() => deleteProperty(p.id)); } },
              ]} />
            {pOpen && <BuildingsTree propertyId={p.id} buildings={p.buildings} depthBase={1} propertyAddress={p} />}
          </div>
        );
      })}
    </div>
  );
}

/** Reusable Buildings→Floors→(CommonAreas,Units) tree with per-entity action dropdowns.
 *  Used both inside the customer tree (depthBase=1) and standalone on the property page (depthBase=0). */
export function BuildingsTree({ propertyId, buildings, depthBase = 0, showAddBuilding = true, propertyAddress }: {
  propertyId: string; buildings: TBuilding[]; depthBase?: number; showAddBuilding?: boolean; propertyAddress?: TPropertyAddress;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<Modal_>(null);
  const [, startTransition] = useTransition();
  const toggle = (id: string) => setOpen((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  function act(fn: () => Promise<unknown>) { startTransition(async () => { await fn(); router.refresh(); }); }
  const close = () => setModal(null);
  const done = () => { setModal(null); router.refresh(); };

  return (
    <div>
      {showAddBuilding && (
        <div style={{ paddingLeft: 10 + depthBase * 22, marginBottom: 6 }}>
          <button onClick={() => setModal({ kind: "building", propertyId, editing: null })} style={smallBtn}><RiAddLine /> Νέο Κτήριο</button>
        </div>
      )}
      {buildings.length === 0 && !showAddBuilding && (
        <div style={{ paddingLeft: 10 + depthBase * 22, fontSize: 12, color: "var(--muted-foreground)" }}>Κανένα κτήριο.</div>
      )}
      {buildings.map((b) => {
        const bOpen = open.has(b.id);
        const floors = groupByFloor(b);
        const bSqm = b.units.reduce((s, u) => s + (u.areaSqm ?? 0), 0);
        const bStats = [
          b.floors ? `${b.floors} όροφοι` : null,
          b.basements ? `${b.basements} υπόγεια` : null,
          `${b.commonAreas.length} κοιν. χώροι`,
          `${b.units.length} μονάδες`,
          bSqm > 0 ? `${bSqm} τ.μ.` : null,
        ].filter(Boolean).join(" · ");
        return (
          <div key={b.id}>
            <Row depth={depthBase} expandable open={bOpen} onToggle={() => toggle(b.id)}
              icon={<RiBuildingLine style={{ color: "var(--color-primary)" }} />}
              title={b.name} subtitle={[b.address, b.city].filter(Boolean).join(", ") || "—"} extra={bStats}
              actions={[
                { label: "Επεξεργασία", icon: <RiPencilLine />, onClick: () => setModal({ kind: "building", propertyId, editing: b }) },
                { label: "Προσθήκη ορόφου", icon: <RiArrowUpSLine />, onClick: () => act(() => updateBuilding(b.id, { floors: (b.floors ?? 0) + 1 })) },
                { label: "Προσθήκη υπογείου", icon: <RiArrowDownSLine />, onClick: () => act(() => updateBuilding(b.id, { basements: (b.basements ?? 0) + 1 })) },
                { label: "Προσθήκη μονάδας", icon: <RiAddLine />, onClick: () => setModal({ kind: "unit", buildingId: b.id, editing: null }) },
                { label: "Προσθήκη κοιν. χώρου", icon: <RiDoorOpenLine />, onClick: () => setModal({ kind: "commonArea", buildingId: b.id }) },
                { label: "Υπολογισμός χιλιοστών", icon: <RiCalculatorLine />, onClick: () => setModal({ kind: "millesimes", building: b }) },
                { label: "Διαγραφή", icon: <RiDeleteBinLine />, danger: true, onClick: () => { if (confirm(`Διαγραφή κτηρίου «${b.name}»;`)) act(() => deleteBuilding(b.id)); } },
              ]} />
            {bOpen && floors.map((fl) => {
              const fid = `${b.id}:floor:${fl.key}`;
              const fOpen = open.has(fid);
              return (
                <div key={fid}>
                  <Row depth={depthBase + 1} expandable open={fOpen} onToggle={() => toggle(fid)}
                    icon={<RiStairsLine style={{ color: "#CA5D00" }} />}
                    title={fl.label} subtitle={[`${fl.units.length} μονάδες`, `${fl.areas.length} κοιν. χώροι`, (() => { const s = fl.units.reduce((a, u) => a + (u.areaSqm ?? 0), 0); return s > 0 ? `${s} τ.μ.` : null; })()].filter(Boolean).join(" · ")}
                    actions={[
                      { label: "Προσθήκη μονάδας", icon: <RiAddLine />, onClick: () => setModal({ kind: "unit", buildingId: b.id, editing: null, defaultFloor: fl.floor }) },
                      { label: "Προσθήκη κοιν. χώρου", icon: <RiDoorOpenLine />, onClick: () => setModal({ kind: "commonArea", buildingId: b.id, defaultFloor: fl.floor }) },
                    ]} />
                  {fOpen && fl.areas.map((a) => (
                    <Row key={a.id} depth={depthBase + 2} icon={<RiDoorOpenLine style={{ color: "#707070" }} />}
                      title={a.name} subtitle={a.type || "Κοινόχρηστος χώρος"}
                      actions={[{ label: "Διαγραφή", icon: <RiDeleteBinLine />, danger: true, onClick: () => act(() => deleteCommonArea(a.id)) }]} />
                  ))}
                  {fOpen && fl.units.map((u) => {
                    const Icon = UNIT_TYPE_ICON[u.unitType] ?? RiBox3Line;
                    const occ = [u.owner && `Ιδ: ${u.owner.name || u.owner.email}`, u.resident && `Εν: ${u.resident.name || u.resident.email}`].filter(Boolean).join(" · ");
                    return (
                      <Row key={u.id} depth={depthBase + 2} icon={<Icon style={{ color: "#0078D4" }} />}
                        title={`${u.unitNumber} · ${UNIT_TYPE_LABEL[u.unitType] ?? u.unitType}`}
                        subtitle={occ || [u.areaSqm && `${u.areaSqm} τ.μ.`, u.millesimes && `${u.millesimes}‰`].filter(Boolean).join(" · ") || "—"}
                        actions={[
                          { label: "Ιδιοκτήτης / Ένοικος", icon: <RiUserStarLine />, onClick: () => setModal({ kind: "occupants", unit: u }) },
                          { label: "Επεξεργασία", icon: <RiPencilLine />, onClick: () => setModal({ kind: "unit", buildingId: b.id, editing: u }) },
                          { label: "Διαγραφή", icon: <RiDeleteBinLine />, danger: true, onClick: () => { if (confirm(`Διαγραφή μονάδας «${u.unitNumber}»;`)) act(() => deleteUnit(u.id)); } },
                        ]} />
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}

      {modal?.kind === "building" && <BuildingModal propertyId={modal.propertyId} editing={modal.editing} propertyAddress={propertyAddress} onClose={close} onDone={done} />}
      {modal?.kind === "unit" && <UnitModal buildingId={modal.buildingId} editing={modal.editing} defaultFloor={modal.defaultFloor} onClose={close} onDone={done} />}
      {modal?.kind === "commonArea" && <CommonAreaModal buildingId={modal.buildingId} defaultFloor={modal.defaultFloor} onClose={close} onDone={done} />}
      {modal?.kind === "occupants" && <OccupantsModal unit={modal.unit} onClose={close} onDone={() => router.refresh()} />}
      {modal?.kind === "millesimes" && <MillesimesModal building={modal.building} onClose={close} onDone={done} />}
    </div>
  );
}

function floorLabel(f: number | null): string {
  if (f == null) return "Χωρίς όροφο";
  if (f === 0) return "Ισόγειο";
  if (f < 0) return `Υπόγειο ${Math.abs(f)}`;
  return `${f}ος όροφος`;
}

function groupByFloor(b: TBuilding) {
  const keys = new Set<string>();
  const floorOf = (f: number | null) => (f == null ? "none" : String(f));
  b.units.forEach((u) => keys.add(floorOf(u.floor)));
  b.commonAreas.forEach((a) => keys.add(floorOf(a.floor)));
  // Always include Ισόγειο (0); declared above-ground floors (1..N); basements (-1..-K).
  keys.add("0");
  if (b.floors && b.floors > 0) for (let i = 1; i <= b.floors; i++) keys.add(String(i));
  if (b.basements && b.basements > 0) for (let i = 1; i <= b.basements; i++) keys.add(String(-i));
  const arr = [...keys].map((k) => {
    const floor = k === "none" ? null : parseInt(k);
    return {
      key: k, floor,
      label: floorLabel(floor),
      units: b.units.filter((u) => floorOf(u.floor) === k),
      areas: b.commonAreas.filter((a) => floorOf(a.floor) === k),
    };
  });
  arr.sort((x, y) => (x.floor ?? 9999) - (y.floor ?? 9999));
  return arr;
}

// ─── Tree row with kebab dropdown ──────────────────────────────────────────────
type Action = { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean };
function Row({ depth, expandable, open, onToggle, icon, title, subtitle, extra, actions }: {
  depth: number; expandable?: boolean; open?: boolean; onToggle?: () => void;
  icon: React.ReactNode; title: string; subtitle?: string; extra?: string; actions: Action[];
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", paddingLeft: 10 + depth * 22, borderRadius: 6, background: depth === 0 ? "var(--card)" : "transparent", border: depth === 0 ? "1px solid var(--border)" : "none", marginBottom: depth === 0 ? 4 : 0 }}
      onMouseEnter={(e) => { if (depth > 0) e.currentTarget.style.background = "var(--bg-canvas)"; }}
      onMouseLeave={(e) => { if (depth > 0) e.currentTarget.style.background = "transparent"; }}>
      <button onClick={onToggle} disabled={!expandable} style={{ width: 18, height: 18, border: "none", background: "transparent", cursor: expandable ? "pointer" : "default", color: "var(--muted-foreground)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {expandable && <RiArrowRightSLine style={{ fontSize: 16, transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }} />}
      </button>
      <span style={{ flexShrink: 0, display: "flex", fontSize: 15 }}>{icon}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</div>}
        {extra && <div style={{ fontSize: 10, color: "var(--muted-foreground)", opacity: 0.85, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{extra}</div>}
      </div>
      <Dropdown actions={actions} />
    </div>
  );
}

function Dropdown({ actions }: { actions: Action[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button onClick={() => setOpen((v) => !v)} title="Ενέργειες" style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-foreground)" }}>
        <RiMoreFill style={{ fontSize: 16 }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", right: 0, zIndex: 200, marginTop: 4, minWidth: 200, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, boxShadow: "0 4px 16px rgba(0,0,0,.14)", overflow: "hidden" }}>
          {actions.map((a, i) => (
            <button key={i} onClick={() => { setOpen(false); a.onClick(); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", fontSize: 13, color: a.danger ? "#c50f1f" : "var(--foreground)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-canvas)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <span style={{ display: "flex", fontSize: 15 }}>{a.icon}</span> {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modals ────────────────────────────────────────────────────────────────────
const cancelBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: 13, color: "var(--foreground)" };
const saveBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 };
const errBox: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, border: "1px solid #fca5a530", marginBottom: 14 };
const smallBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", color: "var(--foreground)" };
const yesNo = [{ value: "false", label: "Όχι" }, { value: "true", label: "Ναι" }];
const spin = <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>;

function BuildingModal({ propertyId, editing, propertyAddress, onClose, onDone }: { propertyId: string; editing: TBuilding | null; propertyAddress?: TPropertyAddress; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ name: editing?.name ?? "", address: editing?.address ?? "", city: editing?.city ?? "", postalCode: editing?.postalCode ?? "", country: editing?.country ?? "Ελλάδα", floors: editing?.floors != null ? String(editing.floors) : "", basements: editing?.basements != null ? String(editing.basements) : "", hasElevator: String(editing?.hasElevator ?? false), hasBoiler: String(editing?.hasBoiler ?? false), hasFireSafety: String(editing?.hasFireSafety ?? false), technicalNotes: editing?.technicalNotes ?? "" });
  const [lat, setLat] = useState<number | null>(editing?.lat ?? null);
  const [lng, setLng] = useState<number | null>(editing?.lng ?? null);
  const [sameAddress, setSameAddress] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const f = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  function toggleSame(checked: boolean) {
    setSameAddress(checked);
    if (checked && propertyAddress) {
      setForm((p) => ({ ...p, address: propertyAddress.address ?? "", city: propertyAddress.city ?? "", postalCode: propertyAddress.postalCode ?? "", country: propertyAddress.country ?? "Ελλάδα" }));
      setLat(propertyAddress.lat); setLng(propertyAddress.lng);
    }
  }
  async function geocode() {
    const q = [form.address, form.city, form.postalCode, form.country].map((s) => s.trim()).filter(Boolean).join(", ");
    if (!form.address.trim()) { setError("Συμπληρώστε διεύθυνση"); return; }
    setGeoLoading(true); setError(null);
    try { const res = await fetch(`/api/geocode?address=${encodeURIComponent(q)}`); const d: { results?: { lat: number; lng: number; city?: string; postalCode?: string; country?: string }[] } = await res.json(); const r = d.results?.[0]; if (r) { setLat(r.lat); setLng(r.lng); setForm((p) => ({ ...p, city: r.city || p.city, postalCode: r.postalCode || p.postalCode, country: r.country || p.country })); } else setError("Δεν βρέθηκε στίγμα"); } catch { setError("Σφάλμα geocoding"); } finally { setGeoLoading(false); }
  }
  function save() {
    if (!form.name.trim()) { setError("Το όνομα είναι υποχρεωτικό"); return; }
    if (!form.address.trim()) { setError("Η διεύθυνση είναι υποχρεωτική"); return; }
    startTransition(async () => {
      const payload = { name: form.name, address: form.address, city: form.city, postalCode: form.postalCode, country: form.country, floors: form.floors ? parseInt(form.floors) : null, basements: form.basements ? parseInt(form.basements) : null, hasElevator: form.hasElevator === "true", hasBoiler: form.hasBoiler === "true", hasFireSafety: form.hasFireSafety === "true", technicalNotes: form.technicalNotes || null, lat, lng };
      const res = editing ? await updateBuilding(editing.id, payload) : await createBuilding(propertyId, payload);
      if ("error" in res && res.error) { setError(res.error); return; }
      onDone();
    });
  }
  return (
    <Modal open onClose={onClose} title={editing ? `Επεξεργασία: ${editing.name}` : "Νέο Κτήριο"} width={560}
      footer={<><button onClick={onClose} style={cancelBtn}>Ακύρωση</button><button onClick={save} disabled={isPending} style={saveBtn}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Αποθήκευση</button></>}>
      {error && <div style={errBox}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <FormField label="Όνομα κτηρίου" required><FieldInput value={form.name} onChange={f("name")} /></FormField>
          <FormField label="Όροφοι"><FieldInput type="number" value={form.floors} onChange={f("floors")} /></FormField>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FormField label="Υπόγεια"><FieldInput type="number" value={form.basements} onChange={f("basements")} /></FormField>
          <div />
        </div>
        {!editing && propertyAddress && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)", cursor: "pointer" }}>
            <input type="checkbox" checked={sameAddress} onChange={(e) => toggleSame(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--color-primary)" }} />
            Ίδια διεύθυνση με την ιδιοκτησία
          </label>
        )}
        <FormField label="Διεύθυνση" required>
          <div style={{ display: "flex", gap: 6 }}>
            <FieldInput value={form.address} onChange={f("address")} />
            <button type="button" onClick={geocode} disabled={geoLoading || !form.address} title="Geocoding" style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--foreground)" }}>{geoLoading ? <RiLoaderLine style={{ fontSize: 15, animation: "spin 1s linear infinite" }} /> : <RiMapPin2Line style={{ fontSize: 15 }} />}</button>
          </div>
        </FormField>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
          <FormField label="Πόλη"><FieldInput value={form.city} onChange={f("city")} /></FormField>
          <FormField label="Τ.Κ."><FieldInput value={form.postalCode} onChange={f("postalCode")} /></FormField>
          <FormField label="Χώρα"><FieldInput value={form.country} onChange={f("country")} /></FormField>
        </div>
        {lat != null && lng != null && <div style={{ fontSize: 11, color: "#16a34a" }}><RiMapPin2Line style={{ fontSize: 12 }} /> {lat.toFixed(6)}, {lng.toFixed(6)}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <FormField label="Ασανσέρ"><FieldSelect value={form.hasElevator} onChange={f("hasElevator")} options={yesNo} /></FormField>
          <FormField label="Καυστήρας"><FieldSelect value={form.hasBoiler} onChange={f("hasBoiler")} options={yesNo} /></FormField>
          <FormField label="Πυρασφάλεια"><FieldSelect value={form.hasFireSafety} onChange={f("hasFireSafety")} options={yesNo} /></FormField>
        </div>
        <FormField label="Τεχνικές σημειώσεις"><FieldTextarea value={form.technicalNotes} onChange={f("technicalNotes")} rows={2} /></FormField>
      </div>
      {spin}
    </Modal>
  );
}

function UnitModal({ buildingId, editing, defaultFloor, onClose, onDone }: { buildingId: string; editing: TUnit | null; defaultFloor?: number | null; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ unitNumber: editing?.unitNumber ?? "", unitType: editing?.unitType ?? "APARTMENT", floor: editing?.floor != null ? String(editing.floor) : (defaultFloor != null ? String(defaultFloor) : ""), areaSqm: editing?.areaSqm != null ? String(editing.areaSqm) : "", millesimes: editing?.millesimes != null ? String(editing.millesimes) : "" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const f = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));
  function save() {
    if (!form.unitNumber.trim()) { setError("Ο αριθμός μονάδας είναι υποχρεωτικός"); return; }
    startTransition(async () => {
      const payload = { unitNumber: form.unitNumber, unitType: form.unitType as any, floor: form.floor ? parseInt(form.floor) : null, areaSqm: form.areaSqm ? parseFloat(form.areaSqm) : null, millesimes: form.millesimes ? parseFloat(form.millesimes) : null };
      const res = editing ? await updateUnit(editing.id, payload) : await createUnit(buildingId, payload);
      if ("error" in res && res.error) { setError(res.error); return; }
      onDone();
    });
  }
  return (
    <Modal open onClose={onClose} title={editing ? `Μονάδα ${editing.unitNumber}` : "Νέα Μονάδα"} width={480}
      footer={<><button onClick={onClose} style={cancelBtn}>Ακύρωση</button><button onClick={save} disabled={isPending} style={saveBtn}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Αποθήκευση</button></>}>
      {error && <div style={errBox}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FormField label="Αριθμός" required><FieldInput value={form.unitNumber} onChange={f("unitNumber")} /></FormField>
          <FormField label="Τύπος"><FieldSelect value={form.unitType} onChange={f("unitType")} options={Object.entries(UNIT_TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))} /></FormField>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <FormField label="Όροφος"><FieldInput type="number" value={form.floor} onChange={f("floor")} /></FormField>
          <FormField label="τ.μ."><FieldInput type="number" value={form.areaSqm} onChange={f("areaSqm")} /></FormField>
          <FormField label="Χιλιοστά"><FieldInput type="number" value={form.millesimes} onChange={f("millesimes")} /></FormField>
        </div>
      </div>
      {spin}
    </Modal>
  );
}

function MillesimesModal({ building, onClose, onDone }: { building: TBuilding; onClose: () => void; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const units = building.units;
  const computed = computeMillesimes(units.map((u) => ({ id: u.id, areaSqm: u.areaSqm })));
  const newById = Object.fromEntries(computed.map((c) => [c.id, c.millesimes]));
  const totalSqm = units.reduce((s, u) => s + (u.areaSqm ?? 0), 0);
  const totalNew = computed.reduce((s, c) => s + (c.millesimes ?? 0), 0);
  const missing = units.filter((u) => !(u.areaSqm != null && u.areaSqm > 0)).length;
  const canApply = units.some((u) => u.areaSqm != null && u.areaSqm > 0);

  function apply() {
    setError(null);
    startTransition(async () => {
      const res = await recalculateMillesimes(building.id);
      if (res && "error" in res && res.error) { setError(res.error); return; }
      onDone();
    });
  }

  return (
    <Modal open onClose={onClose} title={`Υπολογισμός χιλιοστών — ${building.name}`} width={560}
      footer={<>
        <button onClick={onClose} style={cancelBtn}>Ακύρωση</button>
        <button onClick={apply} disabled={isPending || !canApply} style={saveBtn}>
          {isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Εφαρμογή σε όλες
        </button>
      </>}>
      {error && <div style={{ padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, border: "1px solid #fca5a530", marginBottom: 12 }}>{error}</div>}

      {!canApply && (
        <div style={{ padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, marginBottom: 12 }}>
          Καμία μονάδα δεν έχει τετραγωνικά. Συμπληρώστε τ.μ. στις μονάδες πρώτα.
        </div>
      )}
      {missing > 0 && canApply && (
        <div style={{ padding: "8px 12px", borderRadius: 6, background: "#fef9c318", color: "#a16207", fontSize: 12, border: "1px solid #fde04740", marginBottom: 12 }}>
          {missing} μονάδες χωρίς τ.μ. — τα χιλιοστά τους θα μηδενιστούν.
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--muted-foreground)", fontSize: 11 }}>
            <th style={{ padding: "6px 8px" }}>Μονάδα</th>
            <th style={{ padding: "6px 8px", textAlign: "right" }}>τ.μ.</th>
            <th style={{ padding: "6px 8px", textAlign: "right" }}>Παλιά ‰</th>
            <th style={{ padding: "6px 8px", textAlign: "right" }}>Νέα ‰</th>
          </tr>
        </thead>
        <tbody>
          {units.map((u) => {
            const next = newById[u.id];
            const changed = next != null && next !== u.millesimes;
            return (
              <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "6px 8px" }}>{u.unitNumber} · {UNIT_TYPE_LABEL[u.unitType] ?? u.unitType}</td>
                <td style={{ padding: "6px 8px", textAlign: "right" }}>{u.areaSqm ?? "—"}</td>
                <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--muted-foreground)" }}>{u.millesimes ?? "—"}</td>
                <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: changed ? 700 : 400, color: next == null ? "var(--muted-foreground)" : changed ? "var(--color-primary)" : "var(--foreground)" }}>
                  {next == null ? "—" : next.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 700 }}>
            <td style={{ padding: "6px 8px" }}>Σύνολο</td>
            <td style={{ padding: "6px 8px", textAlign: "right" }}>{totalSqm || "—"}</td>
            <td style={{ padding: "6px 8px" }} />
            <td style={{ padding: "6px 8px", textAlign: "right" }}>{(Math.round(totalNew * 100) / 100).toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </Modal>
  );
}

function CommonAreaModal({ buildingId, defaultFloor, onClose, onDone }: { buildingId: string; defaultFloor?: number | null; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ name: "", type: "", floor: defaultFloor != null ? String(defaultFloor) : "" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const f = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));
  function save() {
    if (!form.name.trim()) { setError("Το όνομα είναι υποχρεωτικό"); return; }
    startTransition(async () => {
      const res = await createCommonArea(buildingId, { name: form.name, type: form.type || null, floor: form.floor ? parseInt(form.floor) : null });
      if ("error" in res && res.error) { setError(res.error); return; }
      onDone();
    });
  }
  return (
    <Modal open onClose={onClose} title="Νέος Κοινόχρηστος Χώρος" width={440}
      footer={<><button onClick={onClose} style={cancelBtn}>Ακύρωση</button><button onClick={save} disabled={isPending} style={saveBtn}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Αποθήκευση</button></>}>
      {error && <div style={errBox}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <FormField label="Όνομα" required><FieldInput value={form.name} onChange={f("name")} placeholder="π.χ. Είσοδος" /></FormField>
          <FormField label="Όροφος"><FieldInput type="number" value={form.floor} onChange={f("floor")} /></FormField>
        </div>
        <FormField label="Τύπος"><FieldInput value={form.type} onChange={f("type")} placeholder="π.χ. Λεβητοστάσιο" /></FormField>
      </div>
      {spin}
    </Modal>
  );
}

function OccupantsModal({ unit, onClose, onDone }: { unit: TUnit; onClose: () => void; onDone: () => void }) {
  return (
    <Modal open onClose={onClose} title={`Ιδιοκτήτης / Ένοικος — Μονάδα ${unit.unitNumber}`} width={520}
      footer={<button onClick={onClose} style={cancelBtn}>Κλείσιμο</button>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Slot unitId={unit.id} role="OWNER" label="Ιδιοκτήτης" current={unit.owner} onDone={onDone} />
        <Slot unitId={unit.id} role="RESIDENT" label="Ένοικος" current={unit.resident} onDone={onDone} />
      </div>
      {spin}
    </Modal>
  );
}

function Slot({ unitId, role, label, current, onDone }: { unitId: string; role: "OWNER" | "RESIDENT"; label: string; current: TOccupant | null; onDone: () => void }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const f = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));
  function create() {
    setError(null);
    startTransition(async () => { const res = await createOccupant(unitId, role, form); if ("error" in res && res.error) { setError(res.error); return; } setAdding(false); setForm({ name: "", email: "", password: "" }); onDone(); });
  }
  function clear() { if (!confirm(`Αφαίρεση ${label.toLowerCase()};`)) return; startTransition(async () => { await clearOccupant(unitId, role); onDone(); }); }
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        {role === "OWNER" ? <RiUserStarLine /> : <RiUserLine />} {label}
      </div>
      {current ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{current.name || "—"}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{current.email}</div>
          </div>
          <button onClick={clear} disabled={isPending} style={{ ...smallBtn, color: "#c50f1f" }}><RiCloseLine /> Αφαίρεση</button>
        </div>
      ) : adding ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {error && <div style={errBox}>{error}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <FormField label="Ονοματεπώνυμο" required><FieldInput value={form.name} onChange={f("name")} /></FormField>
            <FormField label="Email" required><FieldInput type="email" value={form.email} onChange={f("email")} /></FormField>
          </div>
          <FormField label="Κωδικός εισόδου" required><FieldInput type="password" value={form.password} onChange={f("password")} placeholder="Τουλάχιστον 6 χαρακτήρες" /></FormField>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setAdding(false)} style={cancelBtn}>Άκυρο</button>
            <button onClick={create} disabled={isPending} style={saveBtn}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Δημιουργία</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={smallBtn}><RiAddLine /> Δημιουργία {label.toLowerCase()}</button>
      )}
    </div>
  );
}
