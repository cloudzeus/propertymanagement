"use client";

import { useState } from "react";
import { FormField, FieldInput } from "@/components/ui/modal";
import { scheduleWorkOrder } from "@/app/actions/rfq";
import { DialogFrame, useDialogRun, muted, fmt, type DialogProps } from "./shared";
import { liveWorkOrderOf } from "./WoRespondDialog";

export function WoScheduleDialog({ ctx, subject, onDone, onClose }: DialogProps) {
  const wo = liveWorkOrderOf(subject, ctx);
  const [when, setWhen] = useState("");
  const { busy, error, run } = useDialogRun(onDone);
  if (!wo) return null;
  return (
    <DialogFrame title={wo.scheduledAt ? "Αλλαγή ραντεβού έργου" : "Προγραμματισμός έργου"} error={error} busy={busy} onClose={onClose}
      primary={{ label: "Ορισμός", disabled: !when, onClick: () => run(() => scheduleWorkOrder(wo.id, new Date(when).toISOString()), `Ορίστηκε ραντεβού έργου ${fmt(new Date(when).toISOString())}`) }}>
      <p style={muted}>{wo.number} · {wo.title} · {wo.supplierName ?? "—"}{wo.scheduledAt ? ` · τρέχον ραντεβού ${fmt(wo.scheduledAt)}` : ""}</p>
      <FormField label="Ημερομηνία και ώρα επισκευής" required><FieldInput type="datetime-local" value={when} onChange={setWhen} /></FormField>
      <p style={muted}>Ειδοποιούνται ο διαχειριστής του κτηρίου και ο συνεργάτης.</p>
    </DialogFrame>
  );
}
