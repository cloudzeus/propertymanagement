"use client";

import { useState } from "react";
import { FormField, FieldSelect } from "@/components/ui/modal";
import { assignRequestSupplier } from "@/app/actions/maintenance-requests";
import { setPreferredSupplier } from "@/app/actions/suppliers";
import { DialogFrame, useDialogRun, btn, muted, checkRow, type DialogProps } from "./shared";

export function AssignSupplierDialog({ ctx, subject, batchIds, onDone, onClose }: DialogProps) {
  const current = subject.kind === "fault" ? subject.supplierId : null;
  const [sel, setSel] = useState(current ?? "");
  const [makePreferred, setMakePreferred] = useState(false);
  const { busy, error, run, runMany } = useDialogRun(onDone);
  const ids = batchIds ?? [subject.id];
  const covered = ctx.fault?.handledBy === "COMPANY";
  const name = ctx.suppliers.find((s) => s.id === sel)?.name?.split(" — ")[0];

  const submit = () => (ids.length > 1
    ? runMany(ids, (id) => assignRequestSupplier(id, sel || null), sel ? `Ανάθεση σε ${name}` : "Αφαίρεση συνεργάτη")
    : run(async () => {
        const res = await assignRequestSupplier(subject.id, sel || null);
        if ("error" in res && res.error) return res;
        if (makePreferred && sel && ctx.fault) return setPreferredSupplier(ctx.fault.buildingId, ctx.fault.categoryId, sel);
        return res;
      }, sel ? `Ανατέθηκε στον συνεργάτη ${name}` : "Ο συνεργάτης αφαιρέθηκε"));

  return (
    <DialogFrame title={ids.length > 1 ? `Ανάθεση σε συνεργάτη (${ids.length} βλάβες)` : "Ανάθεση σε συνεργάτη"} width={600} error={error} busy={busy} onClose={onClose}
      primary={{ label: sel ? "Ανάθεση" : "Αφαίρεση", onClick: submit, disabled: sel === (current ?? "") && ids.length === 1 }}>
      {ctx.fault && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--fs-12)", fontWeight: 600, padding: "3px 10px", borderRadius: 999, alignSelf: "flex-start",
          color: covered ? "#15803d" : "#b45309", background: covered ? "#15803d14" : "#b4530914", border: `1px solid ${covered ? "#15803d40" : "#b4530940"}`,
        }}>
          {covered ? "Καλύπτεται από τη σύμβαση διαχείρισης — άμεση ανάθεση, χωρίς προσφορά προς τον πελάτη" : "Εκτός σύμβασης — απαιτείται προσφορά και αποδοχή από τον πελάτη"}
        </div>
      )}
      <FormField label="Εξωτερικός συνεργάτης" hint="Ταξινόμηση: προτιμώμενος · ίδιος με προηγούμενη · ειδικότητα · αξιολόγηση · απόσταση · 24/7">
        <FieldSelect value={sel} onChange={setSel} placeholder="— Χωρίς συνεργάτη —" options={ctx.suppliers.map((s) => ({ value: s.id, label: s.name }))} />
      </FormField>
      {ids.length === 1 && ctx.fault && (
        <label style={checkRow}>
          <input type="checkbox" checked={makePreferred} onChange={(e) => setMakePreferred(e.target.checked)} disabled={!sel || sel === ctx.preferredSupplierId} style={{ marginTop: 3 }} />
          <span>Ορισμός ως προτιμώμενου συνεργάτη για αυτό το κτήριο{ctx.fault.categoryName ? ` (${ctx.fault.categoryName})` : ""} — θα προτείνεται πρώτος σε επόμενες εργασίες</span>
        </label>
      )}
      {current && ids.length === 1 && <div><button type="button" style={btn} disabled={busy} onClick={() => { setSel(""); void run(() => assignRequestSupplier(subject.id, null), "Ο συνεργάτης αφαιρέθηκε"); }}>Αφαίρεση συνεργάτη</button></div>}
      {ctx.suppliers.length === 0 && <p style={muted}>Δεν υπάρχουν ενεργοί συνεργάτες στο μητρώο της εταιρείας.</p>}
    </DialogFrame>
  );
}
