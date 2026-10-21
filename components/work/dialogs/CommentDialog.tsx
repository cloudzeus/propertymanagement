"use client";

import { useState } from "react";
import { FieldTextarea } from "@/components/ui/modal";
import { addRequestComment } from "@/app/actions/maintenance-requests";
import { DialogFrame, useDialogRun, muted, checkRow, type DialogProps } from "./shared";

export function CommentDialog({ ctx, subject, onDone, onClose }: DialogProps) {
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const { busy, error, run } = useDialogRun(onDone);
  return (
    <DialogFrame title="Μήνυμα / σημείωση" error={error} busy={busy} onClose={onClose}
      primary={{ label: "Αποστολή", onClick: () => run(() => addRequestComment(subject.id, body, internal), internal ? "Η σημείωση καταχωρήθηκε" : "Το μήνυμα στάλθηκε"), disabled: !body.trim() }}>
      {ctx.fault && <p style={muted}>{ctx.fault.title}</p>}
      <FieldTextarea value={body} onChange={setBody} rows={4} placeholder="Γράψτε μήνυμα…" />
      <label style={checkRow}>
        <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} style={{ marginTop: 3 }} />
        <span>Εσωτερικό σχόλιο (δεν το βλέπει ο ένοικος)</span>
      </label>
    </DialogFrame>
  );
}
