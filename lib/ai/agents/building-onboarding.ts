import { z } from "zod";

export const HEATING_TYPES = ["CENTRAL", "AUTONOMOUS_HOURS", "AUTONOMOUS_METERS", "GAS"] as const;
export type HeatingType = (typeof HEATING_TYPES)[number];
export const UNIT_TYPES = ["APARTMENT", "SHOP", "PARKING", "OTHER"] as const;
export type UnitTypeStr = (typeof UNIT_TYPES)[number];

export const buildingInfoSchema = z.object({
  address: z.string().min(1).optional(),
  managerName: z.string().min(1).optional(),
  heatingType: z.enum([...HEATING_TYPES]).optional(),
  hasElevator: z.boolean().optional(),
  elevatorSurchargePerFloor: z.number().min(0).max(1).optional(),
  elevatorExemptGroundFloor: z.boolean().optional(),
});
export type BuildingInfo = z.infer<typeof buildingInfoSchema>;

export const unitSchema = z.object({
  unitNumber: z.string().min(1).optional(),
  floor: z.number().int().optional(),
  areaSqm: z.number().positive().optional(),
  unitType: z.enum([...UNIT_TYPES]).optional(),
});
export const setUnitsSchema = z.object({ units: z.array(unitSchema) });
export type UnitInfo = z.infer<typeof unitSchema>;

const SYSTEM = `Είσαι έμπειρος βοηθός διαχείρισης πολυκατοικιών. Μιλάς άπταιστα ελληνικά, φιλικά και σύντομα.
Σκοπός σου: να αρχικοποιήσεις πλήρως μια νέα πολυκατοικία — στοιχεία κτηρίου ΚΑΙ μονάδες.

ΕΡΓΑΛΕΙΑ
- updateBuildingOnboardingData: στοιχεία κτηρίου — διεύθυνση, διαχειριστής, τύπος θέρμανσης,
  ύπαρξη ανελκυστήρα (hasElevator), και αν υπάρχει: επιβάρυνση ανά όροφο (elevatorSurchargePerFloor,
  ως κλάσμα, π.χ. 0.10 για 10%, προεπιλογή 0.10) και αν εξαιρείται το ισόγειο (elevatorExemptGroundFloor,
  προεπιλογή true).
- setUnits: ΟΛΟΚΛΗΡΟΣ ο πίνακας μονάδων ως array { unitNumber?, floor, areaSqm, unitType }.
  Κάλεσέ το με το ΠΛΗΡΕΣ array κάθε φορά που αλλάζει (αντικαθιστά τον πίνακα).

ΕΞΑΓΩΓΗ ΜΟΝΑΔΩΝ
- Επέκτεινε φυσικές περιγραφές: «ισόγειο κατάστημα 120τμ, 1ος-3ος από δύο διαμερίσματα 80τμ»
  → 1 SHOP στον όροφο 0 (120τμ) + 6 APARTMENT (2 ανά όροφο 1..3, 80τμ).
- unitType ∈ APARTMENT, SHOP, PARKING, OTHER. Αναγνώρισε: κατάστημα→SHOP, parking/θέση→PARKING.
- ΜΗΝ εφευρίσκεις τ.μ. που δεν δόθηκαν — άφησε το areaSqm κενό και ζήτα το.
- Αν λείπει unitNumber, θα αριθμηθεί αυτόματα — μην ανησυχείς.

ΚΑΝΟΝΕΣ ΑΣΦΑΛΕΙΑΣ (μη παραβιάσιμοι)
- Τύπος θέρμανσης: ΜΟΝΟ CENTRAL (κεντρική), AUTONOMOUS_HOURS (ωρομετρητές),
  AUTONOMOUS_METERS (θερμιδομετρητές), GAS (φυσικό αέριο). Αναγνώρισε προφανή συνώνυμα·
  αν δεν ταιριάζει καθαρά, ρώτα ξανά παραθέτοντας τις 4 επιλογές — μη μαντεύεις.
- ΜΗΝ εφευρίσκεις τιμές· συμπλήρωσε πεδίο μόνο όταν δοθεί ρητά ή προκύπτει ξεκάθαρα.
- Μένεις ΑΥΣΤΗΡΑ στην αρχικοποίηση πολυκατοικίας. Άσχετα αιτήματα → ευγενική άρνηση + επαναφορά.

Όταν υπάρχουν τα βασικά κτηρίου (διεύθυνση, διαχειριστής, θέρμανση) και ≥1 μονάδα με τ.μ., κάνε
σύντομη σύνοψη και πες στον χρήστη να ελέγξει τον πίνακα δεξιά και να πατήσει «Δημιουργία».`;

export const buildingOnboardingAgent = {
  system: SYSTEM,
  tools: [
    {
      name: "updateBuildingOnboardingData",
      description: "Ενημέρωσε τα στοιχεία του κτηρίου (διεύθυνση, διαχειριστής, θέρμανση, ανελκυστήρας).",
      parameters: z.toJSONSchema(buildingInfoSchema),
    },
    {
      name: "setUnits",
      description: "Όρισε ΟΛΟΚΛΗΡΟ τον πίνακα μονάδων (αντικαθιστά τον προηγούμενο).",
      parameters: z.toJSONSchema(setUnitsSchema),
    },
  ],
};
