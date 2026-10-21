"use client";

import { useState } from "react";
import { FormField, FieldTextarea } from "@/components/ui/modal";
import { respondWorkOrder } from "@/app/actions/rfq";
import { eur, withVat } from "@/lib/rfq-shared";
import { DialogFrame, useDialogRun, muted, checkRow, fmt, type DialogProps } from "./shared";

export function liveWorkOrderOf(subject: DialogProps["subject"], ctx: DialogProps["ctx"]) {
  const id = subject.kind === "work-order" ? subject.id : subject.kind === "fault" ? subject.flags.liveWo?.id : null;
  return ctx.workOrders.find((w) => w.id === id) ?? null;
}

export function WoRespondDialog({ ctx, subject, onDone, onClose }: DialogProps) {
  const wo = liveWorkOrderOf(subject, ctx);
  const [accept, setAccept] = useState(true);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const { busy, error, run } = useDialogRun(onDone);
  if (!wo) return null;
  return (
    <DialogFrame title="Αποδοχή / απόρριψη εκ μέρους πελάτη" width={600} error={error} busy={busy} onClose={onClose}
      primary={{ label: "Καταχώρηση", disabled: note.trim().length < 5 || (!accept && !reason.trim()), danger: !accept,
        onClick: () => run(() => respondWorkOrder(wo.id, accept, reason, { onBehalfNote: note }), accept ? `Η προσφορά ${wo.number} έγινε αποδεκτή εκ μέρους του πελάτη` : `Η προσφορά ${wo.number} απορρίφθηκε εκ μέρους του πελάτη`) }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, fontSize: "var(--fs-12-5)" }}>
        <Kv k="Σύμβαση" v={`${wo.number} · ${wo.title}`} />
        <Kv k="Συνεργάτης" v={wo.supplierName ?? "—"} />
        <Kv k="Τιμή πελάτη" v={wo.covered ? "καλύπτεται" : `${eur(wo.customerPrice)} + ΦΠΑ ${wo.vatPct}% = ${eur(withVat(wo.customerPrice, wo.vatPct))}`} />
        <Kv k="Ισχύει έως" v={fmt(wo.validUntil)} />
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <label style={checkRow}><input type="radio" name="resp" checked={accept} onChange={() => setAccept(true)} /><span>Αποδοχή</span></label>
        <label style={checkRow}><input type="radio" name="resp" checked={!accept} onChange={() => setAccept(false)} /><span>Απόρριψη</span></label>
      </div>
      {!accept && <FormField label="Λόγος απόρριψης" required><FieldTextarea value={reason} onChange={setReason} rows={2} /></FormField>}
      <FormField label="Πώς συμφώνησε ο πελάτης;" required><FieldTextarea value={note} onChange={setNote} rows={2} placeholder="π.χ. τηλεφωνικά με κ. Παπαδόπουλο, 21/10 12:30" /></FormField>
      <p style={muted}>Η ενέργεια καταγράφεται στο ιστορικό με το όνομά σας.</p>
    </DialogFrame>
  );
}

export function Kv({ k, v }: { k: string; v: string }) {
  return <div><div style={{ fontSize: "var(--fs-11)", color: "var(--muted-foreground)", fontWeight: 600 }}>{k}</div><div style={{ color: "var(--foreground)" }}>{v}</div></div>;
}
