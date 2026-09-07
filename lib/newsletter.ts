import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { sendNotificationEmail } from "@/lib/mailgun";
import { getEmailBrand } from "@/lib/email-brand";
import { absoluteUrl } from "@/lib/email-template";

/** Bump when the consent wording changes materially — old rows keep their version. */
export const NEWSLETTER_CONSENT_VERSION = "2026-09";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Double opt-in signup. Stores the exact consent wording + IP/UA and emails a
 * confirmation link. Re-subscribing an UNSUBSCRIBED/PENDING address re-sends
 * the link; a CONFIRMED address is left alone (no duplicate mail).
 */
export async function subscribeNewsletter(input: { email: string; locale?: string; source?: string; consentText: string; ip?: string | null; userAgent?: string | null }) {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) return { ok: false as const, error: "EMAIL" };
  if (!input.consentText?.trim()) return { ok: false as const, error: "CONSENT" };
  const locale = input.locale === "en" ? "en" : "el";
  const existing = await db.newsletterSubscriber.findUnique({ where: { email } });
  if (existing?.status === "CONFIRMED") return { ok: true as const, status: "CONFIRMED" as const };

  const token = randomBytes(24).toString("base64url");
  const row = await db.newsletterSubscriber.upsert({
    where: { email },
    create: { email, locale, source: input.source ?? "news", status: "PENDING", consentText: input.consentText, consentVersion: NEWSLETTER_CONSENT_VERSION, ipAddress: input.ip ?? null, userAgent: input.userAgent ?? null, token },
    update: { locale, status: "PENDING", consentText: input.consentText, consentVersion: NEWSLETTER_CONSENT_VERSION, consentedAt: new Date(), ipAddress: input.ip ?? null, userAgent: input.userAgent ?? null, token, unsubscribedAt: null },
  });

  const brand = await getEmailBrand();
  const confirmUrl = absoluteUrl(`/api/newsletter/confirm?t=${row.token}`, brand);
  const isEn = locale === "en";
  await sendNotificationEmail(
    email,
    isEn ? "Confirm your subscription" : "Επιβεβαιώστε την εγγραφή σας",
    isEn
      ? `One more step: press the button to confirm you want the ${brand.name} newsletter at this address. If you didn't ask for it, just ignore this email — nothing will be sent.`
      : `Ένα βήμα ακόμη: πατήστε το κουμπί για να επιβεβαιώσετε ότι θέλετε το ενημερωτικό του ${brand.name} σε αυτή τη διεύθυνση. Αν δεν το ζητήσατε, αγνοήστε αυτό το email — δεν θα σας σταλεί τίποτα.`,
    { href: confirmUrl, ctaLabel: isEn ? "Confirm subscription" : "Επιβεβαίωση εγγραφής", eyebrow: "Newsletter", tags: ["newsletter-confirm"] },
  );
  return { ok: true as const, status: "PENDING" as const };
}

export async function confirmNewsletter(token: string) {
  const row = await db.newsletterSubscriber.findUnique({ where: { token } });
  if (!row) return { ok: false as const, error: "INVALID" };
  if (row.status !== "CONFIRMED") {
    await db.newsletterSubscriber.update({ where: { id: row.id }, data: { status: "CONFIRMED", confirmedAt: new Date() } });
  }
  return { ok: true as const, locale: row.locale };
}

export async function unsubscribeNewsletter(token: string) {
  const row = await db.newsletterSubscriber.findUnique({ where: { token } });
  if (!row) return { ok: false as const, error: "INVALID" };
  if (row.status !== "UNSUBSCRIBED") {
    await db.newsletterSubscriber.update({ where: { id: row.id }, data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() } });
  }
  return { ok: true as const, locale: row.locale };
}

/** Footer link for marketing mail — every newsletter must carry one. */
export async function unsubscribeUrlFor(token: string): Promise<string> {
  return absoluteUrl(`/api/newsletter/unsubscribe?t=${token}`, await getEmailBrand());
}
