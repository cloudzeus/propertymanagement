"use client";

import { cancelRfq } from "@/app/actions/rfq";
import { DialogFrame, useDialogRun, muted, type DialogProps } from "./shared";

export function CancelRfqDialog({ ctx, subject, onDone, onClose }: DialogProps) {
  const { busy, error, run } = useDialogRun(onDone);
  const rfqId = subject.kind === "rfq" ? subject.id : subject.kind === "fault" ? subject.flags.openRfqId : null;
  const rfq = ctx.rfqs.find((r) => r.id === rfqId);
  return (
    <DialogFrame title="Ακύρωση αιτήματος προσφοράς" error={error} busy={busy} onClose={onClose}
      primary={{ label: "Ακύρωση αιτήματος", danger: true, disabled: !rfqId, onClick: () => run(() => cancelRfq(rfqId!), "Το αίτημα προσφοράς ακυρώθηκε") }}>
      <p style={{ margin: 0, fontSize: "var(--fs-13)", color: "var(--foreground)" }}>Το αίτημα θα ακυρωθεί για όλους τους συνεργάτες.</p>
      {rfq && <p style={muted}>{rfq.title || ctx.fault?.title} · {rfq.invitations.length} προσκεκλημένοι · {rfq.offers.length} προσφορές</p>}
    </DialogFrame>
  );
}
