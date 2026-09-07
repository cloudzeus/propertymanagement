"use client";

import { useEffect, useState } from "react";
import { GuidedFlow, ChoiceCards, SummaryList } from "@/components/ui/guided-flow";
import { FormField, FieldInput } from "@/components/ui/modal";
import { RichTextEditor } from "@/components/ui/rich-text";
import { createAnnouncement, listAnnouncementTargets, type Audience } from "@/app/actions/announcements";
import {
  RiInformationLine, RiAlarmWarningLine, RiToolsLine, RiGroupLine, RiMoneyEuroCircleLine,
  RiTeamLine, RiUserStarLine, RiUserLine, RiUserSearchLine,
} from "react-icons/ri";

type Kind = "INFO" | "URGENT" | "WORKS" | "MEETING" | "MONEY";
const KINDS: { value: Kind; label: string; description: string; icon: React.ElementType; titleHint: string; starter: string }[] = [
  { value: "INFO", label: "Ενημέρωση", description: "Κάτι που πρέπει να ξέρουν όλοι, χωρίς βιασύνη.", icon: RiInformationLine, titleHint: "π.χ. Νέος κανονισμός χρήσης ταράτσας", starter: "<p>Αγαπητοί ένοικοι και ιδιοκτήτες,</p><p></p>" },
  { value: "URGENT", label: "Επείγον", description: "Διακοπή νερού/ρεύματος, βλάβη, θέμα ασφάλειας.", icon: RiAlarmWarningLine, titleHint: "π.χ. Διακοπή νερού αύριο 09:00–13:00", starter: "<p><strong>Προσοχή:</strong> </p>" },
  { value: "WORKS", label: "Εργασίες & συντήρηση", description: "Προγραμματισμένες εργασίες συνεργείων στο κτήριο.", icon: RiToolsLine, titleHint: "π.χ. Συντήρηση ανελκυστήρα Τρίτη 10:00", starter: "<p>Σας ενημερώνουμε ότι θα πραγματοποιηθούν εργασίες:</p><ul><li>Τι: </li><li>Πότε: </li><li>Τι χρειάζεται από εσάς: </li></ul>" },
  { value: "MEETING", label: "Συνέλευση", description: "Πρόσκληση με ημερομηνία, ώρα και θέματα.", icon: RiGroupLine, titleHint: "π.χ. Πρόσκληση σε Γενική Συνέλευση", starter: "<p>Καλείστε σε Γενική Συνέλευση:</p><ul><li>Ημερομηνία & ώρα: </li><li>Τόπος / σύνδεσμος: </li></ul><p>Θέματα ημερήσιας διάταξης:</p><ol><li></li></ol>" },
  { value: "MONEY", label: "Κοινόχρηστα & πληρωμές", description: "Έκδοση κοινοχρήστων, προθεσμίες, τρόποι πληρωμής.", icon: RiMoneyEuroCircleLine, titleHint: "π.χ. Κοινόχρηστα Σεπτεμβρίου — προθεσμία 20/10", starter: "<p>Εκδόθηκαν τα κοινόχρηστα του μήνα. Προθεσμία πληρωμής: </p>" },
];

const AUDIENCES: { value: Audience; label: string; description: string; icon: React.ElementType }[] = [
  { value: "ALL", label: "Σε όλους", description: "Ιδιοκτήτες και ένοικοι του κτηρίου.", icon: RiTeamLine },
  { value: "OWNERS", label: "Μόνο ιδιοκτήτες", description: "Π.χ. για δαπάνες ιδιοκτητών ή συνέλευση.", icon: RiUserStarLine },
  { value: "RESIDENTS", label: "Μόνο ένοικοι", description: "Π.χ. για καθημερινά θέματα λειτουργίας.", icon: RiUserLine },
  { value: "CUSTOM", label: "Συγκεκριμένα άτομα", description: "Θα διαλέξετε από τη λίστα στο επόμενο βήμα.", icon: RiUserSearchLine },
];

type Target = { id: string; name: string | null; email: string; roles: ("OWNER" | "RESIDENT")[] };

