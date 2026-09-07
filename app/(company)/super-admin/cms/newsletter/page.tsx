import { db } from "@/lib/db";
import { requirePermission, getEffectivePermissions, can } from "@/lib/rbac/permissions";
import { ConsentsClient } from "./ConsentsClient";

export const metadata = { title: "Newsletter & συναινέσεις" };

/** GDPR register: newsletter list (double opt-in trail), contact-form and demo consents. */
export default async function NewsletterCmsPage() {
  await requirePermission("cms-newsletter", "view");
  const resolved = await getEffectivePermissions();
  const [subs, contacts, demos] = await Promise.all([
    db.newsletterSubscriber.findMany({ orderBy: { createdAt: "desc" }, take: 2000 }),
    db.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 1000, select: { id: true, name: true, email: true, phone: true, subject: true, message: true, status: true, ipAddress: true, consentText: true, consentedAt: true, createdAt: true } }),
    db.demoRequest.findMany({ orderBy: { createdAt: "desc" }, take: 500, select: { id: true, name: true, email: true, company: true, scheduledAt: true, status: true, consentText: true, consentedAt: true, createdAt: true } }),
  ]);
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return (
    <ConsentsClient
      caps={{ edit: can(resolved?.perms ?? new Set<string>(), "cms-newsletter", "edit"), delete: can(resolved?.perms ?? new Set<string>(), "cms-newsletter", "delete") }}
      subscribers={subs.map((s) => ({ id: s.id, email: s.email, locale: s.locale, source: s.source, status: s.status, consentText: s.consentText, consentVersion: s.consentVersion, consentedAt: s.consentedAt.toISOString(), confirmedAt: iso(s.confirmedAt), unsubscribedAt: iso(s.unsubscribedAt), ipAddress: s.ipAddress, userAgent: s.userAgent }))}
      contacts={contacts.map((c) => ({ ...c, consentedAt: iso(c.consentedAt), createdAt: c.createdAt.toISOString() }))}
      demos={demos.map((d) => ({ ...d, scheduledAt: d.scheduledAt.toISOString(), consentedAt: iso(d.consentedAt), createdAt: d.createdAt.toISOString() }))}
    />
  );
}
