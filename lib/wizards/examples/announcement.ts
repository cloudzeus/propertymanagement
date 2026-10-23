/** Pure rules of the «Νέα ανακοίνωση» example: recipients per audience, delivery channels, kind explanation. */
export type AnnouncementKind = "INFO" | "URGENT" | "WORKS" | "MEETING" | "MONEY";
export type AnnouncementAudience = "ALL" | "OWNERS" | "RESIDENTS" | "CUSTOM";
export type AnnouncementTarget = { roles: ("OWNER" | "RESIDENT")[] };

export type AnnouncementExampleInput = { kind: AnnouncementKind; title: string; audience: AnnouncementAudience; targets: AnnouncementTarget[]; selectedCount: number; addToCalendar: boolean };
export type AnnouncementExample = { recipients: number; channels: string[]; kindLine: string; audienceLine: string };

const KIND_LINES: Record<AnnouncementKind, string> = {
  INFO: "Ενημέρωση: μένει στις ανακοινώσεις του κτηρίου και στην πινακίδα εισόδου μέχρι να τη σβήσετε.",
  URGENT: "Επείγον: ξεχωρίζει με κόκκινη σήμανση στο email, στο καμπανάκι και στην πινακίδα.",
  WORKS: "Εργασίες: οι ένοικοι βλέπουν τι, πότε και τι χρειάζεται από αυτούς· συνδυάστε με το ημερολόγιο.",
  MEETING: "Πρόσκληση σε συνέλευση: μπαίνει στο ημερολόγιο και οι παραλήπτες παίρνουν τον σύνδεσμο συμμετοχής.",
  MONEY: "Κοινόχρηστα & πληρωμές: συνήθως μαζί με την έκδοση του μήνα — οι ένοικοι βλέπουν και το κουμπί πληρωμής.",
};

export function exampleForAnnouncement(i: AnnouncementExampleInput): AnnouncementExample {
  const recipients = i.audience === "ALL" ? i.targets.length
    : i.audience === "OWNERS" ? i.targets.filter((t) => t.roles.includes("OWNER")).length
    : i.audience === "RESIDENTS" ? i.targets.filter((t) => t.roles.includes("RESIDENT")).length
    : i.selectedCount;
  const channels = ["Email με σύνδεσμο «Έλαβα γνώση»", "Καμπανάκι & ειδοποίηση στο κινητό (PWA)", "Ανακοινώσεις στο portal / owner", "Πινακίδα εισόδου (signage)", ...(i.addToCalendar ? ["Ημερολόγιο κτηρίου"] : [])];
  const audienceLine = i.audience === "ALL" ? "όλους τους ιδιοκτήτες και ενοίκους" : i.audience === "OWNERS" ? "μόνο τους ιδιοκτήτες" : i.audience === "RESIDENTS" ? "μόνο τους ενοίκους" : "τα άτομα που επιλέξατε";
  return { recipients, channels, kindLine: KIND_LINES[i.kind], audienceLine: `Θα σταλεί σε ${audienceLine} (${recipients} ${recipients === 1 ? "παραλήπτης" : "παραλήπτες"}). Βλέπετε ποιος πάτησε «Έλαβα γνώση».` };
}
