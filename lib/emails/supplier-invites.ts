/**
 * E-mails of the supplier programme: RFQ invitation with a personal link,
 * contact activation ("set your password"), and contract-B signed notices.
 * Pure functions (no DB) over lib/email-template so they are testable and
 * reusable from actions and cron. Never put a password in any of these.
 */
import { renderEmail, renderText, textToHtml, detailRows, noteBox, escapeHtml, type EmailBrand } from "@/lib/email-template";

export type Mail = { subject: string; html: string; text: string };

const fmtDT = (d: Date | null) => (d ? d.toLocaleString("el-GR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Athens" }) : null);

export const RFQ_LINK_NOTE = "Το link ισχύει 14 ημέρες και είναι προσωπικό.";

export function rfqInvitationEmail(p: {
  brand: EmailBrand; supplierName: string; title: string; buildingLabel: string; deadlineAt: Date | null; surveyRequired: boolean; url: string; recipientHasAccount: boolean;
}): Mail {
  const intro = `Η ${p.brand.name} ζητά προσφορά από την επιχείρηση «${p.supplierName}» για την παρακάτω εργασία. Απαντήστε με τιμή και διαθεσιμότητα μέσα από την πλατφόρμα.`;
  const access = p.recipientHasAccount
    ? "Πατώντας το κουμπί θα συνδεθείτε με τον λογαριασμό σας και θα ανοίξει κατευθείαν η φόρμα προσφοράς."
    : "Πατώντας το κουμπί θα ορίσετε κωδικό πρόσβασης (μία φορά) και θα ανοίξει κατευθείαν η φόρμα προσφοράς. Δεν στέλνουμε ποτέ κωδικούς με email.";
  const rows: [string, string | null][] = [
    ["Εργασία", escapeHtml(p.title)],
    ["Κτήριο", escapeHtml(p.buildingLabel)],
    ["Προθεσμία απάντησης", fmtDT(p.deadlineAt)],
    ["Αυτοψία", p.surveyRequired ? "Ζητείται αυτοψία πριν την προσφορά" : null],
  ];
  const text = [intro, "", `Εργασία: ${p.title}`, `Κτήριο: ${p.buildingLabel}`, p.deadlineAt ? `Προθεσμία απάντησης: ${fmtDT(p.deadlineAt)}` : null, p.surveyRequired ? "Ζητείται αυτοψία πριν την προσφορά." : null, "", access, RFQ_LINK_NOTE].filter((x) => x != null).join("\n");
  return {
    subject: `Αίτημα προσφοράς: ${p.title}`,
    html: renderEmail({
      brand: p.brand, eyebrow: "Αίτημα προσφοράς", title: p.title, preheader: `Η ${p.brand.name} ζητά προσφορά για: ${p.title}`,
      bodyHtml: textToHtml(intro) + detailRows(rows) + noteBox(escapeHtml(access)),
      cta: { label: "Δείτε το αίτημα & προσφορά", href: p.url, variant: "accent" },
      afterCta: RFQ_LINK_NOTE,
    }),
    text: renderText({ title: `Αίτημα προσφοράς: ${p.title}`, text, cta: { label: "Δείτε το αίτημα & προσφορά", href: p.url }, brand: p.brand }),
  };
}

export function contactInvitationEmail(p: { brand: EmailBrand; supplierName: string; contactName: string; url: string }): Mail {
  const title = `Πρόσβαση στο περιβάλλον συνεργατών ${p.brand.name}`;
  const body = `Η ${p.brand.name} σάς έδωσε πρόσβαση στο περιβάλλον συνεργατών για την επιχείρηση «${p.supplierName}». Εκεί βλέπετε τις αναθέσεις σας, υποβάλλετε προσφορές και υπογράφετε ηλεκτρονικά τις συμβάσεις έργου.\n\nΠατήστε το κουμπί για να ορίσετε τον κωδικό σας. Δεν στέλνουμε ποτέ κωδικούς με email.`;
  return {
    subject: title,
    html: renderEmail({ brand: p.brand, eyebrow: "Συνεργάτες", title, greeting: `Γεια σας, ${p.contactName}`, bodyHtml: textToHtml(body), cta: { label: "Ορισμός κωδικού", href: p.url, variant: "accent" }, afterCta: RFQ_LINK_NOTE }),
    text: renderText({ title, greeting: `Γεια σας, ${p.contactName}`, text: `${body}\n\n${RFQ_LINK_NOTE}`, cta: { label: "Ορισμός κωδικού", href: p.url }, brand: p.brand }),
  };
}

export function contractSignedStaffEmail(p: { brand: EmailBrand; woNumber: string; title: string; supplierName: string; signatory: string; url: string }): Mail {
  const subject = `Υπογράφηκε η σύμβαση ${p.woNumber}-B από ${p.supplierName}`;
  const body = `Ο συνεργάτης «${p.supplierName}» αποδέχθηκε ηλεκτρονικά τη σύμβαση έργου ${p.woNumber}-B («${p.title}»). Υπογράφων: ${p.signatory}. Η ώρα, η διεύθυνση IP και η συσκευή καταγράφηκαν στο οριστικό αντίγραφο.`;
  return {
    subject,
    html: renderEmail({ brand: p.brand, eyebrow: `Σύμβαση ${p.woNumber}-B`, title: "Ο συνεργάτης υπέγραψε τη σύμβαση", bodyHtml: textToHtml(body), cta: { label: "Άνοιγμα σύμβασης Β", href: p.url } }),
    text: renderText({ title: subject, text: body, cta: { label: "Άνοιγμα σύμβασης Β", href: p.url }, brand: p.brand }),
  };
}

export function contractSignedSupplierEmail(p: { brand: EmailBrand; woNumber: string; title: string; signatory: string; url: string }): Mail {
  const subject = `Αντίγραφο σύμβασης ${p.woNumber}-B`;
  const body = `Αποδεχθήκατε ηλεκτρονικά τη σύμβαση έργου ${p.woNumber}-B («${p.title}») ως ${p.signatory}. Το οριστικό αντίγραφο με την ώρα αποδοχής είναι διαθέσιμο στην πλατφόρμα — μπορείτε να το εκτυπώσετε ή να το αποθηκεύσετε ως PDF.`;
  return {
    subject,
    html: renderEmail({ brand: p.brand, eyebrow: `Σύμβαση ${p.woNumber}-B`, title: "Η σύμβαση υπογράφηκε", bodyHtml: textToHtml(body), cta: { label: "Άνοιγμα αντιγράφου", href: p.url } }),
    text: renderText({ title: subject, text: body, cta: { label: "Άνοιγμα αντιγράφου", href: p.url }, brand: p.brand }),
  };
}
