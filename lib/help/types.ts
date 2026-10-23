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
  /** `page` = guide of one app route (default); `guide` = step-by-step guide of a wizard (docs/wiki/guides, no route). */
  kind: "page" | "guide";
  /** Guides: the wizard key (lib/wizards/registry) this guide explains. */
  wizard?: string;
  /** Guides: explainer video (Bunny CDN mp4) and its poster. */
  video?: string;
  videoPoster?: string;
  /** Guides: reading/watching time, minutes. */
  minutes?: number;
};

export const AREA_LABELS: Record<string, string> = {
  guides: "Οδηγοί βήμα-βήμα",
  core: "Επισκόπηση & κέντρο εργασιών",
  management: "Πελάτες & ακίνητα",
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
export const AREA_ORDER = ["guides", "core", "management", "operations", "financials", "settings", "cms", "assets", "services", "business", "tasks", "other"];
