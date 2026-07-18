import { redirect } from "next/navigation";
import { getEffectiveSession } from "@/lib/auth-effective";
import { getOwnerUnits } from "@/lib/dashboard/owner-queries";
import { SectionCard, StatusChip, EmptyState } from "@/components/dashboard";
import { RiHome3Line, RiUserStarLine, RiUserLine } from "react-icons/ri";

export const metadata = { title: "Οι μονάδες μου" };

const fmtDate = (d: Date) => d.toLocaleDateString("el-GR");

type OwnerUnits = Awaited<ReturnType<typeof getOwnerUnits>>;

export default async function OwnerUnitsPage() {
  const eff = await getEffectiveSession();
  if (!eff?.user?.id) redirect("/login");
  const userId = eff.user.id;

  const units = await getOwnerUnits(userId);

  const byBuilding = new Map<string, { id: string; name: string; address: string; city: string; units: OwnerUnits }>();
  for (const u of units) {
    const b = byBuilding.get(u.building.id) ?? { id: u.building.id, name: u.building.name, address: u.building.address, city: u.building.city, units: [] };
    b.units.push(u);
    byBuilding.set(u.building.id, b);
  }
  const buildings = [...byBuilding.values()];

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 980 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Οι μονάδες μου</h1>

      {buildings.length === 0 ? (
        <EmptyState icon={RiHome3Line} label="Δεν υπάρχουν καταχωρημένες μονάδες στο όνομά σας." />
      ) : (
        buildings.map((b) => (
          <SectionCard key={b.id} title={`${b.name} · ${b.address}, ${b.city}`}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {b.units.map((u) => (
                <details key={u.id} style={{ background: "var(--bg-canvas)", borderRadius: 10, padding: "12px 14px" }}>
                  <summary style={{
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                    gap: 12, flexWrap: "wrap",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Μονάδα {u.unitNumber}</span>
                      <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{u.floor != null ? `Όροφος ${u.floor}` : "—"}</span>
                      <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{u.areaSqm != null ? `${u.areaSqm} τ.μ.` : "—"}</span>
                      <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{u.millesimes != null ? `${u.millesimes}‰` : "—"}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 12, color: "var(--foreground)" }}>{u.resident?.name ?? u.resident?.email ?? "—"}</span>
                      <StatusChip tone={u.residentId ? "success" : "warning"}>{u.residentId ? "Ενοικιασμένο" : "Κενό"}</StatusChip>
                    </div>
                  </summary>

                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                    {u.occupancies.length === 0 ? (
                      <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Δεν υπάρχει ιστορικό χρήσης.</div>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead>
                            <tr style={{ textAlign: "left", color: "var(--muted-foreground)" }}>
                              <th style={{ padding: "4px 8px", fontWeight: 600 }}>Ιδιότητα</th>
                              <th style={{ padding: "4px 8px", fontWeight: 600 }}>Όνομα</th>
                              <th style={{ padding: "4px 8px", fontWeight: 600 }}>Από</th>
                              <th style={{ padding: "4px 8px", fontWeight: 600 }}>Έως</th>
                            </tr>
                          </thead>
                          <tbody>
                            {u.occupancies.map((o) => (
                              <tr key={o.id} style={{ borderTop: "1px solid var(--border)" }}>
                                <td style={{ padding: "6px 8px", color: "var(--foreground)", whiteSpace: "nowrap" }}>
                                  {o.role === "OWNER" ? (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><RiUserStarLine /> Ιδιοκτήτης</span>
                                  ) : (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><RiUserLine /> Ένοικος</span>
                                  )}
                                </td>
                                <td style={{ padding: "6px 8px", color: "var(--foreground)" }}>{o.user.name ?? o.user.email}</td>
                                <td style={{ padding: "6px 8px", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{fmtDate(o.startDate)}</td>
                                <td style={{ padding: "6px 8px", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{o.endDate ? fmtDate(o.endDate) : "Σήμερα"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </SectionCard>
        ))
      )}
    </div>
  );
}
