import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  RiBuildingLine,
  RiArrowLeftLine,
  RiMapPin2Line,
  RiHome2Line,
  RiToolsLine,
  RiMegaphoneLine,
  RiPencilLine,
} from "react-icons/ri";
import { PropertyMap } from "@/components/maps/PropertyMap";
import { GeocodePicker } from "@/components/maps/GeocodePicker";

type Props = { params: Promise<{ id: string }> };

export default async function PropertyDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id as string },
    select: { companyId: true, role: true },
  });
  if (!user?.companyId) redirect("/admin");

  const property = await db.building.findUnique({
    where: { id, companyId: user.companyId },
    include: {
      _count: {
        select: {
          units: true,
          maintenanceRequests: true,
          announcements: true,
          users: true,
        },
      },
      units: { orderBy: { unitNumber: "asc" }, take: 10 },
      maintenanceRequests: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { reportedBy: { select: { name: true } } },
      },
      announcements: { orderBy: { createdAt: "desc" }, take: 3 },
    },
  });

  if (!property) notFound();

  const hasGeo = property.lat !== null && property.lng !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Back + title */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link
          href="/admin/properties"
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
            {property.address}, {property.city} {property.postalCode} · {property.country}
          </p>
        </div>
        <Link
          href={`/admin/properties/${id}/edit`}
          style={{
            marginLeft: "auto", display: "flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600,
            border: "1px solid var(--border)", background: "var(--card)",
            color: "var(--foreground)", textDecoration: "none",
          }}
        >
          <RiPencilLine style={{ fontSize: 14 }} />
          Επεξεργασία
        </Link>
      </div>

      {/* Stats strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { icon: RiHome2Line, label: "Διαμερίσματα", value: property._count.units },
          { icon: RiToolsLine, label: "Αιτήματα", value: property._count.maintenanceRequests },
          { icon: RiMegaphoneLine, label: "Ανακοινώσεις", value: property._count.announcements },
          { icon: RiBuildingLine, label: "Χρήστες", value: property._count.users },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} style={{
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "14px 16px",
            display: "flex", flexDirection: "column", gap: 4,
          }}>
            <Icon style={{ fontSize: 18, color: "var(--color-primary)" }} />
            <span style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)" }}>{value}</span>
            <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Two-column layout: map + side info */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>
        {/* Map panel */}
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 10, padding: 20, display: "flex", flexDirection: "column", gap: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <RiMapPin2Line style={{ fontSize: 18, color: "var(--color-primary)" }} />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
              Τοποθεσία στον χάρτη
            </h2>
          </div>

          {hasGeo ? (
            <PropertyMap lat={property.lat!} lng={property.lng!} name={property.name} />
          ) : (
            <GeocodePicker propertyId={property.id} address={`${property.address}, ${property.city}`} />
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Recent maintenance */}
          <div style={{
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 10, padding: 16,
          }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", margin: "0 0 12px" }}>
              Πρόσφατα αιτήματα
            </h3>
            {property.maintenanceRequests.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Κανένα αίτημα</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {property.maintenanceRequests.map((req) => (
                  <div key={req.id} style={{
                    padding: "8px 10px", borderRadius: 6,
                    background: "var(--bg-canvas)", fontSize: 12,
                  }}>
                    <div style={{ fontWeight: 600, color: "var(--foreground)" }}>{req.title}</div>
                    <div style={{ color: "var(--muted-foreground)", marginTop: 2 }}>
                      {req.reportedBy?.name} · {statusLabel(req.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent announcements */}
          <div style={{
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 10, padding: 16,
          }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", margin: "0 0 12px" }}>
              Ανακοινώσεις
            </h3>
            {property.announcements.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Καμία ανακοίνωση</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {property.announcements.map((ann) => (
                  <div key={ann.id} style={{
                    padding: "8px 10px", borderRadius: 6,
                    background: "var(--bg-canvas)", fontSize: 12,
                  }}>
                    <div style={{ fontWeight: 600, color: "var(--foreground)" }}>{ann.title}</div>
                    <div style={{ color: "var(--muted-foreground)", marginTop: 2 }}>
                      {ann.createdAt.toLocaleDateString("el-GR")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Units list */}
          <div style={{
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 10, padding: 16,
          }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", margin: "0 0 12px" }}>
              Διαμερίσματα {property._count.units > 10 && `(+${property._count.units - 10} ακόμα)`}
            </h3>
            {property.units.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Κανένα διαμέρισμα</p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {property.units.map((unit) => (
                  <div key={unit.id} style={{
                    padding: "4px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                    background: unit.residentId ? "#16a34a18" : "var(--bg-canvas)",
                    color: unit.residentId ? "#16a34a" : "var(--muted-foreground)",
                    border: `1px solid ${unit.residentId ? "#16a34a30" : "var(--border)"}`,
                  }}>
                    {unit.unitNumber}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    OPEN: "Ανοιχτό",
    IN_PROGRESS: "Σε εξέλιξη",
    COMPLETED: "Ολοκληρώθηκε",
    CANCELLED: "Ακυρώθηκε",
  };
  return map[status] ?? status;
}
