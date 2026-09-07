/**
 * Context-aware quick actions for the floating menu (bottom-left of every app
 * page). Pure + client-safe: given the current path, the role and the set of
 * menu hrefs the user is allowed to see, return the 3–5 most useful shortcuts
 * for THAT screen — never the same list everywhere.
 *
 * `kind: "expense"` opens the OCR expense modal; everything else navigates.
 */
export type QuickAction = { key: string; label: string; icon: string; href?: string; kind?: "expense"; hint?: string };

type Ctx = { pathname: string; role: string; allowed: Set<string>; canExpense: boolean };

const A = {
  report: { key: "report", label: "Δήλωση βλάβης", icon: "RiAlarmWarningLine", href: "/report", hint: "Με φωτογραφία από το κινητό" },
  expense: { key: "expense", label: "Νέο έξοδο", icon: "RiMoneyEuroCircleLine", kind: "expense" as const, hint: "OCR τιμολογίου" },
  faults: { key: "faults", label: "Βλάβες & συντηρήσεις", icon: "RiToolsLine", href: "/admin/maintenance" },
  workOrders: { key: "work-orders", label: "Συμβάσεις έργου", icon: "RiFileTextLine", href: "/admin/work-orders" },
  programme: { key: "programme", label: "Ετήσιο πρόγραμμα", icon: "RiCalendarTodoLine", href: "/admin/maintenance-program" },
  calendar: { key: "calendar", label: "Ημερολόγιο", icon: "RiCalendarLine", href: "/staff/calendar" },
  announcement: { key: "announcement", label: "Νέα ανακοίνωση", icon: "RiNotification2Line", href: "/admin/announcements" },
  suppliers: { key: "suppliers", label: "Συνεργάτες", icon: "RiTeamLine", href: "/super-admin/suppliers" },
  catalog: { key: "catalog", label: "Κατάλογος υπηρεσιών", icon: "RiPriceTag3Line", href: "/super-admin/suppliers/catalog" },
  customers: { key: "customers", label: "Πελάτες", icon: "RiContactsLine", href: "/super-admin/customers" },
  properties: { key: "properties", label: "Ιδιοκτησίες", icon: "RiCommunityLine", href: "/super-admin/properties" },
  onboarding: { key: "onboarding", label: "Νέα πολυκατοικία (AI)", icon: "RiRobot2Line", href: "/super-admin/onboarding" },
  users: { key: "users", label: "Χρήστες", icon: "RiGroupLine", href: "/super-admin/users" },
  roles: { key: "roles", label: "Ρόλοι & δικαιώματα", icon: "RiShieldUserLine", href: "/super-admin/roles" },
  contracts: { key: "contracts", label: "Προσφορές & συμβάσεις", icon: "RiFileTextLine", href: "/super-admin/settings/contracts" },
  maintSettings: { key: "maint-settings", label: "Ρυθμίσεις συντηρήσεων", icon: "RiSettings3Line", href: "/admin/maintenance/settings" },
  cron: { key: "cron", label: "Αυτόματες εργασίες", icon: "RiTimerLine", href: "/super-admin/settings/cron" },
  managedBuildings: { key: "managed", label: "Διαχειριζόμενα κτήρια", icon: "RiBuilding2Line", href: "/super-admin/managed-buildings" },
  cmsLanding: { key: "cms-landing", label: "Αρχική σελίδα", icon: "RiLayoutLine", href: "/super-admin/cms/landing" },
  cmsArticles: { key: "cms-articles", label: "Νέο άρθρο", icon: "RiArticleLine", href: "/super-admin/cms/articles" },
  cmsMedia: { key: "cms-media", label: "Media", icon: "RiImage2Line", href: "/super-admin/cms/media" },
  cmsNewsletter: { key: "cms-newsletter", label: "Newsletter & συναινέσεις", icon: "RiMailCheckLine", href: "/super-admin/cms/newsletter" },
  billing: { key: "billing", label: "Τιμολόγηση", icon: "RiFileListLine", href: "/super-admin/billing" },
  help: { key: "help", label: "Βοήθεια", icon: "RiQuestionLine", href: "/staff/help" },
  // customer surface
  mySuppliers: { key: "my-suppliers", label: "Οι προμηθευτές μου", icon: "RiTruckLine", href: "/building/suppliers" },
  myMaintenance: { key: "my-maint", label: "Συντηρήσεις", icon: "RiToolsLine", href: "/building?s=maintenance" },
  myAnnouncement: { key: "my-ann", label: "Ανακοίνωση", icon: "RiNotification2Line", href: "/building?s=communication" },
  customerHelp: { key: "customer-help", label: "Βοήθεια", icon: "RiQuestionLine", href: "/portal/help" },
  ownerPayments: { key: "owner-pay", label: "Λογαριασμοί", icon: "RiMoneyDollarCircleLine", href: "/owner/payments" },
  ownerRequests: { key: "owner-req", label: "Τα αιτήματά μου", icon: "RiToolsLine", href: "/owner/requests" },
  portalPayments: { key: "portal-pay", label: "Λογαριασμοί", icon: "RiMoneyDollarCircleLine", href: "/portal/payments" },
  portalRequests: { key: "portal-req", label: "Τα αιτήματά μου", icon: "RiToolsLine", href: "/portal/requests" },
  portalFiles: { key: "portal-files", label: "Αρχεία", icon: "RiFileListLine", href: "/portal/files" },
  // marketplace
  mktRfq: { key: "mkt-rfq", label: "Αιτήματα προσφοράς", icon: "RiMoneyEuroCircleLine", href: "/marketplace/rfq" },
  mktWo: { key: "mkt-wo", label: "Συμβάσεις έργου", icon: "RiFileTextLine", href: "/marketplace/work-orders" },
  mktTasks: { key: "mkt-tasks", label: "Αναθέσεις", icon: "RiToolsLine", href: "/marketplace/requests" },
  mktCatalog: { key: "mkt-catalog", label: "Υπηρεσίες & τιμές", icon: "RiPriceTag3Line", href: "/marketplace/catalog" },
  mktTeam: { key: "mkt-team", label: "Ομάδα", icon: "RiGroupLine", href: "/marketplace/team" },
  mktProfile: { key: "mkt-profile", label: "Προφίλ & ωράρια", icon: "RiStoreLine", href: "/marketplace/profile" },
  mktHelp: { key: "mkt-help", label: "Βοήθεια", icon: "RiQuestionLine", href: "/marketplace/help" },
} satisfies Record<string, QuickAction>;

