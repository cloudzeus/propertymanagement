"use client";

import { useState } from "react";
import { RiStarFill, RiStarLine } from "react-icons/ri";
import { FieldInput } from "@/components/ui/modal";
import { rateSupplier } from "@/app/actions/suppliers";
import { DialogFrame, useDialogRun, muted, type DialogProps } from "./shared";

export function RateSupplierDialog({ ctx, subject, onDone, onClose }: DialogProps) {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const { busy, error, run } = useDialogRun(onDone);
  const supplierName = ctx.suppliers.find((s) => s.id === ctx.fault?.supplierId)?.name?.split(" — ")[0] ?? "συνεργάτη";
  return (
    <DialogFrame title={`Αξιολόγηση συνεργάτη · ${supplierName}`} error={error} busy={busy} onClose={onClose}
      primary={{ label: "Αποθήκευση", onClick: () => run(() => rateSupplier(subject.id, score, comment), "Η αξιολόγηση αποθηκεύτηκε"), disabled: !score }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setScore(n)} aria-label={`${n} αστέρια`}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "var(--fs-26)", lineHeight: 1, color: n <= score ? "#F2A23C" : "var(--border)", padding: 2, display: "inline-flex" }}>
            {n <= score ? <RiStarFill /> : <RiStarLine />}
          </button>
        ))}
        <span style={{ ...muted, marginLeft: 8 }}>{score ? `${score}/5` : "Επιλέξτε 1–5"}</span>
      </div>
      <FieldInput value={comment} onChange={setComment} placeholder="Σχόλιο (προαιρετικά): ποιότητα, συνέπεια, επικοινωνία" />
      <p style={muted}>Η αξιολόγηση επηρεάζει τη σειρά πρότασης του συνεργάτη σε επόμενες αναθέσεις.</p>
    </DialogFrame>
  );
}
