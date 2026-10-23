"use client";

/**
 * Renders the modal for the active building action — always IN PLACE, never a
 * page or tab change. Every modal here is the one the corresponding panel
 * already uses (exported from it); this file only wires subjects (unit,
 * person, open fault) in front of the ones that need them.
 */
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { BuildingDashboardData } from "@/lib/building/dashboard-data";
import type { BuildingCaps } from "@/lib/building-caps";
import type { BuildingActionKey } from "@/lib/building-actions";
import type { AuditTab } from "@/lib/buildings/audit";
import { EMPTY_FLAGS, type WorkDialog, type WorkSubject } from "@/lib/work/actions";
import type { WorkActionViewer } from "@/lib/work/scope";
import { STATUS_LABELS, PRIORITY_LABELS, type FaultStatus, type FaultPriority } from "@/lib/maintenance-shared";
import { listManagers, type ManagerRow } from "@/app/actions/managers";
import { getBuildingForEdit } from "@/app/actions/buildings";
import { UnitModal, MillesimesModal, OccupantsModal, type Unit } from "@/components/building/UnitsPanel";
import { OccupantWizard } from "@/components/building/wizards/OccupantWizard";
import { ContactModal } from "@/components/building/ContactsPanel";
import { AddManagerModal } from "@/components/building/ManagersPanel";
import { ExpenseUploadFlow } from "@/components/buildings/ExpenseUploadFlow";
import { IssuanceModal } from "@/components/buildings/IssuanceModal";
import { PersonStatementModal } from "@/components/buildings/PersonStatementModal";
import { NewRequestModal } from "@/components/maintenance/new-request-form";
import { WorkActionHost, type OpenRequest } from "@/components/work/WorkActionHost";
import { MaintenanceTaskWizard } from "@/components/building/wizards/MaintenanceTaskWizard";
import { TaskModal } from "@/components/building/CalendarPanel";
import { ManagedItemModal } from "@/components/building/ManagedItemsPanel";
import { AnnouncementWizard } from "@/components/building/wizards/AnnouncementWizard";
import { AnnouncementFormModal } from "@/components/building/AnnouncementsPanel";
import { AssemblyWizard } from "@/components/building/wizards/AssemblyWizard";
import { AssemblyFormModal } from "@/components/building/AssembliesPanel";
import { HeatingReadingsPanel } from "@/components/building/HeatingReadingsPanel";
import { MeterReadingsPanel } from "@/components/building/MeterReadingsPanel";
import { FileUploadModal } from "@/components/building/FileUploadModal";
import { InfraModal } from "@/components/building/InfraPanel";
import { BuildingModal, type BuildingFormValues, type PropertyAddress } from "@/components/buildings/BuildingModal";
import { MillesimeGrid } from "@/components/building/MillesimeGrid";
import { DistributionTab } from "@/components/building/DistributionTab";
import { ExclusionMatrix } from "@/components/building/ExclusionMatrix";
import { CategorySplitSettings } from "@/components/buildings/CategorySplitSettings";
import { AuditDrawer } from "@/components/building/AuditDrawer";
import { PickerModal } from "./PickerModal";
import { MillesimesWizard } from "@/components/wizards/MillesimesWizard";
import { CommonAreaWizard } from "@/components/wizards/CommonAreaWizard";

export type BuildingActionHostProps = {
  active: BuildingActionKey | null;
  data: BuildingDashboardData;
  can: BuildingCaps;
  /** Needed for the fault dialogs (RFQ, appointment); without it those actions are not offered. */
  workViewer?: WorkActionViewer | null;
  /** Where a freshly created fault lives for this surface (e.g. "/admin/maintenance"). */
  faultDetailBase: string;
  onGoToTab?: (tab: AuditTab) => void;
  onClose: () => void;
  /** Called after a successful mutation; the hook refreshes and toasts. */
  onDone: (message: string) => void;
};

const CLOSED_FAULT = new Set(["COMPLETED", "CANCELLED"]);

