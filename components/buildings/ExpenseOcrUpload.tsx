"use client";

import { useRef, useState } from "react";
import { RiUploadCloud2Line, RiLoaderLine } from "react-icons/ri";
import { Modal } from "@/components/ui/modal";
import { extractExpenseDocument } from "@/app/actions/building-expenses";
import { ExpenseReviewForm, type CategorySplit, type ExtractedDoc } from "./ExpenseReviewForm";

export function ExpenseOcrUpload({ buildingId, categories }: { buildingId: string; categories: CategorySplit[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ fileId: string; fileUrl: string; extracted: ExtractedDoc } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setLoading(false);
    setError(null);
    setResult(null);
    setDragOver(false);
    if (inputRef.current) inputRef.current.value = "";
  }
  function close() {
    setOpen(false);
    reset();
  }

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

  return (
    <>
      <button onClick={() => setOpen(true)} style={btnPrimary}>
        <RiUploadCloud2Line style={{ fontSize: 16 }} /> Καταχώρηση εξόδου (OCR)
      </button>

      <Modal open={open} onClose={close} title="Καταχώρηση εξόδου (OCR)" width={result ? 760 : 520}>
        {result ? (
          <ExpenseReviewForm
            buildingId={buildingId}
            fileId={result.fileId}
            fileUrl={result.fileUrl}
            extracted={result.extracted}
            categories={categories}
            onDone={close}
          />
        ) : (
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
          </div>
        )}
        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </Modal>
    </>
  );
}

const btnPrimary: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  height: 36, padding: "0 14px", borderRadius: 6,
  border: "1px solid var(--color-primary)", background: "var(--color-primary)",
  color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
};
