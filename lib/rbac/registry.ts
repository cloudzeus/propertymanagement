import type { RbacModule, RoleDefaults, MenuGroupDef } from "./types";
import { permKey } from "./types";

const CRUD = ["view", "create", "edit", "delete"] as const;
const VIEW = ["view"] as const;

export const RBAC_MODULES: readonly RbacModule[] = [
  // ── Company surface ──
  // Order inside each group = order in the sidebar. Groups themselves are
  // ordered by MENU_GROUPS below (not by first appearance here).
  // overview
  { key: "dashboard", label: "Αρχική", surface: "company", menu: { href: "/super-admin", icon: "RiDashboardLine", group: "overview" }, actions: [...VIEW] }, // href is replaced by the role's home in buildMenu
  { key: "work", label: "Κέντρο εργασιών", surface: "company", menu: { href: "/admin/work", icon: "RiTaskLine", group: "overview" }, actions: [...VIEW] },
  { key: "reports", label: "Αναφορές", surface: "company", menu: { href: "/super-admin/reports", icon: "RiBarChartLine", group: "overview" }, actions: [...VIEW] },
  // customers — Πελάτες & Ακίνητα
  { key: "customers", label: "Πελάτες", surface: "company", menu: { href: "/super-admin/customers", icon: "RiContactsLine", group: "customers" }, actions: [...CRUD] },
  { key: "properties", label: "Ιδιοκτησίες", surface: "company", menu: { href: "/super-admin/properties", icon: "RiCommunityLine", group: "customers" }, actions: [...CRUD] },
  { key: "units", label: "Μονάδες", surface: "company", menu: { href: "/super-admin/units", icon: "RiHome3Line", group: "customers" }, actions: [...CRUD] },
  { key: "residents", label: "Ένοικοι & ιδιοκτήτες", surface: "company", menu: { href: "/admin/residents", icon: "RiUserLine", group: "customers" }, actions: [...CRUD] },
  { key: "managed-buildings", label: "Διαχειριζόμενα κτήρια", surface: "company", menu: { href: "/super-admin/managed-buildings", icon: "RiBuilding2Line", group: "customers" }, actions: [...CRUD] },
  { key: "managed-items", label: "Στοιχεία Διαχείρισης", surface: "company", menu: { href: "/super-admin/managed-items", icon: "RiListCheck2", group: "customers" }, actions: [...CRUD] },
  { key: "onboarding", label: "Νέα πολυκατοικία (AI)", surface: "company", menu: { href: "/super-admin/onboarding", icon: "RiRobot2Line", group: "customers" }, actions: [...CRUD] },
  // operations — Εργασίες
  { key: "maintenance", label: "Βλάβες & αιτήματα", surface: "company", menu: { href: "/admin/maintenance", icon: "RiToolsLine", group: "operations" }, actions: [...CRUD] },
  // Universal phone-first fault report (/report) — one module per surface so every role gets the entry.
  { key: "report", label: "Δήλωση βλάβης", surface: "company", menu: { href: "/report", icon: "RiAlarmWarningLine", group: "operations" }, actions: [...VIEW] },
  // Φ2: RFQ → offers → back-to-back work orders (company side).
  { key: "work-orders", label: "Συμβάσεις έργου", surface: "company", menu: { href: "/admin/work-orders", icon: "RiFileTextLine", group: "operations" }, actions: [...CRUD] },
  { key: "rfq", label: "Αιτήματα προσφοράς", surface: "company", menu: { href: "/staff/rfq", icon: "RiMoneyEuroCircleLine", group: "operations" }, actions: [...CRUD] },
  { key: "maintenance-program", label: "Ετήσιο πρόγραμμα", surface: "company", menu: { href: "/admin/maintenance-program", icon: "RiCalendarTodoLine", group: "operations" }, actions: [...CRUD] },
  { key: "calendar", label: "Ημερολόγιο", surface: "company", menu: { href: "/staff/calendar", icon: "RiCalendarLine", group: "operations" }, actions: [...CRUD] },
  // suppliers — Συνεργάτες
  { key: "suppliers", label: "Συνεργάτες & Προμηθευτές", surface: "company", menu: { href: "/super-admin/suppliers", icon: "RiTeamLine", group: "suppliers" }, actions: [...CRUD] },
  // communication — Επικοινωνία
  { key: "announcements", label: "Ανακοινώσεις", surface: "company", menu: { href: "/admin/announcements", icon: "RiNotification2Line", group: "communication" }, actions: [...CRUD] },
  // financials — Οικονομικά
  { key: "billing", label: "Τιμολόγηση", surface: "company", menu: { href: "/super-admin/billing", icon: "RiFileListLine", group: "financials" }, actions: [...CRUD] },
  { key: "metered-plans", label: "Πακέτα Χρεώσεων", surface: "company", menu: { href: "/admin/metered-plans", icon: "RiPriceTag3Line", group: "financials" }, actions: [...CRUD] },
  { key: "customer-wallets", label: "Πορτοφόλια Πελατών", surface: "company", menu: { href: "/admin/customer-wallets", icon: "RiMoneyEuroCircleLine", group: "financials" }, actions: [...CRUD] },
  { key: "company-wallet", label: "Πορτοφόλι εταιρείας", surface: "company", menu: { href: "/super-admin/billing/company-wallet", icon: "RiWallet3Line", group: "financials" }, actions: [...CRUD] },
  { key: "services", label: "Υπηρεσίες", surface: "company", menu: { href: "/super-admin/services", icon: "RiServiceLine", group: "financials" }, actions: [...CRUD] },
  { key: "api-costs", label: "AI Κόστη / Tokens", surface: "company", menu: { href: "/super-admin/settings/costs", icon: "RiMoneyDollarCircleLine", group: "financials" }, actions: [...VIEW] },
  // settings — Ρυθμίσεις (collapsed by default)
  { key: "settings", label: "Γενικές ρυθμίσεις", surface: "company", menu: { href: "/super-admin/settings", icon: "RiSettingsLine", group: "settings" }, actions: [...CRUD] },
  { key: "settings-company", label: "Εταιρία", surface: "company", menu: { href: "/super-admin/settings/company", icon: "RiBuildingLine", group: "settings" }, actions: [...CRUD] },
  { key: "settings-brand", label: "Brand", surface: "company", menu: { href: "/super-admin/settings/brand", icon: "RiPaletteLine", group: "settings" }, actions: [...CRUD] },
  { key: "settings-payments", label: "Πληρωμές (Viva)", surface: "company", menu: { href: "/super-admin/settings/payments", icon: "RiBankCardLine", group: "settings" }, actions: [...CRUD] },
  { key: "settings-contracts", label: "Προσφορές & συμβάσεις", surface: "company", menu: { href: "/super-admin/settings/contracts", icon: "RiFileTextLine", group: "settings" }, actions: [...CRUD] },
  { key: "settings-distance", label: "Σταθμός βάσης & ζώνες", surface: "company", menu: { href: "/super-admin/settings/distance", icon: "RiRoadMapLine", group: "settings" }, actions: [...CRUD] },
  { key: "integrations", label: "Ενσωματώσεις", surface: "company", menu: { href: "/super-admin/integrations", icon: "RiLinksLine", group: "settings" }, actions: [...CRUD] },
  { key: "users", label: "Χρήστες", surface: "company", menu: { href: "/super-admin/users", icon: "RiGroupLine", group: "settings" }, actions: [...CRUD] },
  { key: "roles", label: "Ρόλοι", surface: "company", menu: { href: "/super-admin/roles", icon: "RiShieldUserLine", group: "settings" }, actions: [...CRUD] },
  { key: "view-as", label: "Προεπισκόπηση ρόλων", surface: "company", menu: { href: "/super-admin/preview", icon: "RiEyeLine", group: "settings" }, actions: [...VIEW] },
  { key: "ai-tools", label: "AI Εργαλεία & APIs", surface: "company", menu: { href: "/super-admin/ai-tools", icon: "RiRobot2Line", group: "settings" }, actions: [...CRUD] },
  // softone — SoftOne ERP integration (collapsed by default), 4 screens
  { key: "softone-connection", label: "SoftOne: Σύνδεση", surface: "company", menu: { href: "/super-admin/settings/softone", icon: "RiPlugLine", group: "softone" }, actions: [...CRUD] },
  { key: "softone-structure", label: "SoftOne: Δομή & έλεγχοι", surface: "company", menu: { href: "/super-admin/settings/softone/structure", icon: "RiNodeTree", group: "softone" }, actions: [...VIEW] },
  { key: "softone-params", label: "SoftOne: Παράμετροι", surface: "company", menu: { href: "/super-admin/settings/softone/params", icon: "RiListSettingsLine", group: "softone" }, actions: [...CRUD] },
  { key: "softone-sync", label: "SoftOne: Συγχρονισμός", surface: "company", menu: { href: "/super-admin/settings/softone/sync", icon: "RiRefreshLine", group: "softone" }, actions: [...CRUD] },
  // cms — Ιστότοπος (collapsed by default)
  { key: "cms-landing", label: "CMS: Αρχική", surface: "company", menu: { href: "/super-admin/cms/landing", icon: "RiLayoutLine", group: "cms" }, actions: [...CRUD] },
  { key: "cms-seo", label: "CMS: SEO", surface: "company", menu: { href: "/super-admin/cms/seo", icon: "RiSearchEyeLine", group: "cms" }, actions: [...CRUD] },
  { key: "cms-settings", label: "CMS: Ρυθμίσεις", surface: "company", menu: { href: "/super-admin/cms/settings", icon: "RiSettings3Line", group: "cms" }, actions: [...CRUD] },
  { key: "cms-pages", label: "CMS: Σελίδες", surface: "company", menu: { href: "/super-admin/cms/pages", icon: "RiPagesLine", group: "cms" }, actions: [...CRUD] },
  { key: "cms-site-pages", label: "CMS: Δημόσιες σελίδες", surface: "company", menu: { href: "/super-admin/cms/site-pages", icon: "RiLayoutMasonryLine", group: "cms" }, actions: [...CRUD] },
  { key: "cms-pricing", label: "CMS: Τιμές", surface: "company", menu: { href: "/super-admin/cms/pricing", icon: "RiPriceTag3Line", group: "cms" }, actions: [...CRUD] },
  { key: "cms-faq", label: "CMS: FAQ", surface: "company", menu: { href: "/super-admin/cms/faq", icon: "RiQuestionLine", group: "cms" }, actions: [...CRUD] },
  { key: "cms-articles", label: "CMS: Άρθρα", surface: "company", menu: { href: "/super-admin/cms/articles", icon: "RiArticleLine", group: "cms" }, actions: [...CRUD] },
  { key: "cms-authors", label: "CMS: Συγγραφείς", surface: "company", menu: { href: "/super-admin/cms/authors", icon: "RiUserStarLine", group: "cms" }, actions: [...CRUD] },
  { key: "cms-media", label: "CMS: Media", surface: "company", menu: { href: "/super-admin/cms/media", icon: "RiImage2Line", group: "cms" }, actions: [...CRUD] },
  { key: "cms-translations", label: "CMS: Μεταφράσεις", surface: "company", menu: { href: "/super-admin/cms/translations", icon: "RiTranslate2", group: "cms" }, actions: [...CRUD] },
  { key: "cms-newsletter", label: "CMS: Newsletter & συναινέσεις", surface: "company", menu: { href: "/super-admin/cms/newsletter", icon: "RiMailCheckLine", group: "cms" }, actions: [...CRUD] },
  // help — In-app manuals (docs/wiki), one help module per surface, granted to every role.
  { key: "help", label: "Βοήθεια & εγχειρίδια", surface: "company", menu: { href: "/staff/help", icon: "RiQuestionLine", group: "help" }, actions: [...VIEW] },
  // ── Customer surface ──
  // The customer surface serves 4 roles (PROPERTY_ADMIN/OWNER/RESIDENT/VIEWER) whose
  // pages live under different prefixes (/building, /owner, /portal). A module's menu
  // href is single-valued, so role-specific destinations get role-specific modules
  // (owner-*, portal-*) instead of one shared module pointing at the wrong surface.
  { key: "customer-dashboard", label: "Dashboard", surface: "customer", menu: { href: "/building", icon: "RiDashboardLine", group: "core" }, actions: [...VIEW] },
  { key: "customer-properties", label: "Ακίνητά μου", surface: "customer", menu: { href: "/building?s=building", icon: "RiBuildingLine", group: "properties" }, actions: [...CRUD] },
  { key: "customer-units", label: "Μονάδες", surface: "customer", menu: { href: "/owner/units", icon: "RiHome3Line", group: "assets" }, actions: [...CRUD] },
  { key: "customer-income", label: "Λογαριασμοί", surface: "customer", menu: { href: "/owner/payments", icon: "RiMoneyDollarCircleLine", group: "assets" }, actions: [...VIEW] },
  { key: "customer-requests", label: "Αιτήσεις", surface: "customer", menu: { href: "/portal/requests", icon: "RiToolsLine", group: "services" }, actions: [...CRUD] },
  { key: "customer-maintenance", label: "Συντηρήσεις", surface: "customer", menu: { href: "/building?s=maintenance", icon: "RiToolsLine", group: "operations" }, actions: [...CRUD] },
  { key: "customer-communication", label: "Ανακοινώσεις", surface: "customer", menu: { href: "/building?s=communication", icon: "RiNotification2Line", group: "operations" }, actions: [...CRUD] },
  // The manager's PRIVATE supplier list (contact cards) — isolated from the company registry.
  { key: "customer-suppliers", label: "Οι προμηθευτές μου", surface: "customer", menu: { href: "/building/suppliers", icon: "RiTruckLine", group: "operations" }, actions: [...CRUD] },
  { key: "customer-announcements", label: "Ανακοινώσεις", surface: "customer", menu: { href: "/portal/announcements", icon: "RiNotification2Line", group: "operations" }, actions: [...VIEW] },
  { key: "customer-wallet", label: "Πορτοφόλι", surface: "customer", menu: { href: "/portal/wallet", icon: "RiWallet3Line", group: "services" }, actions: [...VIEW] },
  { key: "owner-requests", label: "Αιτήματα", surface: "customer", menu: { href: "/owner/requests", icon: "RiToolsLine", group: "assets" }, actions: [...CRUD] },
  { key: "owner-announcements", label: "Ανακοινώσεις", surface: "customer", menu: { href: "/owner/announcements", icon: "RiNotification2Line", group: "assets" }, actions: [...VIEW] },
  { key: "occupant-building", label: "Το κτήριό μου", surface: "customer", menu: { href: "/building", icon: "RiBuildingLine", group: "assets" }, actions: [...VIEW] },
  { key: "portal-payments", label: "Λογαριασμοί", surface: "customer", menu: { href: "/portal/payments", icon: "RiMoneyDollarCircleLine", group: "services" }, actions: [...VIEW] },
  { key: "portal-files", label: "Αρχεία", surface: "customer", menu: { href: "/portal/files", icon: "RiFileListLine", group: "services" }, actions: [...VIEW] },
  { key: "portal-maintenance", label: "Συντηρήσεις", surface: "customer", menu: { href: "/portal/maintenance", icon: "RiToolsLine", group: "operations" }, actions: [...VIEW] },
  { key: "customer-help", label: "Βοήθεια & οδηγίες", surface: "customer", menu: { href: "/portal/help", icon: "RiQuestionLine", group: "help" }, actions: [...VIEW] },
  { key: "customer-report", label: "Δήλωση βλάβης", surface: "customer", menu: { href: "/report", icon: "RiAlarmWarningLine", group: "core" }, actions: [...VIEW] },
  // ── Marketplace surface (COLLABORATOR = external supplier's users) ──
  { key: "mkt-dashboard", label: "Dashboard", surface: "marketplace", menu: { href: "/marketplace", icon: "RiDashboardLine", group: "core" }, actions: [...VIEW] },
  { key: "mkt-tasks", label: "Αναθέσεις", surface: "marketplace", menu: { href: "/marketplace/requests", icon: "RiToolsLine", group: "tasks" }, actions: [...CRUD] },
  { key: "mkt-rfq", label: "Αιτήματα προσφοράς", surface: "marketplace", menu: { href: "/marketplace/rfq", icon: "RiMoneyEuroCircleLine", group: "tasks" }, actions: [...CRUD] },
  { key: "mkt-work-orders", label: "Συμβάσεις έργου", surface: "marketplace", menu: { href: "/marketplace/work-orders", icon: "RiFileTextLine", group: "tasks" }, actions: [...CRUD] },
  { key: "mkt-report", label: "Δήλωση βλάβης", surface: "marketplace", menu: { href: "/report", icon: "RiAlarmWarningLine", group: "tasks" }, actions: [...VIEW] },
  { key: "mkt-catalog", label: "Υπηρεσίες & προϊόντα", surface: "marketplace", menu: { href: "/marketplace/catalog", icon: "RiPriceTag3Line", group: "business" }, actions: [...CRUD] },
  { key: "mkt-team", label: "Ομάδα", surface: "marketplace", menu: { href: "/marketplace/team", icon: "RiGroupLine", group: "business" }, actions: [...CRUD] },
  { key: "mkt-profile", label: "Προφίλ & ωράρια", surface: "marketplace", menu: { href: "/marketplace/profile", icon: "RiStoreLine", group: "business" }, actions: [...CRUD] },
  { key: "mkt-help", label: "Βοήθεια & οδηγίες", surface: "marketplace", menu: { href: "/marketplace/help", icon: "RiQuestionLine", group: "help" }, actions: [...VIEW] },
  // Legacy keys kept without a menu: EMPLOYEE defaults grant them and
  // /staff/calendar still checks "mkt-calendar" (see that page).
  { key: "mkt-maintenance", label: "Συντηρήσεις (legacy)", surface: "marketplace", actions: [...CRUD] },
  { key: "mkt-calendar", label: "Ημερολόγιο (legacy)", surface: "marketplace", actions: [...VIEW] },
] as const;

