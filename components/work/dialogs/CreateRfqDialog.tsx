"use client";

import { useState } from "react";
import { FormField, FieldInput, FieldTextarea } from "@/components/ui/modal";
import { RfqSupplierPicker } from "@/components/suppliers/RfqSupplierPicker";
import { createRfq } from "@/app/actions/rfq";
import { sentMessage } from "@/lib/rfq-shared";
import { DialogFrame, useDialogRun, muted, checkRow, type DialogProps } from "./shared";

export function CreateRfqDialog({ ctx, subject, onDone, onClose }: DialogProps) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [deadline, setDeadline] = useState("");
  const [survey, setSurvey] = useState(false);
  const [notes, setNotes] = useState("");
  const { busy, error, run } = useDialogRun(onDone);
  const n = sel.size;
  return (
    <DialogFrame title="Αίτημα προσφοράς σε συνεργάτες" width={720} error={error} busy={busy} onClose={onClose}
      primary={{ label: `Αποστολή σε ${n} συνεργάτ${n === 1 ? "η" : "ες"}`, disabled: n === 0,
        onClick: () => run(() => createRfq({ maintenanceRequestId: subject.id, supplierIds: [...sel], deadlineAt: deadline ? new Date(deadline).toISOString() : null, surveyRequired: survey, notes }),
          (r) => sentMessage(r as { sent: number; noEmail?: string[]; failed?: string[] }, ctx.picker.candidates)) }}>
      {ctx.fault && <p style={muted}>{ctx.fault.title}</p>}
      <p style={muted}>Η λίστα είναι ταξινομημένη κατά καταλληλότητα. Κάθε συνεργάτης λαμβάνει email με προσωπικό link (14 ημέρες) και απαντά με τιμή και διαθεσιμότητα.</p>
      <RfqSupplierPicker candidates={ctx.picker.candidates} categories={ctx.picker.categories} defaultCategoryId={ctx.picker.defaultCategoryId} selected={sel} onChange={setSel} />
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10, alignItems: "end" }}>
        <FormField label="Προθεσμία απάντησης"><FieldInput type="datetime-local" value={deadline} onChange={setDeadline} /></FormField>
        <label style={{ ...checkRow, paddingBottom: 8 }}><input type="checkbox" checked={survey} onChange={(e) => setSurvey(e.target.checked)} style={{ marginTop: 3 }} /><span>Ζητείται αυτοψία πριν την προσφορά</span></label>
      </div>
      <FormField label="Σημείωση προς τους συνεργάτες (προαιρετικά)"><FieldTextarea value={notes} onChange={setNotes} rows={2} /></FormField>
    </DialogFrame>
  );
}
