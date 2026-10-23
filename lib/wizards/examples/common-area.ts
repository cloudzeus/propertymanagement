/** Pure rules of the «Κοινόχρηστος χώρος & στοιχεία» wizard: area types with suggested managed items, and the example (package impact + items). */

export type CommonAreaType = { value: string; label: string; icon: string; description: string; suggestedItems: string[] };

export const COMMON_AREA_TYPES: CommonAreaType[] = [
  { value: "stairs", label: "Κλιμακοστάσιο", icon: "RiStairsLine", description: "Σκάλες, πλατύσκαλα, φωτισμός", suggestedItems: ["λαμπτήρ", "κλιμακοστασ", "πυροσβεστήρ"] },
  { value: "entrance", label: "Είσοδος / χολ", icon: "RiDoorOpenLine", description: "Πόρτα, θυροτηλέφωνο, γραμματοκιβώτια", suggestedItems: ["εισόδ", "θυροτηλέφων"] },
  { value: "boiler", label: "Λεβητοστάσιο", icon: "RiFireLine", description: "Λέβητας, καυστήρας, δεξαμενή", suggestedItems: ["καυστήρ", "λέβητ"] },
  { value: "roof", label: "Ταράτσα", icon: "RiHome8Line", description: "Μόνωση, κεραίες, μηχανοστάσιο", suggestedItems: ["ταράτσ", "μηχανοστάσι"] },
  { value: "yard", label: "Αυλή / κήπος", icon: "RiPlantLine", description: "Πρασιά, κάδοι, αυτόματο πότισμα", suggestedItems: ["κήπ", "κάδ"] },
  { value: "parking", label: "Πυλωτή / πάρκινγκ", icon: "RiParkingBoxLine", description: "Θέσεις, γκαραζόπορτα, φωτισμός", suggestedItems: ["γκαραζόπορτ", "υπογεί"] },
  { value: "storage", label: "Αποθήκη / υπόγειο", icon: "RiArchiveLine", description: "Αποθηκευτικοί χώροι, αντλίες", suggestedItems: ["αντλί", "αποθήκ"] },
  { value: "other", label: "Άλλο", icon: "RiMoreLine", description: "Θα το ονομάσετε εσείς", suggestedItems: [] },
];

export function areaTypeLabel(value: string): string {
  return COMMON_AREA_TYPES.find((t) => t.value === value)?.label ?? value;
}

/** Catalog item types whose name contains one of the type's suggestion stems (accent/case-insensitive). */
export function suggestedItemTypeIds(type: string, catalog: { id: string; name: string }[]): string[] {
  const stems = COMMON_AREA_TYPES.find((t) => t.value === type)?.suggestedItems ?? [];
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return catalog.filter((c) => stems.some((st) => norm(c.name).includes(norm(st)))).map((c) => c.id);
}

export type CommonAreaExampleInput = {
  name: string;
  type: string;
  items: { typeName: string; quantity: number }[];
  /** The property's package catalog (enabled flag included). */
  services: { name: string; price: number; pricingModel: string; enabled: boolean }[];
  /** Common areas the property already has (all buildings). */
  currentCommonAreas: number;
};

export type CommonAreaExample = {
  headline: string;
  costLines: { service: string; before: number; after: number }[];
  costDelta: number;
  itemLines: string[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function exampleForCommonArea(i: CommonAreaExampleInput): CommonAreaExample {
  const costLines = i.services
    .filter((s) => s.enabled && s.pricingModel === "PER_COMMON_AREA")
    .map((s) => ({ service: s.name, before: r2(s.price * i.currentCommonAreas), after: r2(s.price * (i.currentCommonAreas + 1)) }));
  return {
    headline: `«${i.name.trim() || "Ο νέος χώρος"}» (${areaTypeLabel(i.type)}) θα είναι ο ${i.currentCommonAreas + 1}ος κοινόχρηστος χώρος της ιδιοκτησίας.`,
    costLines,
    costDelta: r2(costLines.reduce((s, l) => s + (l.after - l.before), 0)),
    itemLines: i.items.filter((x) => x.quantity > 0).map((x) => `${x.quantity} × ${x.typeName}`),
  };
}