export function BuildingActionHost(props: BuildingActionHostProps) {
  const { active } = props;
  if (!active) return null;
  // Remount per action so no state leaks between two openings.
  return <ActiveAction key={active} {...props} active={active} />;
}

function ActiveAction({ active, data, can, workViewer, faultDetailBase, onGoToTab, onClose, onDone }: BuildingActionHostProps & { active: BuildingActionKey }) {
  const { building } = data;
  const buildingId = building.id;

  switch (active) {
    // ── Μονάδες & άτομα ───────────────────────────────────────────────────
    case "unit-new":
      return <UnitModal buildingId={buildingId} editing={null} onClose={onClose} onDone={() => onDone("Η μονάδα δημιουργήθηκε.")} />;
    case "occupant-assign":
      return <OccupantFlow units={data.units} onClose={onClose} onDone={onDone} />;
    case "contact-new":
      return <ContactModal buildingId={buildingId} editing={null} onClose={onClose} onDone={() => onDone("Η επαφή αποθηκεύτηκε.")} />;
    case "manager-add":
      return <ManagerAddFlow buildingId={buildingId} managed={building.propertyManaged} onClose={onClose} onDone={onDone} />;
    // ── Οικονομικά ────────────────────────────────────────────────────────
    case "expense-new":
      return (
        <Modal open onClose={onClose} title="Νέα δαπάνη" width={760}>
          <ExpenseUploadFlow buildingId={buildingId} categories={data.categorySplits} onDone={() => onDone("Η δαπάνη καταχωρήθηκε.")} />
        </Modal>
      );
    case "koino-issue":
      return <IssuanceModal buildingId={buildingId} expenses={data.expenses} onClose={onClose} onDone={({ count, month }) => onDone(`${count} έξοδα συμπεριλήφθηκαν στην έκδοση ${month}.`)} />;
    case "payment":
    case "statement":
      return <PersonFlow buildingId={buildingId} people={data.people} canPay={active === "payment" ? can.managePayments : can.managePayments} title={active === "payment" ? "Είσπραξη / απόδειξη" : "Καρτέλα προσώπου"} onClose={onClose} onChanged={() => onDone("Η πληρωμή καταχωρήθηκε.")} />;
    case "millesimes-calc":
      return (
        <WizardOrForm
          wizard={(p) => <MillesimesWizard buildingId={buildingId} units={data.millesimeUnits} building={{ hasElevator: building.hasElevator, elevatorSurchargePerFloor: building.elevatorSurchargePerFloor, elevatorExemptGroundFloor: building.elevatorExemptGroundFloor }} usesMeteredHeating={data.usesMeteredHeating} {...p} />}
          form={(p) => <MillesimesModal units={data.units} buildingId={buildingId} {...p} />}
          onClose={onClose} onDone={() => onDone("Τα χιλιοστά εφαρμόστηκαν.")} />
      );
    // ── Συντήρηση ─────────────────────────────────────────────────────────
    case "fault-new":
      return (
        <NewRequestModal open onClose={onClose} stay
          buildings={[{ id: buildingId, name: building.name, units: data.units.map((u) => ({ id: u.id, label: u.unitNumber })) }]}
          categories={data.maintenanceCategories} detailBase={faultDetailBase}
          onCreated={() => onDone("Η βλάβη δηλώθηκε.")} />
      );
    case "rfq-new":
    case "appointment":
      if (!workViewer) return null;
      return <FaultDialogFlow dialog={active === "rfq-new" ? "create-rfq" : "appointment"} requests={data.maintenanceRequests} viewer={workViewer} onClose={onClose} onDone={onDone} />;
    case "task-new":
      return <TaskFlow buildingId={buildingId} onClose={onClose} onDone={onDone} />;
    case "managed-item-new":
      return (
        <WizardOrForm
          wizard={(p) => <CommonAreaWizard buildingId={buildingId} itemTypes={data.managedItemTypes} floorOptions={data.floorOptions} services={data.packageServices} currentCommonAreas={data.commonAreas.length} {...p} />}
          form={(p) => <ManagedItemModal buildingId={buildingId} itemTypes={data.managedItemTypes} floorOptions={data.floorOptions} commonAreas={data.commonAreas} editing={null} {...p} />}
          onClose={onClose} onDone={() => onDone("Ο κοινόχρηστος χώρος και τα στοιχεία του προστέθηκαν.")} />
      );
    // ── Επικοινωνία ───────────────────────────────────────────────────────
    case "announcement-new":
      return <WizardOrForm wizard={(p) => <AnnouncementWizard buildingId={buildingId} {...p} />} form={(p) => <AnnouncementFormModal buildingId={buildingId} {...p} />} onClose={onClose} onDone={() => onDone("Η ανακοίνωση δημοσιεύτηκε.")} />;
    case "assembly-new":
      return <WizardOrForm wizard={(p) => <AssemblyWizard buildingId={buildingId} units={data.millesimeUnits.map((u) => ({ unitNumber: u.unitNumber, millesimes: u.millesimes }))} {...p} />} form={(p) => <AssemblyFormModal buildingId={buildingId} {...p} />} onClose={onClose} onDone={() => onDone("Η συνέλευση δημιουργήθηκε.")} />;
    case "printables":
      return null; // opens /print in a new tab (handled by the hook)
    // ── Μετρήσεις ─────────────────────────────────────────────────────────
    case "heating-readings":
      return (
        <Modal open onClose={onClose} title="Ενδείξεις θέρμανσης" width={960}>
          <HeatingReadingsPanel buildingId={buildingId} period={data.heatingPeriod} rows={data.heatingReadingRows} heatingMeterUnit={building.heatingMeterUnit ?? null} can={can} />
        </Modal>
      );
    case "meter-readings":
      return (
        <Modal open onClose={onClose} title="Ενδείξεις μετρητών" width={960}>
          <MeterReadingsPanel rows={data.meterReadingRows} />
        </Modal>
      );
    // ── Κτήριο & ρυθμίσεις ────────────────────────────────────────────────
    case "file-upload":
      return <FileUploadModal buildingId={buildingId} onClose={onClose} onDone={(n) => onDone(n === 1 ? "Το αρχείο ανέβηκε." : `${n} αρχεία ανέβηκαν.`)} />;
    case "infra-new":
      return <InfraModal buildingId={buildingId} floorOptions={data.floorOptions} editing={null} onClose={onClose} onDone={() => onDone("Το σημείο αποθηκεύτηκε.")} />;
    case "building-edit":
      return <BuildingEditFlow buildingId={buildingId} onClose={onClose} onDone={onDone} />;
    case "millesimes-grid":
      return (
        <Modal open onClose={onClose} title="Χιλιοστά ανά μονάδα" width={1100}>
          <MillesimeGrid buildingId={buildingId} units={data.millesimeUnits} elevatorSurchargePerFloor={building.elevatorSurchargePerFloor} elevatorExemptGroundFloor={building.elevatorExemptGroundFloor} can={can} />
        </Modal>
      );
    case "distribution":
      return (
        <Modal open onClose={onClose} title="Κατανομές ανά κατηγορία" width={900}>
          <DistributionTab buildingId={buildingId} categories={data.expenseCategories} overrides={data.categoryOverrides} can={can} />
        </Modal>
      );
    case "exclusions":
      return (
        <Modal open onClose={onClose} title="Αποκλεισμοί μονάδων" width={1000}>
          <ExclusionMatrix buildingId={buildingId} units={data.exclusionUnits} categories={data.expenseCategories} exclusions={data.unitExclusions} can={can} />
        </Modal>
      );
    case "split-settings":
      return (
        <Modal open onClose={onClose} title="Ποσοστά ενοικιαστή / ιδιοκτήτη" width={900}>
          <CategorySplitSettings buildingId={buildingId} rows={data.categorySplits} can={can} />
        </Modal>
      );
    case "audit":
      return <AuditDrawer buildingId={buildingId} open hideTrigger onOpenChange={(o) => { if (!o) onClose(); }} onGoToTab={onGoToTab} />;
    default:
      return null;
  }
}

