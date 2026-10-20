import "server-only";
import { db } from "@/lib/db";
import { recipientsForSupplier } from "@/lib/rfq-candidates";
import { issueInviteLink } from "@/lib/supplier-invites";
import { sendBrandedEmail } from "@/lib/mailgun";
import { getEmailBrand } from "@/lib/email-brand";
import { rfqInvitationEmail } from "@/lib/emails/supplier-invites";

/**
 * E-mail the invitations of an RFQ to the given suppliers: one personal link +
 * one branded mail per recipient (logins, RFQ contacts, supplier address — see
 * recipientsForSupplier). Used on create, on "add suppliers" and on resend;
 * every call counts as one more send on the RfqInvitation.
 */
export async function sendRfqInvitations(rfqId: string, supplierIds: string[], actorId: string): Promise<{ sent: number; noEmail: string[]; failed: string[] }> {
  const rfq = await db.serviceRequest.findUnique({
    where: { id: rfqId },
    select: { id: true, title: true, deadlineAt: true, surveyRequired: true, building: { select: { name: true, city: true } }, invitations: { select: { id: true, supplierId: true } } },
  });
  if (!rfq) return { sent: 0, noEmail: [], failed: [] };
  const suppliers = await db.supplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, name: true } });
  const brand = await getEmailBrand();
  const buildingLabel = [rfq.building.name, rfq.building.city].filter(Boolean).join(", ");
  let sent = 0;
  const noEmail: string[] = [];
  const failed: string[] = [];
  for (const sup of suppliers) {
    const inv = rfq.invitations.find((i) => i.supplierId === sup.id);
    if (!inv) continue;
    const recipients = await recipientsForSupplier(sup.id);
    if (recipients.length === 0) { noEmail.push(sup.id); continue; }
    let okHere = 0;
    for (const r of recipients) {
      const link = await issueInviteLink({ kind: "RFQ_INVITE", supplierId: sup.id, email: r.email, rfqInvitationId: inv.id, contactId: r.contactId, createdById: actorId });
      const mail = rfqInvitationEmail({ brand, supplierName: sup.name, title: rfq.title, buildingLabel, deadlineAt: rfq.deadlineAt, surveyRequired: rfq.surveyRequired, url: link.url, recipientHasAccount: !!r.userId });
      const res = await sendBrandedEmail(r.email, mail, ["rfq-invite"]);
      if (res.success) { sent++; okHere++; } else failed.push(r.email);
    }
    // the counter reflects mail that actually left (Mailgun never throws; it returns success:false)
    if (okHere > 0) await db.rfqInvitation.update({ where: { id: inv.id }, data: { emailCount: { increment: 1 }, lastEmailAt: new Date() } });
  }
  return { sent, noEmail, failed };
}
