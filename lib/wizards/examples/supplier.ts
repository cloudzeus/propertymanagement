/** Pure rules of the «Νέος συνεργάτης» wizard: the RFQ→contract timeline and the site-survey fee per distance zone. */
import type { DistanceZone } from "@/lib/distance/zones";

export type SupplierExampleInput = {
  name: string;
  categories: string[];
  zones: DistanceZone[];
  siteSurveyFee: number | null;
  surveyZoneFees: Record<string, number>;
  surveyWaived: boolean;
  emergency24h: boolean;
};

export type SupplierExample = {
  timeline: { title: string; body: string }[];
  surveyLines: { zone: string; amount: number }[];
  surveyNote: string;
  badges: string[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function exampleForSupplier(i: SupplierExampleInput): SupplierExample {
  const name = i.name.trim() || "ο συνεργάτης";
  const fee = i.siteSurveyFee != null && i.siteSurveyFee > 0 ? i.siteSurveyFee : null;
  return {
    timeline: [
      { title: "Βλάβη", body: "Ένας ένοικος δηλώνει βλάβη (π.χ. πίνακας ρεύματος) από το κινητό του· η εταιρεία τη βλέπει στο Κέντρο εργασιών." },
      { title: "Αίτημα προσφοράς (RFQ)", body: `Η εταιρεία στέλνει το αίτημα στους συνεργάτες της ειδικότητας${i.categories.length ? ` «${i.categories[0]}»` : ""} — με έναν σύνδεσμο, χωρίς λογαριασμό.` },
      { title: "Προσφορά", body: `Ο/Η ${name} απαντά με τιμή και χρόνο${fee ? `· η αυτοψία χρεώνεται ${fee} € (συν προσαύξηση ζώνης)` : "· η αυτοψία είναι δωρεάν"}.` },
      { title: "Αποδοχή", body: "Ο πελάτης (ή η εταιρεία για λογαριασμό του) αποδέχεται — με δύο τιμές: του συνεργάτη και του πελάτη, η διαφορά μένει στην εταιρεία." },
      { title: "Σύμβαση έργου", body: "Δημιουργείται back-to-back σύμβαση: ραντεβού, εκτέλεση, παραλαβή με φωτογραφία, πληρωμή και αξιολόγηση." },
    ],
    surveyLines: fee ? i.zones.map((z) => ({ zone: z.label, amount: r2(fee + (Number(i.surveyZoneFees[z.code] ?? 0) || 0)) })) : [],
    surveyNote: fee
      ? (i.surveyWaived ? "Η αυτοψία συμψηφίζεται αν ανατεθεί η εργασία — ο πελάτης την πληρώνει μόνο αν δεν προχωρήσει." : "Η αυτοψία χρεώνεται ανεξάρτητα από το αν ανατεθεί η εργασία.")
      : "Η αυτοψία είναι δωρεάν — η προσφορά δεν θα περιλαμβάνει χρέωση αυτοψίας.",
    badges: [...i.categories, ...(i.emergency24h ? ["Έκτακτα 24/7"] : [])],
  };
}