// ── Flows with a picker in front ────────────────────────────────────────────

function OccupantFlow({ units, onClose, onDone }: { units: Unit[]; onClose: () => void; onDone: (m: string) => void }) {
  const [unit, setUnit] = useState<Unit | null>(units.length === 1 ? units[0] : null);
  const [guided, setGuided] = useState<"OWNER" | "RESIDENT" | null>(null);
  if (!unit) {
    return (
      <PickerModal title="Ανάθεση ιδιοκτήτη / ενοίκου — επιλογή μονάδας" hint="Επιλέξτε τη μονάδα· στο επόμενο βήμα ορίζετε ιδιοκτήτη και ένοικο."
        items={units.map((u) => ({ id: u.id, title: `Μονάδα ${u.unitNumber}`, subtitle: [u.owner ? `Ιδιοκτήτης: ${u.owner.name ?? u.owner.email}` : "Χωρίς ιδιοκτήτη", u.resident ? `Ένοικος: ${u.resident.name ?? u.resident.email}` : null].filter(Boolean).join(" · "), badge: u.floor != null ? `Όροφος ${u.floor}` : null }))}
        emptyText="Δεν υπάρχουν μονάδες — δημιουργήστε πρώτα μια «Νέα μονάδα»." onPick={(id) => setUnit(units.find((u) => u.id === id) ?? null)} onClose={onClose} />
    );
  }
  if (guided) {
    return <OccupantWizard unitId={unit.id} unitNumber={unit.unitNumber} customerId={unit.customerId} initialRole={guided} onClose={() => setGuided(null)} onDone={() => onDone("Η ανάθεση ολοκληρώθηκε.")} />;
  }
  return <OccupantsModal unit={unit} onClose={onClose} onDone={() => onDone("Η ανάθεση αποθηκεύτηκε.")} onGuided={(role) => setGuided(role)} />;
}

