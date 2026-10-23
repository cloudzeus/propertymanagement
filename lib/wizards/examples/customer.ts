/** «Παράδειγμα εφαρμογής» of the customer wizard: what happens next for this customer. Pure. */
export type CustomerExampleInput = {
  type: "INDIVIDUAL" | "COMPANY";
  name: string;
  hasLogin: boolean;
  loginEmail: string | null;
  /** The code the server will assign (peekNextCustomerCode). */
  nextCode: string;
};

export type CustomerExample = {
  headline: string;
  steps: { title: string; body: string }[];
  loginLine: string | null;
};

export function exampleForCustomer(i: CustomerExampleInput): CustomerExample {
  const who = i.type === "COMPANY" ? `Η εταιρεία ${i.name.trim()}` : `Ο/Η ${i.name.trim()}`;
  return {
    headline: `${who} θα καταχωριστεί με κωδικό ${i.nextCode}. Από εδώ ξεκινά η αλυσίδα:`,
    steps: [
      { title: "Ιδιοκτησία", body: "Το ακίνητο ή συγκρότημα του πελάτη. Εδώ ορίζεται αν το διαχειρίζεται η εταιρεία και το πακέτο υπηρεσιών που θα χρεώνεται κάθε μήνα." },
      { title: "Κτήριο & μονάδες", body: "Κάθε πολυκατοικία με τα διαμερίσματα και τα καταστήματά της (όροφος, τετραγωνικά). Από αυτά υπολογίζονται τα κοινόχρηστα." },
      { title: "Χιλιοστά", body: "Τρία σετ χιλιοστών (γενικά, ανελκυστήρα, θέρμανσης) — αυτόματα βάσει νόμου από τα τετραγωνικά ή με τον κανονισμό της πολυκατοικίας." },
      { title: "Πακέτο υπηρεσιών", body: "Οι υπηρεσίες που επιλέγει ο πελάτης για την ιδιοκτησία. Από αυτές προκύπτει το μηνιαίο τιμολόγιο προς τον πελάτη." },
    ],
    loginLine: i.hasLogin && i.loginEmail
      ? `${who} θα συνδέεται με ${i.loginEmail.trim()} και θα βλέπει τα ακίνητα, τα τιμολόγια και τα κοινόχρηστα ${i.type === "COMPANY" ? "της" : "του/της"}.`
      : null,
  };
}
