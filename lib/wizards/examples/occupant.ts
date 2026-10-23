/** Pure rules of the «Ιδιοκτήτης / ένοικος» example: what the person will see and which expenses they pay. */
export type OccupantExampleInput = { role: "OWNER" | "RESIDENT"; name: string; unitNumber: string; isNewAccount: boolean };
export type OccupantExample = {
  surface: "/portal" | "/owner";
  sees: string[];
  splitRows: { label: string; pays: "Ένοικος" | "Ιδιοκτήτης"; note: string }[];
  loginLine: string;
};

export function exampleForOccupant(i: OccupantExampleInput): OccupantExample {
  const who = i.name.trim() || (i.role === "OWNER" ? "ο ιδιοκτήτης" : "ο ένοικος");
  const owner = i.role === "OWNER";
  return {
    surface: owner ? "/owner" : "/portal",
    sees: owner
      ? [`τα κοινόχρηστα της μονάδας ${i.unitNumber} (μερίδιο ιδιοκτήτη) και το υπόλοιπο`, "τις αποφάσεις συνελεύσεων και τα πρακτικά", "τις βλάβες και τα αιτήματα του κτηρίου", "τα έγγραφα και τις ανακοινώσεις"]
      : [`τα κοινόχρηστα της μονάδας ${i.unitNumber} (μερίδιο ενοίκου) και πληρωμή online`, "δήλωση βλάβης με φωτογραφία από το κινητό", "τις ανακοινώσεις και τα έγγραφα του κτηρίου"],
    splitRows: [
      { label: "Καθαρισμός, ρεύμα κοινοχρήστων, πετρέλαιο (100 €)", pays: "Ένοικος", note: "δαπάνες λειτουργίας — όσο μένει εκεί" },
      { label: "Επισκευή ανελκυστήρα, μόνωση ταράτσας (300 €)", pays: "Ιδιοκτήτης", note: "δαπάνες ιδιοκτήτη — ακολουθούν το ακίνητο" },
    ],
    loginLine: i.isNewAccount
      ? `Δημιουργείται λογαριασμός για ${who}: συνδέεται με το email και τον αρχικό κωδικό που δώσατε (πείτε του να τον αλλάξει).`
      : `${who} έχει ήδη λογαριασμό — απλώς συνδέεται με τη μονάδα ${i.unitNumber} και βλέπει αμέσως τα κοινόχρηστά της.`,
  };
}
