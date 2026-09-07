"use client";

import { useState } from "react";
import { GuidedFlow, ChoiceCards, SummaryList } from "@/components/ui/guided-flow";
import { FormField, FieldInput } from "@/components/ui/modal";
import { UserCombo } from "@/components/ui/user-combo";
import type { UserOption } from "@/app/actions/employees";
import { CUSTOMER_ROLES } from "@/lib/roles-constants";
import { createOccupant, assignOccupant } from "@/app/actions/unit-occupants";
import { RiUserStarLine, RiUserLine, RiUserSearchLine, RiUserAddLine, RiUser3Line, RiBuilding4Line, RiCalendarCheckLine, RiCalendarLine } from "react-icons/ri";

type Role = "OWNER" | "RESIDENT";
type Mode = "existing" | "new";

const ROLES: { value: Role; label: string; description: string; icon: React.ElementType }[] = [
  { value: "OWNER", label: "Ιδιοκτήτης", description: "Πληρώνει το μερίδιο ιδιοκτήτη (π.χ. έκτακτες δαπάνες), ψηφίζει στη συνέλευση.", icon: RiUserStarLine },
  { value: "RESIDENT", label: "Ένοικος", description: "Μένει στη μονάδα και πληρώνει το μερίδιο ενοίκου (π.χ. θέρμανση, καθαριότητα).", icon: RiUserLine },
];
const MODES: { value: Mode; label: string; description: string; icon: React.ElementType }[] = [
  { value: "existing", label: "Υπάρχει ήδη στο σύστημα", description: "Έχει λογαριασμό από άλλη μονάδα ή κτήριό σας — απλώς τον συνδέουμε.", icon: RiUserSearchLine },
  { value: "new", label: "Νέο πρόσωπο", description: "Θα φτιάξουμε λογαριασμό για να μπαίνει στην εφαρμογή.", icon: RiUserAddLine },
];
const TYPES = [
  { value: "INDIVIDUAL", label: "Ιδιώτης", description: "Φυσικό πρόσωπο", icon: RiUser3Line },
  { value: "COMPANY", label: "Εταιρεία", description: "Με ΑΦΜ/ΔΟΥ και υπεύθυνο επικοινωνίας", icon: RiBuilding4Line },
];
const STARTS = [
  { value: "today", label: "Από σήμερα", description: "η συνηθισμένη επιλογή", icon: RiCalendarCheckLine },
  { value: "other", label: "Από άλλη ημερομηνία", description: "π.χ. έναρξη μισθωτηρίου", icon: RiCalendarLine },
];

