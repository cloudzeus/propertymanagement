/**
 * Registry of everything staff (and a self-managed PROPERTY_ADMIN) can do on a
 * building, grouped for the «Ενέργειες» menu of the building page. Pure and
 * client-safe: no React, no Prisma. The host (components/building/actions)
 * maps each key to the modal it opens; this module only decides WHAT exists
 * and WHO sees it (BuildingCaps + building flags).
 *
 * Deep link: `/super-admin/buildings/<id>?action=<key>` (or `/building/<id>?action=…`)
 * opens the modal straight away — the work center, the AI assistant and the
 * quick-actions FAB use `buildingActionHref`.
 */
import type { BuildingCaps } from "./building-caps";

export type BuildingActionGroup = "units" | "finance" | "maintenance" | "communication" | "readings" | "building";

export const GROUP_ORDER: readonly BuildingActionGroup[] = ["units", "finance", "maintenance", "communication", "readings", "building"];
export const GROUP_LABELS: Record<BuildingActionGroup, string> = {
  units: "Μονάδες & άτομα",
  finance: "Οικονομικά",
  maintenance: "Συντήρηση",
  communication: "Επικοινωνία",
  readings: "Μετρήσεις",
  building: "Κτήριο & ρυθμίσεις",
};

export type BuildingActionKey =
  | "unit-new" | "occupant-assign" | "contact-new" | "manager-add"
  | "expense-new" | "koino-issue" | "payment" | "statement" | "millesimes-calc"
  | "fault-new" | "rfq-new" | "appointment" | "task-new" | "managed-item-new"
  | "announcement-new" | "assembly-new" | "printables"
  | "heating-readings" | "meter-readings"
  | "file-upload" | "infra-new" | "building-edit" | "millesimes-grid" | "distribution" | "exclusions" | "split-settings" | "audit";

export type BuildingAction = {
  key: BuildingActionKey;
  label: string;
  /** react-icons/ri name; resolved to a component by the host. */
  icon: string;
  group: BuildingActionGroup;
  /** Capability that must be on for the action to show. */
  cap: keyof BuildingCaps;
  /** Short hint under the label (search box also matches it). */
  hint?: string;
  /** Only on buildings the company manages (property.managed). */
  managedOnly?: boolean;
  /** Only on buildings with metered heating. */
  meteredOnly?: boolean;
  /** Needs the work-action viewer (fault dialogs). Hidden when the page has none. */
  needsWorkViewer?: boolean;
  /** The server action behind it is SUPER_ADMIN-only (building master data). */
  superAdminOnly?: boolean;
  /** Part of the short list shown in building rows (DataTable row actions). */
  basic?: boolean;
  /** Opens a page in a new tab instead of a modal (print hub). */
  external?: boolean;
};

