"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createMaintenanceRequest, type AttachmentInput } from "@/app/actions/maintenance-requests";
import { FAULT_PRIORITIES, PRIORITY_LABELS } from "@/lib/maintenance-shared";
import { RiCameraLine, RiImageAddLine, RiCloseLine, RiLoaderLine, RiSendPlaneLine, RiCheckboxCircleLine } from "react-icons/ri";
import type { BuildingOption, CategoryOption } from "./types";

type Pending = { name: string; url: string; attachment: AttachmentInput };

/**
 * Mobile-first fault report: photo first (phone camera opens directly), then
 * where/what. One column, large touch targets. Also fine on desktop.
 */
export function MobileReportForm({ buildings, categories, detailBase }: {
  buildings: BuildingOption[];
  categories: CategoryOption[];
  detailBase: string;
}) {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [buildingId, setBuildingId] = useState(buildings.length === 1 ? buildings[0].id : "");
  const building = buildings.find((b) => b.id === buildingId);
  const [unitId, setUnitId] = useState(buildings.length === 1 && buildings[0].units.length === 1 ? buildings[0].units[0].id : "");
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [restricted, setRestricted] = useState(false);
  const [files, setFiles] = useState<Pending[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(list: FileList | null) {
    if (!list?.length) return;
    setUploading(true); setError(null);
    try {
      for (const file of Array.from(list)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/maintenance/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Αποτυχία ανεβάσματος");
        setFiles((prev) => [...prev, { name: file.name, url: json.attachment.url, attachment: json.attachment }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Αποτυχία ανεβάσματος");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setError(null);
    if (!buildingId) { setError("Επιλέξτε κτήριο"); return; }
    if (!description.trim()) { setError("Γράψτε τι συμβαίνει"); return; }
    setBusy(true);
    const cat = categories.find((c) => c.id === categoryId);
    const res = await createMaintenanceRequest({
      buildingId, unitId: unitId || null,
      title: title.trim() || (cat ? `${cat.name}: ${description.trim().slice(0, 60)}` : description.trim().slice(0, 70)),
      description, categoryId: categoryId || null, priority: priority as (typeof FAULT_PRIORITIES)[number],
      restrictedAccess: restricted, attachments: files.map((f) => f.attachment),
    });
    setBusy(false);
    if ("error" in res && res.error) { setError(res.error); return; }
    router.push(`${detailBase}/${(res as { id: string }).id}`);
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ fontSize: "var(--fs-11-5)", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--muted-foreground)" }}>Νέα βλάβη</div>
        <h1 style={{ fontSize: "var(--fs-22)", fontWeight: 800, margin: "2px 0 0", color: "var(--foreground)" }}>Τι συμβαίνει;</h1>
      </div>

      {error && <div style={errBox} role="alert">{error}</div>}

      {/* 1. Photo first — the camera opens directly on phones */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button type="button" onClick={() => cameraRef.current?.click()} disabled={uploading} style={{ ...bigBtn, borderStyle: "dashed", borderColor: "var(--color-primary)", color: "var(--color-primary)" }}>
          {uploading ? <RiLoaderLine style={{ fontSize: "var(--fs-26)", animation: "spin 1s linear infinite" }} /> : <RiCameraLine style={{ fontSize: "var(--fs-26)" }} />}
          <span>Τράβηξε φωτογραφία</span>
        </button>
        <button type="button" onClick={() => galleryRef.current?.click()} disabled={uploading} style={bigBtn}>
          <RiImageAddLine style={{ fontSize: "var(--fs-26)" }} /><span>Από τη συλλογή</span>
        </button>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onPick(e.target.files); e.target.value = ""; }} />
        <input ref={galleryRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { onPick(e.target.files); e.target.value = ""; }} />
      </div>
      {files.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {files.map((f, i) => (
            <div key={i} style={{ position: "relative", width: 84, height: 84, borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", background: "var(--paper)" }}>
              {f.attachment.kind === "VIDEO" ? <video src={f.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <img src={f.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              <button type="button" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} aria-label="Αφαίρεση" style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: 999, border: "none", background: "rgba(0,0,0,.6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><RiCloseLine /></button>
            </div>
          ))}
        </div>
      )}

      {/* 2. Where */}
      {buildings.length > 1 && (
        <Field label="Κτήριο">
          <select value={buildingId} onChange={(e) => { setBuildingId(e.target.value); setUnitId(""); }} style={select}>
            <option value="">Επιλέξτε κτήριο</option>
            {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
      )}
      {building && building.units.length > 0 && (
        <Field label="Πού;">
          <select value={unitId} onChange={(e) => setUnitId(e.target.value)} style={select}>
            <option value="">Κοινόχρηστος χώρος</option>
            {building.units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </Field>
      )}

      {/* 3. What */}
      <Field label="Κατηγορία">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {categories.map((c) => {
            const on = categoryId === c.id;
            return <button key={c.id} type="button" onClick={() => setCategoryId(on ? "" : c.id)} style={{ ...chip, ...(on ? chipOn : {}) }}>{c.name}</button>;
          })}
        </div>
      </Field>
      <Field label="Πόσο επείγει;">
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${FAULT_PRIORITIES.length}, 1fr)`, gap: 4, background: "var(--paper)", padding: 4, borderRadius: 10 }}>
          {FAULT_PRIORITIES.map((p) => (
            <button key={p} type="button" onClick={() => setPriority(p)} style={{ height: 40, border: "none", borderRadius: 8, cursor: "pointer", fontSize: "var(--fs-13)", fontWeight: 600, background: priority === p ? "var(--card)" : "transparent", color: priority === p ? (p === "URGENT" ? "#c50f1f" : "var(--foreground)") : "var(--muted-foreground)", boxShadow: priority === p ? "0 1px 2px rgba(0,0,0,.12)" : "none" }}>
              {PRIORITY_LABELS[p]}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Περιγραφή" required>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="π.χ. Τρέχει νερό από το ταβάνι του υπογείου, δίπλα στον λέβητα" style={{ ...select, height: "auto", padding: 12, resize: "vertical", fontFamily: "inherit" }} />
      </Field>
      <Field label="Τίτλος (προαιρετικά)">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Θα δημιουργηθεί αυτόματα αν το αφήσετε κενό" style={select} />
      </Field>
      <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "var(--fs-14)", color: "var(--foreground)", cursor: "pointer", padding: "4px 0" }}>
        <input type="checkbox" checked={restricted} onChange={(e) => setRestricted(e.target.checked)} style={{ width: 20, height: 20 }} />
        Χρειάζεται ραντεβού για πρόσβαση (κλειδωμένος χώρος/εξοπλισμός)
      </label>

      <button type="button" onClick={submit} disabled={busy || uploading} style={cta}>
        {busy ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiSendPlaneLine />} Αποστολή στη διαχείριση
      </button>
      <p style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: "var(--fs-12)", color: "var(--muted-foreground)", margin: 0 }}>
        <RiCheckboxCircleLine style={{ marginTop: 2, flexShrink: 0 }} /> Μετά την αποστολή θα δείτε αν η βλάβη καλύπτεται από τη σύμβαση διαχείρισης ή αν θα λάβετε προσφορά.
      </p>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: "var(--fs-13)", fontWeight: 600, color: "var(--foreground)" }}>{label}{required && <span style={{ color: "#c50f1f", marginLeft: 3 }}>*</span>}</label>
      {children}
    </div>
  );
}

const select: React.CSSProperties = { width: "100%", height: 46, padding: "0 12px", border: "1px solid var(--border)", borderRadius: 10, fontSize: "var(--fs-15)", color: "var(--foreground)", background: "var(--card)", boxSizing: "border-box" };
const bigBtn: React.CSSProperties = { height: 92, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, border: "1px solid var(--border)", borderRadius: 12, background: "var(--card)", color: "var(--foreground)", fontSize: "var(--fs-13)", fontWeight: 600, cursor: "pointer" };
const chip: React.CSSProperties = { border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 999, padding: "9px 14px", fontSize: "var(--fs-14)", cursor: "pointer" };
const chipOn: React.CSSProperties = { background: "var(--color-primary)", borderColor: "var(--color-primary)", color: "#fff", fontWeight: 600 };
const cta: React.CSSProperties = { height: 52, border: "none", borderRadius: 12, background: "var(--color-primary)", color: "#fff", fontSize: "var(--fs-16)", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6 };
const errBox: React.CSSProperties = { padding: "10px 12px", borderRadius: 8, background: "#fee2e218", color: "#dc2626", fontSize: "var(--fs-13)", border: "1px solid #fca5a530" };
