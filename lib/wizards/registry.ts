/**
 * Registry of the guided-entry wizards («βήμα-βήμα» flows that end with an
 * «Παράδειγμα εφαρμογής» step, a video and a wiki guide). Pure and
 * client-safe: no React, no Prisma. Consumers: WizardHost (?wizard= deep
 * link), the building «Ενέργειες» registry (lib/building-actions `wizard`
 * field), the quick-actions FAB, the help coverage test and the command
 * palette. Spec: docs/superpowers/specs/2026-10-23-guided-wizards-design.md §3.1.
 */
import type { BuildingCaps } from "@/lib/building-caps";
import { can } from "@/lib/rbac/permissions-core";

export type WizardKey =
  | "customer-new" | "property-new" | "building-new" | "millesimes-setup"
  | "common-area-new" | "service-new" | "package-setup" | "supplier-new"
  // existing step-by-step flows, moved onto the same framework
  | "occupant-assign" | "task-new" | "announcement-new" | "assembly-new";

/** Which id the wizard needs from its context (URL or page). */
export type WizardScope = "global" | "customer" | "property" | "building";

export type WizardDef = {
  key: WizardKey;
  /** Full title shown in the modal header, e.g. «Νέος πελάτης βήμα-βήμα». */
  title: string;
  /** Short label for buttons / FAB / palette. */
  short: string;
  /** react-icons/ri *Line name; resolved to a component by the host. */
  icon: string;
  scope: WizardScope;
  /** RBAC module + action — for global/customer/property scope (client `can`, server guards). */
  permission?: { module: string; action: "create" | "edit" };
  /** BuildingCaps key — for building scope (the «Ενέργειες» menu filters by caps). */
  cap?: keyof BuildingCaps;
  /** The server action behind it is SUPER_ADMIN-only (master data). */
  superAdminOnly?: boolean;
  /** motion-studio composition `Orithon-Guide-<videoKey>-16x9`; key into lib/wizards/videos.ts. */
  videoKey: string;
  /** docs/wiki/guides/<guideSlug>.md */
  guideSlug: string;
  /** Next wizard of the chain offered on the «Έγινε!» screen. */
  next?: WizardKey;
};

export const WIZARD_PARAM = "wizard";

export type WizardCtx = { customerId?: string; propertyId?: string; buildingId?: string };

export const WIZARDS: readonly WizardDef[] = [
  { key: "customer-new", title: "Νέος πελάτης βήμα-βήμα", short: "Νέος πελάτης", icon: "RiUserAddLine", scope: "global", permission: { module: "customers", action: "create" }, superAdminOnly: true, videoKey: "Customer", guideSlug: "guide-customer", next: "property-new" },
  { key: "property-new", title: "Νέα ιδιοκτησία βήμα-βήμα", short: "Νέα ιδιοκτησία", icon: "RiCommunityLine", scope: "customer", permission: { module: "properties", action: "create" }, superAdminOnly: true, videoKey: "Property", guideSlug: "guide-property", next: "building-new" },
  { key: "building-new", title: "Νέο κτήριο με τις μονάδες του", short: "Νέο κτήριο", icon: "RiBuilding2Line", scope: "property", permission: { module: "properties", action: "create" }, superAdminOnly: true, videoKey: "Building", guideSlug: "guide-building", next: "millesimes-setup" },
  { key: "millesimes-setup", title: "Χιλιοστά βήμα-βήμα", short: "Χιλιοστά", icon: "RiScales3Line", scope: "building", cap: "editMillesimes", videoKey: "Millesimes", guideSlug: "guide-millesimes", next: "package-setup" },
  { key: "common-area-new", title: "Νέος κοινόχρηστος χώρος & στοιχεία", short: "Κοινόχρηστος χώρος", icon: "RiDoorOpenLine", scope: "building", cap: "manageManagedItems", videoKey: "CommonArea", guideSlug: "guide-common-area", next: "package-setup" },
  { key: "service-new", title: "Νέα υπηρεσία καταλόγου βήμα-βήμα", short: "Νέα υπηρεσία", icon: "RiServiceLine", scope: "global", permission: { module: "services", action: "create" }, superAdminOnly: true, videoKey: "Service", guideSlug: "guide-service" },
  { key: "package-setup", title: "Πακέτο υπηρεσιών ιδιοκτησίας", short: "Πακέτο υπηρεσιών", icon: "RiPriceTag3Line", scope: "property", permission: { module: "properties", action: "edit" }, videoKey: "Package", guideSlug: "guide-package" },
  { key: "supplier-new", title: "Νέος συνεργάτης βήμα-βήμα", short: "Νέος συνεργάτης", icon: "RiTeamLine", scope: "global", permission: { module: "suppliers", action: "create" }, videoKey: "Supplier", guideSlug: "guide-supplier" },
  { key: "occupant-assign", title: "Ιδιοκτήτης / ένοικος μονάδας", short: "Ιδιοκτήτης / ένοικος", icon: "RiUserStarLine", scope: "building", cap: "editUnits", videoKey: "Occupant", guideSlug: "guide-occupant" },
  { key: "task-new", title: "Νέα τακτική συντήρηση", short: "Τακτική συντήρηση", icon: "RiCalendarTodoLine", scope: "building", cap: "manageCalendar", videoKey: "Task", guideSlug: "guide-task" },
  { key: "announcement-new", title: "Νέα ανακοίνωση", short: "Ανακοίνωση", icon: "RiMegaphoneLine", scope: "building", cap: "manageAnnouncements", videoKey: "Announcement", guideSlug: "guide-announcement" },
  { key: "assembly-new", title: "Πρόσκληση γενικής συνέλευσης", short: "Συνέλευση", icon: "RiGroupLine", scope: "building", cap: "manageAssemblies", videoKey: "Assembly", guideSlug: "guide-assembly" },
];

const BY_KEY = new Map<string, WizardDef>(WIZARDS.map((w) => [w.key, w]));

export function isWizardKey(s: unknown): s is WizardKey {
  return typeof s === "string" && BY_KEY.has(s);
}

export function getWizard(key: WizardKey): WizardDef {
  return BY_KEY.get(key)!;
}

export function nextWizard(key: WizardKey): WizardDef | null {
  const n = getWizard(key).next;
  return n ? getWizard(n) : null;
}

/** Deep link that opens the wizard on `base`; only the given ctx ids are appended. */
export function wizardHref(base: string, key: WizardKey, ctx: WizardCtx = {}): string {
  const parts = [`${WIZARD_PARAM}=${key}`];
  for (const k of ["customerId", "propertyId", "buildingId"] as const) {
    if (ctx[k]) parts.push(`${k}=${encodeURIComponent(ctx[k] as string)}`);
  }
  return `${base}?${parts.join("&")}`;
}

/** Non-building wizards the viewer may open (building ones are gated by BuildingCaps on the building page). */
export function allowedWizards(perms: Set<string>, role: string): WizardKey[] {
  return WIZARDS
    .filter((w) => w.scope !== "building" && w.permission && can(perms, w.permission.module, w.permission.action) && (!w.superAdminOnly || role === "SUPER_ADMIN"))
    .map((w) => w.key);
}
