"use client";

import { useState } from "react";
import { GuidedFlow, ChoiceCards, SummaryList } from "@/components/ui/guided-flow";
import { FormField, FieldInput } from "@/components/ui/modal";
import { createAssembly } from "@/app/actions/assemblies";
import { RiCalendarCheckLine, RiAlarmWarningLine, RiChat3Line } from "react-icons/ri";

type Kind = "REGULAR" | "EXTRA" | "INFO";
const KINDS: { value: Kind; label: string; description: string; icon: React.ElementType; title: string }[] = [
  { value: "REGULAR", label: "Τακτική Γενική Συνέλευση", description: "Η ετήσια συνέλευση: απολογισμός, προϋπολογισμός, εκλογή διαχειριστή.", icon: RiCalendarCheckLine, title: "Τακτική Γενική Συνέλευση" },
  { value: "EXTRA", label: "Έκτακτη Γενική Συνέλευση", description: "Για ένα συγκεκριμένο θέμα που δεν περιμένει (π.χ. μεγάλη επισκευή).", icon: RiAlarmWarningLine, title: "Έκτακτη Γενική Συνέλευση" },
  { value: "INFO", label: "Ενημερωτική συνάντηση", description: "Χωρίς αποφάσεις — ενημέρωση και συζήτηση.", icon: RiChat3Line, title: "Ενημερωτική συνάντηση ενοίκων" },
];
const TIMES = ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30"];

/** Step-by-step assembly: kind → when → check. The video room and minutes are set up automatically. */
export function AssemblyWizard({ buildingId, onClose, onDone, onSimpleForm }: { buildingId: string; onClose: () => void; onDone: () => void; onSimpleForm?: () => void }) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:00");
  const k = KINDS.find((x) => x.value === kind);
  const when = date && time ? new Date(`${date}T${time}`) : null;

  return (
    <GuidedFlow title="Νέα συνέλευση — βήμα προς βήμα" onClose={onClose} onSimpleForm={onSimpleForm} finishLabel="Δημιουργία συνέλευσης"
      steps={[
        {
          key: "kind", title: "Τι είδους συνέλευση;",
          help: "Η συνέλευση γίνεται διαδικτυακά μέσα από την εφαρμογή. Οι συμμετέχοντες λαμβάνουν σύνδεσμο, και στο τέλος τα πρακτικά γράφονται αυτόματα για έγκριση.",
          render: () => <ChoiceCards options={KINDS} value={kind} onChange={(v) => { setKind(v); const d = KINDS.find((x) => x.value === v)!; if (!title.trim() || KINDS.some((x) => x.title === title)) setTitle(`${d.title} ${new Date().getFullYear()}`); }} columns={1} />,
          validate: () => (kind ? null : "Επιλέξτε είδος συνέλευσης"),
        },
        {
          key: "when", title: "Πότε θα γίνει;",
          help: "Διαλέξτε ημέρα και ώρα. Καλό είναι να ενημερώσετε τουλάχιστον 7 ημέρες πριν — μπορείτε να στείλετε πρόσκληση από τις «Ανακοινώσεις».",
          render: () => (
            <>
              <FormField label="Τίτλος" required><FieldInput value={title} onChange={setTitle} placeholder="π.χ. Τακτική Γενική Συνέλευση 2026" /></FormField>
              <FormField label="Ημερομηνία" required><FieldInput type="date" value={date} onChange={setDate} /></FormField>
              <FormField label="Ώρα">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {TIMES.map((t) => (
                    <button key={t} type="button" onClick={() => setTime(t)} style={{ padding: "9px 14px", borderRadius: 999, fontSize: 14, cursor: "pointer", border: `2px solid ${time === t ? "var(--color-primary)" : "var(--border)"}`, background: time === t ? "var(--color-primary)0f" : "var(--card)", color: "var(--foreground)", fontWeight: time === t ? 700 : 500 }}>{t}</button>
                  ))}
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ height: 38, padding: "0 10px", border: "1px solid var(--border)", borderRadius: 999, fontSize: 13, color: "var(--foreground)", background: "var(--card)" }} title="Άλλη ώρα" />
                </div>
              </FormField>
            </>
          ),
          validate: () => (!title.trim() ? "Γράψτε έναν τίτλο" : !date ? "Επιλέξτε ημερομηνία" : when && when.getTime() < Date.now() ? "Η ημερομηνία είναι στο παρελθόν" : null),
        },
        {
          key: "check", title: "Έλεγχος",
          help: "Μετά τη δημιουργία θα βρείτε τη συνέλευση στη λίστα με τον σύνδεσμο συμμετοχής. Στείλτε πρόσκληση από τις «Ανακοινώσεις» (τύπος «Συνέλευση»).",
          render: () => <SummaryList rows={[["Είδος", k?.label], ["Τίτλος", title], ["Πότε", when ? when.toLocaleString("el-GR", { dateStyle: "full", timeStyle: "short" }) : "—"], ["Πώς", "Διαδικτυακά, μέσα από την εφαρμογή"]]} />,
        },
      ]}
      onFinish={async () => {
        try {
          await createAssembly({ buildingId, title: title.trim(), scheduledAt: when!.toISOString() });
          onDone();
        } catch (e) {
          return { error: e instanceof Error ? e.message : "Σφάλμα" };
        }
      }}
    />
  );
}
