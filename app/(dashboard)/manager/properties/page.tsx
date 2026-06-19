import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  RiBuildingLine,
  RiMapPin2Line,
  RiMapPinLine,
  RiEyeLine,
} from "react-icons/ri";
import { GeocodeButton } from "@/components/maps/GeocodeButton";

export default async function ManagerPropertiesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id as string },
    select: { companyId: true, role: true, buildingId: true },
  });
  if (!user?.companyId) redirect("/manager");

  // Managers/Property admins see their assigned property; Admins see all
  const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(user.role);

  const properties = await db.building.findMany({
    where: isAdmin
      ? { companyId: user.companyId }
      : { companyId: user.companyId, ...(user.buildingId ? { id: user.buildingId } : {}) },
    include: {
      _count: { select: { units: true, maintenanceRequests: true } },
    },
    orderBy: { name: "asc" },
  });

  const withGeo = properties.filter((p) => p.lat !== null && p.lng !== null).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
          Τα κτήριά μου
        </h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
          {properties.length} κτήρια · {withGeo} με χάρτη
        </p>
      </div>

      {properties.length === 0 ? (
        <div style={{
          padding: "48px 24px", textAlign: "center",
          border: "2px dashed var(--border)", borderRadius: 12,
          color: "var(--muted-foreground)",
        }}>
          <RiBuildingLine style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }} />
          <p style={{ fontSize: 15, fontWeight: 600 }}>Δεν έχετε αναθεθεί κτήρια</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Ζητήστε από τον διαχειριστή να σας αναθέσει κτήριο</p>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 16,
        }}>
          {properties.map((property) => {
            const hasGeo = property.lat !== null && property.lng !== null;
            return (
              <div key={property.id} style={{
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: 10, overflow: "hidden",
              }}>
                <div style={{
                  height: 120,
                  background: property.imageUrl
                    ? `url(${property.imageUrl}) center/cover`
                    : "linear-gradient(135deg, var(--color-primary)22 0%, var(--color-primary)08 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  position: "relative",
                }}>
                  {!property.imageUrl && (
                    <RiBuildingLine style={{ fontSize: 40, color: "var(--color-primary)", opacity: 0.4 }} />
                  )}
                  <div style={{
                    position: "absolute", top: 10, right: 10,
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "3px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: hasGeo ? "#16a34a18" : "#6b728018",
                    color: hasGeo ? "#16a34a" : "#6b7280",
                    border: `1px solid ${hasGeo ? "#16a34a30" : "#6b728030"}`,
                  }}>
                    {hasGeo ? <RiMapPin2Line style={{ fontSize: 12 }} /> : <RiMapPinLine style={{ fontSize: 12 }} />}
                    {hasGeo ? "Στον χάρτη" : "Χωρίς θέση"}
                  </div>
                </div>

                <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
                    {property.name}
                  </h3>
                  <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                    {property.address}, {property.city}
                  </p>
                  <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--muted-foreground)" }}>
                    <span><strong style={{ color: "var(--foreground)" }}>{property._count.units}</strong> διαμ.</span>
                    <span><strong style={{ color: "var(--foreground)" }}>{property._count.maintenanceRequests}</strong> αιτήματα</span>
                  </div>

                  <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
                    <Link
                      href={`/manager/properties/${property.id}`}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                        background: "var(--color-primary)", color: "#fff", textDecoration: "none",
                      }}
                    >
                      <RiEyeLine style={{ fontSize: 14 }} />
                      Προβολή
                    </Link>
                    {!hasGeo && <GeocodeButton propertyId={property.id} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
