"use client";

import { useRef, useState } from "react";
import { RiUploadCloud2Line, RiLoaderLine } from "react-icons/ri";
import { extractExpenseDocument } from "@/app/actions/building-expenses";
import { ExpenseReviewForm, type CategorySplit, type ExtractedDoc } from "./ExpenseReviewForm";

/**
 * The inner "upload → OCR extract → review" flow for a single building, with no
 * trigger button or modal chrome of its own. Reused by both the per-building
 * ExpenseOcrUpload button and the global GlobalExpenseButton. The parent decides
 * how/where to mount it and what `onDone` does (usually close its modal).
 */
export function ExpenseUploadFlow({
  buildingId,
  categories,
  onDone,
}: {
  buildingId: string;
  categories: CategorySplit[];
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ fileId: string; fileUrl: string; extracted: ExtractedDoc } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await extractExpenseDocument(buildingId, fd);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Αποτυχία επεξεργασίας αρχείου.");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <ExpenseReviewForm
        buildingId={buildingId}
        fileId={result.fileId}
        fileUrl={result.fileUrl}
        extracted={result.extracted}
        categories={categories}
        onDone={onDone}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {error && (
        <div style={{ padding: 10, borderRadius: 6, background: "#FEE7E618", border: "1px solid var(--color-danger)", color: "var(--color-danger)", fontSize: 12 }}>
          {error}
        </div>
      )}
      <div
        onClick={() => !loading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
        style={{
          border: `1.5px dashed ${dragOver ? "var(--color-primary)" : "var(--border-strong)"}`,
          borderRadius: 8, padding: 36, textAlign: "center",
          color: "var(--muted-foreground)", background: "var(--bg-canvas)",
          cursor: loading ? "default" : "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        }}
      >
        {loading ? (
          <>
            <RiLoaderLine style={{ fontSize: 26, animation: "spin 1s linear infinite" }} />
            <div>Επεξεργασία παραστατικού…</div>
          </>
        ) : (
          <>
            <RiUploadCloud2Line style={{ fontSize: 28 }} />
            <div>Σύρε ή κάνε κλικ για ανέβασμα παραστατικού</div>
            <div style={{ fontSize: 11 }}>Εικόνα ή PDF (έως 15MB)</div>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
