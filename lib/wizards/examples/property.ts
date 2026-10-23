/** «Παράδειγμα εφαρμογής» of the property wizard: the hierarchy this property creates. Pure. */
export type PropertyExampleInput = {
  customerName: string;
  name: string;
  address: string | null;
  managed: boolean;
  sameAddressBuilding: boolean;
  buildingName: string | null;
};

export type TreeNode = { label: string; sub?: string; depth: number };

export type PropertyExample = {
  tree: TreeNode[];
  managedLine: string;
  packageLine: string;
};

export function exampleForProperty(i: PropertyExampleInput): PropertyExample {
  const name = i.name.trim() || "η νέα ιδιοκτησία";
  const building = i.buildingName?.trim() || name;
  return {
    tree: [
      { label: i.customerName.trim() || "Πελάτης", sub: "Πελάτης — εδώ πάει το μηνιαίο τιμολόγιο", depth: 0 },
      { label: name, sub: i.address?.trim() ? `Ιδιοκτησία · ${i.address.trim()}` : "Ιδιοκτησία · χωρίς διεύθυνση ακόμη", depth: 1 },
      { label: building, sub: i.sameAddressBuilding ? "Πρώτο κτήριο · ίδια διεύθυνση με την ιδιοκτησία — οι μονάδες μπαίνουν μετά" : "Πρώτο κτήριο · η διεύθυνση ορίζεται αργότερα στη διαχείριση", depth: 2 },
    ],
    managedLine: i.managed
      ? "Τη διαχειρίζεται η εταιρεία: διαχειριστής μπορεί να οριστεί μόνο υπάλληλος της εταιρείας, και ισχύουν τα στοιχεία διαχείρισης και οι υποχρεώσεις συντήρησης."
      : "Αυτοδιαχείριση: ως διαχειριστής μπορεί να οριστεί ιδιοκτήτης, ένοικος ή ο ίδιος ο πελάτης· η εταιρεία παρέχει μόνο τις υπηρεσίες του πακέτου.",
    packageLine: "Το πακέτο υπηρεσιών και η μηνιαία χρέωση ορίζονται σε αυτή την ιδιοκτησία — όχι ανά κτήριο. Κάθε ιδιοκτησία του πελάτη μπορεί να έχει διαφορετικό πακέτο.",
  };
}