/**
 * Sidebar groups — the single source for id, label, icon, colour, default
 * open/closed state and (array order) display order. Modules reference a
 * group by id in `menu.group`; ids missing here fall to the end of the menu.
 */
export const MENU_GROUPS: readonly MenuGroupDef[] = [
  // company surface — workflow order
  { id: "overview",      label: "Επισκόπηση",        icon: "RiDashboardLine",       color: "#0078D4", defaultOpen: true },
  { id: "customers",     label: "Πελάτες & Ακίνητα", icon: "RiCommunityLine",       color: "#8764B8", defaultOpen: true },
  { id: "operations",    label: "Εργασίες",          icon: "RiToolsLine",           color: "#CA5D00", defaultOpen: true },
  { id: "suppliers",     label: "Συνεργάτες",        icon: "RiTeamLine",            color: "#038387", defaultOpen: true },
  { id: "communication", label: "Επικοινωνία",       icon: "RiNotification2Line",   color: "#0F6CBD", defaultOpen: true },
  { id: "financials",    label: "Οικονομικά",        icon: "RiMoneyEuroCircleLine", color: "#107C10", defaultOpen: true },
  { id: "settings",      label: "Ρυθμίσεις",         icon: "RiSettingsLine",        color: "#5C5C5C", defaultOpen: false },
  { id: "softone",       label: "SoftOne",           icon: "RiExchangeLine",        color: "#0F6CBD", defaultOpen: false },
  { id: "cms",           label: "Ιστότοπος (CMS)",   icon: "RiLayoutLine",          color: "#8764b8", defaultOpen: false },
  { id: "help",          label: "Βοήθεια",           icon: "RiQuestionLine",        color: "#038387", defaultOpen: true },
  // customer + marketplace surfaces (unchanged structure)
  { id: "core",          label: "Κεντρικό",          icon: "RiDashboardLine",       color: "#0078D4", defaultOpen: true },
  { id: "properties",    label: "Ακίνητα",           icon: "RiBuildingLine",        color: "#8764B8", defaultOpen: true },
  { id: "assets",        label: "Τα ακίνητά μου",    icon: "RiHome3Line",           color: "#8764B8", defaultOpen: true },
  { id: "services",      label: "Υπηρεσίες",         icon: "RiToolsLine",           color: "#CA5D00", defaultOpen: true },
  { id: "tasks",         label: "Εργασίες",          icon: "RiToolsLine",           color: "#CA5D00", defaultOpen: true },
  { id: "business",      label: "Η επιχείρησή μου",  icon: "RiStoreLine",           color: "#107C10", defaultOpen: true },
];

