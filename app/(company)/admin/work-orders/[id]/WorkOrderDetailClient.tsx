"use client";

import Link from "next/link";
import { RiArrowLeftLine, RiFileTextLine, RiEyeLine, RiHistoryLine, RiStarFill } from "react-icons/ri";
import { useWorkActions } from "@/components/work/useWorkActions";
import { ActionsButton } from "@/components/work/ActionsButton";
import { subjectFromWorkOrderDTO } from "@/lib/work/subjects";
import type { WorkActionViewer } from "@/lib/work/scope";
import type { WorkOrderDetail } from "@/lib/rfq";
import { WO_STATUS_LABELS, WO_STATUS_COLORS, eur, withVat } from "@/lib/rfq-shared";
import { STATUS_LABELS, type FaultStatus } from "@/lib/maintenance-shared";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Athens" }) : "—");
const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 18 };
const h3: React.CSSProperties = { fontSize: "var(--fs-13)", fontWeight: 700, color: "var(--foreground)", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 };
const link: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: "var(--fs-12-5)", color: "var(--color-primary)", textDecoration: "none", fontWeight: 600 };
const pill: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: "var(--fs-11)", fontWeight: 700, padding: "2px 8px", borderRadius: 999, border: "1px solid var(--border)", background: "var(--paper)", color: "var(--foreground)" };

