"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormField, FieldInput, FieldTextarea } from "@/components/ui/modal";
import { supplierAcceptWorkOrder, scheduleWorkOrder, startWorkOrder, completeWorkOrder } from "@/app/actions/rfq";
import { WO_STATUS_LABELS, WO_STATUS_COLORS, eur, withVat } from "@/lib/rfq-shared";
import type { SupplierWorkOrderDTO } from "@/lib/rfq";
import { RiFileTextLine, RiCheckLine, RiCalendarCheckLine, RiPlayLine, RiCameraLine, RiImageAddLine, RiCloseLine, RiLoaderLine, RiAlertLine, RiThumbUpLine, RiMapPin2Line } from "react-icons/ri";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("el-GR", { dateStyle: "long", timeStyle: "short" }) : "—");
type Media = { url: string; kind: "IMAGE" | "VIDEO" };

/** Supplier's view of one work order: accept → schedule → start → proof of repair. */
export function WorkOrderActions({ wo, isAdmin }: { wo: SupplierWorkOrderDTO; isAdmin: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [media, setMedia] = useState<Media[]>([]);
  const [uploading, setUploading] = useState(false);
  const c = WO_STATUS_COLORS[wo.status] ?? "#6b7280";

  async function run(fn: () => Promise<{ error?: string | null } | { ok?: boolean }>) {
    setBusy(true); setError(null);
    const res = await fn();
    setBusy(false);
    if (res && "error" in res && res.error) { setError(res.error); return; }
    router.refresh();
  }
  async function onPick(list: FileList | null) {
    if (!list?.length) return;
    setUploading(true); setError(null);
    try {
      for (const file of Array.from(list)) {
        const fd = new FormData(); fd.append("file", file);
        const res = await fetch("/api/maintenance/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Αποτυχία ανεβάσματος");
        setMedia((p) => [...p, { url: json.attachment.url, kind: json.attachment.kind === "VIDEO" ? "VIDEO" : "IMAGE" }]);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Αποτυχία ανεβάσματος"); } finally { setUploading(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: "var(--fs-19)", fontWeight: 700, margin: 0, flex: 1 }}>{wo.number} · {wo.title}</h1>
          <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: "var(--fs-11-5)", fontWeight: 600, color: c, background: `${c}18`, border: `1px solid ${c}40` }}>{WO_STATUS_LABELS[wo.status] ?? wo.status}</span>
          <Link href={`/marketplace/work-orders/${wo.id}/contract`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "var(--fs-12-5)", color: "var(--color-primary)", textDecoration: "none" }}><RiFileTextLine /> Σύμβαση Β</Link>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)", marginTop: 6 }}>
          <span><RiMapPin2Line style={{ verticalAlign: "-2px" }} /> {wo.building}</span>
          <span>Τιμή σας: <b style={{ color: "var(--foreground)" }}>{eur(wo.supplierPrice)}</b> + ΦΠΑ {wo.vatPct}% = {eur(withVat(wo.supplierPrice, wo.vatPct))}</span>
          {wo.warrantyMonths != null && <span>Εγγύηση {wo.warrantyMonths} μήνες</span>}
          {wo.scheduledAt && <span><RiCalendarCheckLine style={{ verticalAlign: "-2px" }} /> Ραντεβού {fmt(wo.scheduledAt)}</span>}
        </div>
        <p style={{ fontSize: "var(--fs-14)", marginTop: 12, whiteSpace: "pre-wrap" }}>{wo.description}</p>
        {wo.maintenanceRequestId && <Link href={`/marketplace/requests/${wo.maintenanceRequestId}`} style={{ fontSize: "var(--fs-12-5)", color: "var(--color-primary)" }}>Άνοιγμα της βλάβης (φωτογραφίες, επικοινωνία, ραντεβού πρόσβασης)</Link>}
      </div>

      {error && <div style={{ color: "var(--destructive)", fontSize: "var(--fs-13)" }}>{error}</div>}

      {/* Step 1: accept */}
      {wo.status === "ACCEPTED" && !wo.supplierAcceptedAt && (
        <div style={card}>
          <div style={h3}><RiCheckLine /> Αποδοχή ανάθεσης</div>
          <p style={{ fontSize: "var(--fs-13-5)", margin: "0 0 10px" }}>Ο πελάτης αποδέχθηκε την προσφορά σας. Διαβάστε τη <Link href={`/marketplace/work-orders/${wo.id}/contract`}>σύμβαση Β</Link> και αποδεχθείτε την ανάθεση για να ξεκινήσει ο προγραμματισμός.</p>
          {isAdmin ? <button disabled={busy} style={btnPrimary} onClick={() => run(() => supplierAcceptWorkOrder(wo.id))}><RiCheckLine /> Αποδέχομαι την ανάθεση και τους όρους</button> : <p style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)", margin: 0 }}>Μόνο ο διαχειριστής της επιχείρησής σας μπορεί να αποδεχθεί.</p>}
        </div>
      )}

      {/* Step 2: schedule */}
      {["ACCEPTED", "SCHEDULED"].includes(wo.status) && wo.supplierAcceptedAt && (
        <div style={card}>
          <div style={h3}><RiCalendarCheckLine /> {wo.scheduledAt ? "Αλλαγή ραντεβού" : "Ορισμός ημερομηνίας επισκευής"}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", maxWidth: 420 }}>
            <div style={{ flex: 1 }}><FormField label="Ημερομηνία & ώρα"><FieldInput type="datetime-local" value={when} onChange={setWhen} /></FormField></div>
            <button disabled={busy || !when} style={btnPrimary} onClick={() => run(() => scheduleWorkOrder(wo.id, new Date(when).toISOString()))}>Ορισμός</button>
          </div>
          {wo.status === "SCHEDULED" && <button disabled={busy} style={{ ...btn, marginTop: 10 }} onClick={() => run(() => startWorkOrder(wo.id))}><RiPlayLine /> Ξεκίνησα την εργασία</button>}
        </div>
      )}

      {/* Step 3: proof of repair */}
      {["IN_PROGRESS", "SCHEDULED", "DISPUTED"].includes(wo.status) && wo.supplierAcceptedAt && (
        <div style={card}>
          <div style={h3}><RiCameraLine /> Απόδειξη επισκευής</div>
          {wo.status === "DISPUTED" && <div style={{ padding: "8px 12px", borderRadius: 6, background: "#9f123914", color: "#9f1239", fontSize: "var(--fs-13)", marginBottom: 10 }}><RiAlertLine style={{ verticalAlign: "-2px" }} /> Ο πελάτης αμφισβήτησε την παραλαβή: {wo.disputeNote}. Αποκαταστήστε και καταθέστε νέα απόδειξη.</div>}
          <p style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)", margin: "0 0 10px" }}>Φωτογραφίες «μετά» και σύντομη αναφορά. Χωρίς αυτά η εργασία δεν θεωρείται ολοκληρωμένη και δεν ξεκινά η πληρωμή.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxWidth: 420 }}>
            <label style={bigBtn}><RiCameraLine style={{ fontSize: "var(--fs-22)" }} /> Φωτογραφία<input type="file" accept="image/*" capture="environment" hidden disabled={uploading} onChange={(e) => { onPick(e.target.files); e.target.value = ""; }} /></label>
            <label style={bigBtn}><RiImageAddLine style={{ fontSize: "var(--fs-22)" }} /> Από τη συλλογή<input type="file" accept="image/*,video/*" multiple hidden disabled={uploading} onChange={(e) => { onPick(e.target.files); e.target.value = ""; }} /></label>
          </div>
          {uploading && <div style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)", marginTop: 6 }}><RiLoaderLine style={{ animation: "spin 1s linear infinite", verticalAlign: "-2px" }} /> Ανέβασμα…</div>}
          {media.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {media.map((m, i) => (
                <div key={i} style={{ position: "relative", width: 84, height: 84, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
                  {m.kind === "VIDEO" ? <video src={m.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <img src={m.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                  <button type="button" onClick={() => setMedia((p) => p.filter((_, j) => j !== i))} style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 999, border: "none", background: "rgba(0,0,0,.6)", color: "#fff", cursor: "pointer" }}><RiCloseLine /></button>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 10 }}><FormField label="Αναφορά εργασιών" required><FieldTextarea value={note} onChange={setNote} rows={3} placeholder="Τι έγινε, ποια υλικά, τι να προσέχει ο διαχειριστής." /></FormField></div>
          <button disabled={busy || uploading || !note.trim() || media.length === 0} style={{ ...btnPrimary, marginTop: 10 }} onClick={() => run(() => completeWorkOrder(wo.id, { note, media }))}><RiCheckLine /> Ολοκλήρωση & αποστολή για παραλαβή</button>
        </div>
      )}

      {(wo.status === "COMPLETED" || wo.status === "CONFIRMED") && (
        <div style={card}>
          <div style={h3}>{wo.status === "CONFIRMED" ? <RiThumbUpLine /> : <RiCheckLine />} {wo.status === "CONFIRMED" ? "Παραλήφθηκε από τον πελάτη" : "Αναμένει επιβεβαίωση παραλαβής"}</div>
          <p style={{ fontSize: "var(--fs-13-5)", margin: "0 0 8px", whiteSpace: "pre-wrap" }}>{wo.completionNote}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{wo.completionMedia.map((m, i) => <a key={i} href={m.url} target="_blank" rel="noreferrer"><img src={m.url} alt="" style={{ width: 100, height: 76, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} /></a>)}</div>
          {wo.status === "CONFIRMED" && <p style={{ fontSize: "var(--fs-13)", color: "#15803d", fontWeight: 600, margin: "10px 0 0" }}>Επιβεβαιώθηκε {fmt(wo.customerConfirmedAt)} — μπορείτε να εκδώσετε τιμολόγιο προς την εταιρεία διαχείρισης.</p>}
        </div>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 18 };
const h3: React.CSSProperties = { fontSize: "var(--fs-13)", fontWeight: 700, color: "var(--foreground)", margin: "0 0 10px", display: "flex", alignItems: "center", gap: 6 };
const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, height: 38, padding: "0 14px", border: "1px solid var(--border)", background: "var(--paper)", borderRadius: "var(--radius-sm)", fontSize: "var(--fs-13)", fontWeight: 600, cursor: "pointer", color: "var(--foreground)" };
const btnPrimary: React.CSSProperties = { ...btn, background: "var(--primary)", color: "var(--primary-foreground)", border: "none" };
const bigBtn: React.CSSProperties = { height: 72, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, border: "1px dashed var(--color-primary)", borderRadius: 12, background: "var(--card)", color: "var(--color-primary)", fontSize: "var(--fs-13)", fontWeight: 600, cursor: "pointer" };
