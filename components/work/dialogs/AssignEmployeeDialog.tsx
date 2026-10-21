"use client";

import { useState } from "react";
import { FormField, FieldSelect } from "@/components/ui/modal";
import { assignRequest } from "@/app/actions/maintenance-requests";
import { DialogFrame, useDialogRun, btn, muted, type DialogProps } from "./shared";

export function AssignEmployeeDialog({ ctx, subject, batchIds, onDone, onClose }: DialogProps) {
  const current = subject.kind === "fault" ? subject.assigneeId : null;
  const [assignee, setAssignee] = useState(current ?? "");
  const { busy, error, run, runMany } = useDialogRun(onDone);
  const ids = batchIds ?? [subject.id];
  const name = ctx.employees.find((e) => e.id === assignee)?.name;

  const submit = () => (ids.length > 1
    ? runMany(ids, (id) => assignRequest(id, assignee || null), assignee ? `Ανάθεση σε ${name}` : "Αφαίρεση ανάθεσης")
    : run(() => assignRequest(subject.id, assignee || null), assignee ? `Ανατέθηκε σε ${name}` : "Η ανάθεση αφαιρέθηκε"));

  return (
    <DialogFrame title={ids.length > 1 ? `Ανάθεση σε υπάλληλο (${ids.length} βλάβες)` : "Ανάθεση σε υπάλληλο"} error={error} busy={busy} onClose={onClose}
      primary={{ label: "Ανάθεση", onClick: submit, disabled: !assignee }}>
      {ctx.fault && ids.length === 1 && <p style={muted}>{ctx.fault.title}</p>}
      <FormField label="Υπάλληλος">
        <FieldSelect value={assignee} onChange={setAssignee} placeholder="— Χωρίς ανάθεση —" options={ctx.employees.map((e) => ({ value: e.id, label: e.name }))} />
      </FormField>
      {current && ids.length === 1 && (
        <div><button type="button" style={btn} disabled={busy} onClick={() => { setAssignee(""); void run(() => assignRequest(subject.id, null), "Η ανάθεση αφαιρέθηκε"); }}>Αφαίρεση ανάθεσης</button></div>
      )}
    </DialogFrame>
  );
}
