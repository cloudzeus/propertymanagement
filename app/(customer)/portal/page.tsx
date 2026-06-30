import { db } from "@/lib/db";
import { auth } from "@/auth";
import Link from "next/link";
import {
  RiToolsLine,
  RiNotification2Line,
  RiArrowRightLine,
  RiCheckboxCircleLine,
  RiHome3Line,
} from "react-icons/ri";

async function getResidentData(userId: string, companyId: string | undefined) {
  const propWhere = companyId ? { companyId } : {};
  const [myRequests, announcements, resolvedRequests] = await Promise.all([
    db.maintenanceRequest.count({ where: { reportedById: userId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    db.announcement.count({ where: { building: propWhere, status: "ACTIVE" } }),
    db.maintenanceRequest.count({ where: { reportedById: userId, status: "COMPLETED" } }),
  ]);
  return { myRequests, announcements, resolvedRequests };
}

async function getRecentAnnouncements(companyId: string | undefined) {
  const propWhere = companyId ? { companyId } : {};
  return db.announcement.findMany({
    where: { building: propWhere, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
}

export default async function PortalDashboard() {
  const session = await auth();
  const userId = (session?.user as any)?.id ?? "";
  const companyId = (session?.user as any)?.companyId;
  const [data, announcements] = await Promise.all([
    getResidentData(userId, companyId),
    getRecentAnnouncements(companyId),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
          Καλώς ήρθατε, {session?.user?.name?.split(" ")[0]}
        </h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>Πύλη ενοικιαστή — Υπηρεσίες και ανακοινώσεις</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {[
          { label: "Αιτήσεις μου", value: data.myRequests, sub: "Εκκρεμείς", icon: RiToolsLine, href: "/portal/requests", color: "#CA5D00" },
          { label: "Επιλυμένες", value: data.resolvedRequests, sub: "Ολοκληρωμένες αιτήσεις", icon: RiCheckboxCircleLine, href: "/portal/requests", color: "#107C10" },
          { label: "Ανακοινώσεις", value: data.announcements, sub: "Ενεργές", icon: RiNotification2Line, href: "/portal/announcements", color: "#0078D4" },
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

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        {/* Announcements */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>Πρόσφατες Ανακοινώσεις</h2>
            <Link href="/portal/announcements" style={{ fontSize: 12, color: "var(--color-primary)", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
              Όλες <RiArrowRightLine />
            </Link>
          </div>

          {(announcements as any[]).length === 0 ? (
            <div style={{ padding: "24px 0", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
              <RiNotification2Line style={{ fontSize: 28, opacity: 0.4, display: "block", margin: "0 auto 8px" }} />
              Δεν υπάρχουν ανακοινώσεις
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(announcements as any[]).map((ann) => (
                <div key={ann.id} style={{
                  padding: "12px 14px", background: "var(--bg-canvas)", borderRadius: 6,
                  borderLeft: "3px solid var(--color-primary)",
                }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>{ann.title}</div>
                  {ann.content && (
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {ann.content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: "0 0 14px" }}>Γρήγορες Ενέργειες</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Νέα Αίτηση Συντήρησης", href: "/portal/requests", icon: RiToolsLine, color: "#CA5D00" },
              { label: "Ανακοινώσεις", href: "/portal/announcements", icon: RiNotification2Line, color: "#0078D4" },
              { label: "Το Διαμέρισμά μου", href: "/portal", icon: RiHome3Line, color: "#8764B8" },
            ].map((link) => {
              const Icon = link.icon;
              return (
                <Link key={link.href} href={link.href} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                  borderRadius: 8, background: "var(--bg-canvas)", border: "1px solid var(--border)",
                  textDecoration: "none", color: "var(--foreground)", fontSize: 13, fontWeight: 500,
                }}>
                  <Icon style={{ fontSize: 16, color: link.color, flexShrink: 0 }} />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
