import { RiBuildingLine, RiInformationLine, RiScales3Line } from "react-icons/ri";
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
          <section key={b.buildingId} style={{
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 18, boxShadow: "var(--shadow-card)", padding: 24,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <RiScales3Line style={{ fontSize: 18, color: "var(--color-accent)", flexShrink: 0 }} />
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
                Πώς υπολογίζονται τα κοινόχρηστα — {b.buildingName}
              </h2>
            </div>
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
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "6px 8px", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>
                          Κατηγορία
                        </th>
                        <th style={{ textAlign: "left", padding: "6px 8px", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>
                          Βάση κατανομής
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.categories.map((c) => (
                        <tr key={c.id}>
                          <td style={{ padding: "7px 8px", color: "var(--foreground)", borderBottom: "1px solid var(--border)", fontWeight: 600 }}>
                            {c.name}
                          </td>
                          <td style={{ padding: "7px 8px", color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>
                            {c.basisLabel}
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
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {b.myUnits.map((u) => (
                  <div key={u.unitNumber} style={{
                    display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                    padding: "10px 12px", background: "var(--bg-canvas)", borderRadius: 10,
                  }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>
                      <RiBuildingLine style={{ fontSize: 14, color: "var(--color-accent)" }} />
                      Μονάδα {u.unitNumber}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--muted-foreground)", ...tnums }}>
                      Κανονικά {mille(u.millesimes)} · Ανελκυστήρα {mille(u.millesimesElevator)} · Θέρμανσης {mille(u.millesimesHeating)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
