"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { supplierAcceptWorkOrder } from "@/app/actions/rfq";
import { FormField, FieldInput } from "@/components/ui/modal";
import { RiQuillPenLine, RiLoaderLine, RiCheckLine } from "react-icons/ri";

/** Electronic acceptance card under contract B: typed name + consent → time/IP recorded. */
export function AcceptContract({ woId, woNumber, isAdmin, defaultName }: { woId: string; woNumber: string; isAdmin: boolean; defaultName: string }) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 18, maxWidth: 860 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--fs-13)", fontWeight: 700, marginBottom: 8 }}><RiQuillPenLine style={{ color: "var(--color-primary)" }} /> Ηλεκτρονική αποδοχή</div>
      {!isAdmin ? (
        <p style={{ margin: 0, fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)" }}>Μόνο ο διαχειριστής της επιχείρησής σας μπορεί να υπογράψει τη σύμβαση.</p>
      ) : (
        <>
          {error && <div role="alert" style={{ color: "var(--destructive)", fontSize: "var(--fs-13)", marginBottom: 8 }}>{error}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(200px, 320px) 1fr", gap: 12, alignItems: "end" }}>
            <FormField label="Ονοματεπώνυμο υπογράφοντα" required><FieldInput value={name} onChange={setName} /></FormField>
          </div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: "var(--fs-13)", margin: "10px 0", cursor: "pointer" }}>
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 3 }} />
            <span>Διάβασα και αποδέχομαι τους όρους της σύμβασης {woNumber}-B. Κατανοώ ότι καταγράφονται ημερομηνία/ώρα, διεύθυνση IP και συσκευή.</span>
          </label>
          <button disabled={pending || !agreed || name.trim().length < 3} onClick={() => { setError(null); start(async () => { const r = await supplierAcceptWorkOrder(woId, { signatoryName: name, agreed }); if ("error" in r && r.error) { setError(r.error); return; } router.refresh(); }); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 38, padding: "0 16px", border: "none", borderRadius: "var(--radius-sm)", background: "var(--primary)", color: "var(--primary-foreground)", fontSize: "var(--fs-13)", fontWeight: 700, cursor: "pointer" }}>
            {pending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Αποδοχή & υπογραφή
          </button>
          <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
        </>
      )}
    </div>
  );
}
