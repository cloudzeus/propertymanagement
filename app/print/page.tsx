import { redirect } from "next/navigation";
import { RiPrinterLine } from "react-icons/ri";
import { printableBuildings, STAFF_ROLES, OCCUPANT_DOCS } from "@/lib/print/access";
import { loadPrintBuilding, listAssemblies, listAnnouncements, listProposalSources } from "@/lib/print/data";
import { DOCS, type DocKey, type DocGroup } from "@/lib/print/registry";
import { managerBuildingIds } from "@/lib/building-access";
import { monthLabel, dateLabel, eur } from "@/lib/print/format";
import { HubSelectors, DocCard, Field } from "./PrintHub";

export const dynamic = "force-dynamic";
export const metadata = { title: "Εκτυπωτικά" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Εκτυπωτικά — every document a manager hands to owners/residents, generated from live data. */
export default async function PrintHubPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { session, buildings } = await printableBuildings();
  if (!session) redirect("/login?next=/print");
  const role = session.user.role;
  const isStaff = STAFF_ROLES.includes(role);
  const managed = role === "PROPERTY_ADMIN" ? new Set(await managerBuildingIds(session.user.id)) : new Set<string>();
  const buildingId = buildings.some((b) => b.id === one(sp.building)) ? one(sp.building) : buildings[0]?.id;
  const building = buildingId ? await loadPrintBuilding(buildingId) : null;
  const full = !!building && (isStaff || managed.has(building.id));
  const month = building && /^\d{4}-\d{2}$/.test(one(sp.month)) && building.months.includes(one(sp.month)) ? one(sp.month) : building?.months[0] ?? "";
  const [assemblies, announcements, workOrders] = building ? await Promise.all([listAssemblies(building.id), full ? listAnnouncements(building.id) : [], full ? listProposalSources(building.id) : []]) : [[], [], []];
  const ownUnits = building ? building.units.filter((u) => full || u.ownerId === session.user.id || u.residentId === session.user.id) : [];
  const allowed = (k: DocKey) => full || OCCUPANT_DOCS.includes(k);
  const groups: DocGroup[] = ["Κοινόχρηστα", "Εισπράξεις", "Αποφάσεις", "Συνελεύσεις & ενημέρωση"];
  const backHref = isStaff ? "/admin" : role === "PROPERTY_ADMIN" ? (building ? `/building/${building.id}` : "/building") : role === "PROPERTY_OWNER" ? "/owner" : "/portal";

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", background: "#fff", border: "1px solid #d9d4cb", borderRadius: 14, padding: "22px 24px 28px", marginTop: -40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="pdoc-eyebrow">Διαχείριση · Έντυπα προς ιδιοκτήτες & ενοίκους</div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-30)", fontWeight: 600, margin: "2px 0 4px", lineHeight: 1.1 }}>Εκτυπωτικά</h1>
          <p style={{ margin: 0, color: "#555", fontSize: "var(--fs-13)", maxWidth: 640 }}>Κάθε έντυπο ανοίγει σε νέα καρτέλα ως σελίδα Α4 με τα ζωντανά στοιχεία του κτηρίου. Από εκεί «Εκτύπωση / PDF» για χαρτί, PDF ή email.</p>
        </div>
        <a href={backHref} style={{ fontSize: "var(--fs-13)", color: "#333", textDecoration: "underline", marginTop: 6 }}>← Επιστροφή στην εφαρμογή</a>
      </div>

      {buildings.length === 0 || !building ? (
        <div style={{ marginTop: 20, padding: 28, border: "1px dashed #999", borderRadius: 10, textAlign: "center", color: "#555" }}>Δεν υπάρχει κτήριο συνδεδεμένο με τον λογαριασμό σας.</div>
      ) : (
        <>
          <HubSelectors buildings={buildings} buildingId={building.id} months={building.months.map((m) => ({ value: m, label: `${monthLabel(m)}${building.issuedMonths.includes(m) ? "" : " (μη εκδοθείς)"}` }))} month={month} />
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: "var(--fs-12-5)", color: "#555", marginTop: 8 }}>
            <span>Διαχειριστής: <b style={{ color: "#111" }}>{building.managerName ?? "—"}</b></span>
            <span>Μονάδες: <b style={{ color: "#111" }}>{building.units.length}</b></span>
            <span>Εκδόσεις κοινοχρήστων: <b style={{ color: "#111" }}>{building.issuedMonths.length}</b></span>
          </div>

          {groups.map((g) => {
            const keys = (Object.keys(DOCS) as DocKey[]).filter((k) => DOCS[k].group === g && allowed(k));
            if (!keys.length) return null;
            return (
              <section key={g} style={{ marginTop: 22 }}>
                <div className="psec-title" style={{ borderBottomColor: "#d9d4cb" }}>{g}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12, marginTop: 10 }}>
                  {keys.map((k) => {
                    const d = DOCS[k];
                    const base = { building: building.id, ...(d.needsMonth ? { month } : {}) };
                    const disabled = d.needsMonth && !month;
                    return (
                      <DocCard key={k} doc={k} title={d.title} hint={d.hint} icon={d.icon} hidden={base} disabled={disabled}>
                        {k === "notice" && (
                          <Field label="Διαμέρισμα"><select name="unit" defaultValue={full ? "all" : ownUnits[0]?.id}>{full && <option value="all">Όλα τα διαμερίσματα (ένα φύλλο το καθένα)</option>}{ownUnits.map((u) => <option key={u.id} value={u.id}>Διαμ. {u.unitNumber} · {u.ownerName ?? "—"}</option>)}</select></Field>
                        )}
                        {(k === "notice" || k === "summary" || k === "payments") && <Field label="Προθεσμία εξόφλησης (προαιρετικά)"><input type="date" name="due" /></Field>}
                        {k === "receipt" && (
                          <>
                            <Field label="Διαμέρισμα"><select name="unit">{building.units.map((u) => <option key={u.id} value={u.id}>Διαμ. {u.unitNumber} · {u.ownerName ?? "—"}{u.residentName && u.residentId !== u.ownerId ? ` / ${u.residentName}` : ""}</option>)}</select></Field>
                            <Field label="Καταβάλλων"><select name="party"><option value="tenant">Ένοικος</option><option value="owner">Ιδιοκτήτης</option></select></Field>
                          </>
                        )}
                        {k === "proposal" && (
                          <>
                            {workOrders.length > 0 && <Field label="Από σύμβαση έργου / προσφορά"><select name="wo" defaultValue=""><option value="">— χειροκίνητα —</option>{workOrders.map((w) => <option key={w.id} value={w.id}>{w.number} · {w.title} · {eur(w.net)} + ΦΠΑ</option>)}</select></Field>}
                            <Field label="Θέμα"><input name="title" placeholder="π.χ. Αντικατάσταση κεντρικής θύρας εισόδου" /></Field>
                            <Field label="Περιγραφή"><textarea name="desc" rows={3} placeholder="Τι προτείνεται, γιατί, από ποιον, πότε." /></Field>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                              <Field label="Καθαρό ποσό €"><input name="net" inputMode="decimal" placeholder="1500" /></Field>
                              <Field label="ΦΠΑ %"><input name="vat" inputMode="numeric" defaultValue="24" /></Field>
                              <Field label="Ένοικοι %"><input name="tenantPct" inputMode="numeric" defaultValue="0" /></Field>
                            </div>
                            <Field label="Κατανομή"><select name="basis"><option value="GENERAL_MILLESIMES">Χιλιοστά κοινοχρήστων</option><option value="EQUAL_PER_UNIT">Ισόποσα ανά μονάδα</option><option value="ELEVATOR_MILLESIMES">Χιλιοστά ανελκυστήρα</option><option value="HEATING_MILLESIMES">Χιλιοστά θέρμανσης</option></select></Field>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                              <Field label="Εκτέλεση από"><input name="supplier" placeholder="Συνεργείο" /></Field>
                              <Field label="Απάντηση έως"><input type="date" name="replyBy" /></Field>
                            </div>
                          </>
                        )}
                        {k === "invitation" && (
                          <>
                            {assemblies.length > 0 && <Field label="Από προγραμματισμένη συνέλευση"><select name="assembly" defaultValue=""><option value="">— χειροκίνητα —</option>{assemblies.map((a) => <option key={a.id} value={a.id}>{dateLabel(a.scheduledAt)} · {a.title}</option>)}</select></Field>}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                              <Field label="Είδος"><select name="kind"><option>Τακτική</option><option>Έκτακτη</option></select></Field>
                              <Field label="Ημερομηνία & ώρα"><input type="datetime-local" name="date" /></Field>
                            </div>
                            <Field label="Τόπος (κενό = ηλεκτρονικά)"><input name="place" placeholder="π.χ. είσοδος πολυκατοικίας" /></Field>
                            <Field label="Θέματα (ένα ανά γραμμή)"><textarea name="agenda" rows={4} placeholder={"Απολογισμός έτους\nΈγκριση προϋπολογισμού\nΛοιπά θέματα"} /></Field>
                            <Field label="Επαναληπτική (κενό = +7 ημέρες)"><input type="datetime-local" name="repeat" /></Field>
                          </>
                        )}
                        {k === "minutes" && (
                          assemblies.filter((a) => a.hasMinutes).length === 0
                            ? <div style={{ fontSize: "var(--fs-12-5)", color: "#a33" }}>Δεν υπάρχουν συνελεύσεις με εγκεκριμένα πρακτικά.</div>
                            : <Field label="Συνέλευση"><select name="assembly">{assemblies.filter((a) => a.hasMinutes).map((a) => <option key={a.id} value={a.id}>{dateLabel(a.scheduledAt)} · {a.title}</option>)}</select></Field>
                        )}
                        {k === "announcement" && (
                          <>
                            {announcements.length > 0 && <Field label="Από καταχωρημένη ανακοίνωση"><select name="announcement" defaultValue=""><option value="">— νέο κείμενο —</option>{announcements.map((a) => <option key={a.id} value={a.id}>{dateLabel(a.publishedAt ?? a.createdAt)} · {a.title}</option>)}</select></Field>}
                            <Field label="Τίτλος"><input name="title" placeholder="π.χ. Διακοπή νερού την Τρίτη 10:00–13:00" /></Field>
                            <Field label="Κείμενο"><textarea name="body" rows={4} /></Field>
                            <Field label="Απευθύνεται"><select name="audience"><option value="ALL">Σε όλους</option><option value="OWNERS">Ιδιοκτήτες</option><option value="RESIDENTS">Ενοίκους</option></select></Field>
                          </>
                        )}
                      </DocCard>
                    );
                  })}
                </div>
              </section>
            );
          })}
          <p style={{ marginTop: 24, fontSize: "var(--fs-12)", color: "#666", display: "flex", gap: 6, alignItems: "center" }}><RiPrinterLine /> Για PDF: στο παράθυρο εκτύπωσης επιλέξτε «Αποθήκευση ως PDF». Τα έντυπα είναι Α4 και τυπώνονται ασπρόμαυρα.</p>
        </>
      )}
    </div>
  );
}
