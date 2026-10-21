"use client";

import { useState } from "react";
import { RfqSupplierPicker } from "@/components/suppliers/RfqSupplierPicker";
import { addRfqSuppliers } from "@/app/actions/rfq";
import { sentMessage } from "@/lib/rfq-shared";
import { DialogFrame, useDialogRun, muted, type DialogProps } from "./shared";

export function AddRfqSuppliersDialog({ ctx, subject, onDone, onClose }: DialogProps) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const { busy, error, run } = useDialogRun(onDone);
  const rfqId = subject.kind === "rfq" ? subject.id : subject.kind === "fault" ? subject.flags.openRfqId : null;
  const rfq = ctx.rfqs.find((r) => r.id === rfqId);
  const invited = rfq?.invitations.map((i) => i.supplierId) ?? [];
  return (
    <DialogFrame title="Προσθήκη συνεργατών στο αίτημα" width={720} error={error} busy={busy} onClose={onClose}
      primary={{ label: `Αποστολή σε ${sel.size} επιπλέον`, disabled: sel.size === 0 || !rfqId,
        onClick: () => run(() => addRfqSuppliers(rfqId!, [...sel]), (r) => sentMessage(r as { sent: number; noEmail?: string[]; failed?: string[] }, ctx.picker.candidates)) }}>
      {rfq && <p style={muted}>{rfq.title || ctx.fault?.title} · ήδη προσκεκλημένοι: {invited.length}</p>}
      <RfqSupplierPicker candidates={ctx.picker.candidates} categories={ctx.picker.categories} defaultCategoryId={ctx.picker.defaultCategoryId} selected={sel} onChange={setSel} excludeIds={invited} />
    </DialogFrame>
  );
}
