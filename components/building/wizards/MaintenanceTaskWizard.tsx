"use client";

import { useState } from "react";
import { GuidedFlow, ChoiceCards, SummaryList } from "@/components/ui/guided-flow";
import { FormField, FieldInput, FieldTextarea } from "@/components/ui/modal";
import { SupplierPicker } from "@/components/suppliers/SupplierPicker";
import { createRecurringTask, type TaskFrequency, type MaintenanceKind } from "@/app/actions/recurring-tasks";
import type { SupplierOption } from "@/lib/suppliers-shared";
import {
  RiArrowUpDownLine, RiFireLine, RiShieldFlashLine, RiWindyLine, RiFlashlightLine, RiDropLine, RiToolsLine, RiMoreLine,
  RiCalendarLine, RiCalendarEventLine, RiCalendar2Line, RiCalendarCheckLine, RiCalendarScheduleLine, RiCalendarTodoLine,
} from "react-icons/ri";

const KINDS: { value: MaintenanceKind; label: string; description: string; icon: React.ElementType; title: string; freq: TaskFrequency }[] = [
  { value: "ELEVATOR", label: "Ανελκυστήρας", description: "Μηνιαία συντήρηση από αδειούχο συνεργείο — υποχρεωτική.", icon: RiArrowUpDownLine, title: "Συντήρηση ανελκυστήρα", freq: "MONTHLY" },
  { value: "BOILER", label: "Λέβητας / Καυστήρας", description: "Ετήσια ρύθμιση και καθαρισμός πριν τον χειμώνα.", icon: RiFireLine, title: "Συντήρηση καυστήρα", freq: "ANNUAL" },
  { value: "FIRE_SAFETY", label: "Πυρασφάλεια", description: "Πυροσβεστήρες, φωτισμός ασφαλείας — ετήσιος έλεγχος.", icon: RiShieldFlashLine, title: "Έλεγχος πυρασφάλειας", freq: "ANNUAL" },
  { value: "HVAC", label: "Κλιματισμός", description: "Καθαρισμός/έλεγχος κεντρικών μονάδων.", icon: RiWindyLine, title: "Συντήρηση κλιματισμού", freq: "SEMIANNUAL" },
  { value: "ELECTRICAL", label: "Ηλεκτρολογικά", description: "Πίνακες, κοινόχρηστος φωτισμός, αυτοματισμοί.", icon: RiFlashlightLine, title: "Ηλεκτρολογικός έλεγχος", freq: "ANNUAL" },
  { value: "PLUMBING", label: "Υδραυλικά", description: "Πιεστικό, δεξαμενή, αποχέτευση.", icon: RiDropLine, title: "Έλεγχος υδραυλικών", freq: "SEMIANNUAL" },
  { value: "GENERAL", label: "Καθαρισμός / γενικά", description: "Καθαρισμός κοινοχρήστων, κήπος, απολύμανση.", icon: RiToolsLine, title: "Καθαρισμός κοινοχρήστων", freq: "WEEKLY" },
  { value: "OTHER", label: "Κάτι άλλο", description: "Θα το περιγράψετε εσείς.", icon: RiMoreLine, title: "", freq: "MONTHLY" },
];
const FREQS: { value: TaskFrequency; label: string; description: string; icon: React.ElementType }[] = [
  { value: "WEEKLY", label: "Κάθε εβδομάδα", description: "π.χ. καθαρισμός", icon: RiCalendarLine },
  { value: "MONTHLY", label: "Κάθε μήνα", description: "π.χ. ανελκυστήρας", icon: RiCalendarEventLine },
  { value: "QUARTERLY", label: "Κάθε 3 μήνες", description: "τριμηνιαία", icon: RiCalendar2Line },
  { value: "SEMIANNUAL", label: "Κάθε 6 μήνες", description: "εξαμηνιαία", icon: RiCalendarCheckLine },
  { value: "ANNUAL", label: "Μία φορά τον χρόνο", description: "π.χ. καυστήρας", icon: RiCalendarScheduleLine },
  { value: "CUSTOM", label: "Μία φορά μόνο", description: "χωρίς επανάληψη", icon: RiCalendarTodoLine },
];
const REMINDERS = [
  { value: "3", label: "3 ημέρες πριν", description: "για συχνές εργασίες" },
  { value: "7", label: "1 εβδομάδα πριν", description: "η συνηθισμένη επιλογή" },
  { value: "14", label: "2 εβδομάδες πριν", description: "όταν χρειάζεται ραντεβού" },
  { value: "30", label: "1 μήνα πριν", description: "για ετήσιες εργασίες" },
];
const PACKAGE: { value: "yes" | "no"; label: string; description: string }[] = [
  { value: "yes", label: "Ναι, εντός πακέτου", description: "Την αναλαμβάνει η εταιρεία διαχείρισης χωρίς επιπλέον χρέωση." },
  { value: "no", label: "Όχι", description: "Χρεώνεται ξεχωριστά ή την κάνει δικό σας συνεργείο." },
];

