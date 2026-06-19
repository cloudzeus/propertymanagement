"use client";

import { useState } from "react";
import { RiUploadCloud2Line } from "react-icons/ri";
import { Modal } from "@/components/ui/modal";
import { ExpenseUploadFlow } from "./ExpenseUploadFlow";
import { type CategorySplit } from "./ExpenseReviewForm";

export function ExpenseOcrUpload({ buildingId, categories }: { buildingId: string; categories: CategorySplit[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} style={btnPrimary}>
        <RiUploadCloud2Line style={{ fontSize: 16 }} /> Καταχώρηση εξόδου (OCR)
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Καταχώρηση εξόδου (OCR)" width={760}>
        {open && (
          <ExpenseUploadFlow buildingId={buildingId} categories={categories} onDone={() => setOpen(false)} />
        )}
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
