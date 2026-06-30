import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  RiArrowLeftLine,
  RiMapPin2Line,
  RiHome2Line,
  RiToolsLine,
  RiBuildingLine,
} from "react-icons/ri";
import { PropertyMap } from "@/components/maps/PropertyMap";
import { GeocodePicker } from "@/components/maps/GeocodePicker";

type Props = { params: Promise<{ id: string }> };

export default async function ManagerPropertyDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id as string },
    select: { companyId: true, role: true },
  });
  if (!user?.companyId) redirect("/manager");

  const property = await db.building.findUnique({
    where: { id, companyId: user.companyId },
    include: {
      _count: {
        select: { units: true, maintenanceRequests: true, announcements: true, users: true },
      },
      units: { orderBy: { unitNumber: "asc" }, take: 10 },
      maintenanceRequests: {
        orderBy: { createdAt: "desc" }, take: 5,
        include: { reportedBy: { select: { name: true } } },
      },
      announcements: { orderBy: { createdAt: "desc" }, take: 3 },
    },
  });

  if (!property) notFound();

  const hasGeo = property.lat !== null && property.lng !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link
          href="/manager/properties"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 32, height: 32, borderRadius: 6,
            border: "1px solid var(--border)", background: "var(--card)",
            color: "var(--muted-foreground)", textDecoration: "none",
          }}
        >
          <RiArrowLeftLine style={{ fontSize: 16 }} />
        </Link>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
            {property.name}
          </h1>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
            {property.address}, {property.city} {property.postalCode}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { icon: RiHome2Line, label: "Διαμερίσματα", value: property._count.units },
          { icon: RiToolsLine, label: "Αιτήματα", value: property._count.maintenanceRequests },
          { icon: RiBuildingLine, label: "Ανακοινώσεις", value: property._count.announcements },
          { icon: RiBuildingLine, label: "Χρήστες", value: property._count.users },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} style={{
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "12px 14px",
            display: "flex", flexDirection: "column", gap: 4,
          }}>
            <Icon style={{ fontSize: 16, color: "var(--color-primary)" }} />
            <span style={{ fontSize: 20, fontWeight: 700, color: "var(--foreground)" }}>{value}</span>
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{label}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>
        {/* Map */}
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 10, padding: 20, display: "flex", flexDirection: "column", gap: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <RiMapPin2Line style={{ fontSize: 18, color: "var(--color-primary)" }} />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
              Τοποθεσία
            </h2>
          </div>
          {hasGeo ? (
            <PropertyMap lat={property.lat!} lng={property.lng!} name={property.name} />
          ) : (
            <GeocodePicker propertyId={property.id} address={`${property.address}, ${property.city}`} />
          )}
        </div>

        {/* Side info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Maintenance */}
          <div style={{
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 10, padding: 14,
          }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", margin: "0 0 10px" }}>
              Πρόσφατα αιτήματα
            </h3>
            {property.maintenanceRequests.length === 0
              ? <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Κανένα</p>
              : property.maintenanceRequests.map((req) => (
                <div key={req.id} style={{
                  padding: "7px 9px", borderRadius: 5, background: "var(--bg-canvas)",
                  fontSize: 12, marginBottom: 6,
                }}>
                  <div style={{ fontWeight: 600, color: "var(--foreground)" }}>{req.title}</div>
                  <div style={{ color: "var(--muted-foreground)" }}>{req.reportedBy?.name}</div>
                </div>
              ))
            }
          </div>

          {/* Units */}
          <div style={{
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 10, padding: 14,
          }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", margin: "0 0 10px" }}>
              Διαμερίσματα
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {property.units.map((unit) => (
                <div key={unit.id} style={{
                  padding: "3px 7px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                  background: unit.residentId ? "#16a34a18" : "var(--bg-canvas)",
                  color: unit.residentId ? "#16a34a" : "var(--muted-foreground)",
                  border: `1px solid ${unit.residentId ? "#16a34a30" : "var(--border)"}`,
                }}>
                  {unit.unitNumber}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