const all = (): string[] => RBAC_MODULES.flatMap((m) => m.actions.map((a) => permKey(m.key, a)));
const view = (...keys: string[]): string[] => keys.map((k) => permKey(k, "view"));
const crud = (...keys: string[]): string[] =>
  keys.flatMap((k) => (["view", "create", "edit", "delete"] as const).map((a) => permKey(k, a)));

// Mirror today's NAV_BY_ROLE visibility. `view` = read-only surfacing; `crud` = full manage.
export const DEFAULT_PERMISSIONS: RoleDefaults = {
  SUPER_ADMIN: all(),
  ADMIN: [
    ...view("dashboard", "work", "reports"),
    ...crud("properties", "units", "users", "residents", "maintenance", "announcements", "calendar", "managed-items", "managed-buildings", "suppliers", "work-orders", "rfq", "maintenance-program"),
    ...crud("metered-plans", "customer-wallets"),
    ...view("api-costs"), ...crud("settings", "settings-payments", "settings-contracts", "settings-distance", "cms-newsletter"), ...view("help", "report"),
    ...crud("softone-connection", "softone-params", "softone-sync"), ...view("softone-structure"),
  ],
  MANAGER: [
    ...view("dashboard", "work", "calendar", "help", "report"),
    ...crud("properties", "units", "maintenance", "announcements", "managed-items", "managed-buildings", "suppliers", "work-orders", "rfq", "maintenance-program"),
  ],
  EMPLOYEE: [
    ...view("dashboard", "work"),
    ...view("mkt-dashboard", "mkt-calendar", "managed-buildings", "suppliers", "help", "report", "maintenance-program"), ...crud("mkt-tasks", "mkt-maintenance"),
    ...crud("managed-items", "rfq"), ...view("maintenance", "calendar"),
  ],
  PROPERTY_ADMIN: [
    ...view("customer-dashboard", "customer-help", "customer-report"),
    ...crud("customer-properties", "customer-units", "customer-maintenance", "customer-communication", "customer-suppliers"),
    ...view("customer-wallet"),
  ],
  PROPERTY_OWNER: [
    ...view("customer-dashboard", "customer-income", "customer-help", "customer-report"),
    ...crud("owner-requests"),
    // owner-announcements («Ανακοινώσεις») removed as a top-level menu grant — the
    // building-tree sidebar surfaces Ανακοινώσεις per building, and the /owner
    // dashboard shows a consolidated cross-building announcements widget.
  ],
  PROPERTY_RESIDENT: [
    ...view("customer-dashboard"), ...crud("customer-requests"),
    // customer-announcements («Ανακοινώσεις») removed as a top-level menu grant —
    // per-building announcements live in the building tree; the /portal dashboard
    // shows the consolidated announcements widget.
    ...view("portal-payments", "portal-files", "portal-maintenance", "customer-help", "customer-report"),
  ],
  PROPERTY_VIEWER: [
    ...view("customer-dashboard", "customer-announcements"),
  ],
  COLLABORATOR: [
    ...view("mkt-dashboard", "mkt-help", "mkt-report"), ...crud("mkt-tasks", "mkt-rfq", "mkt-work-orders", "mkt-catalog", "mkt-team", "mkt-profile"),
  ],
};

