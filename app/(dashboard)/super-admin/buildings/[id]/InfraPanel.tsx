"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormField, FieldInput, FieldSelect, FieldTextarea } from "@/components/ui/modal";
import {
  createInfraPoint, updateInfraPoint, deleteInfraPoint, uploadInfraMedia, deleteInfraMedia,
  searchInfraPeople, type InfraType, type InfraPerson,
} from "@/app/actions/infra-points";
import { toWebpResized } from "@/lib/resize-image";
import {
  RiAddLine, RiPencilLine, RiDeleteBinLine, RiCheckLine, RiLoaderLine, RiImageAddLine,
  RiMapPin2Line, RiGroupLine, RiKey2Line, RiLockLine, RiLockUnlockLine, RiCloseLine,
  RiFlashlightLine, RiPhoneLine, RiBuilding2Line, RiBaseStationLine, RiFireLine, RiSettings3Line,
  RiVideoLine, RiSearchLine,
} from "react-icons/ri";

type MediaRow = { id: string; url: string; type: "IMAGE" | "VIDEO" };
type AccessUser = { id: string; name: string | null; email: string };
export type InfraRow = {
  id: string; name: string; type: string; floorLabel: string | null; location: string | null;
  locked: boolean; notes: string | null;
  keyHolderUserId: string | null; keyHolderName: string | null;
  access: AccessUser[]; media: MediaRow[];
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
const nm = (u: { name: string | null; email: string }) => u.name ?? u.email;

export function InfraPanel({ buildingId, points, floorOptions }: { buildingId: string; points: InfraRow[]; floorOptions: string[] }) {
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
        <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Φωτο/βίντεο, όροφος, κλείδωμα, πρόσβαση & κάτοχος κλειδιού</div>
        <button onClick={() => setEditing("new")} style={{ ...btn, ...btnPrimary }}><RiAddLine /> Νέο σημείο</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
        {points.map((p) => {
          const Icon = TYPE_ICON[p.type] ?? RiSettings3Line;
          const cover = p.media[0];
          return (
            <div key={p.id} style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "var(--card)" }}>
              <div style={{ height: 140, background: "var(--bg-canvas)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-foreground)", position: "relative" }}>
                {cover ? (cover.type === "VIDEO"
                  ? <video src={cover.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                  : <img src={cover.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />)
                  : <Icon style={{ fontSize: 38 }} />}
                {p.floorLabel && <span style={{ position: "absolute", top: 8, left: 8, ...chipGrey }}>{p.floorLabel}</span>}
                {p.media.length > 1 && <span style={{ position: "absolute", bottom: 8, right: 8, ...chipGrey }}>+{p.media.length - 1}</span>}
              </div>
              <div style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <b style={{ fontSize: 14 }}>{p.name}</b>
                  <span style={p.locked ? chipOrange : chipGreen}>{p.locked ? <RiLockLine /> : <RiLockUnlockLine />} {p.locked ? "Κλειδωμένο" : "Ελεύθερο"}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{TYPE_LABEL[p.type] ?? p.type}</div>
                <div style={{ marginTop: 8 }}>
                  {p.location && <Kv icon={<RiMapPin2Line />} v={p.location} />}
                  {p.keyHolderName && <Kv icon={<RiKey2Line />} v={p.keyHolderName} />}
                  {p.access.length > 0 && (
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
                      <RiGroupLine style={{ color: "var(--muted-foreground)", fontSize: 14 }} />
                      {p.access.map((a) => <span key={a.id} style={pill}>{nm(a)}</span>)}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <MediaButton infraPointId={p.id} onDone={() => router.refresh()} />
                  <button onClick={() => setEditing(p)} style={iconBtn} title="Επεξεργασία"><RiPencilLine /></button>
                  <button onClick={() => remove(p.id)} disabled={isPending} style={{ ...iconBtn, color: "#c50f1f" }} title="Διαγραφή"><RiDeleteBinLine /></button>
                </div>
                {p.media.length > 0 && <MediaStrip media={p.media} onDone={() => router.refresh()} />}
              </div>
            </div>
          );
        })}

        <div onClick={() => setEditing("new")} style={{ border: "1.5px dashed var(--border-strong)", borderRadius: 8, minHeight: 260, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--muted-foreground)", textAlign: "center" }}>
          <div><RiAddLine style={{ fontSize: 22 }} /><div style={{ marginTop: 6 }}>Νέο σημείο</div></div>
        </div>
      </div>

      {editing !== null && (
        <InfraModal buildingId={buildingId} floorOptions={floorOptions} editing={editing === "new" ? null : editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); router.refresh(); }} />
      )}
    </div>
  );
}

function MediaStrip({ media, onDone }: { media: MediaRow[]; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  function del(id: string) { if (!confirm("Διαγραφή αρχείου;")) return; startTransition(async () => { await deleteInfraMedia(id); onDone(); }); }
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
      {media.map((m) => (
        <div key={m.id} style={{ position: "relative", width: 56, height: 44, borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)" }}>
          {m.type === "VIDEO" ? <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-canvas)", color: "var(--muted-foreground)" }}><RiVideoLine /></div> : <img src={m.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
          <button onClick={() => del(m.id)} disabled={isPending} title="Διαγραφή" style={{ position: "absolute", top: 1, right: 1, width: 16, height: 16, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.6)", color: "#fff", cursor: "pointer", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>
      ))}
    </div>
  );
}

function MediaButton({ infraPointId, onDone }: { infraPointId: string; onDone: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  function pick(files: FileList | null) {
    if (!files?.length) return;
    startTransition(async () => {
      for (const raw of Array.from(files)) {
        const file = await toWebpResized(raw);
        const fd = new FormData(); fd.set("infraPointId", infraPointId); fd.set("file", file);
        await uploadInfraMedia(fd);
      }
      if (ref.current) ref.current.value = "";
      onDone();
    });
  }
  return (
    <>
      <button onClick={() => ref.current?.click()} disabled={isPending} style={iconBtn} title="Φωτο/βίντεο">{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiImageAddLine />}</button>
      <input ref={ref} type="file" accept="image/*,video/*" multiple style={{ display: "none" }} onChange={(e) => pick(e.target.files)} />
    </>
  );
}

// ── People combo (single = key holder, multi = access) ───────────────────────
function PeoplePicker({ buildingId, multi, selected, onChange, placeholder }: {
  buildingId: string; multi?: boolean; selected: AccessUser[]; onChange: (u: AccessUser[]) => void; placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<InfraPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const h = setTimeout(async () => { try { setRes(await searchInfraPeople(buildingId, q)); } finally { setLoading(false); } }, 250);
    return () => clearTimeout(h);
  }, [q, open, buildingId]);
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc); return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const ids = new Set(selected.map((s) => s.id));
  function add(u: InfraPerson) {
    const item = { id: u.id, name: u.name, email: u.email };
    if (multi) { if (!ids.has(u.id)) onChange([...selected, item]); }
    else { onChange([item]); setOpen(false); }
    setQ("");
  }
  function removeOne(id: string) { onChange(selected.filter((s) => s.id !== id)); }

  return (
    <div ref={box} style={{ position: "relative" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 8px", minHeight: 36, background: "var(--card)" }}>
        {selected.map((s) => (
          <span key={s.id} style={{ ...pill, display: "inline-flex", alignItems: "center", gap: 4 }}>
            {nm(s)}<button onClick={() => removeOne(s.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--color-primary)", display: "inline-flex", padding: 0 }}><RiCloseLine style={{ fontSize: 13 }} /></button>
          </span>
        ))}
        {(multi || selected.length === 0) && (
          <input value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} placeholder={selected.length ? "" : placeholder}
            style={{ flex: 1, minWidth: 100, border: "none", outline: "none", background: "transparent", fontSize: 13, color: "var(--foreground)" }} />
        )}
      </div>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 400, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, marginTop: 4, boxShadow: "0 4px 16px rgba(0,0,0,.12)", maxHeight: 240, overflowY: "auto" }}>
          {loading && res.length === 0 && <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--muted-foreground)" }}>Φόρτωση…</div>}
          {!loading && res.length === 0 && <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--muted-foreground)" }}>Κανένας</div>}
          {res.filter((u) => !ids.has(u.id)).map((u) => (
            <button key={u.id} type="button" onClick={() => add(u)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", borderBottom: "1px solid var(--border)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-canvas)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{u.name || u.email}</span>
                <span style={{ display: "block", fontSize: 11, color: "var(--muted-foreground)" }}>{u.email}</span>
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 9999, background: "var(--bg-canvas)", color: "var(--muted-foreground)" }}>
                {u.origin === "occupant" ? "Ένοικος/Ιδ." : u.origin === "manager" ? "Διαχειριστής" : "Εταιρεία"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function InfraModal({ buildingId, floorOptions, editing, onClose, onDone }: { buildingId: string; floorOptions: string[]; editing: InfraRow | null; onClose: () => void; onDone: () => void }) {
  const router = useRouter();
  const [tab, setTab] = useState<"info" | "media">("info");
  const [form, setForm] = useState({ name: editing?.name ?? "", type: (editing?.type ?? "OTHER") as InfraType, floorLabel: editing?.floorLabel ?? "", location: editing?.location ?? "", locked: editing?.locked ?? false, notes: editing?.notes ?? "" });
  const [keyHolder, setKeyHolder] = useState<AccessUser[]>(editing?.keyHolderUserId && editing.keyHolderName ? [{ id: editing.keyHolderUserId, name: editing.keyHolderName, email: "" }] : []);
  const [access, setAccess] = useState<AccessUser[]>(editing?.access ?? []);
  const [media, setMedia] = useState<MediaRow[]>(editing?.media ?? []);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const mediaInput = useRef<HTMLInputElement>(null);
  const f = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));
  const floorSelectOpts = [{ value: "", label: "—" }, ...floorOptions.map((o) => ({ value: o, label: o }))];

  function save() {
    setError(null);
    const payload = { ...form, keyHolderUserId: keyHolder[0]?.id ?? null, accessUserIds: access.map((a) => a.id) };
    startTransition(async () => {
      const res = editing ? await updateInfraPoint(editing.id, payload) : await createInfraPoint(buildingId, payload);
      if (res && "error" in res && res.error) { setError(res.error); return; }
      onDone();
    });
  }
  function pickMedia(files: FileList | null) {
    if (!files?.length || !editing) return;
    startTransition(async () => {
      for (const raw of Array.from(files)) {
        const file = await toWebpResized(raw);
        const fd = new FormData(); fd.set("infraPointId", editing.id); fd.set("file", file);
        const res = await uploadInfraMedia(fd);
        if (res && "media" in res && res.media) setMedia((m) => [...m, res.media]);
      }
      if (mediaInput.current) mediaInput.current.value = "";
      router.refresh();
    });
  }
  function delMedia(id: string) {
    if (!confirm("Διαγραφή αρχείου;")) return;
    startTransition(async () => { await deleteInfraMedia(id); setMedia((m) => m.filter((x) => x.id !== id)); router.refresh(); });
  }

  return (
    <Modal open onClose={onClose} title={editing ? "Επεξεργασία σημείου" : "Νέο σημείο πρόσβασης"} width={540}
      footer={<><button onClick={onClose} style={cancelBtn}>Ακύρωση</button><button onClick={save} disabled={isPending} style={saveBtn}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Αποθήκευση</button></>}>
      {error && <div style={errBox}>{error}</div>}
      {editing && (
        <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--border)", marginBottom: 14 }}>
          {([["info", "Στοιχεία"], ["media", `Φωτο/Βίντεο (${media.length})`]] as const).map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)} style={{ border: "none", background: "transparent", padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: tab === k ? "var(--color-primary)" : "var(--muted-foreground)", borderBottom: `2px solid ${tab === k ? "var(--color-primary)" : "transparent"}` }}>{lbl}</button>
          ))}
        </div>
      )}

      {editing && tab === "media" ? (
        <div>
          <button onClick={() => mediaInput.current?.click()} disabled={isPending} style={{ ...saveBtn, marginBottom: 14 }}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiImageAddLine />} Προσθήκη φωτο/βίντεο</button>
          <input ref={mediaInput} type="file" accept="image/*,video/*" multiple style={{ display: "none" }} onChange={(e) => pickMedia(e.target.files)} />
          {media.length === 0 ? (
            <div style={{ color: "var(--muted-foreground)", fontSize: 13, textAlign: "center", padding: 24 }}>Δεν υπάρχουν αρχεία.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 10 }}>
              {media.map((m) => (
                <div key={m.id} style={{ position: "relative", borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)", height: 90 }}>
                  {m.type === "VIDEO" ? <video src={m.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted /> : <img src={m.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                  <button onClick={() => delMedia(m.id)} disabled={isPending} title="Διαγραφή" style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.6)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><RiDeleteBinLine style={{ fontSize: 12 }} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FormField label="Όνομα" required><FieldInput value={form.name} onChange={f("name")} placeholder="π.χ. Μετρητές ΔΕΗ" /></FormField>
          <FormField label="Τύπος"><FieldSelect value={form.type} onChange={(v) => f("type")(v)} options={TYPE_OPTS} /></FormField>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FormField label="Όροφος"><FieldSelect value={form.floorLabel} onChange={(v) => f("floorLabel")(v)} options={floorSelectOpts} /></FormField>
          <FormField label="Θέση"><FieldInput value={form.location} onChange={f("location")} placeholder="π.χ. Κολώνα εισόδου" /></FormField>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)", cursor: "pointer" }}>
          <input type="checkbox" checked={form.locked} onChange={(e) => setForm((p) => ({ ...p, locked: e.target.checked }))} style={{ width: 15, height: 15, accentColor: "var(--color-primary)" }} /> Κλειδωμένο
        </label>
        <FormField label="Κάτοχος κλειδιού"><PeoplePicker buildingId={buildingId} selected={keyHolder} onChange={setKeyHolder} placeholder="Αναζήτηση προσώπου…" /></FormField>
        <FormField label="Πρόσβαση (ποιοι)"><PeoplePicker buildingId={buildingId} multi selected={access} onChange={setAccess} placeholder="Πρόσθεσε πρόσωπα…" /></FormField>
        <FormField label="Σημειώσεις"><FieldTextarea value={form.notes} onChange={f("notes")} rows={2} /></FormField>
        {!editing && <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0 }}>Φωτο/βίντεο προστίθενται μετά τη δημιουργία, από την καρτέλα «Φωτο/Βίντεο» (εικόνες → WebP ≤1920px).</p>}
      </div>
      )}
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
const pill: React.CSSProperties = { fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: "var(--color-primary-soft)", color: "var(--color-primary)" };
const chipGrey: React.CSSProperties = { fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: "var(--card)", color: "var(--muted-foreground)", border: "1px solid var(--border)" };
const chipOrange: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: "var(--color-orange-soft)", color: "var(--color-orange)" };
const chipGreen: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: "var(--color-green-soft)", color: "var(--color-green)" };
const cancelBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: 13, color: "var(--foreground)" };
const saveBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 };
const errBox: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, border: "1px solid #fca5a530", marginBottom: 12 };