/** Step-by-step owner/resident assignment for one unit. */
export function OccupantWizard({ unitId, unitNumber, customerId, initialRole, onClose, onDone }: {
  unitId: string; unitNumber: string; customerId: string; initialRole?: Role; onClose: () => void; onDone: () => void;
}) {
  const [role, setRole] = useState<Role | null>(initialRole ?? null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [existing, setExisting] = useState<UserOption | null>(null);
  const [type, setType] = useState<"INDIVIDUAL" | "COMPANY">("INDIVIDUAL");
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", mobile: "", afm: "", doy: "", contactName: "", contactEmail: "", contactPhone: "" });
  const [startMode, setStartMode] = useState<"today" | "other">("today");
  const [startDate, setStartDate] = useState("");
  const f = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));
  const roleLabel = ROLES.find((r) => r.value === role)?.label ?? "";
  const start = startMode === "today" ? new Date().toISOString().slice(0, 10) : startDate;

  return (
    <GuidedFlow title={`Μονάδα ${unitNumber} — ποιος μένει / ποιος είναι ιδιοκτήτης`} onClose={onClose} finishLabel="Καταχώρηση"
      steps={[
        {
          key: "role", title: "Τι θέλετε να ορίσετε;",
          help: "Κάθε μονάδα έχει έναν ιδιοκτήτη και (αν ενοικιάζεται) έναν ένοικο. Τα κοινόχρηστα μοιράζονται αυτόματα ανάμεσά τους.",
          render: () => <ChoiceCards options={ROLES} value={role} onChange={setRole} />,
          validate: () => (role ? null : "Επιλέξτε ιδιοκτήτη ή ένοικο"),
        },
        {
          key: "who", title: `Ποιος είναι ο ${roleLabel.toLowerCase()};`,
          help: "Αν το πρόσωπο έχει ήδη λογαριασμό (π.χ. είναι ιδιοκτήτης και σε άλλη μονάδα), ψάξτε το με το όνομα ή το email. Αλλιώς φτιάξτε νέο.",
          render: () => (
            <>
              <ChoiceCards options={MODES} value={mode} onChange={setMode} />
              {mode === "existing" && (
                <FormField label="Αναζήτηση προσώπου" hint="Πληκτρολογήστε 2–3 γράμματα του ονόματος ή το email">
                  <UserCombo selected={existing} onSelect={setExisting} placeholder="Αναζήτηση με email ή όνομα…" roles={CUSTOMER_ROLES} customerId={customerId} />
                </FormField>
              )}
              {mode === "new" && (
                <>
                  <ChoiceCards options={TYPES} value={type} onChange={(v) => setType(v as "INDIVIDUAL" | "COMPANY")} />
                  {type === "COMPANY" ? (
                    <>
                      <FormField label="Επωνυμία" required><FieldInput value={form.name} onChange={f("name")} placeholder="π.χ. Εταιρεία ΕΠΕ" /></FormField>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <FormField label="ΑΦΜ"><FieldInput value={form.afm} onChange={f("afm")} placeholder="9 ψηφία" /></FormField>
                        <FormField label="ΔΟΥ"><FieldInput value={form.doy} onChange={f("doy")} /></FormField>
                        <FormField label="Υπεύθυνος επικοινωνίας"><FieldInput value={form.contactName} onChange={f("contactName")} /></FormField>
                        <FormField label="Τηλέφωνο υπευθύνου"><FieldInput value={form.contactPhone} onChange={f("contactPhone")} /></FormField>
                      </div>
                    </>
                  ) : (
                    <>
                      <FormField label="Ονοματεπώνυμο" required><FieldInput value={form.name} onChange={f("name")} placeholder="π.χ. Μαρία Παπαδοπούλου" /></FormField>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <FormField label="Κινητό"><FieldInput value={form.mobile} onChange={f("mobile")} /></FormField>
                        <FormField label="Σταθερό"><FieldInput value={form.phone} onChange={f("phone")} /></FormField>
                      </div>
                    </>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <FormField label="Email" required hint="Εδώ θα λαμβάνει ειδοποιήσεις και με αυτό θα συνδέεται"><FieldInput type="email" value={form.email} onChange={f("email")} /></FormField>
                    <FormField label="Αρχικός κωδικός" required hint="Τουλάχιστον 6 χαρακτήρες — πείτε του να τον αλλάξει"><FieldInput type="password" value={form.password} onChange={f("password")} /></FormField>
                  </div>
                </>
              )}
            </>
          ),
          validate: () => {
            if (!mode) return "Επιλέξτε αν υπάρχει ήδη ή είναι νέο πρόσωπο";
            if (mode === "existing") return existing ? null : "Επιλέξτε ένα πρόσωπο από την αναζήτηση";
            if (!form.name.trim()) return type === "COMPANY" ? "Γράψτε την επωνυμία" : "Γράψτε το ονοματεπώνυμο";
            if (!form.email.trim()) return "Γράψτε το email";
            if (form.password.length < 6) return "Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες";
            return null;
          },
        },
        {
          key: "start", title: "Από πότε;",
          help: "Η ημερομηνία καθορίζει από ποιον μήνα χρεώνονται τα κοινόχρηστα στο νέο πρόσωπο. Ο προηγούμενος κλείνει αυτόματα την ίδια ημέρα.",
          render: () => (
            <>
              <ChoiceCards options={STARTS} value={startMode} onChange={(v) => setStartMode(v as "today" | "other")} />
              {startMode === "other" && <FormField label="Ημερομηνία έναρξης" required><FieldInput type="date" value={startDate} onChange={setStartDate} /></FormField>}
            </>
          ),
          validate: () => (startMode === "other" && !startDate ? "Επιλέξτε ημερομηνία" : null),
        },
        {
          key: "check", title: "Έλεγχος",
          help: mode === "new" ? "Με την καταχώρηση δημιουργείται ο λογαριασμός. Ενημερώστε το πρόσωπο για το email και τον αρχικό κωδικό." : "Με την καταχώρηση το πρόσωπο συνδέεται με τη μονάδα και βλέπει τα κοινόχρηστά της.",
          render: () => (
            <SummaryList rows={[
              ["Μονάδα", unitNumber], ["Ρόλος", roleLabel],
              ["Πρόσωπο", mode === "existing" ? `${existing?.name ?? ""} ${existing?.email ? `(${existing.email})` : ""}` : `${form.name} (${form.email})${type === "COMPANY" ? " — εταιρεία" : ""}`],
              ["Από", start ? new Date(start).toLocaleDateString("el-GR") : "—"],
            ]} />
          ),
        },
      ]}
      onFinish={async () => {
        const res = mode === "existing"
          ? await assignOccupant(unitId, role!, existing!.id, start)
          : await createOccupant(unitId, role!, { ...form, isCompany: type === "COMPANY", startDate: start });
        if (res && "error" in res && res.error) return { error: res.error };
        onDone();
      }}
    />
  );
}
