"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormField, FieldInput, FieldSelect, FieldTextarea } from "@/components/ui/modal";
import { createInfraPoint, updateInfraPoint, deleteInfraPoint, uploadInfraPhoto, type InfraType } from "@/app/actions/infra-points";
import {
  RiAddLine, RiPencilLine, RiDeleteBinLine, RiCheckLine, RiLoaderLine, RiImageAddLine,
  RiMapPin2Line, RiGroupLine, RiKey2Line, RiLockLine, RiLockUnlockLine,
  RiFlashlightLine, RiPhoneLine, RiBuilding2Line, RiBaseStationLine, RiFireLine, RiSettings3Line,
} from "react-icons/ri";

export type InfraRow = {
  id: string; name: string; type: string; floorLabel: string | null; location: string | null;
  locked: boolean; accessNotes: string | null; keyHolder: string | null; photoUrl: string | null; notes: string | null;
};

const TYPE_OPTS: { value: InfraType; label: string }[] = [
  { value: "ELECTRICITY", label: "Μετρητές ΔΕΗ" }, { value: "OTE", label: "Κουτί ΟΤΕ" },
  { value: "ROOF", label: "Ταράτσα" }, { value: "ANTENNA", label: "Κεραία TV" },
  { value: "BOILER", label: "Λεβητοστάσιο" }, { value: "PUMP", label: "Αντλιοστάσιο" },
  { value: "FIRE", label: "Πυρόσβεση" }, { value: "WATER", label: "Νερό" }, { value: "OTHER", label: "Άλλο" },
];
const TYPE_LABEL = Object.fromEntries(TYPE_OPTS.map((t) => [t.value, t.label]));
const TYPE_ICON: Record<string, React.ElementType> = {
  ELECTRICITY: RiFlashlightLine, OTE: RiPhoneLine, ROOF: RiBuilding2Line, ANTENNA: RiBaseStationLine,
  BOILER: RiFireLine, PUMP: RiSettings3Line, FIRE: RiFireLine, WATER: RiSettings3Line, OTHER: RiSettings3Line,
};

