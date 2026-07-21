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
  // Self-managed building: no company runs it, so the assigned PROPERTY_ADMIN IS the
  // manager and gets full staff-equivalent control — scoped to this specific building.
  if (!managed) return all(true);
  // Company-managed building: the company runs operations; the manager gets only
  // communication + own requests + building-wide reads. Everything else stays off,
  // including editDistribution / manageManagers / manageManagedItems (company-owned).
  return {
    ...all(false),
    manageFiles: true, manageContacts: true, manageAnnouncements: true,
    manageAssemblies: true, manageCalendar: true, createRequests: true, viewAudit: true,
    viewLedger: true,
  };
}
