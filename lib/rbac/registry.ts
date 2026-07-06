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
  { key: "roles", label: "Ρόλοι", surface: "company", menu: { href: "/super-admin/roles", icon: "RiShieldUserLine", group: "management" }, actions: [...CRUD] },
  { key: "services", label: "Υπηρεσίες", surface: "company", menu: { href: "/super-admin/services", icon: "RiServiceLine", group: "financials" }, actions: [...CRUD] },
  { key: "api-costs", label: "Κόστη API", surface: "company", menu: { href: "/super-admin/settings/costs", icon: "RiMoneyDollarCircleLine", group: "financials" }, actions: [...VIEW] },
  { key: "billing", label: "Τιμολόγηση", surface: "company", menu: { href: "/super-admin/billing", icon: "RiFileListLine", group: "financials" }, actions: [...CRUD] },
  { key: "maintenance", label: "Συντηρήσεις", surface: "company", menu: { href: "/admin/maintenance", icon: "RiToolsLine", group: "operations" }, actions: [...CRUD] },
  { key: "announcements", label: "Ανακοινώσεις", surface: "company", menu: { href: "/admin/announcements", icon: "RiNotification2Line", group: "operations" }, actions: [...CRUD] },
  { key: "calendar", label: "Ημερολόγιο", surface: "company", menu: { href: "/admin/calendar", icon: "RiCalendarLine", group: "operations" }, actions: [...CRUD] },
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
  { key: "customer-dashboard", label: "Dashboard", surface: "customer", menu: { href: "/building", icon: "RiDashboardLine", group: "core" }, actions: [...VIEW] },
  { key: "customer-properties", label: "Ακίνητά μου", surface: "customer", menu: { href: "/manager/properties", icon: "RiBuildingLine", group: "properties" }, actions: [...CRUD] },
  { key: "customer-units", label: "Μονάδες", surface: "customer", menu: { href: "/manager/units", icon: "RiHome3Line", group: "properties" }, actions: [...CRUD] },
  { key: "customer-income", label: "Έσοδα", surface: "customer", menu: { href: "/owner/income", icon: "RiMoneyDollarCircleLine", group: "assets" }, actions: [...VIEW] },
  { key: "customer-requests", label: "Αιτήσεις", surface: "customer", menu: { href: "/portal/requests", icon: "RiToolsLine", group: "services" }, actions: [...CRUD] },
  { key: "customer-maintenance", label: "Συντηρήσεις", surface: "customer", menu: { href: "/portal/maintenance", icon: "RiToolsLine", group: "operations" }, actions: [...CRUD] },
  { key: "customer-announcements", label: "Ανακοινώσεις", surface: "customer", menu: { href: "/portal/announcements", icon: "RiNotification2Line", group: "operations" }, actions: [...VIEW] },
  // ── Marketplace surface ──
  { key: "mkt-dashboard", label: "Dashboard", surface: "marketplace", menu: { href: "/staff", icon: "RiDashboardLine", group: "core" }, actions: [...VIEW] },
  { key: "mkt-tasks", label: "Assigned", surface: "marketplace", menu: { href: "/staff/tasks", icon: "RiFileListLine", group: "tasks" }, actions: [...CRUD] },
  { key: "mkt-maintenance", label: "Συντηρήσεις", surface: "marketplace", menu: { href: "/staff/maintenance", icon: "RiToolsLine", group: "tasks" }, actions: [...CRUD] },
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
    ...crud("properties", "units", "users", "residents", "maintenance", "announcements", "calendar"),
    ...view("api-costs"), ...crud("settings"),
  ],
  MANAGER: [
    ...view("dashboard"),
    ...crud("properties", "units", "maintenance", "announcements"),
  ],
  EMPLOYEE: [
    ...view("mkt-dashboard"), ...crud("mkt-tasks", "mkt-maintenance"),
  ],
  PROPERTY_ADMIN: [
    ...view("customer-dashboard"),
    ...crud("customer-properties", "customer-units", "customer-maintenance"),
    ...view("customer-announcements"),
  ],
  PROPERTY_OWNER: [
    ...view("customer-dashboard", "customer-income"), ...crud("customer-units"),
  ],
  PROPERTY_RESIDENT: [
    ...view("customer-dashboard"), ...crud("customer-requests"), ...view("customer-announcements"),
  ],
  PROPERTY_VIEWER: [
    ...view("customer-dashboard", "customer-announcements"),
  ],
  COLLABORATOR: [
    ...view("mkt-dashboard"), ...crud("mkt-tasks", "mkt-maintenance"),
  ],
};
