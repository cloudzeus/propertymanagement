import type { RbacModule, RoleDefaults } from "./types";
import { permKey } from "./types";

const CRUD = ["view", "create", "edit", "delete"] as const;
const VIEW = ["view"] as const;

export const RBAC_MODULES: readonly RbacModule[] = [
  // ── Company surface ──
  { key: "dashboard", label: "Dashboard", surface: "company", menu: { href: "/super-admin", icon: "RiDashboardLine", group: "core" }, actions: [...VIEW] },
  { key: "reports", label: "Αναφορές", surface: "company", menu: { href: "/super-admin/reports", icon: "RiBarChartLine", group: "core" }, actions: [...VIEW] },
  { key: "onboarding", label: "Νέα πολυκατοικία (AI)", surface: "company", menu: { href: "/super-admin/onboarding", icon: "RiRobot2Line", group: "management" }, actions: [...CRUD] },
  { key: "customers", label: "Πελάτες", surface: "company", menu: { href: "/super-admin/customers", icon: "RiContactsLine", group: "management" }, actions: [...CRUD] },
  { key: "properties", label: "Ιδιοκτησίες", surface: "company", menu: { href: "/super-admin/properties", icon: "RiCommunityLine", group: "management" }, actions: [...CRUD] },
  { key: "units", label: "Μονάδες", surface: "company", menu: { href: "/super-admin/units", icon: "RiHome3Line", group: "management" }, actions: [...CRUD] },
  { key: "users", label: "Χρήστες", surface: "company", menu: { href: "/super-admin/users", icon: "RiGroupLine", group: "management" }, actions: [...CRUD] },
  { key: "residents", label: "Ενοικιαστές", surface: "company", menu: { href: "/admin/residents", icon: "RiUserLine", group: "management" }, actions: [...CRUD] },
  { key: "managed-items", label: "Στοιχεία Διαχείρισης", surface: "company", menu: { href: "/super-admin/managed-items", icon: "RiListCheck2", group: "management" }, actions: [...CRUD] },
  { key: "roles", label: "Ρόλοι", surface: "company", menu: { href: "/super-admin/roles", icon: "RiShieldUserLine", group: "management" }, actions: [...CRUD] },
  { key: "services", label: "Υπηρεσίες", surface: "company", menu: { href: "/super-admin/services", icon: "RiServiceLine", group: "financials" }, actions: [...CRUD] },
  { key: "api-costs", label: "AI Κόστη / Tokens", surface: "company", menu: { href: "/super-admin/settings/costs", icon: "RiMoneyDollarCircleLine", group: "financials" }, actions: [...VIEW] },
  { key: "billing", label: "Τιμολόγηση", surface: "company", menu: { href: "/super-admin/billing", icon: "RiFileListLine", group: "financials" }, actions: [...CRUD] },
  { key: "ai-tools", label: "AI Tools & APIs", surface: "company", menu: { href: "/super-admin/ai-tools", icon: "RiRobot2Line", group: "financials" }, actions: [...CRUD] },
  { key: "company-wallet", label: "Company Wallet", surface: "company", menu: { href: "/super-admin/billing/company-wallet", icon: "RiWallet3Line", group: "financials" }, actions: [...CRUD] },
  { key: "metered-plans", label: "Πακέτα Χρεώσεων", surface: "company", menu: { href: "/admin/metered-plans", icon: "RiPriceTag3Line", group: "financials" }, actions: [...CRUD] },
  { key: "customer-wallets", label: "Πορτοφόλια Πελατών", surface: "company", menu: { href: "/admin/customer-wallets", icon: "RiMoneyEuroCircleLine", group: "financials" }, actions: [...CRUD] },
  { key: "maintenance", label: "Συντηρήσεις", surface: "company", menu: { href: "/admin/maintenance", icon: "RiToolsLine", group: "operations" }, actions: [...CRUD] },
  { key: "announcements", label: "Ανακοινώσεις", surface: "company", menu: { href: "/admin/announcements", icon: "RiNotification2Line", group: "operations" }, actions: [...CRUD] },
  { key: "calendar", label: "Ημερολόγιο", surface: "company", menu: { href: "/staff/calendar", icon: "RiCalendarLine", group: "operations" }, actions: [...CRUD] },
  { key: "integrations", label: "Ενσωματώσεις", surface: "company", menu: { href: "/super-admin/integrations", icon: "RiLinksLine", group: "settings" }, actions: [...CRUD] },
  { key: "settings-company", label: "Εταιρία", surface: "company", menu: { href: "/super-admin/settings/company", icon: "RiBuildingLine", group: "settings" }, actions: [...CRUD] },
  { key: "settings-brand", label: "Brand", surface: "company", menu: { href: "/super-admin/settings/brand", icon: "RiPaletteLine", group: "settings" }, actions: [...CRUD] },
  { key: "settings", label: "Ρυθμίσεις", surface: "company", menu: { href: "/super-admin/settings", icon: "RiSettingsLine", group: "settings" }, actions: [...CRUD] },
  { key: "cms-landing", label: "CMS: Αρχική", surface: "company", menu: { href: "/super-admin/cms/landing", icon: "RiLayoutLine", group: "cms" }, actions: [...CRUD] },
  { key: "cms-seo", label: "CMS: SEO", surface: "company", menu: { href: "/super-admin/cms/seo", icon: "RiSearchEyeLine", group: "cms" }, actions: [...CRUD] },
  { key: "cms-settings", label: "CMS: Ρυθμίσεις", surface: "company", menu: { href: "/super-admin/cms/settings", icon: "RiSettings3Line", group: "cms" }, actions: [...CRUD] },
  { key: "cms-pages", label: "CMS: Σελίδες", surface: "company", menu: { href: "/super-admin/cms/pages", icon: "RiPagesLine", group: "cms" }, actions: [...CRUD] },
  { key: "cms-pricing", label: "CMS: Τιμές", surface: "company", menu: { href: "/super-admin/cms/pricing", icon: "RiPriceTag3Line", group: "cms" }, actions: [...CRUD] },
  { key: "cms-faq", label: "CMS: FAQ", surface: "company", menu: { href: "/super-admin/cms/faq", icon: "RiQuestionLine", group: "cms" }, actions: [...CRUD] },
  { key: "cms-articles", label: "CMS: Άρθρα", surface: "company", menu: { href: "/super-admin/cms/articles", icon: "RiArticleLine", group: "cms" }, actions: [...CRUD] },
  { key: "cms-authors", label: "CMS: Συγγραφείς", surface: "company", menu: { href: "/super-admin/cms/authors", icon: "RiUserStarLine", group: "cms" }, actions: [...CRUD] },
  { key: "cms-media", label: "CMS: Media", surface: "company", menu: { href: "/super-admin/cms/media", icon: "RiImage2Line", group: "cms" }, actions: [...CRUD] },
  { key: "cms-translations", label: "CMS: Μεταφράσεις", surface: "company", menu: { href: "/super-admin/cms/translations", icon: "RiTranslate2", group: "cms" }, actions: [...CRUD] },
  { key: "view-as", label: "View as…", surface: "company", menu: { href: "/super-admin/view-as", icon: "RiEyeLine", group: "preview" }, actions: [...VIEW] },
  // ── Customer surface ──
  // The customer surface serves 4 roles (PROPERTY_ADMIN/OWNER/RESIDENT/VIEWER) whose
  // pages live under different prefixes (/building, /owner, /portal). A module's menu
  // href is single-valued, so role-specific destinations get role-specific modules
  // (owner-*, portal-*) instead of one shared module pointing at the wrong surface.
  { key: "customer-dashboard", label: "Dashboard", surface: "customer", menu: { href: "/building", icon: "RiDashboardLine", group: "core" }, actions: [...VIEW] },
  { key: "customer-properties", label: "Ακίνητά μου", surface: "customer", menu: { href: "/building?s=building", icon: "RiBuildingLine", group: "properties" }, actions: [...CRUD] },
  { key: "customer-units", label: "Μονάδες", surface: "customer", menu: { href: "/owner/units", icon: "RiHome3Line", group: "assets" }, actions: [...CRUD] },
  { key: "customer-income", label: "Πληρωμές", surface: "customer", menu: { href: "/owner/payments", icon: "RiMoneyDollarCircleLine", group: "assets" }, actions: [...VIEW] },
  { key: "customer-requests", label: "Αιτήσεις", surface: "customer", menu: { href: "/portal/requests", icon: "RiToolsLine", group: "services" }, actions: [...CRUD] },
  { key: "customer-maintenance", label: "Συντηρήσεις", surface: "customer", menu: { href: "/building?s=maintenance", icon: "RiToolsLine", group: "operations" }, actions: [...CRUD] },
  { key: "customer-communication", label: "Ανακοινώσεις", surface: "customer", menu: { href: "/building?s=communication", icon: "RiNotification2Line", group: "operations" }, actions: [...CRUD] },
  { key: "customer-announcements", label: "Ανακοινώσεις", surface: "customer", menu: { href: "/portal/announcements", icon: "RiNotification2Line", group: "operations" }, actions: [...VIEW] },
  { key: "customer-wallet", label: "Πορτοφόλι", surface: "customer", menu: { href: "/portal/wallet", icon: "RiWallet3Line", group: "services" }, actions: [...VIEW] },
  { key: "owner-requests", label: "Αιτήματα", surface: "customer", menu: { href: "/owner/requests", icon: "RiToolsLine", group: "assets" }, actions: [...CRUD] },
  { key: "owner-announcements", label: "Ανακοινώσεις", surface: "customer", menu: { href: "/owner/announcements", icon: "RiNotification2Line", group: "assets" }, actions: [...VIEW] },
  { key: "portal-payments", label: "Πληρωμές", surface: "customer", menu: { href: "/portal/payments", icon: "RiMoneyDollarCircleLine", group: "services" }, actions: [...VIEW] },
  { key: "portal-files", label: "Αρχεία", surface: "customer", menu: { href: "/portal/files", icon: "RiFileListLine", group: "services" }, actions: [...VIEW] },
  { key: "portal-maintenance", label: "Συντηρήσεις", surface: "customer", menu: { href: "/portal/maintenance", icon: "RiToolsLine", group: "operations" }, actions: [...VIEW] },
  // ── Marketplace surface ──
  { key: "mkt-dashboard", label: "Dashboard", surface: "marketplace", menu: { href: "/staff", icon: "RiDashboardLine", group: "core" }, actions: [...VIEW] },
  { key: "mkt-tasks", label: "Assigned", surface: "marketplace", menu: { href: "/staff/tasks", icon: "RiFileListLine", group: "tasks" }, actions: [...CRUD] },
  { key: "mkt-maintenance", label: "Συντηρήσεις", surface: "marketplace", menu: { href: "/staff/maintenance", icon: "RiToolsLine", group: "tasks" }, actions: [...CRUD] },
  { key: "mkt-calendar", label: "Ημερολόγιο", surface: "marketplace", menu: { href: "/staff/calendar", icon: "RiCalendarLine", group: "tasks" }, actions: [...VIEW] },
] as const;