const STAFF = ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"];

/** Section title shown at the top of the menu. */
export function quickActionsTitle(pathname: string, role: string): string {
  if (pathname.startsWith("/admin/maintenance-program")) return "Πρόγραμμα συντηρήσεων";
  if (pathname.startsWith("/admin/maintenance") || pathname.startsWith("/admin/work-orders")) return "Βλάβες & συμβάσεις";
  if (pathname.startsWith("/super-admin/suppliers")) return "Συνεργάτες";
  if (pathname.startsWith("/super-admin/cms")) return "CMS";
  if (pathname.startsWith("/super-admin/settings") || pathname.startsWith("/super-admin/roles") || pathname.startsWith("/super-admin/users")) return "Ρυθμίσεις";
  if (pathname.startsWith("/super-admin/customers") || pathname.startsWith("/super-admin/properties") || pathname.startsWith("/super-admin/units") || pathname.startsWith("/super-admin/managed")) return "Πελάτες & ακίνητα";
  if (pathname.startsWith("/super-admin/billing")) return "Οικονομικά";
  if (pathname.startsWith("/staff/calendar")) return "Ημερολόγιο";
  if (pathname.startsWith("/building/suppliers")) return "Προμηθευτές";
  if (pathname.startsWith("/building")) return "Το κτήριο";
  if (pathname.startsWith("/owner")) return "Ιδιοκτήτης";
  if (pathname.startsWith("/portal")) return "Ένοικος";
  if (pathname.startsWith("/marketplace/rfq") || pathname.startsWith("/marketplace/work-orders")) return "Προσφορές & συμβάσεις";
  if (pathname.startsWith("/marketplace")) return "Η επιχείρησή μου";
  return STAFF.includes(role) ? "Γρήγορες ενέργειες" : "Γρήγορες ενέργειες";
}

