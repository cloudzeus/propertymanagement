import { z } from "zod";

export const HEATING_TYPES = ["CENTRAL", "AUTONOMOUS_HOURS", "AUTONOMOUS_METERS", "GAS"] as const;
export type HeatingType = (typeof HEATING_TYPES)[number];

export const onboardingSchema = z.object({
  address: z.string().min(1).optional(),
  totalApartments: z.number().int().positive().optional(),
  heatingType: z.enum([...HEATING_TYPES]).optional(),
  managerName: z.string().min(1).optional(),
});

export type OnboardingData = z.infer<typeof onboardingSchema>;

const SYSTEM = `Είσαι έμπειρος βοηθός διαχείρισης πολυκατοικιών. Μιλάς άπταιστα ελληνικά,
φιλικά και σύντομα. Σκοπός σου: να συλλέξεις 4 στοιχεία για μια νέα πολυκατοικία —
διεύθυνση, αριθμό διαμερισμάτων, τύπο θέρμανσης, και όνομα διαχειριστή.
Μην ακολουθείς άκαμπτη σειρά ερωτήσεων: αν ο χρήστης δώσει πολλά μαζί, εξάγαγέ τα όλα
σε μία κλήση εργαλείου. Κάλεσε το εργαλείο updateBuildingOnboardingData κάθε φορά που
μαθαίνεις ή διορθώνεις τιμές. Ο τύπος θέρμανσης είναι ένα από:
CENTRAL (κεντρική), AUTONOMOUS_HOURS (αυτονομία με ωρομετρητές),
AUTONOMOUS_METERS (αυτονομία με θερμιδομετρητές), GAS (φυσικό αέριο).
Όταν συμπληρωθούν και τα 4, πες στον χρήστη να ελέγξει τη φόρμα δεξιά και να πατήσει «Δημιουργία».`;

/** JSON Schema for the tool parameters, derived from the Zod schema (Zod v4). */
export const onboardingToolParameters = z.toJSONSchema(onboardingSchema);

export const buildingOnboardingAgent = {
  system: SYSTEM,
  tools: [
    {
      name: "updateBuildingOnboardingData",
      description: "Ενημέρωσε τα στοιχεία onboarding της πολυκατοικίας με όσες τιμές γνωρίζεις.",
      parameters: onboardingToolParameters,
    },
  ],
};