// ── RBAC route-guard coverage (as of dynamic-rbac rollout) ──
// GUARDED (view): customers, users, roles (edit), billing, services, settings, integrations,
//   properties, reports, onboarding, view-as, settings-company, settings-brand, api-costs
//   (via settings/costs/layout.tsx), and all cms-* (landing, seo, settings, pages, pricing,
//   faq, articles, authors, media, translations).
//   Also GUARDED: maintenance (/admin/maintenance + /[id] + /settings) and
//   customer-requests (/portal/requests) via requirePermission.
// NOT YET GUARDED: units/residents/calendar/announcements (no dedicated page.tsx
//   under (company) — menu hrefs point at /admin/* routes that don't exist as pages yet), and
//   all customer-* / mkt-* surface routes (those surfaces still gate by role enum at the layout).
//
// ── Customer-menu module split (role hierarchy rollout) ──
// customer-maintenance/-communication link the PROPERTY_ADMIN building shell
//   (/building?s=…); owner-* link /owner/*; portal-* link /portal/*.
// Seeding: prisma/seed-rbac.ts backfillNewModules() inserts the NEW modules'
//   default rows for already-seeded roles on deploy (per-role, per-module, only when
//   the role has zero rows for that module — idempotent). Defaults REMOVED here
//   (customer-announcements from PROPERTY_ADMIN, customer-requests from PROPERTY_OWNER)
//   are NOT deleted from existing DBs — deployed roles keep those extra menu items
//   (both destinations remain accessible to them) until revoked in /super-admin/roles.
