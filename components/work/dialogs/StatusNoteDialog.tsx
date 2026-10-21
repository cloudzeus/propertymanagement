"use client";

import { useState } from "react";
import { FormField, FieldTextarea } from "@/components/ui/modal";
import { changeRequestStatus } from "@/app/actions/maintenance-requests";
import { STATUS_LABELS } from "@/lib/maintenance-shared";
import { DialogFrame, useDialogRun, muted, type DialogProps } from "./shared";

export function StatusNoteDialog({ ctx, subject, status, batchIds, onDone, onClose }: DialogProps) {
  const [note, setNote] = useState("");
  const { busy, error, run, runMany } = useDialogRun(onDone);
  if (!status) return null;
  const ids = batchIds ?? [subject.id];
  const required = status === "CANCELLED";
  const label = STATUS_LABELS[status];
  const submit = () => (ids.length > 1
    ? runMany(ids, (id) => changeRequestStatus(id, status, note), `→ ${label}`)
    : run(() => changeRequestStatus(subject.id, status, note), `Η κατάσταση άλλαξε σε «${label}»`));
  return (
    <DialogFrame title={`→ ${label}`} error={error} busy={busy} onClose={onClose}
      primary={{ label: "Αλλαγή κατάστασης", onClick: submit, disabled: required && !note.trim(), danger: status === "CANCELLED" }}>
      {ctx.fault && ids.length === 1 && <p style={muted}>{ctx.fault.title}</p>}
      <FormField label={required ? "Λόγος ακύρωσης" : "Σημείωση (προαιρετικά)"} required={required}>
        <FieldTextarea value={note} onChange={setNote} rows={3} placeholder={required ? "Γράψτε τον λόγο ακύρωσης" : "Θα το δουν οι ενδιαφερόμενοι στην ειδοποίηση"} />
      </FormField>
    </DialogFrame>
  );
}
