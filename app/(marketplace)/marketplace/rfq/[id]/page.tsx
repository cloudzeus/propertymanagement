import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCollaborator } from "@/lib/marketplace";
import { UnlinkedNotice } from "@/components/marketplace/UnlinkedNotice";
import { loadSupplierRfq } from "@/lib/rfq";
import { db } from "@/lib/db";
import { OfferForm } from "./OfferForm";
import { RiArrowLeftLine } from "react-icons/ri";

export const metadata = { title: "Αίτημα προσφοράς" };

export default async function SupplierRfqPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCollaborator("mkt-rfq");
  if (!ctx.supplierId) return <UnlinkedNotice />;
  const data = await loadSupplierRfq(id, ctx.supplierId);
  if (!data) notFound();
  // mark as seen (the company sees "το είδε")
  if (!data.invitation.viewedAt) await db.rfqInvitation.update({ where: { id: data.invitation.id }, data: { viewedAt: new Date() } }).catch(() => {});
  const sup = await db.supplier.findUnique({ where: { id: ctx.supplierId }, select: { siteSurveyFee: true, siteSurveyFeeWaived: true } });

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 860 }}>
      <Link href="/marketplace/rfq" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--fs-13)", color: "var(--muted-foreground)", textDecoration: "none" }}><RiArrowLeftLine /> Πίσω στα αιτήματα</Link>
      <OfferForm rfq={data.rfq} invitation={data.invitation} myOffer={data.myOffer} canOffer={ctx.isSupplierAdmin || true} defaults={{ surveyFee: sup?.siteSurveyFee != null ? Number(sup.siteSurveyFee) : null, surveyWaived: sup?.siteSurveyFeeWaived ?? true }} />
    </div>
  );
}
