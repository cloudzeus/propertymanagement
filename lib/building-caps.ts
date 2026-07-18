/** Capability flags for one building, as seen by the current viewer. */
export type BuildingCaps = {
  editUnits: boolean; editMillesimes: boolean; editDistribution: boolean;
  manageExpenses: boolean; manageKoinochrista: boolean; managePayments: boolean;
  manageFiles: boolean; manageContacts: boolean; manageAnnouncements: boolean;
  manageAssemblies: boolean; manageCalendar: boolean; manageInfra: boolean;
  manageManagedItems: boolean; manageMaintenance: boolean; createRequests: boolean;
  viewAudit: boolean; manageManagers: boolean;
};

const all = (v: boolean): BuildingCaps => ({
  editUnits: v, editMillesimes: v, editDistribution: v,
  manageExpenses: v, manageKoinochrista: v, managePayments: v,
  manageFiles: v, manageContacts: v, manageAnnouncements: v,
  manageAssemblies: v, manageCalendar: v, manageInfra: v,
  manageManagedItems: v, manageMaintenance: v, createRequests: v,
  viewAudit: v, manageManagers: v,
});

export const NO_CAPS: BuildingCaps = all(false);

export function capsForStaff(): BuildingCaps {
  return all(true);
}

/** PROPERTY_ADMIN caps. `managed` = the company manages the building (property.managed). */
export function capsForManager(managed: boolean): BuildingCaps {
  return {
    ...all(!managed),
    // Communication + own requests are always allowed:
    manageFiles: true, manageContacts: true, manageAnnouncements: true,
    manageAssemblies: true, manageCalendar: true, createRequests: true, viewAudit: true,
    // Company-owned settings are never manager-editable:
    editDistribution: false, manageManagers: false,
  };
}