export function resolveQuickActions(ctx: Ctx): QuickAction[] {
  const { pathname: p, role } = ctx;
  let picks: QuickAction[];

  if (STAFF.includes(role)) {
    if (p.startsWith("/admin/maintenance-program")) picks = [A.faults, A.workOrders, A.calendar, A.suppliers, A.report];
    else if (p.startsWith("/admin/work-orders")) picks = [A.faults, A.contracts, A.suppliers, A.programme];
    else if (p.startsWith("/admin/maintenance")) picks = [A.report, A.workOrders, A.programme, A.maintSettings, A.suppliers];
    else if (p.startsWith("/super-admin/suppliers")) picks = [A.catalog, A.faults, A.workOrders, A.contracts];
    else if (p.startsWith("/super-admin/cms")) picks = [A.cmsArticles, A.cmsMedia, A.cmsLanding, A.cmsNewsletter];
    else if (p.startsWith("/super-admin/settings") || p.startsWith("/super-admin/roles") || p.startsWith("/super-admin/users")) picks = [A.users, A.roles, A.contracts, A.cron];
    else if (p.startsWith("/super-admin/customers") || p.startsWith("/super-admin/properties") || p.startsWith("/super-admin/units")) picks = [A.onboarding, A.expense, A.managedBuildings, A.announcement];
    else if (p.startsWith("/super-admin/managed") || p.startsWith("/super-admin/buildings")) picks = [A.expense, A.programme, A.report, A.announcement];
    else if (p.startsWith("/super-admin/billing")) picks = [A.customers, A.properties, A.billing];
    else if (p.startsWith("/staff/calendar")) picks = [A.programme, A.faults, A.report, A.announcement];
    else if (p.startsWith("/admin/announcements")) picks = [A.properties, A.calendar, A.report];
    else if (p.startsWith("/staff/help")) picks = [A.report, A.faults, A.calendar];
    else picks = [A.report, A.expense, A.faults, A.announcement, A.onboarding]; // dashboards
  } else if (role === "PROPERTY_ADMIN") {
    if (p.startsWith("/building/suppliers")) picks = [A.report, A.myMaintenance, A.expense];
    else if (p.startsWith("/portal/maintenance") || p.includes("s=maintenance")) picks = [A.report, A.mySuppliers, A.expense, A.myAnnouncement];
    else if (p.includes("s=finance") || p.includes("s=expenses")) picks = [A.expense, A.report, A.myMaintenance];
    else picks = [A.report, A.expense, A.myAnnouncement, A.mySuppliers, A.customerHelp];
  } else if (role === "PROPERTY_OWNER") {
    if (p.startsWith("/owner/payments")) picks = [A.report, A.ownerRequests];
    else if (p.startsWith("/owner/requests")) picks = [A.report, A.ownerPayments];
    else picks = [A.report, A.ownerPayments, A.ownerRequests, A.customerHelp];
  } else if (role === "PROPERTY_RESIDENT" || role === "PROPERTY_VIEWER") {
    if (p.startsWith("/portal/payments")) picks = [A.report, A.portalRequests, A.portalFiles];
    else if (p.startsWith("/portal/requests")) picks = [A.report, A.portalPayments];
    else picks = [A.report, A.portalPayments, A.portalRequests, A.customerHelp];
  } else if (role === "COLLABORATOR") {
    if (p.startsWith("/marketplace/rfq")) picks = [A.mktWo, A.mktTasks, A.mktCatalog];
    else if (p.startsWith("/marketplace/work-orders")) picks = [A.mktRfq, A.mktTasks, A.report];
    else if (p.startsWith("/marketplace/requests")) picks = [A.report, A.mktRfq, A.mktWo];
    else if (p.startsWith("/marketplace/catalog") || p.startsWith("/marketplace/profile") || p.startsWith("/marketplace/team")) picks = [A.mktRfq, A.mktTasks, A.mktProfile, A.mktTeam];
    else picks = [A.mktRfq, A.mktWo, A.mktTasks, A.report, A.mktHelp];
  } else {
    picks = [A.report];
  }

  // Keep only what the user may actually open (menu hrefs), the expense modal only for those who can register expenses,
  // and never the page we are already on.
  const base = (h: string) => h.split("?")[0];
  return picks
    .filter((a) => (a.kind === "expense" ? ctx.canExpense : a.href === "/report" || ctx.allowed.has(a.href!) || ctx.allowed.has(base(a.href!)) || (a.key === "cron" && ctx.allowed.has("/super-admin/settings"))))
    .filter((a) => !a.href || base(a.href) !== p.split("?")[0] || a.href.includes("?"))
    .slice(0, 5);
}
