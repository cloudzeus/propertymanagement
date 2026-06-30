import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  RiArrowLeftLine, RiContactsLine, RiCommunityLine, RiMapPin2Line, RiAddLine, RiArrowRightSLine,
} from "react-icons/ri";

export const metadata = { title: "Πελάτης — Super Admin" };

const TYPE_LABEL: Record<string, string> = { INDIVIDUAL: "Ιδιώτης", COMPANY: "Εταιρεία" };

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const me = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (me?.role !== "SUPER_ADMIN") redirect("/admin");

  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      properties: {
        orderBy: { name: "asc" },
        include: {
          _count: { select: { buildings: true, services: true } },
          buildings: { select: { _count: { select: { units: true } } } },
        },
      },
    },
  });
  if (!customer) notFound();

  const totalUnits = customer.properties.reduce(
    (s, p) => s + p.buildings.reduce((a, b) => a + b._count.units, 0), 0);
  const totalBuildings = customer.properties.reduce((s, p) => s + p._count.buildings, 0);

  const rows: [string, string | null][] = [
    ["ΑΦΜ", customer.afm], ["ΔΟΥ", customer.doy],
    ["Email", customer.email], ["Τηλ. 1", customer.phone], ["Τηλ. 2", customer.phone2],
    ["Fax", customer.fax], ["Ιστοσελίδα", customer.webpage],
  ];
  const addr = [customer.address, customer.city, customer.district, customer.postalCode, customer.country].filter(Boolean).join(", ");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Link href="/super-admin/customers" style={{ fontSize: 12, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
        <RiArrowLeftLine /> Πίσω στους Πελάτες
      </Link>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, background: "var(--color-primary)18", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <RiContactsLine style={{ fontSize: 24, color: "var(--color-primary)" }} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>{customer.name}</h1>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 3, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: customer.type === "COMPANY" ? "#8764B818" : "#0078D418", color: customer.type === "COMPANY" ? "#8764B8" : "#0078D4" }}>
              {TYPE_LABEL[customer.type] ?? customer.type}
            </span>
            {customer.code && <span style={{ fontFamily: "monospace" }}>{customer.code}</span>}
          </p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 20 }}>
          {[
            { label: "Ιδιοκτησίες", val: customer.properties.length },
            { label: "Κτήρια", val: totalBuildings },
            { label: "Μονάδες", val: totalUnits },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--foreground)" }}>{s.val}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Info + address */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={cardStyle}>
          <h3 style={cardTitle}>Στοιχεία</h3>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 14px", fontSize: 13 }}>
            {rows.map(([k, v]) => (
              <div key={k} style={{ display: "contents" }}>
                <span style={{ color: "var(--muted-foreground)" }}>{k}</span>
                <span style={{ color: "var(--foreground)", fontWeight: 500 }}>{v || "—"}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={cardStyle}>
          <h3 style={cardTitle}>Διεύθυνση</h3>
          <p style={{ fontSize: 13, color: "var(--foreground)", margin: 0 }}>{addr || "—"}</p>
          {customer.lat != null && customer.lng != null && (
            <p style={{ fontSize: 12, color: "#16a34a", marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}>
              <RiMapPin2Line /> {customer.lat.toFixed(6)}, {customer.lng.toFixed(6)}
            </p>
          )}
          {customer.remarks && (
            <>
              <h3 style={{ ...cardTitle, marginTop: 16 }}>Παρατηρήσεις</h3>
              <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>{customer.remarks}</p>
            </>
          )}
        </div>
      </div>

      {/* Properties */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Ιδιοκτησίες</h3>
          <Link href="/super-admin/properties" style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: "var(--color-primary)", color: "#fff", textDecoration: "none" }}>
            <RiAddLine /> Νέα Ιδιοκτησία
          </Link>
        </div>
        {customer.properties.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: "center", color: "var(--muted-foreground)", padding: "36px" }}>
            <RiCommunityLine style={{ fontSize: 32, opacity: 0.4, display: "block", margin: "0 auto 10px" }} />
            <p style={{ fontSize: 13, margin: 0 }}>Δεν υπάρχουν ιδιοκτησίες για αυτόν τον πελάτη.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {customer.properties.map((p) => {
              const units = p.buildings.reduce((a, b) => a + b._count.units, 0);
              return (
                <Link key={p.id} href={`/super-admin/properties/${p.id}`} style={{ ...cardStyle, textDecoration: "none", display: "block" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <RiCommunityLine style={{ color: "var(--color-primary)" }} />
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>{p.name}</span>
                    <RiArrowRightSLine style={{ marginLeft: "auto", color: "var(--muted-foreground)" }} />
                  </div>
                  {(p.address || p.city) && (
                    <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "0 0 10px" }}>
                      {[p.address, p.city].filter(Boolean).join(", ")}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--muted-foreground)" }}>
                    <span><strong style={{ color: "var(--foreground)" }}>{p._count.buildings}</strong> κτήρια</span>
                    <span><strong style={{ color: "var(--foreground)" }}>{units}</strong> μονάδες</span>
                    <span><strong style={{ color: "var(--foreground)" }}>{p._count.services}</strong> υπηρεσίες</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px 18px" };
const cardTitle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" };