/** Step-by-step recurring maintenance: what → how often → who → reminder → check. */
export function MaintenanceTaskWizard({ buildingId, onClose, onDone, onSimpleForm }: { buildingId: string; onClose: () => void; onDone: () => void; onSimpleForm?: () => void }) {
  const [kind, setKind] = useState<MaintenanceKind | null>(null);
  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState<TaskFrequency | null>(null);
  const [nextDueDate, setNextDueDate] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
  const [vendor, setVendor] = useState("");
  const [inPackage, setInPackage] = useState<"yes" | "no" | null>(null);
  const [reminder, setReminder] = useState<string | null>("7");
  const [notes, setNotes] = useState("");
  const k = KINDS.find((x) => x.value === kind);
  const supplierName = supplierOptions.find((o) => o.id === supplierId)?.name ?? "";

  return (
    <GuidedFlow title="Νέα συντήρηση — βήμα προς βήμα" onClose={onClose} onSimpleForm={onSimpleForm} finishLabel="Αποθήκευση στο ημερολόγιο"
      steps={[
        {
          key: "kind", title: "Τι θέλετε να συντηρείται τακτικά;",
          help: "Διαλέξτε την κατηγορία. Θα προτείνουμε όνομα και συχνότητα — μπορείτε να τα αλλάξετε.",
          render: () => (
            <>
              <ChoiceCards options={KINDS} value={kind} onChange={(v) => { setKind(v); const d = KINDS.find((x) => x.value === v)!; if (!title.trim() || KINDS.some((x) => x.title === title)) setTitle(d.title); if (!frequency) setFrequency(d.freq); }} />
              {kind && <FormField label="Όνομα εργασίας" required><FieldInput value={title} onChange={setTitle} placeholder="π.χ. Συντήρηση ανελκυστήρα" /></FormField>}
            </>
          ),
          validate: () => (!kind ? "Επιλέξτε κατηγορία" : !title.trim() ? "Γράψτε ένα όνομα για την εργασία" : null),
        },
        {
          key: "freq", title: "Κάθε πότε γίνεται;",
          help: "Μετά από κάθε «Ολοκλήρωση» το ημερολόγιο υπολογίζει μόνο του την επόμενη ημερομηνία.",
          render: () => (
            <>
              <ChoiceCards options={FREQS} value={frequency} onChange={setFrequency} columns={3} />
              <FormField label="Πότε είναι η επόμενη φορά;" hint="Αν δεν ξέρετε ακριβώς, βάλτε μια εκτίμηση — θα λάβετε υπενθύμιση."><FieldInput type="date" value={nextDueDate} onChange={setNextDueDate} /></FormField>
            </>
          ),
          validate: () => (!frequency ? "Επιλέξτε συχνότητα" : null),
        },
        {
          key: "who", title: "Ποιος την αναλαμβάνει;",
          help: "Διαλέξτε από τους προμηθευτές σας ή την εταιρεία διαχείρισης. Αν δεν είναι στη λίστα, γράψτε απλώς το όνομα του συνεργείου.",
          render: () => (
            <>
              <FormField label="Προμηθευτής / συνεργείο"><SupplierPicker buildingId={buildingId} value={supplierId} onChange={setSupplierId} placeholder="— Επιλέξτε από τη λίστα —" onOptions={setSupplierOptions} /></FormField>
              <FormField label="…ή γράψτε το όνομα" hint="π.χ. KLEEMANN, Καθαριστική ΑΕ"><FieldInput value={vendor} onChange={setVendor} /></FormField>
              <FormField label="Περιλαμβάνεται στο πακέτο υπηρεσιών της εταιρείας διαχείρισης;"><ChoiceCards options={PACKAGE} value={inPackage} onChange={setInPackage} /></FormField>
            </>
          ),
          validate: () => (inPackage ? null : "Απαντήστε αν είναι εντός πακέτου"),
        },
        {
          key: "reminder", title: "Πότε να σας θυμίζουμε;",
          help: "Η υπενθύμιση έρχεται με email και στο καμπανάκι της εφαρμογής, πριν την επόμενη ημερομηνία.",
          render: () => (
            <>
              <ChoiceCards options={REMINDERS} value={reminder} onChange={setReminder} />
              <FormField label="Σημειώσεις (προαιρετικά)"><FieldTextarea value={notes} onChange={setNotes} rows={2} placeholder="π.χ. Το κλειδί του μηχανοστασίου είναι στον θυρωρό" /></FormField>
            </>
          ),
        },
        {
          key: "check", title: "Έλεγχος",
          help: "Αν κάτι δεν είναι σωστό, πατήστε «Πίσω». Μετά την αποθήκευση θα εμφανιστεί στο ημερολόγιο του κτηρίου.",
          render: () => (
            <SummaryList rows={[
              ["Εργασία", title], ["Κατηγορία", k?.label], ["Συχνότητα", FREQS.find((f) => f.value === frequency)?.label],
              ["Επόμενη φορά", nextDueDate ? new Date(nextDueDate).toLocaleDateString("el-GR") : "θα οριστεί αργότερα"],
              ["Ανάδοχος", [supplierName, vendor].filter(Boolean).join(" · ") || "—"], ["Εντός πακέτου", inPackage === "yes" ? "Ναι" : "Όχι"],
              ["Υπενθύμιση", REMINDERS.find((r) => r.value === reminder)?.label], ["Σημειώσεις", notes],
            ]} />
          ),
        },
      ]}
      onFinish={async () => {
        const res = await createRecurringTask(buildingId, {
          title: title.trim(), frequency: frequency!, nextDueDate: nextDueDate || null,
          supplierId: supplierId || null, vendor: vendor || null, notes: notes || null,
          kind: kind!, inServicePackage: inPackage === "yes", reminderDaysBefore: Number(reminder ?? 7),
        });
        if (res && "error" in res && res.error) return { error: res.error };
        onDone();
      }}
    />
  );
}