export function InfraPanel({ buildingId, points }: { buildingId: string; points: InfraRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<InfraRow | null | "new">(null);
  const [isPending, startTransition] = useTransition();

  function remove(id: string) {
    if (!confirm("Διαγραφή σημείου;")) return;
    startTransition(async () => { await deleteInfraPoint(id); router.refresh(); });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Φωτογραφία, όροφος, κλείδωμα, πρόσβαση & κάτοχος κλειδιού</div>
        <button onClick={() => setEditing("new")} style={{ ...btn, ...btnPrimary }}><RiAddLine /> Νέο σημείο</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
        {points.map((p) => {
          const Icon = TYPE_ICON[p.type] ?? RiSettings3Line;
          return (
            <div key={p.id} style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "var(--card)" }}>
              <div style={{ height: 130, background: "var(--bg-canvas)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-foreground)", position: "relative", backgroundImage: p.photoUrl ? `url(${p.photoUrl})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
                {!p.photoUrl && <Icon style={{ fontSize: 38 }} />}
                {p.floorLabel && <span style={{ position: "absolute", top: 8, left: 8, ...chipGrey }}>{p.floorLabel}</span>}
              </div>
              <div style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <b style={{ fontSize: 14 }}>{p.name}</b>
                  <span style={p.locked ? chipOrange : chipGreen}>{p.locked ? <RiLockLine /> : <RiLockUnlockLine />} {p.locked ? "Κλειδωμένο" : "Ελεύθερο"}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{TYPE_LABEL[p.type] ?? p.type}</div>
                <div style={{ marginTop: 8 }}>
                  {p.location && <Kv icon={<RiMapPin2Line />} v={p.location} />}
                  {p.accessNotes && <Kv icon={<RiGroupLine />} v={p.accessNotes} />}
                  {p.keyHolder && <Kv icon={<RiKey2Line />} v={p.keyHolder} />}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <PhotoButton infraPointId={p.id} onDone={() => router.refresh()} />
                  <button onClick={() => setEditing(p)} style={iconBtn} title="Επεξεργασία"><RiPencilLine /></button>
                  <button onClick={() => remove(p.id)} disabled={isPending} style={{ ...iconBtn, color: "#c50f1f" }} title="Διαγραφή"><RiDeleteBinLine /></button>
                </div>
              </div>
            </div>
          );
        })}

        <div onClick={() => setEditing("new")} style={{ border: "1.5px dashed var(--border-strong)", borderRadius: 8, minHeight: 240, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--muted-foreground)", textAlign: "center" }}>
          <div><RiAddLine style={{ fontSize: 22 }} /><div style={{ marginTop: 6 }}>Νέο σημείο</div></div>
        </div>
      </div>

      {editing !== null && (
        <InfraModal buildingId={buildingId} editing={editing === "new" ? null : editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); router.refresh(); }} />
      )}
    </div>
  );
}

function PhotoButton({ infraPointId, onDone }: { infraPointId: string; onDone: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  function pick(files: FileList | null) {
    if (!files?.[0]) return;
    const fd = new FormData(); fd.set("infraPointId", infraPointId); fd.set("file", files[0]);
    startTransition(async () => { await uploadInfraPhoto(fd); if (ref.current) ref.current.value = ""; onDone(); });
  }
  return (
    <>
      <button onClick={() => ref.current?.click()} disabled={isPending} style={iconBtn} title="Φωτογραφία">{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiImageAddLine />}</button>
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => pick(e.target.files)} />
    </>
  );
}

function InfraModal({ buildingId, editing, onClose, onDone }: { buildingId: string; editing: InfraRow | null; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    name: editing?.name ?? "", type: (editing?.type ?? "OTHER") as InfraType,
    floorLabel: editing?.floorLabel ?? "", location: editing?.location ?? "",
    locked: editing?.locked ?? false, accessNotes: editing?.accessNotes ?? "", keyHolder: editing?.keyHolder ?? "", notes: editing?.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const f = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));
  function save() {
    setError(null);
    startTransition(async () => {
      const res = editing ? await updateInfraPoint(editing.id, form) : await createInfraPoint(buildingId, form);
      if (res && "error" in res && res.error) { setError(res.error); return; }
      onDone();
    });
  }
  return (
    <Modal open onClose={onClose} title={editing ? "Επεξεργασία σημείου" : "Νέο σημείο πρόσβασης"} width={500}
      footer={<><button onClick={onClose} style={cancelBtn}>Ακύρωση</button><button onClick={save} disabled={isPending} style={saveBtn}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Αποθήκευση</button></>}>
      {error && <div style={errBox}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FormField label="Όνομα" required><FieldInput value={form.name} onChange={f("name")} placeholder="π.χ. Μετρητές ΔΕΗ" /></FormField>
          <FormField label="Τύπος"><FieldSelect value={form.type} onChange={(v) => f("type")(v)} options={TYPE_OPTS} /></FormField>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FormField label="Όροφος"><FieldInput value={form.floorLabel} onChange={f("floorLabel")} placeholder="π.χ. Ισόγειο" /></FormField>
          <FormField label="Θέση"><FieldInput value={form.location} onChange={f("location")} placeholder="π.χ. Κολώνα εισόδου" /></FormField>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)", cursor: "pointer" }}>
          <input type="checkbox" checked={form.locked} onChange={(e) => setForm((p) => ({ ...p, locked: e.target.checked }))} style={{ width: 15, height: 15, accentColor: "var(--color-primary)" }} />
          Κλειδωμένο
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FormField label="Πρόσβαση (ποιος)"><FieldInput value={form.accessNotes} onChange={f("accessNotes")} placeholder="π.χ. Διαχειριστής, ΔΕΗ" /></FormField>
          <FormField label="Κάτοχος κλειδιού"><FieldInput value={form.keyHolder} onChange={f("keyHolder")} placeholder="π.χ. Διαχειριστής (Α2)" /></FormField>
        </div>
        <FormField label="Σημειώσεις"><FieldTextarea value={form.notes} onChange={f("notes")} rows={2} /></FormField>
        {!editing && <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0 }}>Η φωτογραφία προστίθεται μετά τη δημιουργία, από την κάρτα.</p>}
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

function Kv({ icon, v }: { icon: React.ReactNode; v: string }) {
  return <div style={{ display: "flex", gap: 6, fontSize: 12, color: "var(--foreground)", padding: "2px 0", alignItems: "flex-start" }}><span style={{ color: "var(--muted-foreground)", display: "inline-flex", marginTop: 1 }}>{icon}</span> {v}</div>;
}

const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 4, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnPrimary: React.CSSProperties = { background: "var(--color-primary)", color: "#fff", borderColor: "var(--color-primary)" };
const iconBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 4, padding: 6, cursor: "pointer" };
const chipGrey: React.CSSProperties = { fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: "var(--card)", color: "var(--muted-foreground)", border: "1px solid var(--border)" };
const chipOrange: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: "var(--color-orange-soft)", color: "var(--color-orange)" };
const chipGreen: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: "var(--color-green-soft)", color: "var(--color-green)" };
const cancelBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: 13, color: "var(--foreground)" };
const saveBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 };
const errBox: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, border: "1px solid #fca5a530", marginBottom: 12 };
