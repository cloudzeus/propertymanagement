/* Serializable DTOs shared between server pages and client maintenance components. */

export type FaultListItem = {
  id: string;
  title: string;
  status: string;
  priority: string;
  handledBy: string;
  categoryName: string | null;
  buildingName: string;
  unitLabel: string | null;
  reporterName: string | null;
  assigneeName: string | null;
  slaDueAt: string | null;
  scheduledDate: string | null;
  createdAt: string;
};

export type FaultAttachment = { id: string; url: string; kind: string };
export type FaultComment = { id: string; body: string; internal: boolean; authorName: string | null; authorId: string | null; createdAt: string };
export type FaultEvent = { id: string; fromStatus: string | null; toStatus: string; note: string | null; byName: string | null; createdAt: string };
export type FaultSlot = { id: string; side: string; startAt: string; status: string; offeredByName: string | null };
export type FaultAppointment = { id: string; startAt: string; endAt: string; status: string; managerPresence: boolean };

export type FaultDetail = FaultListItem & {
  description: string;
  restrictedAccess: boolean;
  managerPresence: boolean;
  estimatedMinutes: number | null;
  completedAt: string | null;
  attachments: FaultAttachment[];
  comments: FaultComment[];
  events: FaultEvent[];
  slots: FaultSlot[];
  appointments: FaultAppointment[];
};

export type Viewer = {
  id: string;
  role: string;
  isStaff: boolean;      // SUPER_ADMIN/ADMIN/MANAGER/EMPLOYEE
  canManage: boolean;    // αλλαγή κατάστασης κ.λπ.
  canAssign: boolean;    // ADMIN/MANAGER/SUPER_ADMIN
};

export type EmployeeOption = { id: string; name: string };
export type CategoryOption = { id: string; name: string };
export type BuildingOption = { id: string; name: string; units: { id: string; label: string }[] };
