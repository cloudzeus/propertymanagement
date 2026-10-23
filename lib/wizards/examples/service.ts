/** Pure rules of the «Νέα υπηρεσία καταλόγου» wizard: pricing models explained, code suggestion, two-scenario example. */
import type { DistanceZone } from "@/lib/distance/zones";
import { lineFor, type PkgCounts, type PkgLinePreview, type PkgServiceLike } from "./package";

export type ServicePricingModel = "PER_UNIT" | "PER_BUILDING" | "PER_COMMON_AREA" | "FLAT" | "METERED_PREPAID" | "PER_ZONE";

export const PRICING_MODELS: { value: ServicePricingModel; label: string; description: string; icon: string; priceLabel: string }[] = [
  { value: "PER_UNIT", label: "Ανά μονάδα / μήνα", description: "Τιμή × διαμερίσματα και καταστήματα της ιδιοκτησίας. Η συνηθισμένη βασική διαχείριση.", icon: "RiHome4Line", priceLabel: "€ ανά μονάδα / μήνα" },
  { value: "PER_BUILDING", label: "Ανά κτήριο / μήνα", description: "Τιμή × κτήρια. Για υπηρεσίες που αφορούν το κτήριο ως σύνολο (π.χ. έλεγχος εγκαταστάσεων).", icon: "RiBuilding2Line", priceLabel: "€ ανά κτήριο / μήνα" },
  { value: "PER_COMMON_AREA", label: "Ανά κοινόχρηστο χώρο / μήνα", description: "Τιμή × κοινόχρηστοι χώροι (κλιμακοστάσια, είσοδοι…). Για καθαρισμούς και συντήρηση χώρων.", icon: "RiDoorOpenLine", priceLabel: "€ ανά χώρο / μήνα" },
  { value: "FLAT", label: "Σταθερή / μήνα", description: "Ένα ποσό ανά ιδιοκτησία, ανεξάρτητα από μέγεθος (π.χ. λογιστική υποστήριξη).", icon: "RiPriceTag3Line", priceLabel: "€ / μήνα" },
  { value: "METERED_PREPAID", label: "Με μέτρηση + προαγορά", description: "Γενικές συνελεύσεις: ο πελάτης προαγοράζει λεπτά συμμετοχής· καταναλώνονται διάρκεια × συμμετέχοντες.", icon: "RiTimerLine", priceLabel: "€ ανά λεπτό συμμετοχής" },
  { value: "PER_ZONE", label: "Ανά ζώνη απόστασης / μήνα", description: "Βασική τιμή + ποσό ανά κτήριο ανάλογα με την απόσταση από τον σταθμό βάσης (ζώνες στις Ρυθμίσεις).", icon: "RiRoadMapLine", priceLabel: "βασική τιμή € / μήνα" },
];

const GREEK: Record<string, string> = {
  α: "a", ά: "a", β: "v", γ: "g", δ: "d", ε: "e", έ: "e", ζ: "z", η: "i", ή: "i", θ: "th", ι: "i", ί: "i", ϊ: "i", ΐ: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x",
  ο: "o", ό: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", ύ: "y", ϋ: "y", ΰ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o", ώ: "o",
};

/** «Καθαρισμός κοινοχρήστων» → KATHARISMOS-KOINOCHRISTON, unique against `taken` (-2, -3…), max 32 chars. */
export function suggestServiceCode(name: string, taken: string[]): string {
  const latin = name.toLowerCase().split("").map((ch) => GREEK[ch] ?? ch).join("");
  let base = latin.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!base) base = "SERVICE";
  if (base.length > 32) base = base.slice(0, 32).replace(/-+$/g, "");
  const takenSet = new Set(taken.map((t) => t.toUpperCase()));
  if (!takenSet.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const suffix = `-${i}`;
    const candidate = `${base.slice(0, 32 - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (!takenSet.has(candidate)) return candidate;
  }
  return `${base.slice(0, 18)}-${Date.now() % 100000}`;
}

export type Scenario = { label: string; counts: PkgCounts; zoneIndexes: number[] };
/** Two illustrative properties: a small one and a two-building one. */
export const EXAMPLE_SCENARIOS: Scenario[] = [
  { label: "Μικρή πολυκατοικία", counts: { units: 5, buildings: 1, commonAreas: 2 }, zoneIndexes: [0] },
  { label: "Συγκρότημα δύο κτηρίων", counts: { units: 12, buildings: 2, commonAreas: 4 }, zoneIndexes: [0, 1] },
];

export type ServiceExample = { scenarios: { label: string; counts: PkgCounts; zones: string[]; line: PkgLinePreview }[] };

export function exampleForService(s: PkgServiceLike, zones: DistanceZone[]): ServiceExample {
  return {
    scenarios: EXAMPLE_SCENARIOS.map((sc) => {
      const codes = sc.zoneIndexes.map((i) => zones[Math.min(i, Math.max(zones.length - 1, 0))]?.code ?? null);
      const zoneCodes = s.pricingModel === "PER_ZONE" ? codes : undefined;
      return { label: sc.label, counts: sc.counts, zones: codes.map((c) => zones.find((z) => z.code === c)?.label ?? "χωρίς ζώνη"), line: lineFor(s, sc.counts, zoneCodes) };
    }),
  };
}