function PersonFlow({ buildingId, people, canPay, title, onClose, onChanged }: { buildingId: string; people: BuildingDashboardData["people"]; canPay: boolean; title: string; onClose: () => void; onChanged: () => void }) {
  const [userId, setUserId] = useState<string | null>(null);
  const REL: Record<string, string> = { OWNER: "Ιδιοκτήτης", RESIDENT: "Ένοικος", BOTH: "Ιδιοκτήτης & Ένοικος" };
  if (!userId) {
    return (
      <PickerModal title={`${title} — επιλογή προσώπου`} hint="Επιλέξτε ιδιοκτήτη ή ένοικο του κτηρίου."
        items={people.map((p) => ({ id: p.id, title: p.name ?? p.email, subtitle: p.unitsHere.map((u) => `Μον. ${u.unitNumber}`).join(", ") || p.email, badge: REL[p.relation] ?? p.relation }))}
        emptyText="Δεν υπάρχουν πρόσωπα στο κτήριο — αναθέστε πρώτα ιδιοκτήτες/ενοίκους στις μονάδες." onPick={setUserId} onClose={onClose} />
    );
  }
  return <PersonStatementModal open onClose={onClose} buildingId={buildingId} userId={userId} canPay={canPay} onChanged={onChanged} />;
}

function FaultDialogFlow({ dialog, requests, viewer, onClose, onDone }: { dialog: WorkDialog; requests: BuildingDashboardData["maintenanceRequests"]; viewer: WorkActionViewer; onClose: () => void; onDone: (m: string) => void }) {
  const [request, setRequest] = useState<OpenRequest | null>(null);
  const open = requests.filter((r) => !CLOSED_FAULT.has(r.status));
  const title = dialog === "create-rfq" ? "Αίτημα προσφοράς — επιλογή βλάβης" : "Ραντεβού — επιλογή βλάβης";
  if (!request) {
    return (
      <PickerModal title={title} hint="Οι ενέργειες αυτές αφορούν μια ανοιχτή βλάβη του κτηρίου."
        items={open.map((r) => ({ id: r.id, title: r.title, subtitle: [r.unitNumber ? `Μονάδα ${r.unitNumber}` : "Κοινόχρηστος χώρος", r.categoryName, PRIORITY_LABELS[r.priority as FaultPriority] ?? r.priority].filter(Boolean).join(" · "), badge: STATUS_LABELS[r.status as FaultStatus] ?? r.status }))}
        emptyText="Δεν υπάρχουν ανοιχτές βλάβες — κάντε πρώτα «Δήλωση βλάβης»."
        onPick={(id) => {
          const r = open.find((x) => x.id === id)!;
          const subject: WorkSubject = { kind: "fault", id: r.id, status: r.status, handledBy: "COMPANY", assigneeId: null, supplierId: null, flags: EMPTY_FLAGS };
          setRequest({ seq: Date.now(), dialog, subject });
        }}
        onClose={onClose} />
    );
  }
  return <WorkActionHost request={request} viewer={viewer} onClose={onClose} onDone={onDone} />;
}

