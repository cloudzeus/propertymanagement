"use server";

/**
 * Read-only loader for the shared work-action dialogs (assignment, appointment,
 * RFQ, forward offer, on-behalf acceptance…). One call when a dialog opens,
 * composed from the existing loaders; the mutating actions keep their own guards.
 */
import { db } from "@/lib/db";
import { getEffectiveSession } from "@/lib/auth-effective";
import { getEffectivePermissions, can } from "@/lib/rbac/permissions";
import { COMPANY_ROLES } from "@/lib/roles-constants";
import { managedCustomerIds, listAssignableEmployees } from "@/lib/work/queries";
import { loadFaultDetail } from "@/lib/maintenance-requests";
import { loadRfqPanel, woInclude, workOrderToCompanyDTO } from "@/lib/rfq";
import { listRfqCandidates } from "@/lib/rfq-candidates";
import { describeRank } from "@/lib/supplier-ranking";
import type { RfqDTO, WorkOrderDTO, RfqCandidateDTO } from "@/lib/rfq-shared";
import type { FaultDetail } from "@/components/maintenance/types";

export type RfqPickerData = { candidates: RfqCandidateDTO[]; categories: { id: string; name: string }[]; defaultCategoryId: string | null };

export type WorkActionContext = {
  fault: {
    id: string; title: string; status: string; handledBy: string; assigneeId: string | null; supplierId: string | null; buildingId: string;
    categoryId: string | null; categoryName: string | null; restrictedAccess: boolean; estimatedMinutes: number | null; managerPresence: boolean;
    slots: FaultDetail["slots"]; appointments: FaultDetail["appointments"];
  } | null;
  employees: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  preferredSupplierId: string | null;
  picker: RfqPickerData;
  rfqs: RfqDTO[];
  workOrders: WorkOrderDTO[];
  defaults: { markupPct: number; warrantyMonths: number };
};

const ASSIGN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];
const MODULE: Record<"fault" | "work-order" | "rfq", string> = { fault: "maintenance", "work-order": "work-orders", rfq: "rfq" };
const EMPTY_PICKER: RfqPickerData = { candidates: [], categories: [], defaultCategoryId: null };

export async function loadWorkActionContext(subject: { kind: "fault" | "work-order" | "rfq"; id: string }): Promise<WorkActionContext | { error: string }> {
  const [eff, resolved] = await Promise.all([getEffectiveSession(), getEffectivePermissions()]);
  const role = eff?.user?.role as string | undefined;
  if (!eff?.user?.id || !resolved || !role || !(COMPANY_ROLES as readonly string[]).includes(role)) return { error: "Δεν επιτρέπεται" };
  if (!can(resolved.perms, MODULE[subject.kind], "view")) return { error: "Δεν επιτρέπεται" };
  const userId = eff.user.id as string;

  // Resolve the fault (and building) behind the subject.
  let faultId: string | null = null;
  let buildingId: string | null = null;
  let soleWorkOrder: WorkOrderDTO | null = null;
  if (subject.kind === "fault") faultId = subject.id;
  else if (subject.kind === "work-order") {
    const wo = await db.workOrder.findUnique({ where: { id: subject.id }, include: woInclude });
    if (!wo) return { error: "Δεν βρέθηκε" };
    faultId = wo.maintenanceRequestId; buildingId = wo.buildingId; soleWorkOrder = workOrderToCompanyDTO(wo);
  } else {
    const rfq = await db.serviceRequest.findUnique({ where: { id: subject.id }, select: { id: true, maintenanceRequestId: true, buildingId: true } });
    if (!rfq) return { error: "Δεν βρέθηκε" };
    faultId = rfq.maintenanceRequestId; buildingId = rfq.buildingId;
  }

  const fault = faultId ? await loadFaultDetail(faultId) : null;
  if (subject.kind === "fault" && !fault) return { error: "Δεν βρέθηκε" };
  buildingId = fault?.buildingId ?? buildingId;

  // MANAGER scope: the same customer rule as the lists.
  const managed = await managedCustomerIds(userId, role);
  if (managed && buildingId) {
    const b = await db.building.findUnique({ where: { id: buildingId }, select: { customerId: true } });
    if (!b || !managed.includes(b.customerId)) return { error: "Εκτός εμβέλειας" };
  }

  const canAssign = ASSIGN_ROLES.includes(role);
  const canRfqView = can(resolved.perms, "rfq", "view");
  const canRfqCreate = can(resolved.perms, "rfq", "create");

  const [employees, picker, preferred, panel] = await Promise.all([
    canAssign ? listAssignableEmployees() : Promise.resolve([]),
    faultId && (canAssign || canRfqCreate) ? listRfqCandidates(faultId) : Promise.resolve(EMPTY_PICKER),
    canAssign && fault
      ? db.buildingPreferredSupplier.findMany({ where: { buildingId: fault.buildingId!, OR: [{ categoryId: fault.categoryId ?? "-" }, { categoryId: null }] }, select: { supplierId: true, categoryId: true } })
      : Promise.resolve([] as { supplierId: string; categoryId: string | null }[]),
    faultId && canRfqView ? loadRfqPanel(faultId) : Promise.resolve(null),
  ]);

  const suppliers = canAssign
    ? picker.candidates.map((r) => ({ id: r.id, name: describeRank({ ...r, lat: null, lng: null, preferred: false, lastUsedHere: false, onboarded: true }) }))
    : [];

  return {
    fault: fault
      ? {
          id: fault.id, title: fault.title, status: fault.status, handledBy: fault.handledBy, assigneeId: fault.assigneeId ?? null, supplierId: fault.supplierId ?? null,
          buildingId: fault.buildingId!, categoryId: fault.categoryId ?? null, categoryName: fault.categoryName, restrictedAccess: fault.restrictedAccess,
          estimatedMinutes: fault.estimatedMinutes, managerPresence: fault.managerPresence, slots: fault.slots, appointments: fault.appointments,
        }
      : null,
    employees,
    suppliers,
    preferredSupplierId: (preferred.find((p) => p.categoryId) ?? preferred[0])?.supplierId ?? null,
    picker: canRfqCreate ? picker : EMPTY_PICKER,
    rfqs: panel?.rfqs ?? [],
    workOrders: panel?.workOrders ?? (soleWorkOrder ? [soleWorkOrder] : []),
    defaults: panel?.defaults ?? { markupPct: 15, warrantyMonths: 6 },
  };
}
