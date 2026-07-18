import type { BuildingCaps } from "@/lib/building-caps";
export type SectionKey = "overview" | "finance" | "building" | "people" | "maintenance" | "communication";
export type SubTab = { key: string; label: string; visible?: (can: BuildingCaps, f: { managed: boolean; metered: boolean }) => boolean };
export const SECTIONS: { key: SectionKey; label: string; tabs: SubTab[] }[] = [
  { key: "overview", label: "Επισκόπηση", tabs: [] },
  { key: "finance", label: "Οικονομικά", tabs: [
    { key: "koino", label: "Κοινόχρηστα" }, { key: "expenses", label: "Έξοδα" },
    { key: "readings", label: "Ενδείξεις μετρητών" },
  ]},
  { key: "building", label: "Κτήριο", tabs: [
    { key: "units", label: "Μονάδες" }, { key: "millesimes", label: "Χιλιοστά & Κατανομή" },
    { key: "splitsettings", label: "Ρυθμίσεις κατανομής" }, { key: "infra", label: "Εγκαταστάσεις" },
    { key: "manageditems", label: "Διαχειριζόμενα στοιχεία", visible: (_c, f) => f.managed },
  ]},
  { key: "people", label: "Άνθρωποι", tabs: [
    { key: "people", label: "Ένοικοι & Ιδιοκτήτες" }, { key: "contacts", label: "Επαφές" },
  ]},
  { key: "maintenance", label: "Συντήρηση", tabs: [
    { key: "maint", label: "Αιτήματα βλαβών" }, { key: "maintenance", label: "Συντηρήσεις" },
    { key: "calendar", label: "Ημερολόγιο" },
  ]},
  { key: "communication", label: "Επικοινωνία", tabs: [
    { key: "ann", label: "Ανακοινώσεις" }, { key: "assemblies", label: "Συνελεύσεις" },
    { key: "files", label: "Αρχεία" },
  ]},
];
