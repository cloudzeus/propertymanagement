"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadBuildingFile, deleteBuildingFile } from "@/app/actions/building-files";
import { toWebpResized } from "@/lib/resize-image";
import {
  RiFolderLine, RiRulerLine, RiImageLine, RiFileTextLine, RiShieldCheckLine,
  RiUploadCloud2Line, RiDownload2Line, RiDeleteBinLine, RiLoaderLine,
} from "react-icons/ri";

export type FileRow = {
  id: string; name: string; url: string; category: string;
  mimeType: string | null; sizeBytes: number | null; createdAt: string;
};

const CATS: { key: string; label: string; icon: React.ElementType }[] = [
  { key: "ALL", label: "Όλα", icon: RiFolderLine },
  { key: "PLANS", label: "Σχέδια & Κατόψεις", icon: RiRulerLine },
  { key: "PHOTOS", label: "Φωτογραφίες", icon: RiImageLine },
  { key: "DOCUMENTS", label: "Έγγραφα", icon: RiFileTextLine },
  { key: "CERTIFICATES", label: "Πιστοποιητικά", icon: RiShieldCheckLine },
  { key: "OTHER", label: "Λοιπά", icon: RiFolderLine },
];

function fmtSize(b: number | null) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
function ext(name: string) {
  const m = name.split(".").pop()?.toUpperCase() ?? "";
  return m.length <= 4 ? m : "FILE";
}
function thumbColor(name: string): [string, string] {
  const e = ext(name);
  if (e === "PDF") return ["#d1343815", "#d13438"];
  if (["JPG", "JPEG", "PNG", "GIF", "WEBP"].includes(e)) return ["var(--color-blue-soft)", "var(--color-blue)"];
  if (["XLS", "XLSX", "CSV"].includes(e)) return ["var(--color-green-soft)", "var(--color-green)"];
  return ["var(--bg-canvas)", "var(--muted-foreground)"];
}

export function FilesPanel({ buildingId, files }: { buildingId: string; files: FileRow[] }) {
  const router = useRouter();
  const [cat, setCat] = useState("ALL");
  const [uploadCat, setUploadCat] = useState("DOCUMENTS");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const visible = cat === "ALL" ? files : files.filter((f) => f.category === cat);

  function onPick(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    startTransition(async () => {
      for (const raw of Array.from(fileList)) {
        const file = await toWebpResized(raw);
        const fd = new FormData();
        fd.set("buildingId", buildingId);
        fd.set("category", uploadCat);
        fd.set("file", file);
        const res = await uploadBuildingFile(fd);
        if (res && "error" in res && res.error) { setError(res.error); break; }
      }
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    });
  }
  function remove(id: string) {
    if (!confirm("Διαγραφή αρχείου;")) return;
    startTransition(async () => { await deleteBuildingFile(id); router.refresh(); });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 6 }}>
          <RiFolderLine /> {files.length} αρχεία
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={uploadCat} onChange={(e) => setUploadCat(e.target.value)} style={selectStyle}>
            {CATS.filter((c) => c.key !== "ALL").map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <button onClick={() => inputRef.current?.click()} disabled={isPending} style={{ ...btn, ...btnPrimary }}>
            {isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiUploadCloud2Line />} Ανέβασμα
          </button>
          <input ref={inputRef} type="file" multiple style={{ display: "none" }} onChange={(e) => onPick(e.target.files)} />
        </div>
      </div>

      {error && <div style={errBox}>{error}</div>}

      {/* category filters (wrap, never scroll) */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {CATS.map((c) => {
          const Icon = c.icon;
          const active = cat === c.key;
          const count = c.key === "ALL" ? files.length : files.filter((f) => f.category === c.key).length;
          return (
            <button key={c.key} onClick={() => setCat(c.key)} style={{
              ...btn, ...(active ? btnPrimary : {}),
            }}>
              <Icon style={{ fontSize: 15 }} /> {c.label} <span style={{ opacity: 0.7 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div onClick={() => inputRef.current?.click()} style={dropzone}>
          <RiUploadCloud2Line style={{ fontSize: 26 }} />
          <div>Σύρε αρχεία ή κάνε κλικ για ανέβασμα</div>
          <div style={{ fontSize: 11 }}>Αποθήκευση στον φάκελο του κτηρίου (BunnyCDN)</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(186px,1fr))", gap: 13 }}>
          {visible.map((f) => {
            const [bg, fg] = thumbColor(f.name);
            return (
              <div key={f.id} style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "var(--card)" }}>
                <div style={{ height: 96, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, background: bg, color: fg }}>{ext(f.name)}</div>
                <div style={{ padding: "10px 11px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={f.name}>{f.name}</div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{fmtSize(f.sizeBytes)}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <a href={f.url} target="_blank" rel="noreferrer" style={{ ...btnSm, textDecoration: "none" }}><RiDownload2Line /> Άνοιγμα</a>
                    <button onClick={() => remove(f.id)} disabled={isPending} style={{ ...btnSm, color: "#c50f1f" }}><RiDeleteBinLine /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 9999, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnPrimary: React.CSSProperties = { background: "var(--color-primary)", color: "#fff", borderColor: "var(--color-primary)" };
const btnSm: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 4, padding: "5px 9px", fontSize: 12, fontWeight: 600, cursor: "pointer" };
const selectStyle: React.CSSProperties = { height: 34, borderRadius: 4, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: 13, padding: "0 8px" };
const dropzone: React.CSSProperties = { border: "1.5px dashed var(--border-strong)", borderRadius: 8, padding: 30, textAlign: "center", color: "var(--muted-foreground)", background: "var(--bg-canvas)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 };
const errBox: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, border: "1px solid #fca5a530", marginBottom: 12 };
