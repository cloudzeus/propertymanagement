/** Capability flags for one building, as seen by the current viewer. */
export type BuildingCaps = {
  editUnits: boolean; editMillesimes: boolean; editDistribution: boolean;
  manageExpenses: boolean; manageKoinochrista: boolean; managePayments: boolean;
  manageFiles: boolean; manageContacts: boolean; manageAnnouncements: boolean;
  manageAssemblies: boolean; manageCalendar: boolean; manageInfra: boolean;
  manageManagedItems: boolean; manageMaintenance: boolean; createRequests: boolean;
  viewAudit: boolean; manageManagers: boolean;
  /** Building-wide financial/person reads (ledger, per-person statements, expense
   *  drafts, targets, heating readings). Staff + assigned managers only — occupants
   *  get their own scoped loaders instead. */
  viewLedger: boolean;
};

const all = (v: boolean): BuildingCaps => ({
  editUnits: v, editMillesimes: v, editDistribution: v,
  manageExpenses: v, manageKoinochrista: v, managePayments: v,
  manageFiles: v, manageContacts: v, manageAnnouncements: v,
  manageAssemblies: v, manageCalendar: v, manageInfra: v,
  manageManagedItems: v, manageMaintenance: v, createRequests: v,
  viewAudit: v, manageManagers: v, viewLedger: v,
});

export const NO_CAPS: BuildingCaps = all(false);

export function capsForStaff(): BuildingCaps {
  return all(true);
}

/** Owners/residents inside their own building: view everything public, mutate nothing. */
export const OCCUPANT_CAPS: BuildingCaps = { ...NO_CAPS, createRequests: true };

/** PROPERTY_ADMIN caps. `managed` = the company manages the building (property.managed). */
export function capsForManager(managed: boolean): BuildingCaps {
  return {
    ...all(!managed),
    // Communication + own requests + building-wide reads are always allowed:
    manageFiles: true, manageContacts: true, manageAnnouncements: true,
    manageAssemblies: true, manageCalendar: true, createRequests: true, viewAudit: true,
    viewLedger: true,
    // Company-owned settings are never manager-editable:
    editDistribution: false, manageManagers: false,
    // Managed items exist only on managed buildings (company catalog) — always view-only for managers:
    manageManagedItems: false,
  };
}
