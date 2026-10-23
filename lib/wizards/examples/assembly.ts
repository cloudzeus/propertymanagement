/** Pure rules of the «Πρόσκληση συνέλευσης» example: quorum by millesimes, person-minute consumption, timeline. */
export type QuorumUnit = { unitNumber: string; millesimes: number | null };

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Quorum: Σ millesimes of the present units over the building's total; ok when more than half. */
export function assemblyQuorum(units: QuorumUnit[], presentUnitNumbers: string[]): { present: number; total: number; ok: boolean } {
  const total = r2(units.reduce((s, u) => s + (u.millesimes ?? 0), 0));
  const set = new Set(presentUnitNumbers);
  const present = r2(units.filter((u) => set.has(u.unitNumber)).reduce((s, u) => s + (u.millesimes ?? 0), 0));
  return { present, total, ok: total > 0 && present > total / 2 };
}

/** Metered assemblies consume person-minutes: duration × participants. */
export function assemblyConsumption(durationMinutes: number, participants: number): number {
  return Math.max(0, Math.round(durationMinutes)) * Math.max(0, Math.round(participants));
}

export type AssemblyExampleInput = { title: string; when: string | null; units: QuorumUnit[]; prepaidMinutes: number; durationMinutes: number; participants: number };
export type AssemblyExample = {
  timeline: { title: string; body: string }[];
  quorum: { present: number; total: number; ok: boolean };
  consumption: number;
  balanceAfter: number | null;
  balanceLine: string;
};

/** Example: a majority of the (largest) units attends; shows quorum, consumption and the prepaid balance after. */
export function exampleForAssembly(i: AssemblyExampleInput): AssemblyExample {
  const sorted = [...i.units].sort((a, b) => (b.millesimes ?? 0) - (a.millesimes ?? 0));
  const total = sorted.reduce((s, u) => s + (u.millesimes ?? 0), 0);
  const present: string[] = [];
  let acc = 0;
  for (const u of sorted) { if (acc > total / 2) break; present.push(u.unitNumber); acc += u.millesimes ?? 0; }
  const quorum = assemblyQuorum(i.units, present);
  const consumption = assemblyConsumption(i.durationMinutes, i.participants);
  const balanceAfter = i.prepaidMinutes > 0 ? Math.max(0, i.prepaidMinutes - consumption) : null;
  const whenText = i.when ? new Date(i.when).toLocaleString("el-GR", { dateStyle: "full", timeStyle: "short" }) : "την ημερομηνία που θα ορίσετε";
  return {
    timeline: [
      { title: "Πρόσκληση", body: `Στέλνετε ανακοίνωση τύπου «Συνέλευση» σε ιδιοκτήτες και ενοίκους, τουλάχιστον 7 ημέρες πριν· λαμβάνουν σύνδεσμο συμμετοχής.` },
      { title: "Συνέλευση", body: `${whenText}, διαδικτυακά μέσα από την εφαρμογή — ${i.durationMinutes}′ με ${i.participants} συμμετέχοντες στο παράδειγμα.` },
      { title: "Απαρτία", body: i.units.length ? `Παρόντες ${present.join(", ")} = ${quorum.present.toLocaleString("el-GR")}‰ από ${quorum.total.toLocaleString("el-GR")}‰ → ${quorum.ok ? "υπάρχει απαρτία (πάνω από το μισό)" : "δεν υπάρχει απαρτία"}.` : "Η απαρτία μετριέται με τα χιλιοστά των παρόντων (πάνω από 500‰)." },
      { title: "Πρακτικά", body: "Τα πρακτικά γράφονται αυτόματα από τη συζήτηση για έγκριση και εκτυπώνονται από τα Εκτυπωτικά." },
    ],
    quorum,
    consumption,
    balanceAfter,
    balanceLine: balanceAfter == null
      ? `Η συνέλευση καταναλώνει ${consumption} λεπτά-ατόμου· η ιδιοκτησία δεν έχει προαγορά — ρυθμίστε την από το πακέτο υπηρεσιών.`
      : `Καταναλώνονται ${consumption} λεπτά-ατόμου από τα ${i.prepaidMinutes} προπληρωμένα· μένουν ${balanceAfter}.`,
  };
}
