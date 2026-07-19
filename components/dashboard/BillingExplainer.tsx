import { RiArrowDownSLine, RiBuildingLine, RiInformationLine, RiScales3Line } from "react-icons/ri";
import type { BillingExplainerBuilding } from "@/lib/dashboard/owner-queries";

const tnums = { fontVariantNumeric: "tabular-nums" } as const;
const mille = (v: number | null) => (v == null ? "—" : `${v}‰`);

function ParamChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 2, padding: "8px 12px",
      background: "var(--bg-canvas)", borderRadius: 10, minWidth: 0,
    }}>
      <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", ...tnums }}>{value}</span>
    </div>
  );
}

export function BillingExplainer({ buildings }: { buildings: BillingExplainerBuilding[] }) {
  if (buildings.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Server-component-safe disclosure styling: hide the native marker, spin the chevron. */}
      <style>{`
        .billing-summary { list-style: none; }
        .billing-summary::-webkit-details-marker { display: none; }
        .billing-chevron { transition: transform 0.2s ease; }
        details[open] .billing-chevron { transform: rotate(180deg); }
      `}</style>
      {buildings.map((b) => {
        const elevatorParts: string[] = [];
        if (b.params.hasElevator) {
          elevatorParts.push("Ναι");
          if (b.params.elevatorSurchargePerFloor > 0) {
            elevatorParts.push(`χρέωση ${b.params.elevatorSurchargePerFloor}/όροφο`);
          }
          if (b.params.elevatorExemptGroundFloor) elevatorParts.push("εξαίρεση ισογείου");
        } else {
          elevatorParts.push("Όχι");
        }

        return (
          <details key={b.buildingId} style={{
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 18, boxShadow: "var(--shadow-card)",
          }}>
            <summary className="billing-summary" style={{
              display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
              padding: 24, userSelect: "none",
            }}>
              <RiScales3Line style={{ fontSize: 18, color: "var(--color-accent)", flexShrink: 0 }} />
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0, flex: 1 }}>
                Πώς υπολογίζονται τα κοινόχρηστα — {b.buildingName}
              </h2>
              <span style={{ fontSize: 12, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>Ανάλυση</span>
              <RiArrowDownSLine className="billing-chevron" style={{ fontSize: 20, color: "var(--muted-foreground)", flexShrink: 0 }} />
            </summary>

            <div style={{ padding: "0 24px 24px" }}>
              <p style={{
                display: "flex", alignItems: "flex-start", gap: 6, margin: "0 0 18px",
                fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.5,
              }}>
                <RiInformationLine style={{ fontSize: 15, flexShrink: 0, marginTop: 2 }} />
                Οι δαπάνες κατανέμονται στα διαμερίσματα με βάση τα χιλιοστά ιδιοκτησίας ανά ομάδα.
              </p>

              {/* Παράμετροι κτηρίου */}
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Παράμετροι κτηρίου
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
                  <ParamChip label="Όροφοι" value={b.params.floors == null ? "—" : String(b.params.floors)} />
                  {(b.params.basements ?? 0) > 0 && (
                    <ParamChip label="Υπόγεια" value={String(b.params.basements)} />
                  )}
                  <ParamChip label="Ανελκυστήρας" value={elevatorParts.join(" · ")} />
                  <ParamChip
                    label="Θέρμανση"
                    value={b.params.heatingMeterUnit ? `μετρητής (${b.params.heatingMeterUnit})` : "χιλιοστά"}
                  />
                </div>
              </div>

              {/* Κατανομή ανά κατηγορία δαπάνης */}
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Κατανομή ανά κατηγορία δαπάνης
                </h3>
                {b.categories.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>
                    Δεν έχουν οριστεί κατηγορίες δαπανών.
                  </p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
                      <thead>
                        <tr>
                          <th style={{ width: "26%", textAlign: "left", padding: "6px 8px", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>
                            Κατηγορία
                          </th>
                          <th style={{ width: "24%", textAlign: "left", padding: "6px 8px", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>
                            Βάση κατανομής
                          </th>
                          <th style={{ textAlign: "left", padding: "6px 8px", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>
                            Πώς μοιράζεται
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.categories.map((c) => (
                          <tr key={c.id}>
                            <td style={{ padding: "7px 8px", color: "var(--foreground)", borderBottom: "1px solid var(--border)", fontWeight: 600 }}>
                              {c.name}
                            </td>
                            <td style={{ padding: "7px 8px", borderBottom: "1px solid var(--border)" }}>
                              <span style={{
                                display: "inline-block", padding: "2px 8px", borderRadius: 999,
                                background: "var(--bg-canvas)", border: "1px solid var(--border)",
                                fontSize: 11, fontWeight: 600, color: "var(--foreground)", whiteSpace: "nowrap",
                              }}>
                                {c.basisLabel}
                              </span>
                            </td>
                            <td style={{ padding: "7px 8px", color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)", lineHeight: 1.45 }}>
                              {c.basisDescription || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Τα χιλιοστά μου */}
              <div>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Τα χιλιοστά μου
                </h3>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        {["Μονάδα", "Όροφος", "Εμβαδόν", "Γενικά ‰", "Ανελκυστήρα ‰", "Θέρμανσης ‰"].map((h, i) => (
                          <th key={h} style={{
                            textAlign: i === 0 ? "left" : "right", padding: "6px 8px", fontSize: 11, fontWeight: 600,
                            color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {b.myUnits.map((u) => (
                        <tr key={u.unitNumber}>
                          <td style={{ padding: "8px", borderBottom: "1px solid var(--border)" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, color: "var(--foreground)" }}>
                              <RiBuildingLine style={{ fontSize: 14, color: "var(--color-accent)", flexShrink: 0 }} />
                              Μονάδα {u.unitNumber}
                            </span>
                          </td>
                          <td style={{ padding: "8px", textAlign: "right", color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)", ...tnums }}>
                            {u.floor == null ? "—" : u.floor}
                          </td>
                          <td style={{ padding: "8px", textAlign: "right", color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)", ...tnums }}>
                            {u.areaSqm == null ? "—" : `${u.areaSqm} τ.μ.`}
                          </td>
                          <td style={{ padding: "8px", textAlign: "right", fontWeight: 600, color: "var(--foreground)", borderBottom: "1px solid var(--border)", ...tnums }}>
                            {mille(u.millesimes)}
                          </td>
                          <td style={{ padding: "8px", textAlign: "right", color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)", ...tnums }}>
                            {mille(u.millesimesElevator)}
                          </td>
                          <td style={{ padding: "8px", textAlign: "right", color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)", ...tnums }}>
                            {mille(u.millesimesHeating)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ margin: "10px 2px 0", fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.45 }}>
                  Όπου εμφανίζεται «—», δεν έχει οριστεί ξεχωριστό σετ χιλιοστών για το κτήριο — η κατανομή γίνεται με τα γενικά χιλιοστά.
                </p>
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}
