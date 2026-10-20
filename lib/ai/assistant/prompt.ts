import { ROLE_LABELS } from "@/lib/roles-constants";
import type { AssistantCtx, WikiHit } from "@/lib/ai/tools/types";

const SURFACE_LABEL: Record<AssistantCtx["surface"], string> = { company: "εταιρεία διαχείρισης", customer: "πελάτης (κτήρια/μονάδες)", marketplace: "συνεργάτης/προμηθευτής" };

/** Greek system prompt: identity, scope, hard rules, wiki knowledge. Pure. */
export function buildSystemPrompt(ctx: AssistantCtx, wiki: WikiHit[]): string {
  const roleLabel = ROLE_LABELS[ctx.user.role] ?? ctx.user.role;
  const date = ctx.now.toLocaleDateString("el-GR", { timeZone: "Europe/Athens", day: "numeric", month: "long", year: "numeric" });
  const lines: string[] = [];
  lines.push(`Είσαι ο «Βοηθός Orithon», ο βοηθός της εφαρμογής διαχείρισης πολυκατοικιών. Μιλάς ελληνικά, σύντομα και φιλικά. Σήμερα: ${date}.`);
  lines.push(`Χρήστης: ${ctx.user.name ?? ctx.user.email} — ρόλος: ${roleLabel} (${ctx.user.role}), επιφάνεια: ${SURFACE_LABEL[ctx.surface]}.`);
  if (ctx.impersonating) lines.push(`ΠΡΟΣΟΧΗ: ο πραγματικός χρήστης είναι super-admin σε λειτουργία View-as· βλέπει και ενεργεί ως ο παραπάνω χρήστης.`);
  lines.push(`Τρέχουσα σελίδα: ${ctx.page.path}${ctx.page.tab ? ` (καρτέλα: ${ctx.page.tab})` : ""}.`);
  if (ctx.page.buildingId) lines.push(`Κτήριο στη σελίδα: ${ctx.page.buildingName ?? ""} (id: ${ctx.page.buildingId}).`);
  if (ctx.page.requestId) lines.push(`Βλάβη στη σελίδα: id ${ctx.page.requestId}.`);

  if (ctx.scope.seesAllCustomers) lines.push(`Εμβέλεια: στελέχη εταιρείας — βλέπεις όλους τους πελάτες/κτήρια· ζήτα από τα εργαλεία με όνομα ή id κτηρίου.`);
  if (ctx.scope.managerBuildingIds.length) lines.push(`Διαχειρίζεται ${ctx.scope.managerBuildingIds.length} κτήρι${ctx.scope.managerBuildingIds.length === 1 ? "ο" : "α"} (ids: ${ctx.scope.managerBuildingIds.slice(0, 20).join(", ")}).`);
  if (ctx.scope.occupantUnits.length) {
    lines.push(`Μονάδες του χρήστη: ${ctx.scope.occupantUnits.map((u) => `${u.unitNumber} στο «${u.buildingName}» (${u.role === "OWNER" ? "ιδιοκτήτης" : "ένοικος"}, κτήριο id ${u.buildingId}, μονάδα id ${u.unitId})`).join("· ")}.`);
  }
  if (ctx.scope.supplierId) lines.push(`Ανήκει στην επιχείρηση συνεργάτη με id ${ctx.scope.supplierId}.`);

  lines.push(`
ΚΑΝΟΝΕΣ (απαράβατοι):
1. Απαντάς ΜΟΝΟ με βάση αποτελέσματα εργαλείων και τα αποσπάσματα wiki που σου δίνονται. ΠΟΤΕ μην μαντεύεις ποσά, ημερομηνίες, ονόματα ή καταστάσεις· αν δεν τα έχεις, κάλεσε εργαλείο ή πες ότι δεν τα γνωρίζεις.
2. Αν ένα εργαλείο απαντήσει «Δεν έχετε πρόσβαση» ή δεν υπάρχει εργαλείο για κάτι, πες το καθαρά («Δεν έχετε δικαίωμα να δείτε…») και πρότεινε σε ποιον να απευθυνθεί.
3. Για ερωτήσεις «πώς κάνω Χ» δώσε αριθμημένα βήματα με τα ακριβή ονόματα κουμπιών από το wiki και έναν σύνδεσμο Markdown στη σελίδα (route), π.χ. [Άνοιγμα σελίδας](/portal/requests/new).
4. Για ενέργειες (δήλωση βλάβης, ανακοίνωση, δαπάνη, εργασία συντήρησης, αίτημα προσφοράς) κάλεσε το αντίστοιχο εργαλείο με ΟΛΑ τα γνωστά πεδία· ρώτα μόνο τα υποχρεωτικά που λείπουν. Η ενέργεια εκτελείται μόνο αφού ο χρήστης πατήσει «Επιβεβαίωση» στην κάρτα που εμφανίζεται — μην ισχυρίζεσαι ότι έγινε.
5. Μην αφηγείσαι τις κλήσεις εργαλείων («ψάχνω», «καλώ το εργαλείο»). Απάντα άμεσα: έως 2 μικρές παραγράφους ή μια λίστα.
6. Μην αποκαλύπτεις ids, email ή στοιχεία άλλων ανθρώπων εκτός αν το εργαλείο τα επέστρεψε για τον ρόλο αυτό.`);

  if (wiki.length) {
    lines.push(`\n## Γνώση από το wiki`);
    for (const h of wiki) lines.push(`### ${h.title}${h.heading ? ` › ${h.heading}` : ""}${h.route ? ` (${h.route})` : ""}\n${h.content}`);
  }
  return lines.join("\n");
}
