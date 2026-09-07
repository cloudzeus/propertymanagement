/** Catalogue of printable documents (manager → owners/residents). Shared by the hub and the doc route. */
export type DocKey = "notice" | "summary" | "expenses" | "payments" | "receipt" | "proposal" | "invitation" | "minutes" | "announcement";
export type DocGroup = "Κοινόχρηστα" | "Εισπράξεις" | "Αποφάσεις" | "Συνελεύσεις & ενημέρωση";

export const DOCS: Record<DocKey, { title: string; hint: string; group: DocGroup; icon: string; needsMonth?: boolean }> = {
  notice: { title: "Ειδοποιητήριο κοινοχρήστων", hint: "Ένα φύλλο ανά διαμέρισμα με ανάλυση δαπανών, αναλογία, χιλιοστά και πληρωτέο ποσό.", group: "Κοινόχρηστα", icon: "RiFileList3Line", needsMonth: true },
  summary: { title: "Συγκεντρωτική κατάσταση", hint: "Όλα τα διαμερίσματα της περιόδου σε έναν πίνακα, ανά ομάδα δαπανών.", group: "Κοινόχρηστα", icon: "RiTableLine", needsMonth: true },
  expenses: { title: "Ανάλυση εξόδων", hint: "Λίστα παραστατικών της περιόδου με βάση κατανομής και σύνοψη ανά κατηγορία.", group: "Κοινόχρηστα", icon: "RiReceiptLine", needsMonth: true },
  payments: { title: "Κατάσταση πληρωμών", hint: "Χρεώσεις, εισπράξεις και υπόλοιπα ιδιοκτητών/ενοίκων, με προηγούμενες οφειλές.", group: "Εισπράξεις", icon: "RiMoneyEuroCircleLine", needsMonth: true },
  receipt: { title: "Απόδειξη είσπραξης", hint: "Απόδειξη για ιδιοκτήτη ή ένοικο διαμερίσματος, με πρωτότυπο και στέλεχος.", group: "Εισπράξεις", icon: "RiCheckboxCircleLine", needsMonth: true },
  proposal: { title: "Πρόταση δαπάνης", hint: "Κόστος, αναλογία ανά διαμέρισμα και φύλλο ψηφοφορίας των ιδιοκτητών.", group: "Αποφάσεις", icon: "RiDraftLine" },
  invitation: { title: "Πρόσκληση σε Γενική Συνέλευση", hint: "Ημερήσια διάταξη, επαναληπτική συνέλευση και εξουσιοδότηση εκπροσώπησης.", group: "Συνελεύσεις & ενημέρωση", icon: "RiCalendarEventLine" },
  minutes: { title: "Πρακτικά συνέλευσης", hint: "Συμμετέχοντες και τα εγκεκριμένα πρακτικά.", group: "Συνελεύσεις & ενημέρωση", icon: "RiFileTextLine" },
  announcement: { title: "Ανακοίνωση για τον πίνακα", hint: "Μεγάλος τίτλος, ευανάγνωστο κείμενο, στοιχεία διαχείρισης.", group: "Συνελεύσεις & ενημέρωση", icon: "RiMegaphoneLine" },
};
