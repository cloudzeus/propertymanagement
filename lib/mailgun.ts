import { env } from "./env";
import { logAPIUsage } from "./api-costs";

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: string[];
}

interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

async function sendEmail(options: EmailOptions): Promise<EmailResponse> {
  try {
    const form = new FormData();
    form.append("from", env.MAILGUN_FROM_EMAIL);
    form.append("to", Array.isArray(options.to) ? options.to.join(",") : options.to);
    form.append("subject", options.subject);
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
      `https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`,
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

// Email templates
export const emailTemplates = {
  passwordResetOTP: (otp: string, expiresIn: number = 10) => ({
    subject: "Κωδικός επαναφοράς κωδικού πρόσβασης - 6 ψηφία",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Επαναφορά κωδικού πρόσβασης</h2>
        <p>Κάναμε λήψη ενός αιτήματος για επαναφορά του κωδικού πρόσβασής σας.</p>
        <p>Ο κωδικός σας είναι:</p>
        <div style="background-color: #f0f0f0; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0;">
          <h1 style="letter-spacing: 2px; color: #3b82f6; margin: 0; font-size: 32px;">${otp}</h1>
        </div>
        <p style="color: #666;">Αυτός ο κωδικός ισχύει για ${expiresIn} λεπτά.</p>
        <p style="color: #666;">Αν δεν ζητήσατε αυτή την αλλαγή, αγνοήστε αυτό το email.</p>
        <p style="color: #999; font-size: 12px;">Ποτέ μην μοιράζεστε αυτόν τον κωδικό με κανέναν.</p>
      </div>
    `,
    text: `Επαναφορά κωδικού πρόσβασης\n\nΟ κωδικός σας είναι: ${otp}\n\nΑυτός ο κωδικός ισχύει για ${expiresIn} λεπτά.\n\nΑν δεν ζητήσατε αυτή την αλλαγή, αγνοήστε αυτό το email.`,
  }),

  passwordChangeOTP: (otp: string, expiresIn: number = 10) => ({
    subject: "Κωδικός αλλαγής κωδικού πρόσβασης - 6 ψηφία",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Αλλαγή κωδικού πρόσβασης</h2>
        <p>Κάναμε λήψη ενός αιτήματος για αλλαγή του κωδικού πρόσβασής σας.</p>
        <p>Ο κωδικός σας είναι:</p>
        <div style="background-color: #f0f0f0; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0;">
          <h1 style="letter-spacing: 2px; color: #10b981; margin: 0; font-size: 32px;">${otp}</h1>
        </div>
        <p style="color: #666;">Αυτός ο κωδικός ισχύει για ${expiresIn} λεπτά.</p>
        <p style="color: #666;">Αν δεν ζητήσατε αυτή την αλλαγή, αγνοήστε αυτό το email.</p>
        <p style="color: #999; font-size: 12px;">Ποτέ μην μοιράζεστε αυτόν τον κωδικό με κανέναν.</p>
      </div>
    `,
    text: `Αλλαγή κωδικού πρόσβασης\n\nΟ κωδικός σας είναι: ${otp}\n\nΑυτός ο κωδικός ισχύει για ${expiresIn} λεπτά.\n\nΑν δεν ζητήσατε αυτή την αλλαγή, αγνοήστε αυτό το email.`,
  }),

  passwordReset: (email: string, resetLink: string) => ({
    subject: "Επαναφορά κωδικού πρόσβασης",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Επαναφορά κωδικού πρόσβασης</h2>
        <p>Κάναμε λήψη ενός αιτήματος για επαναφορά του κωδικού πρόσβασής σας.</p>
        <p>
          <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px;">
            Επαναφορά κωδικού
          </a>
        </p>
        <p style="color: #666;">Αν δεν ζητήσατε αυτή την αλλαγή, αγνοήστε αυτό το email.</p>
        <p style="color: #666; font-size: 12px;">Ο σύνδεσμος θα λήξει σε 24 ώρες.</p>
      </div>
    `,
    text: `Κάναμε λήψη ενός αιτήματος για επαναφορά του κωδικού πρόσβασής σας.\n\nΑντιγράψτε αυτόν τον σύνδεσμο: ${resetLink}\n\nΟ σύνδεσμος θα λήξει σε 24 ώρες.`,
  }),

  welcomeEmail: (name: string) => ({
    subject: "Καλώς ήρθατε στη Διαχείριση Κτηρίων",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Καλώς ήρθατε, ${name}!</h2>
        <p>Ευχαριστούμε που εγγραφήκατε στη Διαχείριση Κτηρίων.</p>
        <p>Ο λογαριασμός σας είναι πλέον ενεργός και μπορείτε να αρχίσετε να χρησιμοποιείτε το σύστημα.</p>
        <p style="color: #666;">Αν έχετε ερωτήσεις, μην διστάσετε να επικοινωνήσετε με εμάς.</p>
      </div>
    `,
    text: `Καλώς ήρθατε, ${name}!\n\nΕυχαριστούμε που εγγραφήκατε στη Διαχείριση Κτηρίων.`,
  }),

  notificationEmail: (title: string, message: string) => ({
    subject: title,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${title}</h2>
        <p>${message}</p>
      </div>
    `,
    text: `${title}\n\n${message}`,
  }),
};

export async function sendPasswordResetEmail(
  email: string,
  resetLink: string
): Promise<EmailResponse> {
  return sendEmail({
    to: email,
    ...emailTemplates.passwordReset(email, resetLink),
    tags: ["password-reset"],
  });
}

export async function sendWelcomeEmail(
  email: string,
  name: string
): Promise<EmailResponse> {
  return sendEmail({
    to: email,
    ...emailTemplates.welcomeEmail(name),
    tags: ["welcome"],
  });
}

export async function sendNotificationEmail(
  email: string,
  title: string,
  message: string
): Promise<EmailResponse> {
  return sendEmail({
    to: email,
    ...emailTemplates.notificationEmail(title, message),
    tags: ["notification"],
  });
}

export async function sendPasswordResetOTP(
  email: string,
  otp: string,
  expiresIn: number = 10
): Promise<EmailResponse> {
  return sendEmail({
    to: email,
    ...emailTemplates.passwordResetOTP(otp, expiresIn),
    tags: ["otp", "password-reset"],
  });
}

export async function sendPasswordChangeOTP(
  email: string,
  otp: string,
  expiresIn: number = 10
): Promise<EmailResponse> {
  return sendEmail({
    to: email,
    ...emailTemplates.passwordChangeOTP(otp, expiresIn),
    tags: ["otp", "password-change"],
  });
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
  replyTo?: string;
  tags?: string[];
  attachments: EmailAttachment[];
}): Promise<EmailResponse> {
  try {
    const form = new FormData();
    form.append("from", env.MAILGUN_FROM_EMAIL);
    form.append("to", Array.isArray(options.to) ? options.to.join(",") : options.to);
    form.append("subject", options.subject);
    form.append("html", options.html);
    if (options.replyTo) form.append("h:Reply-To", options.replyTo);
    (options.tags ?? []).forEach((t) => form.append("o:tag", t));
    for (const a of options.attachments) {
      const blob = new Blob([new Uint8Array(a.content)], { type: a.contentType ?? "application/octet-stream" });
      form.append("attachment", blob, a.filename);
    }

    const credentials = Buffer.from(`api:${env.MAILGUN_API_KEY}`).toString("base64");
    const response = await fetch(`https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`, {
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