const all = (): string[] => RBAC_MODULES.flatMap((m) => m.actions.map((a) => permKey(m.key, a)));
const view = (...keys: string[]): string[] => keys.map((k) => permKey(k, "view"));
const crud = (...keys: string[]): string[] =>
  keys.flatMap((k) => (["view", "create", "edit", "delete"] as const).map((a) => permKey(k, a)));

// Mirror today's NAV_BY_ROLE visibility. `view` = read-only surfacing; `crud` = full manage.
export const DEFAULT_PERMISSIONS: RoleDefaults = {
  SUPER_ADMIN: all(),
  ADMIN: [
    ...view("dashboard", "reports"),
    ...crud("properties", "units", "users", "residents", "maintenance", "announcements", "calendar", "managed-items"),
    ...crud("metered-plans", "customer-wallets"),
    ...view("api-costs"), ...crud("settings"),
  ],
  MANAGER: [
    ...view("dashboard", "calendar"),
    ...crud("properties", "units", "maintenance", "announcements", "managed-items"),
  ],
  EMPLOYEE: [
    ...view("mkt-dashboard", "mkt-calendar"), ...crud("mkt-tasks", "mkt-maintenance"),
  ],
  PROPERTY_ADMIN: [
    ...view("customer-dashboard"),
    ...crud("customer-properties", "customer-units", "customer-maintenance", "customer-communication"),
    ...view("customer-wallet"),
  ],
  PROPERTY_OWNER: [
    ...view("customer-dashboard", "customer-income"), ...crud("customer-units"),
    ...crud("owner-requests"),
    ...view("owner-announcements", "customer-wallet"),
  ],
  PROPERTY_RESIDENT: [
    ...view("customer-dashboard"), ...crud("customer-requests"),
    ...view("customer-announcements", "customer-wallet", "portal-payments", "portal-files", "portal-maintenance"),
  ],
  PROPERTY_VIEWER: [
    ...view("customer-dashboard", "customer-announcements"),
  ],
  COLLABORATOR: [
    ...view("mkt-dashboard"), ...crud("mkt-tasks", "mkt-maintenance"),
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