export function WorkOrderDetailClient({ detail, viewer }: { detail: WorkOrderDetail; viewer: WorkActionViewer }) {
  const { wo, events } = detail;
  const wa = useWorkActions({ viewer, where: "detail" });
  const color = WO_STATUS_COLORS[wo.status] ?? "var(--muted-foreground)";
  const margin = wo.customerPrice - (wo.supplierPrice ?? 0);

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 920 }}>
      <Link href="/admin/work-orders" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--fs-13)", color: "var(--muted-foreground)", textDecoration: "none" }}>
        <RiArrowLeftLine /> Πίσω στις συμβάσεις
      </Link>

      <div style={card}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <h1 style={{ fontSize: "var(--fs-19)", fontWeight: 700, color: "var(--foreground)", margin: 0, flex: 1, minWidth: 200 }}>{wo.number} · {wo.title}</h1>
          <span style={{ ...pill, color, borderColor: `color-mix(in srgb, ${color} 33%, transparent)`, background: `color-mix(in srgb, ${color} 6%, transparent)` }}>{WO_STATUS_LABELS[wo.status] ?? wo.status}</span>
          {wo.covered && <span style={pill}>καλύπτεται από σύμβαση</span>}
          <ActionsButton subject={subjectFromWorkOrderDTO(wo)} api={wa} title={wo.number} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)" }}>
          <span>Κτήριο: {wo.buildingName}</span>
          <span>Πελάτης: {wo.customerName}</span>
          <span>Συνεργάτης: {wo.supplierName ?? "—"}{wo.offerRating != null && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--color-warning)", marginLeft: 6 }}><RiStarFill /> {wo.offerRating.toFixed(1)}</span>}</span>
          <span>Δημιουργία: {fmt(wo.createdAt)}</span>
        </div>
        {wo.description && <p style={{ fontSize: "var(--fs-13-5)", color: "var(--foreground)", marginTop: 12, whiteSpace: "pre-wrap" }}>{wo.description}</p>}
        {wo.customerMessage && <p style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)", margin: "6px 0 0" }}>Μήνυμα προς πελάτη: {wo.customerMessage}</p>}
      </div>

      <div style={card}>
        <div style={h3}><RiFileTextLine /> Στοιχεία σύμβασης</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, fontSize: "var(--fs-12-5)" }}>
          <Kv k="Τιμή συνεργάτη" v={wo.supplierPrice != null ? `${eur(wo.supplierPrice)} + ΦΠΑ` : "—"} />
          <Kv k="Τιμή πελάτη" v={wo.covered ? "0,00 € (καλύπτεται)" : `${eur(wo.customerPrice)} + ΦΠΑ ${wo.vatPct}% = ${eur(withVat(wo.customerPrice, wo.vatPct))}`} />
          <Kv k="Περιθώριο" v={wo.covered ? "—" : `${wo.markupPct != null ? `${wo.markupPct}% · ` : ""}${eur(margin)}`} />
          <Kv k="Εγγύηση" v={wo.warrantyMonths != null ? `${wo.warrantyMonths} μήνες` : "—"} />
          <Kv k="Ισχύει έως" v={fmt(wo.validUntil)} />
          <Kv k="Αποδοχή πελάτη" v={wo.customerAcceptedAt ? fmt(wo.customerAcceptedAt) : wo.customerDeclinedAt ? `Απόρριψη ${fmt(wo.customerDeclinedAt)}${wo.customerDeclineReason ? ` — ${wo.customerDeclineReason}` : ""}` : "εκκρεμεί"} />
          <Kv k="Αποδοχή συνεργάτη" v={wo.supplierAcceptedAt ? fmt(wo.supplierAcceptedAt) : "εκκρεμεί"} />
          <Kv k="Ραντεβού" v={fmt(wo.scheduledAt)} />
          <Kv k="Παραλαβή" v={wo.customerConfirmedAt ? `Επιβεβαιώθηκε ${fmt(wo.customerConfirmedAt)}` : wo.status === "DISPUTED" ? `Αμφισβήτηση: ${wo.disputeNote}` : wo.completedAt ? `Ολοκληρώθηκε ${fmt(wo.completedAt)} — αναμένει πελάτη` : "—"} />
        </div>
        {wo.completionNote && <p style={{ fontSize: "var(--fs-13)", color: "var(--foreground)", margin: "12px 0 0", whiteSpace: "pre-wrap" }}>Σημείωση ολοκλήρωσης: {wo.completionNote}</p>}
        {wo.completionMedia.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {wo.completionMedia.map((m, i) => <a key={i} href={m.url} target="_blank" rel="noreferrer"><img src={m.url} alt="" style={{ width: 84, height: 64, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} /></a>)}
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
          <Link href={`/admin/work-orders/${wo.id}/contract/customer`} style={link}><RiFileTextLine /> Σύμβαση Α (πελάτης)</Link>
          <Link href={`/admin/work-orders/${wo.id}/contract/supplier`} style={link}><RiFileTextLine /> Σύμβαση Β (συνεργάτης)</Link>
          {wo.maintenanceRequestId && viewer.canViewFault && (
            <Link href={`/admin/maintenance/${wo.maintenanceRequestId}`} style={link}><RiEyeLine /> Άνοιγμα βλάβης{wo.faultTitle ? ` · ${wo.faultTitle}` : ""}{wo.faultStatus ? ` (${STATUS_LABELS[wo.faultStatus as FaultStatus] ?? wo.faultStatus})` : ""}</Link>
          )}
        </div>
      </div>

      <div style={card}>
        <div style={h3}><RiHistoryLine /> Ιστορικό</div>
        {events.length === 0 ? <p style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)", margin: 0 }}>Δεν υπάρχουν καταγραφές για αυτή τη σύμβαση.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {events.map((e) => (
              <div key={e.id} style={{ display: "flex", gap: 10, fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)", flexWrap: "wrap" }}>
                <span style={{ minWidth: 118 }}>{fmt(e.createdAt)}</span>
                {e.byName && <span style={{ color: "var(--foreground)", fontWeight: 600 }}>{e.byName}</span>}
                {e.note && <span style={{ fontStyle: "italic" }}>{e.note}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
      {wa.host}
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return <div><div style={{ fontSize: "var(--fs-11)", color: "var(--muted-foreground)", fontWeight: 600 }}>{k}</div><div style={{ color: "var(--foreground)" }}>{v}</div></div>;
}
