import Link from "next/link";
import { redirect } from "next/navigation";
import { getEffectiveSession } from "@/lib/auth-effective";
import { getOwnerDashboard } from "@/lib/dashboard/queries";
import {
  getOwnerBuildingIds, getOwnerPortfolio, getTenantSide, getOwnerDuoRows, getOwnerBillingExplainer,
  getOwnerAnnouncementsAndFiles, type TenancyState,
} from "@/lib/dashboard/owner-queries";
import { BillingExplainer } from "@/components/dashboard/BillingExplainer";
import { formatEuro, lastNMonths } from "@/lib/dashboard/aggregations";
import { duoTrend } from "@/lib/dashboard/alloc-view";
import {
  Hero, StatTile, SectionCard, StatusChip, TicketList, EmptyState, DuoBars,
} from "@/components/dashboard";
import { AutoRefresh } from "@/components/realtime/AutoRefresh";
import { RiBuildingLine, RiHome3Line, RiKeyLine, RiMegaphoneLine, RiMoneyEuroCircleLine, RiToolsLine, RiWallet3Line } from "react-icons/ri";

const dateFmt = new Intl.DateTimeFormat("el-GR", { day: "2-digit", month: "short", year: "numeric" });
const preview = (html: string, max = 140) => {
  const text = html.replace(/<[^>]*>/g, " ").replace(/&[a-z]+;|&#\d+;/gi, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
};

const MONTH_ABBR = ["Ιαν","Φεβ","Μαρ","Απρ","Μαϊ","Ιουν","Ιουλ","Αυγ","Σεπ","Οκτ","Νοε","Δεκ"];
const monthLabel = (m: string) => `${MONTH_ABBR[Number(m.split("-")[1]) - 1]} ${m.split("-")[0]}`;
const tnums = { fontVariantNumeric: "tabular-nums" } as const;

const TENANCY: Record<TenancyState, { tone: "info" | "success" | "warning"; label: string }> = {
  SELF: { tone: "info", label: "Ιδιοκατοίκηση" },
  RENTED: { tone: "success", label: "Ενοικιασμένο" },
  VACANT: { tone: "warning", label: "Κενό" },
};

export default async function OwnerDashboard() {
  const eff = await getEffectiveSession();
  if (!eff?.user?.id) redirect("/login");
  const userId = eff.user.id;
  const [portfolio, tenantSide, duoRows, dash, buildingIds, explainer, annFiles] = await Promise.all([
    getOwnerPortfolio(userId),
    getTenantSide(userId),
    getOwnerDuoRows(userId),
    getOwnerDashboard(userId),
    getOwnerBuildingIds(userId),
    getOwnerBillingExplainer(userId),
    getOwnerAnnouncementsAndFiles(userId),
  ]);
  const { owed, tickets } = dash;
  const announcements = annFiles.announcements.slice(0, 5);
  const firstName = eff.user.name?.split(" ")[0] ?? "";

  const d = new Date();
  const today = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  // Anchor the 6-month window to the most recent month that actually has charges,
  // so the chart shows real activity (owner + tenant) even when the latest issued
  // month predates today. Falls back to the current month when there is no data.
  const latestMonth = duoRows.reduce((mx, r) => (r.month > mx ? r.month : mx), "");
  const anchor = latestMonth || today;
  const trend = duoTrend(duoRows, lastNMonths(anchor, 6));

  const totalOwed = owed + (tenantSide?.unpaidTenant ?? 0);
  const rented = portfolio.filter((u) => u.tenancy === "RENTED").length;
  const selfOcc = portfolio.filter((u) => u.tenancy === "SELF").length;
  const vacant = portfolio.filter((u) => u.tenancy === "VACANT").length;
  const occSegments = [
    { count: rented, color: "var(--color-primary)", label: "Ενοικιασμένες" },
    { count: selfOcc, color: "var(--color-accent)", label: "Ιδιοκατοίκηση" },
    { count: vacant, color: "var(--color-warning)", label: "Κενές" },
  ].filter((s) => s.count > 0);

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {buildingIds.slice(0, 5).map((id) => (
        <AutoRefresh key={id} buildingId={id} />
      ))}
      <Hero
        title={`Καλησπέρα, ${firstName}`}
        subtitle={
          `${portfolio.length} ${portfolio.length === 1 ? "μονάδα" : "μονάδες"} σε ` +
          `${buildingIds.length} ${buildingIds.length === 1 ? "κτήριο" : "κτήρια"}` +
          (tenantSide
            ? tenantSide.selfOwned
              ? ` · ιδιοκατοίκηση στη μονάδα ${tenantSide.unitNumber}`
              : ` · και ένοικος στη μονάδα ${tenantSide.unitNumber}`
            : "")
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${tenantSide ? 4 : 3}, 1fr)`, gap: 16 }} className="dash-grid">
        <StatTile
          label="Συνολικές οφειλές"
          value={<span style={tnums}>{formatEuro(totalOwed)}</span>}
          valueColor={totalOwed > 0 ? "var(--color-warning)" : "var(--foreground)"}
          sub={tenantSide ? "Ιδιοκτήτης + ένοικος" : "Ανεξόφλητα κοινόχρηστα"}
          icon={RiWallet3Line} href="/owner/payments"
        />
        <StatTile
          label="Ως ιδιοκτήτης"
          value={<span style={tnums}>{formatEuro(owed)}</span>}
          sub="Κοινόχρηστα ιδιοκτήτη" icon={RiMoneyEuroCircleLine} href="/owner/payments"
        />
        {tenantSide && (
          <StatTile
            label={tenantSide.selfOwned ? "Μερίδιο ενοίκου (ιδιοκατοίκηση)" : "Ως ένοικος"}
            value={<span style={tnums}>{formatEuro(tenantSide.unpaidTenant)}</span>}
            sub={`Μονάδα ${tenantSide.unitNumber}`} icon={RiKeyLine} href="/portal/payments"
          />
        )}
        <StatTile
          label="Ανοιχτά αιτήματα" value={tickets.length}
          sub="Στα ακίνητά μου" icon={RiToolsLine} href="/owner/requests"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }} className="dash-cols">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SectionCard title="Το χαρτοφυλάκιό μου" viewAllHref="/owner/units">
          {portfolio.length === 0 ? (
            <EmptyState icon={RiHome3Line} label="Δεν έχουν καταχωρηθεί μονάδες — επικοινωνήστε με τη διαχείριση" />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, maxHeight: 640, overflowY: "auto", paddingRight: 4 }}>
              {portfolio.map((u) => {
                const pill = {
                  display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 999,
                  border: "1px solid var(--border)", background: "var(--card)",
                  fontSize: 12, fontWeight: 600, color: "var(--foreground)", textDecoration: "none",
                  whiteSpace: "nowrap" as const,
                };
                return (
                <div key={u.id} style={{
                  display: "flex", flexDirection: "column", gap: 10, padding: 16,
                  background: "var(--bg-canvas)", borderRadius: 12,
                  border: u.tenancy === "VACANT" ? "1px solid var(--color-warning)" : "1px solid transparent",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)" }}>{u.unitNumber}</div>
                      <Link href={`/building/${u.buildingId}`} style={{ display: "block", fontSize: 12, color: "var(--muted-foreground)", marginTop: 2, textDecoration: "none" }}>
                        {u.buildingName}
                      </Link>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                      <StatusChip tone={TENANCY[u.tenancy].tone}>{TENANCY[u.tenancy].label}</StatusChip>
                      {u.tenantName && <span style={{ fontSize: 12, color: "var(--muted-foreground)", textAlign: "right" }}>{u.tenantName}</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                    Όροφος {u.floor ?? "—"} · {u.areaSqm ?? "—"} τ.μ. · {u.millesimes ?? "—"}‰
                  </div>
                  {/* Unpaid amount / paid status — own prominent line */}
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 2 }}>
                    {u.unpaidOwner > 0 ? (
                      <>
                        <span style={{ fontSize: 20, fontWeight: 700, color: "var(--color-warning)", lineHeight: 1, ...tnums }}>
                          {formatEuro(u.unpaidOwner)}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>ανεξόφλητα</span>
                      </>
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-success)" }}>Εξοφλημένο</span>
                    )}
                  </div>
                  {/* Actions — separate wrapping row of pill-links */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                    <Link href="/owner/payments" style={pill}>Κοινόχρηστα</Link>
                    <Link href="/owner/requests" style={pill}>Βλάβη</Link>
                    <Link href={`/building/${u.buildingId}`} style={pill}>Το κτήριο →</Link>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </SectionCard>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="dash-cols">
            <SectionCard title="Ανοιχτά αιτήματα συντήρησης" viewAllHref="/owner/requests">
              {tickets.length === 0 ? (
                <div style={{ padding: "24px 0", textAlign: "center" }}>
                  <RiToolsLine style={{ fontSize: 28, opacity: 0.35, display: "block", margin: "0 auto 8px", color: "var(--muted-foreground)" }} />
                  <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Κανένα ανοιχτό αίτημα</div>
                  <Link href="/owner/requests" style={{
                    display: "inline-block", marginTop: 12, padding: "6px 14px", borderRadius: 999,
                    border: "1px solid var(--border-strong)", fontSize: 12, fontWeight: 600,
                    color: "var(--foreground)", textDecoration: "none",
                  }}>
                    Δήλωση βλάβης
                  </Link>
                </div>
              ) : (
                <div style={{ maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
                  <TicketList tickets={tickets.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, createdAt: t.createdAt }))} />
                </div>
              )}
            </SectionCard>

            <SectionCard title="Ανακοινώσεις">
              {announcements.length === 0 ? (
                <EmptyState icon={RiMegaphoneLine} label="Δεν υπάρχουν ανακοινώσεις." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
                  {announcements.map((ann) => {
                    const text = preview(ann.content ?? "");
                    return (
                      <div key={ann.id} style={{
                        padding: "12px 14px", background: "var(--bg-canvas)", borderRadius: 10,
                        borderLeft: "3px solid var(--color-primary)",
                      }}>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", minWidth: 0 }}>{ann.title}</div>
                          <span style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap", ...tnums }}>
                            {dateFmt.format(ann.createdAt)}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, fontSize: 12, color: "var(--muted-foreground)" }}>
                          <RiBuildingLine style={{ fontSize: 13, flexShrink: 0 }} /> {ann.building?.name ?? "—"}
                        </div>
                        {text && (
                          <p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.45, color: "var(--muted-foreground)" }}>{text}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionCard title="Κατάσταση μονάδων">
            {portfolio.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>Καμία μονάδα.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", gap: 2 }}>
                  {occSegments.map((s) => (
                    <div key={s.label} style={{ flex: s.count, background: s.color }} />
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {occSegments.map((s) => (
                    <div key={s.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--muted-foreground)" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
                        {s.label}
                      </span>
                      <span style={{ fontWeight: 700, color: "var(--foreground)", ...tnums }}>{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Χρεώσεις 6μήνου">
            <DuoBars data={trend} />
          </SectionCard>

          {tenantSide && (
            <SectionCard title={tenantSide.selfOwned ? "Η κατοικία μου (ιδιοκατοίκηση)" : "Η κατοικία μου (ως ένοικος)"}>
              <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                {tenantSide.buildingName} · Μονάδα {tenantSide.unitNumber}
              </div>
              <div style={{
                fontSize: 30, fontWeight: 300, lineHeight: 1.05, letterSpacing: "-0.02em", marginTop: 10,
                color: tenantSide.unpaidTenant > 0 ? "var(--color-warning)" : "var(--foreground)", ...tnums,
              }}>
                {formatEuro(tenantSide.unpaidTenant)}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 6 }}>
                {tenantSide.selfOwned ? "Ανεξόφλητο μερίδιο ενοίκου" : "Ανεξόφλητα κοινόχρηστα"}
                {tenantSide.latestMonth ? ` · τελευταίος μήνας ${monthLabel(tenantSide.latestMonth)}` : ""}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                <Link href="/portal/payments" style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px",
                  borderRadius: 10, background: "var(--color-primary)", color: "#fff",
                  fontSize: 13, fontWeight: 600, textDecoration: "none",
                }}>
                  <RiWallet3Line /> Πληρωμές ενοίκου
                </Link>
                <Link href={`/building/${tenantSide.buildingId}`} style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px",
                  borderRadius: 10, border: "1px solid var(--border-strong)", color: "var(--foreground)",
                  fontSize: 13, fontWeight: 600, textDecoration: "none",
                }}>
                  <RiBuildingLine /> Το κτήριό μου
                </Link>
              </div>
            </SectionCard>
          )}
        </div>
      </div>

      {explainer.length > 0 && <BillingExplainer buildings={explainer} />}
    </div>
  );
}