function TaskFlow({ buildingId, onClose, onDone }: { buildingId: string; onClose: () => void; onDone: (m: string) => void }) {
  const [simple, setSimple] = useState(false);
  if (!simple) return <MaintenanceTaskWizard buildingId={buildingId} onClose={onClose} onDone={() => onDone("Η εργασία προγραμματίστηκε.")} onSimpleForm={() => setSimple(true)} />;
  return <TaskModal buildingId={buildingId} editing={null} onClose={onClose} onComplete={() => {}} onDone={() => onDone("Η εργασία προγραμματίστηκε.")} />;
}

function WizardOrForm({ wizard, form, onClose, onDone }: {
  wizard: (p: { onClose: () => void; onDone: () => void; onSimpleForm: () => void }) => React.ReactNode;
  form: (p: { onClose: () => void; onDone: () => void }) => React.ReactNode;
  onClose: () => void; onDone: () => void;
}) {
  const [simple, setSimple] = useState(false);
  return <>{simple ? form({ onClose, onDone }) : wizard({ onClose, onDone, onSimpleForm: () => setSimple(true) })}</>;
}

function ManagerAddFlow({ buildingId, managed, onClose, onDone }: { buildingId: string; managed: boolean; onClose: () => void; onDone: (m: string) => void }) {
  const [rows, setRows] = useState<ManagerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { listManagers({ buildingId }).then(setRows).catch((e) => setError(e instanceof Error ? e.message : "Σφάλμα")); }, [buildingId]);
  if (error) return <Modal open onClose={onClose} title="Προσθήκη διαχειριστή"><p role="alert" style={{ margin: 0, fontSize: "var(--fs-13)", color: "var(--destructive)" }}>{error}</p></Modal>;
  if (!rows) return <Modal open onClose={onClose} title="Προσθήκη διαχειριστή"><p style={{ margin: 0, fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>Φόρτωση…</p></Modal>;
  return <AddManagerModal scope={{ buildingId }} managed={managed} assignedIds={new Set(rows.map((m) => m.id))} onClose={onClose} onDone={() => onDone("Ο διαχειριστής προστέθηκε.")} />;
}

function BuildingEditFlow({ buildingId, onClose, onDone }: { buildingId: string; onClose: () => void; onDone: (m: string) => void }) {
  const [state, setState] = useState<{ building: BuildingFormValues & { propertyId: string }; propertyAddress: PropertyAddress } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { getBuildingForEdit(buildingId).then(setState).catch((e) => setError(e instanceof Error ? e.message : "Σφάλμα")); }, [buildingId]);
  if (error) return <Modal open onClose={onClose} title="Στοιχεία κτηρίου"><p role="alert" style={{ margin: 0, fontSize: "var(--fs-13)", color: "var(--destructive)" }}>{error}</p></Modal>;
  if (!state) return <Modal open onClose={onClose} title="Στοιχεία κτηρίου"><p style={{ margin: 0, fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>Φόρτωση…</p></Modal>;
  return <BuildingModal propertyId={state.building.propertyId} editing={state.building} propertyAddress={state.propertyAddress} onClose={onClose} onDone={() => onDone("Τα στοιχεία του κτηρίου αποθηκεύτηκαν.")} />;
}
