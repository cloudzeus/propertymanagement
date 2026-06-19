import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  RiBuildingLine,
  RiMapPin2Line,
  RiMapPinLine,
  RiAddLine,
  RiEyeLine,
} from "react-icons/ri";
import { GeocodeButton } from "@/components/maps/GeocodeButton";

export default async function AdminPropertiesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id as string },
    select: { companyId: true, role: true },
  });
  if (!user?.companyId) redirect("/admin");

  const properties = await db.building.findMany({
    where: { companyId: user.companyId },
    include: {
      _count: { select: { units: true, maintenanceRequests: true } },
    },
    orderBy: { name: "asc" },
  });

  const withGeo = properties.filter((p) => p.lat !== null && p.lng !== null).length;
  const withoutGeo = properties.length - withGeo;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
            Κτήρια
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
            {properties.length} κτήρια · {withGeo} με χάρτη · {withoutGeo} χωρίς γεωδεδομένα
          </p>
        </div>
        <Link
          href="/admin/properties/new"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 6,
            background: "var(--color-primary)", color: "#fff",
            textDecoration: "none", fontSize: 13, fontWeight: 600,
          }}
        >
          <RiAddLine style={{ fontSize: 16 }} />
          Νέο κτήριο
        </Link>
      </div>

      {/* Properties grid */}
      {properties.length === 0 ? (
        <div style={{
          padding: "48px 24px", textAlign: "center",
          border: "2px dashed var(--border)", borderRadius: 12,
          color: "var(--muted-foreground)",
        }}>
          <RiBuildingLine style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }} />
          <p style={{ fontSize: 15, fontWeight: 600 }}>Δεν υπάρχουν κτήρια</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Προσθέστε το πρώτο κτήριο για να ξεκινήσετε</p>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 16,
        }}>
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}
    </div>
  );
}

type PropertyWithCount = {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  imageUrl: string | null;
  lat: number | null;
  lng: number | null;
  unitsCount: number;
  _count: { units: number; maintenanceRequests: number };
  createdAt: Date;
};

function PropertyCard({ property }: { property: PropertyWithCount }) {
  const hasGeo = property.lat !== null && property.lng !== null;

  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Image / placeholder */}
      <div style={{
        height: 140,
        background: property.imageUrl
          ? `url(${property.imageUrl}) center/cover`
          : "linear-gradient(135deg, var(--color-primary)22 0%, var(--color-primary)08 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}>
        {!property.imageUrl && (
          <RiBuildingLine style={{ fontSize: 48, color: "var(--color-primary)", opacity: 0.4 }} />
        )}
        {/* Geo badge */}
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

      {/* Content */}
      <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
            {property.name}
          </h3>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
            {property.address}, {property.city} {property.postalCode}
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--muted-foreground)" }}>
          <span><strong style={{ color: "var(--foreground)" }}>{property._count.units}</strong> διαμερίσματα</span>
          <span><strong style={{ color: "var(--foreground)" }}>{property._count.maintenanceRequests}</strong> αιτήματα</span>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 8 }}>
          <Link
            href={`/admin/properties/${property.id}`}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "7px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: "var(--color-primary)", color: "#fff", textDecoration: "none",
            }}
          >
            <RiEyeLine style={{ fontSize: 14 }} />
            Προβολή
          </Link>

          {!hasGeo && (
            <GeocodeButton propertyId={property.id} />
          )}
        </div>
      </div>
    </div>
  );
}