export const BUILDING_ACTIONS: readonly BuildingAction[] = [
  // ── Μονάδες & άτομα ──────────────────────────────────────────────────────
  { key: "unit-new", label: "Νέα μονάδα", icon: "RiHome4Line", group: "units", cap: "editUnits", basic: true, hint: "Διαμέρισμα, κατάστημα, πάρκινγκ" },
  { key: "occupant-assign", label: "Ανάθεση ιδιοκτήτη / ενοίκου", icon: "RiUserStarLine", group: "units", cap: "editUnits", basic: true, hint: "Επιλέξτε μονάδα και πρόσωπο" },
  { key: "contact-new", label: "Νέα επαφή", icon: "RiContactsBook3Line", group: "units", cap: "manageContacts", hint: "Συνεργεία, ανελκυστήρας, ΔΕΗ…" },
  { key: "manager-add", label: "Προσθήκη διαχειριστή", icon: "RiUserSettingsLine", group: "units", cap: "manageManagers" },
  // ── Οικονομικά ───────────────────────────────────────────────────────────
  { key: "expense-new", label: "Νέα δαπάνη", icon: "RiMoneyEuroCircleLine", group: "finance", cap: "manageExpenses", basic: true, hint: "Παραστατικό με OCR ή χειροκίνητα" },
  { key: "koino-issue", label: "Έκδοση κοινοχρήστων", icon: "RiWallet3Line", group: "finance", cap: "manageKoinochrista", basic: true, hint: "Συμπερίληψη δαπανών σε μήνα" },
  { key: "payment", label: "Είσπραξη / απόδειξη", icon: "RiSecurePaymentLine", group: "finance", cap: "managePayments", hint: "Καταχώρηση πληρωμής προσώπου" },
  { key: "statement", label: "Καρτέλα προσώπου", icon: "RiFileListLine", group: "finance", cap: "viewLedger", hint: "Χρεώσεις, πληρωμές, υπόλοιπο" },
  { key: "millesimes-calc", label: "Υπολογισμός χιλιοστών", icon: "RiCalculatorLine", group: "finance", cap: "editMillesimes", hint: "Από τα τετραγωνικά" },
  // ── Συντήρηση ────────────────────────────────────────────────────────────
  { key: "fault-new", label: "Δήλωση βλάβης", icon: "RiAlarmWarningLine", group: "maintenance", cap: "createRequests", basic: true },
  { key: "rfq-new", label: "Αίτημα προσφοράς σε συνεργάτες", icon: "RiTeamLine", group: "maintenance", cap: "manageMaintenance", needsWorkViewer: true, hint: "Για ανοιχτή βλάβη" },
  { key: "appointment", label: "Ραντεβού για βλάβη", icon: "RiCalendarCheckLine", group: "maintenance", cap: "manageMaintenance", needsWorkViewer: true },
  { key: "task-new", label: "Προγραμματισμένη συντήρηση", icon: "RiCalendarTodoLine", group: "maintenance", cap: "manageCalendar", hint: "Επαναλαμβανόμενη εργασία" },
  { key: "managed-item-new", label: "Νέο διαχειριζόμενο στοιχείο", icon: "RiListCheck2", group: "maintenance", cap: "manageManagedItems", managedOnly: true },
  // ── Επικοινωνία ──────────────────────────────────────────────────────────
  { key: "announcement-new", label: "Νέα ανακοίνωση", icon: "RiMegaphoneLine", group: "communication", cap: "manageAnnouncements", basic: true },
  { key: "assembly-new", label: "Πρόσκληση συνέλευσης", icon: "RiGroupLine", group: "communication", cap: "manageAssemblies" },
  { key: "printables", label: "Εκτυπωτικά", icon: "RiPrinterLine", group: "communication", cap: "viewLedger", external: true, hint: "Ειδοποιητήρια, αποδείξεις, πρακτικά (νέα καρτέλα)" },
  // ── Μετρήσεις ────────────────────────────────────────────────────────────
  { key: "heating-readings", label: "Ενδείξεις θέρμανσης", icon: "RiFireLine", group: "readings", cap: "editMillesimes", meteredOnly: true },
  { key: "meter-readings", label: "Ενδείξεις μετρητών", icon: "RiSpeedUpLine", group: "readings", cap: "viewLedger", hint: "Από τα παραστατικά" },
  // ── Κτήριο & ρυθμίσεις ───────────────────────────────────────────────────
  { key: "file-upload", label: "Ανέβασμα αρχείου", icon: "RiUploadCloud2Line", group: "building", cap: "manageFiles" },
  { key: "infra-new", label: "Νέο σημείο εγκατάστασης", icon: "RiSettings3Line", group: "building", cap: "manageInfra", hint: "Λεβητοστάσιο, μετρητές, κλειδιά" },
  { key: "building-edit", label: "Στοιχεία κτηρίου", icon: "RiEditLine", group: "building", cap: "editUnits", superAdminOnly: true, hint: "Διεύθυνση, όροφοι, εξοπλισμός" },
  { key: "millesimes-grid", label: "Χιλιοστά ανά μονάδα", icon: "RiScales3Line", group: "building", cap: "editMillesimes" },
  { key: "distribution", label: "Κατανομές ανά κατηγορία", icon: "RiPieChartLine", group: "building", cap: "editDistribution" },
  { key: "exclusions", label: "Αποκλεισμοί μονάδων", icon: "RiForbidLine", group: "building", cap: "editDistribution" },
  { key: "split-settings", label: "Ποσοστά ενοικιαστή / ιδιοκτήτη", icon: "RiPercentLine", group: "building", cap: "editDistribution" },
  { key: "audit", label: "Έλεγχος καταχωρήσεων", icon: "RiStethoscopeLine", group: "building", cap: "viewAudit" },
];

export type BuildingFlags = { managed: boolean; metered: boolean; hasWorkViewer?: boolean; superAdmin?: boolean };

const KEYS = new Set<string>(BUILDING_ACTIONS.map((a) => a.key));
export function isBuildingActionKey(s: string | null | undefined): s is BuildingActionKey {
  return !!s && KEYS.has(s);
}

export function getBuildingAction(key: BuildingActionKey): BuildingAction {
  return BUILDING_ACTIONS.find((a) => a.key === key)!;
}

/** Every action the viewer may run on this building, in registry (= group) order. */
export function resolveBuildingActions(can: BuildingCaps, flags: BuildingFlags): BuildingAction[] {
  return BUILDING_ACTIONS.filter((a) =>
    can[a.cap]
    && (!a.managedOnly || flags.managed)
    && (!a.meteredOnly || flags.metered)
    && (!a.needsWorkViewer || !!flags.hasWorkViewer)
    && (!a.superAdminOnly || !!flags.superAdmin),
  );
}

/** The short list for building rows in lists (deep-linked). */
export function basicBuildingActions(can: BuildingCaps, flags: BuildingFlags): BuildingAction[] {
  return resolveBuildingActions(can, flags).filter((a) => a.basic);
}

/** Actions grouped in GROUP_ORDER; empty groups are dropped. */
export function groupBuildingActions(actions: BuildingAction[]): { group: BuildingActionGroup; label: string; actions: BuildingAction[] }[] {
  return GROUP_ORDER
    .map((g) => ({ group: g, label: GROUP_LABELS[g], actions: actions.filter((a) => a.group === g) }))
    .filter((g) => g.actions.length > 0);
}

/** Lower-case, accent-stripped (Greek tonos and Latin diacritics) for matching. */
export function normalizeForSearch(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/ς/g, "σ");
}

/** Substring match on label, hint and group label; an empty query returns everything. */
export function filterBuildingActions(actions: BuildingAction[], query: string): BuildingAction[] {
  const q = normalizeForSearch(query.trim());
  if (!q) return actions;
  return actions.filter((a) => normalizeForSearch(`${a.label} ${a.hint ?? ""} ${GROUP_LABELS[a.group]}`).includes(q));
}

/** Show the search box once the menu is long enough to need it. */
export const SEARCH_THRESHOLD = 12;

/** Deep link that opens the modal on the building page. `base` = page href without query. */
export function buildingActionHref(base: string, key: BuildingActionKey): string {
  return `${base}?action=${key}`;
}

export const BUILDING_ACTION_PARAM = "action";
