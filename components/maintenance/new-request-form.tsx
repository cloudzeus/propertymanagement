"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormField, FieldInput, FieldSelect, FieldTextarea } from "@/components/ui/modal";
import { createMaintenanceRequest, type AttachmentInput } from "@/app/actions/maintenance-requests";
import { FAULT_PRIORITIES, PRIORITY_LABELS } from "@/lib/maintenance-shared";
import { RiAddLine, RiCloseLine, RiImageAddLine, RiVideoAddLine } from "react-icons/ri";
import type { BuildingOption, CategoryOption } from "./types";

type Pending = { name: string; attachment: AttachmentInput };

export function NewRequestButton({ buildings, categories, detailBase }: {
  buildings: BuildingOption[];
  categories: CategoryOption[];
  detailBase: string; // π.χ. "/portal/requests"
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [buildingId, setBuildingId] = useState(buildings.length === 1 ? buildings[0].id : "");
  const [unitId, setUnitId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [restricted, setRestricted] = useState(false);
  const [files, setFiles] = useState<Pending[]>([]);
  const [uploading, setUploading] = useState(false);

  const building = buildings.find((b) => b.id === buildingId);

  async function onPickFiles(list: FileList | null) {
    if (!list?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(list)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/maintenance/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Αποτυχία ανεβάσματος");
        setFiles((prev) => [...prev, { name: file.name, attachment: json.attachment }]);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setError(null);
    if (!buildingId) { setError("Επιλέξτε κτήριο"); return; }
    if (!title.trim() || !description.trim()) { setError("Συμπληρώστε τίτλο και περιγραφή"); return; }
    setBusy(true);
    const res = await createMaintenanceRequest({
      buildingId, unitId: unitId || null, title, description,
      categoryId: categoryId || null, priority: priority as any,
      restrictedAccess: restricted,
      attachments: files.map((f) => f.attachment),
    });
    setBusy(false);
    if ("error" in res && res.error) { setError(res.error); return; }
    setOpen(false);
    router.push(`${detailBase}/${(res as any).id}`);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px",
          background: "var(--primary)", color: "var(--primary-foreground)", border: "none",
          borderRadius: "var(--radius-sm)", fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}
      >
        <RiAddLine /> Δήλωση βλάβης
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Δήλωση βλάβης" width={620}
        footer={
          <>
            <button onClick={() => setOpen(false)} style={btnGhost}>Άκυρο</button>
            <button onClick={submit} disabled={busy || uploading} style={btnPrimary}>
              {busy ? "Υποβολή…" : "Υποβολή"}
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {error && <div style={{ color: "var(--destructive)", fontSize: 13 }}>{error}</div>}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="Κτήριο" required>
              <FieldSelect value={buildingId} onChange={(v) => { setBuildingId(v); setUnitId(""); }}
                placeholder="Επιλέξτε κτήριο" options={buildings.map((b) => ({ value: b.id, label: b.name }))} />
            </FormField>
            <FormField label="Μονάδα (προαιρετικά)">
              <FieldSelect value={unitId} onChange={setUnitId} placeholder="Κοινόχρηστος χώρος"
                options={(building?.units ?? []).map((u) => ({ value: u.id, label: u.label }))} />
            </FormField>
            <FormField label="Κατηγορία">
              <FieldSelect value={categoryId} onChange={setCategoryId} placeholder="Επιλέξτε κατηγορία"
                options={categories.map((c) => ({ value: c.id, label: c.name }))} />
            </FormField>
            <FormField label="Προτεραιότητα">
              <FieldSelect value={priority} onChange={setPriority}
                options={FAULT_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))} />
            </FormField>
          </div>

          <FormField label="Τίτλος" required>
            <FieldInput value={title} onChange={setTitle} placeholder="π.χ. Διαρροή νερού στο υπόγειο" />
          </FormField>
          <FormField label="Περιγραφή" required>
            <FieldTextarea value={description} onChange={setDescription} rows={4} placeholder="Περιγράψτε τη βλάβη…" />
          </FormField>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)", cursor: "pointer" }}>
            <input type="checkbox" checked={restricted} onChange={(e) => setRestricted(e.target.checked)} />
            Αφορά εξοπλισμό με περιορισμένη πρόσβαση (θα χρειαστεί ραντεβού)
          </label>

          <FormField label="Φωτογραφίες / Βίντεο" hint="Έως 25MB ανά φωτογραφία, 100MB ανά βίντεο">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px",
                border: "1px dashed var(--border)", borderRadius: "var(--radius-sm)",
                fontSize: 13, color: "var(--muted-foreground)", cursor: "pointer", width: "fit-content",
              }}>
                <RiImageAddLine /><RiVideoAddLine />
                {uploading ? "Ανέβασμα…" : "Προσθήκη αρχείων"}
                <input type="file" accept="image/*,video/*" multiple hidden disabled={uploading}
                  onChange={(e) => { onPickFiles(e.target.files); e.target.value = ""; }} />
              </label>
              {files.length > 0 && (
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
                  {files.map((f, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--foreground)" }}>
                      {f.attachment.kind === "VIDEO" ? <RiVideoAddLine /> : <RiImageAddLine />}
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {f.name}
                      </span>
                      <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                        style={{ border: "none", background: "none", cursor: "pointer", color: "var(--muted-foreground)" }}>
                        <RiCloseLine />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </FormField>
        </div>
      </Modal>
    </>
  );
}

const btnGhost: React.CSSProperties = {
  height: 34, padding: "0 12px", border: "1px solid var(--border)", background: "var(--paper)",
  borderRadius: "var(--radius-sm)", fontSize: 13, cursor: "pointer", color: "var(--foreground)",
};
const btnPrimary: React.CSSProperties = {
  height: 34, padding: "0 14px", border: "none", background: "var(--primary)",
  color: "var(--primary-foreground)", borderRadius: "var(--radius-sm)", fontSize: 13, fontWeight: 600, cursor: "pointer",
};
