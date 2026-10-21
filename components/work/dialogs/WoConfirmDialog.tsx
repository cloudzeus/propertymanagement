"use client";

import { useState } from "react";
import { FormField, FieldTextarea } from "@/components/ui/modal";
import { confirmWorkOrder } from "@/app/actions/rfq";
import { DialogFrame, useDialogRun, muted, checkRow, fmt, type DialogProps } from "./shared";
import { liveWorkOrderOf, Kv } from "./WoRespondDialog";

export function WoConfirmDialog({ ctx, subject, onDone, onClose }: DialogProps) {
  const wo = liveWorkOrderOf(subject, ctx);
  const [ok, setOk] = useState(true);
  const [issue, setIssue] = useState("");
  const [note, setNote] = useState("");
  const { busy, error, run } = useDialogRun(onDone);
  if (!wo) return null;
  return (
    <DialogFrame title="Παραλαβή έργου εκ μέρους πελάτη" width={600} error={error} busy={busy} onClose={onClose}
      primary={{ label: "Καταχώρηση", disabled: note.trim().length < 5 || (!ok && !issue.trim()), danger: !ok,
        onClick: () => run(() => confirmWorkOrder(wo.id, ok, issue, { onBehalfNote: note }), ok ? `Η παραλαβή της ${wo.number} επιβεβαιώθηκε εκ μέρους του πελάτη` : `Καταχωρήθηκε αμφισβήτηση για την ${wo.number}`) }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, fontSize: "var(--fs-12-5)" }}>
        <Kv k="Σύμβαση" v={`${wo.number} · ${wo.title}`} />
        <Kv k="Συνεργάτης" v={wo.supplierName ?? "—"} />
        <Kv k="Ολοκληρώθηκε" v={fmt(wo.completedAt)} />
      </div>
      {wo.completionNote && <p style={{ margin: 0, fontSize: "var(--fs-13)", color: "var(--foreground)", whiteSpace: "pre-wrap" }}>{wo.completionNote}</p>}
      {wo.completionMedia.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {wo.completionMedia.map((m, i) => <a key={i} href={m.url} target="_blank" rel="noreferrer"><img src={m.url} alt="" style={{ width: 84, height: 64, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} /></a>)}
        </div>
      )}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <label style={checkRow}><input type="radio" name="conf" checked={ok} onChange={() => setOk(true)} /><span>Παραλαβή — η εργασία έγινε σωστά</span></label>
        <label style={checkRow}><input type="radio" name="conf" checked={!ok} onChange={() => setOk(false)} /><span>Αμφισβήτηση — κάτι δεν πάει καλά</span></label>
      </div>
      {!ok && <FormField label="Τι δεν έγινε σωστά;" required><FieldTextarea value={issue} onChange={setIssue} rows={2} /></FormField>}
      <FormField label="Πώς το επιβεβαίωσε ο πελάτης;" required><FieldTextarea value={note} onChange={setNote} rows={2} placeholder="π.χ. τηλεφωνικά με τον διαχειριστή, 21/10" /></FormField>
      <p style={muted}>Η ενέργεια καταγράφεται στο ιστορικό με το όνομά σας.</p>
    </DialogFrame>
  );
}