/** Step-by-step announcement: what kind → who → what → check & send. */
export function AnnouncementWizard({ buildingId, onClose, onDone, onSimpleForm }: { buildingId: string; onClose: () => void; onDone: () => void; onSimpleForm?: () => void }) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [audience, setAudience] = useState<Audience | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [publishedAt, setPublishedAt] = useState(new Date().toISOString().slice(0, 10));
  const [addToCalendar, setAddToCalendar] = useState(false);
  useEffect(() => { listAnnouncementTargets(buildingId).then(setTargets); }, [buildingId]);

  const k = KINDS.find((x) => x.value === kind);
  function pickKind(v: Kind) {
    setKind(v);
    const def = KINDS.find((x) => x.value === v)!;
    if (content.replace(/<[^>]*>/g, "").trim() === "") setContent(def.starter);
    if (v === "MEETING") setAddToCalendar(true);
  }
  const recipientsLabel = audience === "CUSTOM" ? `${selected.size} επιλεγμένα άτομα` : AUDIENCES.find((a) => a.value === audience)?.label ?? "";

  return (
    <GuidedFlow title="Νέα ανακοίνωση — βήμα προς βήμα" onClose={onClose} onSimpleForm={onSimpleForm} finishLabel="Δημοσίευση & αποστολή"
      steps={[
        {
          key: "kind", title: "Τι είδους ανακοίνωση;",
          help: "Διαλέξτε τον τύπο. Θα σας ετοιμάσουμε ένα πρότυπο κείμενο που απλώς συμπληρώνετε.",
          render: () => <ChoiceCards options={KINDS} value={kind} onChange={pickKind} />,
          validate: () => (kind ? null : "Επιλέξτε έναν τύπο για να συνεχίσετε"),
        },
        {
          key: "audience", title: "Σε ποιους απευθύνεται;",
          help: "Κάθε παραλήπτης θα λάβει email με σύνδεσμο «Έλαβα γνώση». Έτσι ξέρετε ποιος το είδε.",
          render: () => (
            <>
              <ChoiceCards options={AUDIENCES} value={audience} onChange={setAudience} />
              {audience === "CUSTOM" && (
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, maxHeight: 220, overflowY: "auto" }}>
                  {targets.length === 0 && <div style={{ padding: 12, fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)" }}>Δεν υπάρχουν ιδιοκτήτες/ένοικοι στο κτήριο.</div>}
                  {targets.map((t) => (
                    <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
                      <input type="checkbox" checked={selected.has(t.id)} onChange={() => setSelected((p) => { const n = new Set(p); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; })} style={{ width: 18, height: 18 }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: "var(--fs-13-5)", fontWeight: 600, color: "var(--foreground)" }}>{t.name ?? t.email}</span>
                        <span style={{ display: "block", fontSize: "var(--fs-11-5)", color: "var(--muted-foreground)" }}>{t.email}</span>
                      </span>
                      <span style={{ fontSize: "var(--fs-11)", fontWeight: 700, color: "var(--muted-foreground)" }}>{t.roles.map((r) => (r === "OWNER" ? "Ιδιοκτήτης" : "Ένοικος")).join(" & ")}</span>
                    </label>
                  ))}
                </div>
              )}
            </>
          ),
          validate: () => (!audience ? "Επιλέξτε παραλήπτες" : audience === "CUSTOM" && selected.size === 0 ? "Τσεκάρετε τουλάχιστον ένα άτομο" : null),
        },
        {
          key: "content", title: "Τι θέλετε να πείτε;",
          help: "Γράψτε ένα σύντομο θέμα (φαίνεται ως τίτλος στο email) και το κείμενο. Το πρότυπο είναι οδηγός — αλλάξτε το ελεύθερα.",
          render: () => (
            <>
              <FormField label="Θέμα" required><FieldInput value={title} onChange={setTitle} placeholder={k?.titleHint ?? "π.χ. Διακοπή νερού"} /></FormField>
              <FormField label="Κείμενο" required><RichTextEditor value={content} onChange={setContent} placeholder="Γράψτε το κείμενο της ανακοίνωσης…" /></FormField>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "end" }}>
                <FormField label="Ημερομηνία δημοσίευσης" hint="Συνήθως σήμερα"><FieldInput type="date" value={publishedAt} onChange={setPublishedAt} /></FormField>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--fs-13)", color: "var(--foreground)", cursor: "pointer", paddingBottom: 8 }}>
                  <input type="checkbox" checked={addToCalendar} onChange={(e) => setAddToCalendar(e.target.checked)} /> Να μπει και στο ημερολόγιο του κτηρίου
                </label>
              </div>
            </>
          ),
          validate: () => (!title.trim() ? "Γράψτε ένα θέμα" : content.replace(/<[^>]*>/g, "").trim() === "" ? "Γράψτε το κείμενο" : null),
        },
        {
          key: "check", title: "Έλεγχος πριν την αποστολή",
          help: "Ελέγξτε τα στοιχεία. Με το «Δημοσίευση & αποστολή» η ανακοίνωση δημοσιεύεται και φεύγουν τα email αμέσως.",
          render: () => (
            <SummaryList rows={[
              ["Τύπος", k?.label], ["Παραλήπτες", recipientsLabel], ["Θέμα", title],
              ["Κείμενο", <span key="c" style={{ whiteSpace: "pre-wrap" }}>{content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300)}</span>],
              ["Δημοσίευση", new Date(publishedAt).toLocaleDateString("el-GR")], ["Ημερολόγιο", addToCalendar ? "Ναι" : "Όχι"],
            ]} />
          ),
        },
      ]}
      onFinish={async () => {
        const res = await createAnnouncement({
          title, content, publishedAt, audience: audience!, addToCalendar,
          recipientUserIds: audience === "CUSTOM" ? [...selected] : undefined,
          targets: [{ scopeType: "BUILDING", scopeId: buildingId }],
        });
        if (res && "error" in res && res.error) return { error: res.error };
        onDone();
      }}
    />
  );
}
