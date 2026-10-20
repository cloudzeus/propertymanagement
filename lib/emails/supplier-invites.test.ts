import { describe, it, expect } from "vitest";
import { DEFAULT_EMAIL_BRAND } from "@/lib/email-template";
import { rfqInvitationEmail, contactInvitationEmail, contractSignedStaffEmail, contractSignedSupplierEmail } from "./supplier-invites";

const brand = { ...DEFAULT_EMAIL_BRAND, name: "Orithon" };
const url = "https://app.example.test/invite/abc123";

describe("rfqInvitationEmail", () => {
  const mail = rfqInvitationEmail({ brand, supplierName: "Ηλεκτρολόγοι ΑΕ", title: "Διαρροή στο λεβητοστάσιο", buildingLabel: "Αθηνάς 12, Μαρούσι", deadlineAt: new Date("2026-10-27T15:00:00+03:00"), surveyRequired: true, url, recipientHasAccount: false });
  it("subject names the fault", () => {
    expect(mail.subject).toBe("Αίτημα προσφοράς: Διαρροή στο λεβητοστάσιο");
  });
  it("html and text carry the personal link, the eyebrow and the fixed CTA copy", () => {
    expect(mail.html).toContain(`href="${url}"`);
    expect(mail.text).toContain(url);
    expect(mail.html).toContain("Αίτημα προσφοράς");
    expect(mail.html).toContain("Δείτε το αίτημα &amp; προσφορά");
    expect(mail.html).toContain("Το link ισχύει 14 ημέρες και είναι προσωπικό.");
  });
  it("mentions the deadline in el-GR and the survey request", () => {
    expect(mail.text).toContain("27/10/2026");
    expect(mail.text).toMatch(/αυτοψία/);
  });
  it("tells a recipient without an account that the link sets up their access", () => {
    expect(mail.html).toMatch(/κωδικό/);
    const withAccount = rfqInvitationEmail({ brand, supplierName: "Χ", title: "Τ", buildingLabel: "Κ", deadlineAt: null, surveyRequired: false, url, recipientHasAccount: true });
    expect(withAccount.html).toMatch(/συνδεθείτε/i);
  });
});

describe("contactInvitationEmail", () => {
  const mail = contactInvitationEmail({ brand, supplierName: "Ηλεκτρολόγοι ΑΕ", contactName: "Μαρία", url });
  it("has the fixed title and CTA and the link in both parts", () => {
    expect(mail.subject).toBe("Πρόσβαση στο περιβάλλον συνεργατών Orithon");
    expect(mail.html).toContain("Ορισμός κωδικού");
    expect(mail.html).toContain(`href="${url}"`);
    expect(mail.text).toContain(url);
  });
});

describe("contract e-mails", () => {
  const staff = contractSignedStaffEmail({ brand, woNumber: "WO-2026-0007", title: "Αντικατάσταση αντλίας", supplierName: "Ηλεκτρολόγοι ΑΕ", signatory: "Γιάννης Παπάς", url: "https://app.example.test/admin/work-orders/w1/contract/supplier" });
  const sup = contractSignedSupplierEmail({ brand, woNumber: "WO-2026-0007", title: "Αντικατάσταση αντλίας", signatory: "Γιάννης Παπάς", url: "https://app.example.test/marketplace/work-orders/w1/contract" });
  it("name the work order, the signatory and link to the contract", () => {
    for (const m of [staff, sup]) {
      expect(m.subject).toContain("WO-2026-0007");
      expect(m.html).toContain("Γιάννης Παπάς");
      expect(m.text).toContain(m === staff ? "/admin/work-orders/w1/contract/supplier" : "/marketplace/work-orders/w1/contract");
    }
    expect(staff.html).toContain("Ηλεκτρολόγοι ΑΕ");
  });
});

describe("no mail ever carries a password", () => {
  it("none of the templates prints a password value", () => {
    const all = [
      rfqInvitationEmail({ brand, supplierName: "Χ", title: "Τ", buildingLabel: "Κ", deadlineAt: null, surveyRequired: false, url, recipientHasAccount: false }),
      contactInvitationEmail({ brand, supplierName: "Χ", contactName: "Μ", url }),
    ];
    for (const m of all) expect(/κωδικός:\s*\S/i.test(m.html) || /κωδικός:\s*\S/i.test(m.text)).toBe(false);
  });
});
