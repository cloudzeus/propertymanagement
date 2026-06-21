export type Severity = "error" | "warning" | "info";
export type AuditTab = "info" | "units" | "millesimes" | "distribution" | "exclusions" | "heating" | "customer";
export type Finding = { severity: Severity; title: string; detail: string; tab: AuditTab };

export type AuditUnit = {
  unitNumber: string; floor: number | null; areaSqm: number | null;
  millesimes: number | null; millesimesElevator: number | null; millesimesHeating: number | null;
  ownerId: string | null; residentId: string | null; hasOccupancyOwner: boolean; hasOccupancyResident: boolean;
  millesimesSource: string;
};
export type AuditInput = {
  building: { name: string; address: string; hasElevator: boolean };
  units: AuditUnit[];
  customer: { vat: string | null };
  heating: { meteredCategoryExists: boolean; readingsForLatestPeriod: number };
  exclusions: { categoryId: string; excludedUnitCount: number; totalUnits: number }[];
};

const sumNonNull = (xs: (number | null)[]) => xs.reduce<number>((s, v) => s + (v ?? 0), 0);
const near1000 = (n: number) => Math.abs(n - 1000) <= 0.5;

export function auditBuilding(input: AuditInput): Finding[] {
  const f: Finding[] = [];
  const { units } = input;

  if (units.length === 0) {
    f.push({ severity: "error", title: "Το κτήριο δεν έχει καμία μονάδα", detail: "Προσθέστε μονάδες για να εκδοθούν κοινόχρηστα.", tab: "units" });
    return f;
  }

  const noArea = units.filter((u) => u.areaSqm == null).map((u) => u.unitNumber);
  if (noArea.length) f.push({ severity: "error", title: `${noArea.length} μονάδες χωρίς τ.μ. (${noArea.join(", ")})`, detail: "Χωρίς τετραγωνικά δεν υπολογίζονται χιλιοστά.", tab: "units" });
  const noFloor = units.filter((u) => u.floor == null).map((u) => u.unitNumber);
  if (noFloor.length) f.push({ severity: "error", title: `${noFloor.length} μονάδες χωρίς όροφο (${noFloor.join(", ")})`, detail: "Ο όροφος χρειάζεται για τα χιλιοστά ανελκυστήρα.", tab: "units" });
  const neg = units.filter((u) => (u.areaSqm ?? 0) < 0).map((u) => u.unitNumber);
  if (neg.length) f.push({ severity: "error", title: `Αρνητικά τ.μ. (${neg.join(", ")})`, detail: "Διορθώστε τα τετραγωνικά.", tab: "units" });

  const seen = new Set<string>(); const dup = new Set<string>();
  for (const u of units) { if (seen.has(u.unitNumber)) dup.add(u.unitNumber); seen.add(u.unitNumber); }
  if (dup.size) f.push({ severity: "error", title: `Διπλά νούμερα μονάδων (${[...dup].join(", ")})`, detail: "Κάθε μονάδα πρέπει να έχει μοναδικό αριθμό.", tab: "units" });

  const g = sumNonNull(units.map((u) => u.millesimes));
  if (!near1000(g)) f.push({ severity: "error", title: `Γενικά χιλιοστά = ${Math.round(g)} (όχι 1000)`, detail: "Συμπληρώστε τ.μ. ή πατήστε «Επανυπολογισμός».", tab: "millesimes" });
  const h = sumNonNull(units.map((u) => u.millesimesHeating));
  if (units.some((u) => u.millesimesHeating != null) && !near1000(h)) f.push({ severity: "error", title: `Χιλιοστά θέρμανσης = ${Math.round(h)} (όχι 1000)`, detail: "Ελέγξτε τα χιλιοστά θέρμανσης.", tab: "millesimes" });
  if (input.building.hasElevator) {
    const e = sumNonNull(units.map((u) => u.millesimesElevator));
    if (!near1000(e)) f.push({ severity: "error", title: `Χιλιοστά ανελκυστήρα = ${Math.round(e)} (όχι 1000)`, detail: "Ελέγξτε τα χιλιοστά ανελκυστήρα.", tab: "millesimes" });
    if (units.every((u) => (u.millesimesElevator ?? 0) === 0)) f.push({ severity: "warning", title: "Ανελκυστήρας χωρίς χιλιοστά", detail: "Το κτήριο έχει ανελκυστήρα αλλά όλες οι μονάδες έχουν 0. Υπολογίστε χιλιοστά ανελκυστήρα.", tab: "millesimes" });
  }

  const orphan = units.filter((u) => !u.ownerId && !u.residentId && !u.hasOccupancyOwner && !u.hasOccupancyResident).map((u) => u.unitNumber);
  if (orphan.length) f.push({ severity: "warning", title: `${orphan.length} μονάδες χωρίς ιδιοκτήτη/ένοικο (${orphan.join(", ")})`, detail: "Οι χρεώσεις τους δεν θα αντιστοιχούν σε άτομο.", tab: "units" });

  if (input.heating.meteredCategoryExists && input.heating.readingsForLatestPeriod === 0)
    f.push({ severity: "warning", title: "Θέρμανση με μετρητές χωρίς ενδείξεις", detail: "Καταχωρήστε ενδείξεις θέρμανσης για τη φετινή περίοδο.", tab: "heating" });

  for (const ex of input.exclusions)
    if (ex.totalUnits > 0 && ex.excludedUnitCount === ex.totalUnits)
      f.push({ severity: "warning", title: "Εξαίρεση μηδενίζει δαπάνη", detail: "Όλες οι μονάδες εξαιρούνται από μια κατηγορία — η δαπάνη δεν θα κατανεμηθεί σε κανέναν.", tab: "exclusions" });

  if (!input.building.address) f.push({ severity: "warning", title: "Λείπει διεύθυνση κτηρίου", detail: "Συμπληρώστε τη διεύθυνση.", tab: "info" });
  if (!input.building.name) f.push({ severity: "warning", title: "Λείπει όνομα κτηρίου", detail: "Συμπληρώστε το όνομα.", tab: "info" });
  if (!input.customer.vat) f.push({ severity: "warning", title: "Ο πελάτης δεν έχει ΑΦΜ", detail: "Συμπληρώστε το ΑΦΜ του πελάτη για τιμολόγηση.", tab: "customer" });

  const manual = units.filter((u) => u.millesimesSource === "MANUAL").length;
  if (manual) f.push({ severity: "info", title: `${manual} μονάδες με χιλιοστά κανονισμού (χειροκίνητα)`, detail: "Δεν αλλάζουν με τον αυτόματο επανυπολογισμό.", tab: "millesimes" });

  return f;
}
