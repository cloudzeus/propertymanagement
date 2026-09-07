import { env } from "./env";
import { logAPIUsage } from "./api-costs";
import { getEmailBrand } from "./email-brand";
import { renderEmail, renderText, textToHtml, codeBlock, absoluteUrl, type EmailBrand } from "./email-template";

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;      // full "Name <email>" override
  replyTo?: string;
  tags?: string[];
}

interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Safety net for local/staging runs against the shared production database:
 * when EMAIL_REDIRECT_TO is set (and we are not in production), EVERY outgoing
 * email goes to that address instead of the real recipients, with the original
 * recipients noted in the subject. Real people never get test notifications.
 */
function redirectRecipients(to: string | string[], subject: string): { to: string; subject: string; redirected: boolean } {
  const target = process.env.EMAIL_REDIRECT_TO?.trim();
  const original = Array.isArray(to) ? to.join(",") : to;
  if (!target || process.env.NODE_ENV === "production") return { to: original, subject, redirected: false };
  return { to: target, subject: `[TEST → ${original}] ${subject}`, redirected: true };
}

async function sendEmail(
  options: EmailOptions,
  ctx?: { buildingId?: string; customerId?: string; assemblyId?: string; companyId?: string; userId?: string }
): Promise<EmailResponse> {
  try {
    const routed = redirectRecipients(options.to, options.subject);
    if (routed.redirected) console.info(`[mail] redirected to ${routed.to}: ${routed.subject}`);
    const form = new FormData();
    form.append("from", options.from ?? env.MAILGUN_FROM_EMAIL);
    form.append("to", routed.to);
    form.append("subject", routed.subject);
    form.append("html", options.html);

    if (options.text) {
      form.append("text", options.text);
    }

    if (options.replyTo) {
      form.append("h:Reply-To", options.replyTo);
    }

    if (options.tags && options.tags.length > 0) {
      options.tags.forEach((tag) => {
        form.append("o:tag", tag);
      });
    }

    const credentials = Buffer.from(`api:${env.MAILGUN_API_KEY}`).toString("base64");
    const response = await fetch(
      `${env.MAILGUN_BASE_URL}/v3/${env.MAILGUN_DOMAIN}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
        },
        body: form,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Mailgun error:", error);
      await logAPIUsage({
        apiName: 'mailgun',
        endpoint: '/messages',
        requestCount: 1,
        status: 'FAILED',
        errorMessage: `HTTP ${response.status}`,
        ...ctx,
      });
      return {
        success: false,
        error: `Mailgun API error: ${response.status}`,
      };
    }

    const data = await response.json() as any;

    // Log successful email send
    const recipientCount = Array.isArray(options.to) ? options.to.length : 1;
    await logAPIUsage({
      apiName: 'mailgun',
      endpoint: '/messages',
      requestCount: recipientCount,
      status: 'SUCCESS',
      ...ctx,
    });

    return {
      success: true,
      messageId: data.id,
    };
  } catch (error) {
    console.error("Email send error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Email templates — every one goes through the branded shell in lib/email-template.ts.

const otpHtml = (title: string, intro: string, otp: string, expiresIn: number, brand?: Partial<EmailBrand>) =>
  renderEmail({
    title, brand, preheader: `Κωδικός: ${otp}`,
    bodyHtml: `${textToHtml(intro)}${codeBlock(otp)}${textToHtml(`Ο κωδικός ισχύει για ${expiresIn} λεπτά. Αν δεν ζητήσατε αυτή την αλλαγή, αγνοήστε αυτό το email.`)}`,
    afterCta: "Ποτέ μην μοιράζεστε αυτόν τον κωδικό με κανέναν.",
  });

export const emailTemplates = {
  passwordResetOTP: (otp: string, expiresIn: number = 10, brand?: Partial<EmailBrand>) => ({
    subject: "Κωδικός επαναφοράς κωδικού πρόσβασης - 6 ψηφία",
    html: otpHtml("Επαναφορά κωδικού πρόσβασης", "Λάβαμε αίτημα για επαναφορά του κωδικού πρόσβασής σας. Ο κωδικός σας είναι:", otp, expiresIn, brand),
    text: `Επαναφορά κωδικού πρόσβασης\n\nΟ κωδικός σας είναι: ${otp}\n\nΑυτός ο κωδικός ισχύει για ${expiresIn} λεπτά.\n\nΑν δεν ζητήσατε αυτή την αλλαγή, αγνοήστε αυτό το email.`,
  }),

  passwordChangeOTP: (otp: string, expiresIn: number = 10, brand?: Partial<EmailBrand>) => ({
    subject: "Κωδικός αλλαγής κωδικού πρόσβασης - 6 ψηφία",
    html: otpHtml("Αλλαγή κωδικού πρόσβασης", "Λάβαμε αίτημα για αλλαγή του κωδικού πρόσβασής σας. Ο κωδικός σας είναι:", otp, expiresIn, brand),
    text: `Αλλαγή κωδικού πρόσβασης\n\nΟ κωδικός σας είναι: ${otp}\n\nΑυτός ο κωδικός ισχύει για ${expiresIn} λεπτά.\n\nΑν δεν ζητήσατε αυτή την αλλαγή, αγνοήστε αυτό το email.`,
  }),

  passwordReset: (email: string, resetLink: string, brand?: Partial<EmailBrand>) => ({
    subject: "Επαναφορά κωδικού πρόσβασης",
    html: renderEmail({
      title: "Επαναφορά κωδικού πρόσβασης", brand,
      bodyHtml: textToHtml(`Λάβαμε αίτημα για επαναφορά του κωδικού πρόσβασης του λογαριασμού ${email}. Πατήστε το κουμπί για να ορίσετε νέο κωδικό.`),
      cta: { label: "Επαναφορά κωδικού", href: resetLink },
      afterCta: "Ο σύνδεσμος λήγει σε 24 ώρες. Αν δεν ζητήσατε αυτή την αλλαγή, αγνοήστε αυτό το email.",
    }),
    text: `Λάβαμε αίτημα για επαναφορά του κωδικού πρόσβασής σας.\n\nΑντιγράψτε αυτόν τον σύνδεσμο: ${resetLink}\n\nΟ σύνδεσμος θα λήξει σε 24 ώρες.`,
  }),

  welcomeEmail: (name: string, brand?: Partial<EmailBrand>) => ({
    subject: `Καλώς ήρθατε στο ${brand?.name ?? "Orithon"}`,
    html: renderEmail({
      title: `Καλώς ήρθατε, ${name}!`, brand,
      bodyHtml: textToHtml("Ο λογαριασμός σας είναι ενεργός. Συνδεθείτε για να δείτε το κτήριό σας, τους λογαριασμούς και να δηλώσετε βλάβη με δύο κινήσεις από το κινητό σας.\n\nΑν έχετε ερωτήσεις, απαντήστε σε αυτό το email ή ανοίξτε τη «Βοήθεια» μέσα στην εφαρμογή."),
      cta: { label: "Σύνδεση", href: absoluteUrl("/login", brand) },
    }),
    text: `Καλώς ήρθατε, ${name}!\n\nΟ λογαριασμός σας είναι ενεργός: ${absoluteUrl("/login", brand)}`,
  }),

  notificationEmail: (title: string, message: string, opts?: { href?: string; ctaLabel?: string; eyebrow?: string; brand?: Partial<EmailBrand> }) => {
    const href = opts?.href ? absoluteUrl(opts.href, opts.brand) : undefined;
    return {
      subject: title,
      html: renderEmail({
        title, brand: opts?.brand, eyebrow: opts?.eyebrow, preheader: message.slice(0, 120),
        bodyHtml: textToHtml(message),
        cta: href ? { label: opts?.ctaLabel ?? "Άνοιγμα στην εφαρμογή", href } : undefined,
      }),
      text: renderText({ title, text: message, cta: href ? { label: opts?.ctaLabel ?? "Άνοιγμα", href } : undefined, brand: opts?.brand }),
    };
  },
};

export async function sendPasswordResetEmail(
  email: string,
  resetLink: string
): Promise<EmailResponse> {
  const brand = await getEmailBrand();
  return sendEmail({ to: email, ...emailTemplates.passwordReset(email, resetLink, brand), from: brandedFrom(brand.name), tags: ["password-reset"] });
}

export async function sendWelcomeEmail(
  email: string,
  name: string
): Promise<EmailResponse> {
  const brand = await getEmailBrand();
  return sendEmail({ to: email, ...emailTemplates.welcomeEmail(name, brand), from: brandedFrom(brand.name), tags: ["welcome"] });
}

export async function sendNotificationEmail(
  email: string,
  title: string,
  message: string,
  opts?: { href?: string; ctaLabel?: string; eyebrow?: string; tags?: string[] }
): Promise<EmailResponse> {
  const brand = await getEmailBrand();
  return sendEmail({
    to: email,
    ...emailTemplates.notificationEmail(title, message, { ...opts, brand }),
    from: brandedFrom(brand.name),
    tags: opts?.tags ?? ["notification"],
  });
}

/** Build a Mailgun `from` that keeps the verified domain but shows a brand name. */
export function brandedFrom(senderName?: string | null): string {
  if (!senderName) return env.MAILGUN_FROM_EMAIL;
  // MAILGUN_FROM_EMAIL may be "Something <no-reply@domain>" or a bare address.
  const match = env.MAILGUN_FROM_EMAIL.match(/<([^>]+)>/);
  const address = match ? match[1] : env.MAILGUN_FROM_EMAIL;
  return `${senderName} <${address}>`;
}

export async function sendAnnouncementEmail(
  email: string,
  recipientName: string | null,
  headingLabel: string,      // e.g. building/property name for the eyebrow line
  subject: string,           // already merge-substituted
  htmlBody: string,          // already merge-substituted
  ackUrl: string,
  opts?: { senderName?: string | null; replyTo?: string | null; preview?: string | null },
  ctx?: { buildingId?: string; customerId?: string; assemblyId?: string; companyId?: string; userId?: string }
): Promise<EmailResponse> {
  const brand = await getEmailBrand();
  const greeting = recipientName ? `Αγαπητέ/ή ${recipientName},` : "Αγαπητέ/ή ένοικε,";
  const html = renderEmail({
    title: subject, brand, eyebrow: `Ανακοίνωση — ${headingLabel}`, greeting, preheader: opts?.preview ?? undefined,
    bodyHtml: `<div style="border:1px solid rgba(27,28,26,.10);border-radius:12px;padding:16px;background:#FBFAF5;font-size:14.5px;line-height:1.65">${htmlBody}</div>`,
    cta: { label: "Έλαβα γνώση", href: ackUrl, variant: "accent" },
    afterCta: "Πατώντας το κουμπί επιβεβαιώνετε ότι λάβατε γνώση αυτής της ανακοίνωσης.",
  });
  const text = `Ανακοίνωση — ${headingLabel}\n\n${subject}\n\n${greeting}\n\nΓια να δηλώσετε ότι λάβατε γνώση, επισκεφθείτε:\n${ackUrl}`;
  return sendEmail({
    to: email,
    subject,
    html,
    text,
    from: brandedFrom(opts?.senderName ?? brand.name),
    replyTo: opts?.replyTo ?? undefined,
    tags: ["announcement"],
  }, ctx);
}

export async function sendPasswordResetOTP(
  email: string,
  otp: string,
  expiresIn: number = 10
): Promise<EmailResponse> {
  const brand = await getEmailBrand();
  return sendEmail({ to: email, ...emailTemplates.passwordResetOTP(otp, expiresIn, brand), from: brandedFrom(brand.name), tags: ["otp", "password-reset"] });
}

export async function sendPasswordChangeOTP(
  email: string,
  otp: string,
  expiresIn: number = 10
): Promise<EmailResponse> {
  const brand = await getEmailBrand();
  return sendEmail({ to: email, ...emailTemplates.passwordChangeOTP(otp, expiresIn, brand), from: brandedFrom(brand.name), tags: ["otp", "password-change"] });
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

/** Send an HTML email with file attachments (e.g. a Word analysis + receipts). */
export async function sendEmailWithAttachments(options: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  tags?: string[];
  attachments: EmailAttachment[];
}): Promise<EmailResponse> {
  try {
    const routed = redirectRecipients(options.to, options.subject);
    if (routed.redirected) console.info(`[mail] redirected to ${routed.to}: ${routed.subject}`);
    const form = new FormData();
    form.append("from", options.from ?? brandedFrom((await getEmailBrand()).name));
    form.append("to", routed.to);
    form.append("subject", routed.subject);
    form.append("html", options.html);
    if (options.replyTo) form.append("h:Reply-To", options.replyTo);
    (options.tags ?? []).forEach((t) => form.append("o:tag", t));
    for (const a of options.attachments) {
      const blob = new Blob([new Uint8Array(a.content)], { type: a.contentType ?? "application/octet-stream" });
      form.append("attachment", blob, a.filename);
    }

    const credentials = Buffer.from(`api:${env.MAILGUN_API_KEY}`).toString("base64");
    const response = await fetch(`${env.MAILGUN_BASE_URL}/v3/${env.MAILGUN_DOMAIN}/messages`, {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}` },
      body: form,
    });
    if (!response.ok) {
      const error = await response.text();
      console.error("Mailgun error:", error);
      await logAPIUsage({ apiName: "mailgun", endpoint: "/messages", requestCount: 1, status: "FAILED", errorMessage: `HTTP ${response.status}` });
      return { success: false, error: `Mailgun API error: ${response.status}` };
    }
    const data = (await response.json()) as any;
    await logAPIUsage({ apiName: "mailgun", endpoint: "/messages", requestCount: 1, status: "SUCCESS" });
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error("Email send error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
