/** Pure wiki metadata types shared by server loaders, UI and tests. */
export type WikiSurface = "company" | "customer" | "marketplace" | "standalone";

export type WikiArticleMeta = {
  slug: string;
  title: string;
  /** Route pattern, e.g. `/building/[id]`. */
  route: string;
  /** Empty = every role. */
  roles: string[];
  surface: WikiSurface;
  area: string;
  summary: string;
  prompts: string[];
  related: string[];
  /** Optional `"tabKey: Heading"` pairs so `?s=<tabKey>` scrolls the help drawer to that section. */
  sections?: string[];
};

export const AREA_LABELS: Record<string, string> = {
  core: "Αρχική & επισκόπηση",
  management: "Πελάτες, ακίνητα, κτήρια",
  operations: "Βλάβες, συντηρήσεις, ανακοινώσεις",
  financials: "Οικονομικά & τιμολόγηση",
  settings: "Ρυθμίσεις",
  cms: "Δημόσιο site (CMS)",
  assets: "Τα ακίνητά μου",
  services: "Λογαριασμοί & αιτήματα",
  business: "Η επιχείρησή μου",
  tasks: "Αναθέσεις & προσφορές",
  other: "Λοιπά",
};
export const AREA_ORDER = ["core", "management", "operations", "financials", "settings", "cms", "assets", "services", "business", "tasks", "other"];
