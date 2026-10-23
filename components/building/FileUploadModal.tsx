"use client";

/** «Ανέβασμα αρχείου» from the building «Ενέργειες» menu: category + files, same upload path as FilesPanel. */
import { useRef, useState, useTransition } from "react";
import { RiUploadCloud2Line, RiLoaderLine } from "react-icons/ri";
import { Modal, FormField } from "@/components/ui/modal";
import { FILE_CATS, uploadBuildingFiles } from "./FilesPanel";

export function FileUploadModal({ buildingId, onClose, onDone }: { buildingId: string; onClose: () => void; onDone: (count: number) => void }) {
  const [category, setCategory] = useState("DOCUMENTS");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function add(list: FileList | null) {
    if (!list?.length) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function submit() {
    setError(null);
    if (!files.length) { setError("Επιλέξτε τουλάχιστον ένα αρχείο."); return; }
    startTransition(async () => {
      const err = await uploadBuildingFiles(buildingId, category, files);
      if (err) { setError(err); return; }
      onDone(files.length);
    });
  }

  return (
    <Modal open onClose={onClose} title="Ανέβασμα αρχείου" width={520}
      footer={<>
        <button onClick={onClose} style={btnCancel}>Ακύρωση</button>
        <button onClick={submit} disabled={isPending || files.length === 0} style={btnSave}>
          {isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiUploadCloud2Line />} Ανέβασμα{files.length ? ` (${files.length})` : ""}
        </button>
      </>}>
      {error && <div style={errBox}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <FormField label="Κατηγορία">
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={selectStyle}>
            {FILE_CATS.filter((c) => c.key !== "ALL").map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </FormField>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); add(e.dataTransfer.files); }}
          style={{ ...dropzone, borderColor: dragOver ? "var(--color-primary)" : "var(--border-strong)" }}
        >
          <RiUploadCloud2Line style={{ fontSize: "var(--fs-26)" }} />
          <div>Σύρε αρχεία ή κάνε κλικ για επιλογή</div>
          <div style={{ fontSize: "var(--fs-11)" }}>Οι εικόνες μετατρέπονται σε WebP · αποθήκευση στον φάκελο του κτηρίου</div>
          <input ref={inputRef} type="file" multiple style={{ display: "none" }} onChange={(e) => add(e.target.files)} />
        </div>
        {files.length > 0 && (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--fs-12)", color: "var(--foreground)" }}>
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                <button type="button" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: "var(--fs-12)" }}>Αφαίρεση</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

const dropzone: React.CSSProperties = {
  border: "1.5px dashed var(--border-strong)", borderRadius: 8, padding: "28px 16px", textAlign: "center",
  color: "var(--muted-foreground)", fontSize: "var(--fs-13)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
};
const selectStyle: React.CSSProperties = { height: 36, padding: "0 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: "var(--fs-13)", width: "100%" };
const btnCancel: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: "var(--fs-13)", color: "var(--foreground)" };
const btnSave: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: "var(--fs-13)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 };
const errBox: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: "var(--fs-12)", marginBottom: 12 };
