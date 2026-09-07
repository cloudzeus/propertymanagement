import Link from "next/link";
import { requireCollaborator } from "@/lib/marketplace";
import { UnlinkedNotice } from "@/components/marketplace/UnlinkedNotice";
import { listSupplierRfqs } from "@/lib/rfq";
import { INVITATION_STATUS_LABELS, RFQ_STATUS_LABELS, eur } from "@/lib/rfq-shared";
import { RiMoneyEuroCircleLine, RiArrowRightSLine, RiTimeLine } from "react-icons/ri";

export const metadata = { title: "Αιτήματα προσφοράς" };

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" }) : null);

export default async function SupplierRfqInbox() {
  const ctx = await requireCollaborator("mkt-rfq");
  if (!ctx.supplierId) return <UnlinkedNotice />;
  const items = await listSupplierRfqs(ctx.supplierId);
  const open = items.filter((i) => i.status === "INVITED" && ["OPEN", "OFFERED"].includes(i.rfqStatus));
  const rest = items.filter((i) => !open.includes(i));

  const Row = ({ i }: { i: (typeof items)[number] }) => (
    <Link href={`/marketplace/rfq/${i.rfqId}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", textDecoration: "none", background: "var(--card)", border: `1px solid ${i.status === "INVITED" && ["OPEN", "OFFERED"].includes(i.rfqStatus) ? "var(--color-primary)55" : "var(--border)"}`, borderRadius: "var(--radius-lg)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "var(--fs-14)", fontWeight: 600, color: "var(--foreground)" }}>{i.title}</div>
        <div style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }}>{i.building}{i.category ? ` · ${i.category}` : ""} · ελήφθη {fmt(i.sentAt)}{i.deadlineAt ? ` · προθεσμία ${fmt(i.deadlineAt)}` : ""}{i.surveyRequired ? " · με αυτοψία" : ""}</div>
      </div>
      <div style={{ textAlign: "right", fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }}>
        <div style={{ fontWeight: 700, color: "var(--foreground)" }}>{i.myOffer ? `Προσφορά ${eur(i.myOffer.amount)}` : INVITATION_STATUS_LABELS[i.status] ?? i.status}</div>
        <div>{RFQ_STATUS_LABELS[i.rfqStatus] ?? i.rfqStatus}</div>
      </div>
      <RiArrowRightSLine style={{ color: "var(--muted-foreground)" }} />
    </Link>
  );

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 900 }}>
      <div>
        <h1 style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "var(--fs-22)", fontWeight: 700, color: "var(--foreground)", margin: 0 }}><RiMoneyEuroCircleLine style={{ color: "var(--color-primary)" }} /> Αιτήματα προσφοράς</h1>
        <p style={{ margin: "4px 0 0", fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>Η εταιρεία διαχείρισης σας ζητά τιμή και διαθεσιμότητα. Απαντήστε πριν την προθεσμία — οι γρήγορες απαντήσεις προτιμώνται.</p>
      </div>
      {open.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><div style={{ fontSize: "var(--fs-12)", fontWeight: 700, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 6 }}><RiTimeLine /> ΑΝΑΜΕΝΟΥΝ ΑΠΑΝΤΗΣΗ ({open.length})</div>{open.map((i) => <Row key={i.invitationId} i={i} />)}</div>}
      {rest.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><div style={{ fontSize: "var(--fs-12)", fontWeight: 700, color: "var(--muted-foreground)" }}>ΙΣΤΟΡΙΚΟ</div>{rest.map((i) => <Row key={i.invitationId} i={i} />)}</div>}
      {items.length === 0 && <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 32, textAlign: "center", fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>Δεν έχετε λάβει αιτήματα προσφοράς ακόμη.</div>}
    </div>
  );
}
