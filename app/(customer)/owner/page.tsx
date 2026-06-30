import { db } from "@/lib/db";
import { auth } from "@/auth";
import Link from "next/link";
import {
  RiHome3Line,
  RiMoneyEuroCircleLine,
  RiArrowRightLine,
  RiBuilding4Line,
} from "react-icons/ri";

async function getOwnerData(userId: string) {
  const [units, totalUnits] = await Promise.all([
    db.unit.findMany({
      where: { ownerId: userId },
      include: { building: true },
      orderBy: { createdAt: "desc" },
    }),
    db.unit.count({ where: { ownerId: userId } }),
  ]);
  return { units, totalUnits };
}

export default async function OwnerDashboard() {
  const session = await auth();
  const userId = (session?.user as any)?.id ?? "";
  const { units, totalUnits } = await getOwnerData(userId);

  const occupiedUnits = units.filter((u) => u.residentId !== null).length;
  const vacantUnits = units.filter((u) => u.residentId === null).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Τα Ακίνητά μου</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>Επισκόπηση ακινήτων και εισοδήματος</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {[
          { label: "Σύνολο Μονάδων", value: totalUnits, sub: "Ιδιοκτησίες μου", icon: RiHome3Line, href: "/owner/units", color: "#8764B8" },
          { label: "Ενοικιασμένες", value: occupiedUnits, sub: "Με ενεργό ενοίκιο", icon: RiBuilding4Line, href: "/owner/units", color: "#107C10" },
          { label: "Κενές", value: vacantUnits, sub: "Διαθέσιμες", icon: RiMoneyEuroCircleLine, href: "/owner/units", color: "#CA5D00" },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} href={card.href} style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", padding: "20px 24px",
              display: "flex", flexDirection: "column", gap: 8, textDecoration: "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "var(--muted-foreground)", fontWeight: 500 }}>{card.label}</span>
                <Icon style={{ fontSize: 20, color: card.color, opacity: 0.8 }} />
              </div>
              <span style={{ fontSize: 28, fontWeight: 700, color: "var(--foreground)", lineHeight: 1 }}>{card.value}</span>
              <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{card.sub}</span>
            </Link>
          );
        })}
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>Λίστα Μονάδων</h2>
          <Link href="/owner/units" style={{ fontSize: 12, color: "var(--color-primary)", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
            Όλες <RiArrowRightLine />
          </Link>
        </div>

        {units.length === 0 ? (
          <div style={{ padding: "32px 0", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
            <RiHome3Line style={{ fontSize: 32, opacity: 0.4, display: "block", margin: "0 auto 8px" }} />
            Δεν υπάρχουν καταχωρημένες μονάδες
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {units.slice(0, 8).map((unit) => (
              <div key={unit.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", background: "var(--bg-canvas)", borderRadius: 6,
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>{unit.unitNumber}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{unit.building?.name}</div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                  background: unit.residentId ? "#107C1018" : "#CA5D0018",
                  color: unit.residentId ? "#107C10" : "#CA5D00",
                }}>
                  {unit.residentId ? "Ενοικιασμένο" : "Κενό"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
