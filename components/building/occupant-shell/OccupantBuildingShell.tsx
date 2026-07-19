"use client";

import { useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  RiArrowRightLine, RiBuildingLine, RiCalendarTodoLine, RiContactsBook3Line, RiDashboardLine,
  RiFolderLine, RiGroupLine, RiHome3Line, RiHome4Line, RiListCheck2, RiMailLine, RiMapPinLine,
  RiMegaphoneLine, RiMoneyEuroCircleLine, RiPhoneLine, RiSettings3Line, RiSpeedUpLine,
  RiToolsLine, RiWallet3Line,
} from "react-icons/ri";
import type { OccupantData } from "@/lib/building/occupant-data";
import { ManagedBadge } from "@/components/ui/managed-badge";
import { AutoRefresh } from "@/components/realtime/AutoRefresh";
import { EmptyState, StatusChip } from "@/components/dashboard";
import { FilesList, type FileListGroup } from "@/components/dashboard/files-list";
import { StatementView } from "./StatementView";
import { ExpensesSection } from "./ExpensesSection";
import { InstallationsSection } from "./InstallationsSection";
import { UnitsSection } from "./UnitsSection";
import { MaintenanceSection } from "./MaintenanceSection";
import { MetersSection } from "./MetersSection";
import { ManagedItemsSection } from "./ManagedItemsSection";
import { AssembliesSection } from "./AssembliesSection";

type SectionKey =
  | "overview" | "koino" | "expenses" | "units" | "infra" | "maintenance" | "meters" | "items"
  | "assemblies" | "files" | "contacts" | "ann";

const SECTIONS: { key: SectionKey; label: string; icon: React.ElementType; managedOnly?: boolean }[] = [
  { key: "overview", label: "Επισκόπηση", icon: RiDashboardLine },
  { key: "koino", label: "Κοινόχρηστα", icon: RiWallet3Line },
  { key: "expenses", label: "Έξοδα", icon: RiMoneyEuroCircleLine },
  { key: "units", label: "Μονάδες", icon: RiHome3Line },
  { key: "infra", label: "Εγκαταστάσεις", icon: RiSettings3Line },
  { key: "maintenance", label: "Συντηρήσεις", icon: RiCalendarTodoLine },
  { key: "meters", label: "Μετρητές", icon: RiSpeedUpLine },
  { key: "items", label: "Διαχ. στοιχεία", icon: RiListCheck2, managedOnly: true },
  { key: "assemblies", label: "Συνελεύσεις", icon: RiGroupLine },
  { key: "files", label: "Έγγραφα", icon: RiFolderLine },
  { key: "contacts", label: "Επαφές", icon: RiContactsBook3Line },
  { key: "ann", label: "Ανακοινώσεις", icon: RiMegaphoneLine },
];

const UNIT_TYPE: Record<string, string> = {
  APARTMENT: "Διαμέρισμα", SHOP: "Κατάστημα", PARKING: "Θέση στάθμευσης", OTHER: "Χώρος",
};
const AUDIENCE: Record<string, string> = { ALL: "Όλοι", OWNERS: "Ιδιοκτήτες", RESIDENTS: "Ένοικοι" };

const FILE_CATS: { key: string; label: string }[] = [
  { key: "PLANS", label: "Σχέδια & Κατόψεις" },
  { key: "PHOTOS", label: "Φωτογραφίες" },
  { key: "DOCUMENTS", label: "Έγγραφα" },
  { key: "CERTIFICATES", label: "Πιστοποιητικά" },
  { key: "OTHER", label: "Λοιπά" },
];

const eur = (n: number) => `${n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const mill = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("el-GR", { maximumFractionDigits: 2 })}‰`);
const monthLabel = (m: string) => {
  const d = new Date(`${m}-01T12:00:00`);
  const s = new Intl.DateTimeFormat("el-GR", { month: "long", year: "numeric" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const fmtLongDate = (iso: string) => new Date(iso).toLocaleDateString("el-GR", { day: "2-digit", month: "long", year: "numeric" });
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("el-GR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const floorLabel = (f: number | null) => (f == null ? null : f === 0 ? "Ισόγειο" : f < 0 ? "Υπόγειο" : `${f}ος όροφος`);
const stripHtml = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const card: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", padding: 18,
};
const cardCaps: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--muted-foreground)",
};

type Props = OccupantData & {
  /** Effective role of the viewer — picks the surface for the «Δήλωση βλάβης» shortcut. */
  viewerRole: string;
  /** From getBuildingAccess — falls back to building.managed when absent. */
  managed?: boolean;
  /** Optional precomputed labels; derived from myUnits when omitted. */
  myUnitLabels?: string[];
};

/**
 * Read-only occupant control center for /building/[id] — the owner/resident
 * counterpart of BuildingManagerShell (same pill/hero/?s= idiom, zero mutations).
 */
export function OccupantBuildingShell(props: Props) {
  const {
    building, myUnits, months, selectedMonth, statements, managerName, expenses,
    heatingReadings, gallery, infra, units, tasks, maintenanceHistory, meterReadings, managedItems,
    assemblies, files, contacts, announcements, viewerRole, managed,
  } = props;

  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const isManaged = managed ?? building.managed;
  const myUnitIds = myUnits.map((u) => u.id);
  const visibleSections = SECTIONS.filter((s) => !s.managedOnly || isManaged);

  const sParam = search.get("s");
  const section: SectionKey = visibleSections.some((x) => x.key === sParam) ? (sParam as SectionKey) : "overview";

  const navigate = useCallback((s: SectionKey) => {
    const q = new URLSearchParams();
    if (s !== "overview") q.set("s", s);
    const month = search.get("month");
    if (month && (s === "koino" || s === "expenses")) q.set("month", month);
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, search]);

  const requestsHref = viewerRole === "PROPERTY_OWNER" ? "/owner/requests" : "/portal/requests";

  const subParts = [
    [building.address, building.city].filter(Boolean).join(", ") || null,
    building.floors ? `${building.floors} όροφοι` : null,
    building.hasElevator ? "Ανελκυστήρας" : null,
  ].filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <AutoRefresh buildingId={building.id} />

      {/* hero */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ width: 54, height: 54, borderRadius: 8, background: "color-mix(in srgb, var(--color-primary) 9%, transparent)", color: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RiBuildingLine style={{ fontSize: 28 }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.15, color: "var(--foreground)" }}>{building.name}</div>
              <ManagedBadge managed={isManaged} />
            </div>
            <div style={{ fontSize: 13, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><RiMapPinLine /> {building.postalCode || "—"}</span>
              {subParts.map((p, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--border-strong)" }} />{p}
                </span>
              ))}
              {myUnits.map((u) => (
                <span key={u.id} style={{
                  display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 10px", borderRadius: 999,
                  background: "color-mix(in srgb, var(--color-accent) 16%, transparent)", color: "var(--foreground)",
                  fontWeight: 700, fontSize: 12, whiteSpace: "nowrap",
                }}>
                  <RiHome4Line /> Η μονάδα μου: {u.unitNumber}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* section pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {visibleSections.map((s) => {
          const Icon = s.icon;
          const active = section === s.key;
          return (
            <button key={s.key} onClick={() => navigate(s.key)} style={{
              display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 9999,
              padding: "10px 16px", minHeight: 40, fontSize: 13, fontWeight: 700, cursor: "pointer",
              border: `1px solid ${active ? "var(--color-primary)" : "var(--border)"}`,
              background: active ? "var(--color-primary)" : "var(--card)",
              color: active ? "#fff" : "var(--muted-foreground)",
            }}>
              <Icon style={{ fontSize: 16 }} /> {s.label}
            </button>
          );
        })}
      </div>

      {/* sections */}
      <div>
        {section === "overview" ? (
          <Overview
            myUnits={myUnits}
            months={months}
            selectedMonth={selectedMonth}
            statements={statements}
            announcements={announcements}
            assemblies={assemblies}
            requestsHref={requestsHref}
            onNavigate={navigate}
          />
        ) : section === "koino" ? (
          <StatementView
            building={building}
            statements={statements}
            months={months}
            selectedMonth={selectedMonth}
            managerName={managerName}
            heatingReadings={heatingReadings}
          />
        ) : section === "expenses" ? (
          <ExpensesSection expenses={expenses} months={months} selectedMonth={selectedMonth} />
        ) : section === "units" ? (
          <UnitsSection units={units} myUnitIds={myUnitIds} />
        ) : section === "infra" ? (
          <InstallationsSection infra={infra} buildingPhotos={gallery.buildingPhotos} />
        ) : section === "maintenance" ? (
          <MaintenanceSection tasks={tasks} maintenanceHistory={maintenanceHistory} />
        ) : section === "meters" ? (
          <MetersSection meterReadings={meterReadings} />
        ) : section === "items" ? (
          <ManagedItemsSection managedItems={managedItems} />
        ) : section === "assemblies" ? (
          <AssembliesSection assemblies={assemblies} />
        ) : section === "files" ? (
          <FilesSection files={files} />
        ) : section === "contacts" ? (
          <ContactsSection contacts={contacts} />
        ) : (
          <AnnouncementsSection announcements={announcements} />
        )}
      </div>
    </div>
  );
}

/* ─── Επισκόπηση ─────────────────────────────────────────────────────────── */

function Overview({ myUnits, months, selectedMonth, statements, announcements, assemblies, requestsHref, onNavigate }: {
  myUnits: OccupantData["myUnits"];
  months: OccupantData["months"];
  selectedMonth: string;
  statements: OccupantData["statements"];
  announcements: OccupantData["announcements"];
  assemblies: OccupantData["assemblies"];
  requestsHref: string;
  onNavigate: (s: SectionKey) => void;
}) {
  // Overview aggregates across ALL the viewer's units: total payable + settled
  // only when every unit's role-relevant side is paid.
  const payable = Math.round(statements.reduce((a, s) => a + s.myPayable, 0) * 100) / 100;
  const settled = statements.every((s) =>
    s.role === "OWNER" ? s.ownerPaid !== false
    : s.role === "RESIDENT" ? s.tenantPaid !== false
    : s.tenantPaid !== false && s.ownerPaid !== false,
  );
  const now = Date.now();
  const nextAssembly = assemblies
    .filter((a) => a.status !== "CANCELLED" && new Date(a.scheduledAt).getTime() >= now)
    .pop(); // list is desc — the last future entry is the soonest
  const latestAnn = announcements[0];

  return (
    <div className="dash-cols" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, alignItems: "start" }}>
      {/* left: my units + current month */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: myUnits.length > 1 ? "repeat(auto-fill, minmax(280px, 1fr))" : "1fr", gap: 16 }}>
          {myUnits.map((u) => (
            <div key={u.id} style={card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: "color-mix(in srgb, var(--color-accent) 16%, transparent)", color: "var(--foreground)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <RiHome4Line style={{ fontSize: 20 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "var(--foreground)" }}>Μονάδα {u.unitNumber}</div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                      {[UNIT_TYPE[u.unitType] ?? u.unitType, floorLabel(u.floor), u.areaSqm != null ? `${u.areaSqm.toLocaleString("el-GR", { maximumFractionDigits: 1 })} μ²` : null]
                        .filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </div>
                <StatusChip tone={u.isOwner ? "accent" : "info"}>{u.rel}</StatusChip>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 14 }}>
                <MilleStat label="Κοινόχρηστα" value={mill(u.millesimes)} />
                <MilleStat label="Ανελκυστήρας" value={mill(u.millesimesElevator)} />
                <MilleStat label="Θέρμανση" value={mill(u.millesimesHeating)} />
              </div>
            </div>
          ))}
        </div>

        {/* current-month tile */}
        <button type="button" onClick={() => onNavigate("koino")} className="dash-tile" style={{ ...card, textAlign: "left", cursor: "pointer", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={cardCaps}>Κοινόχρηστα · {monthLabel(selectedMonth)}</div>
              {months.length === 0 ? (
                <div style={{ fontSize: 14, color: "var(--muted-foreground)", marginTop: 8 }}>Δεν έχουν εκδοθεί ακόμη κοινόχρηστα.</div>
              ) : (
                <>
                  <div style={{ fontSize: 30, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "var(--foreground)", marginTop: 4, lineHeight: 1.15 }}>
                    {eur(payable)}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 2 }}>Το μερίδιό μου για τον μήνα</div>
                </>
              )}
            </div>
            {months.length > 0 && (
              <StatusChip tone={settled ? "success" : "warning"}>{settled ? "Εξοφλημένο" : "Εκκρεμεί"}</StatusChip>
            )}
          </div>
          <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 700, color: "var(--color-primary)", display: "inline-flex", alignItems: "center", gap: 5 }}>
            Προβολή ειδοποιητηρίου <RiArrowRightLine />
          </div>
        </button>
      </div>

      {/* right: quick actions + next assembly + latest announcement */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={card}>
          <div style={cardCaps}>Γρήγορες ενέργειες</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            <Link href={requestsHref} style={quickAction}>
              <RiToolsLine style={{ fontSize: 17 }} /> Δήλωση βλάβης
            </Link>
            <button type="button" onClick={() => onNavigate("koino")} style={quickAction}>
              <RiWallet3Line style={{ fontSize: 17 }} /> Ειδοποιητήριο κοινοχρήστων
            </button>
            <button type="button" onClick={() => onNavigate("infra")} style={quickAction}>
              <RiSettings3Line style={{ fontSize: 17 }} /> Εγκαταστάσεις & κλειδιά
            </button>
            <button type="button" onClick={() => onNavigate("units")} style={quickAction}>
              <RiHome3Line style={{ fontSize: 17 }} /> Μονάδες κτηρίου
            </button>
          </div>
        </div>

        <div style={card}>
          <div style={cardCaps}>Επόμενη συνέλευση</div>
          {nextAssembly ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>{nextAssembly.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 3, fontVariantNumeric: "tabular-nums" }}>
                {fmtDateTime(nextAssembly.scheduledAt)}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 10 }}>Δεν υπάρχει προγραμματισμένη συνέλευση.</div>
          )}
          <button type="button" onClick={() => onNavigate("assemblies")} style={cardLink}>
            Όλες οι συνελεύσεις <RiArrowRightLine />
          </button>
        </div>

        <div style={card}>
          <div style={cardCaps}>Τελευταία ανακοίνωση</div>
          {latestAnn ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>{latestAnn.title}</div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 3 }}>{fmtLongDate(latestAnn.createdAt)}</div>
              <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 6, lineHeight: 1.5 }}>
                {stripHtml(latestAnn.content).slice(0, 150)}{stripHtml(latestAnn.content).length > 150 ? "…" : ""}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 10 }}>Δεν υπάρχουν ενεργές ανακοινώσεις.</div>
          )}
          <button type="button" onClick={() => onNavigate("ann")} style={cardLink}>
            Όλες οι ανακοινώσεις <RiArrowRightLine />
          </button>
        </div>
      </div>
    </div>
  );
}

function MilleStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--bg-canvas)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", color: "var(--muted-foreground)" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "var(--foreground)", marginTop: 2 }}>{value}</div>
    </div>
  );
}

const quickAction: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 9, padding: "11px 13px", borderRadius: 9,
  border: "1px solid var(--border)", background: "var(--bg-canvas)", color: "var(--foreground)",
  fontSize: 13.5, fontWeight: 700, cursor: "pointer", textDecoration: "none", textAlign: "left", width: "100%",
};
const cardLink: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5, marginTop: 12, padding: 0,
  border: "none", background: "transparent", color: "var(--muted-foreground)",
  fontSize: 12, fontWeight: 600, cursor: "pointer",
};

/* ─── Έγγραφα ────────────────────────────────────────────────────────────── */

function FilesSection({ files }: { files: OccupantData["files"] }) {
  const groups: FileListGroup[] = FILE_CATS
    .map((c) => ({ building: c.label, files: files.filter((f) => f.category === c.key) }))
    .filter((g) => g.files.length > 0);
  return <FilesList groups={groups} emptyLabel="Δεν υπάρχουν διαθέσιμα έγγραφα για το κτήριο." />;
}

/* ─── Επαφές ─────────────────────────────────────────────────────────────── */

function ContactsSection({ contacts }: { contacts: OccupantData["contacts"] }) {
  if (contacts.length === 0) {
    return <EmptyState icon={RiContactsBook3Line} label="Δεν υπάρχουν καταχωρημένες επαφές για το κτήριο." />;
  }
  // Deliberately NO notes here — they can carry staff-internal remarks.
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12 }}>
      {contacts.map((c) => (
        <div key={c.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>{c.name}</div>
            {c.category && <StatusChip tone="neutral">{c.category}</StatusChip>}
          </div>
          {c.phone && (
            <a href={`tel:${c.phone}`} style={contactRow}><RiPhoneLine style={{ color: "var(--muted-foreground)" }} /> {c.phone}</a>
          )}
          {c.email && (
            <a href={`mailto:${c.email}`} style={contactRow}><RiMailLine style={{ color: "var(--muted-foreground)" }} /> {c.email}</a>
          )}
          {!c.phone && !c.email && (
            <div style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>Χωρίς στοιχεία επικοινωνίας</div>
          )}
        </div>
      ))}
    </div>
  );
}

const contactRow: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)",
  textDecoration: "none", fontWeight: 500,
};

/* ─── Ανακοινώσεις ───────────────────────────────────────────────────────── */

function AnnouncementsSection({ announcements }: { announcements: OccupantData["announcements"] }) {
  if (announcements.length === 0) {
    return <EmptyState icon={RiMegaphoneLine} label="Δεν υπάρχουν ενεργές ανακοινώσεις." />;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 900 }}>
      {announcements.map((a) => (
        <div key={a.id} style={{
          background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-card)", padding: 20,
        }}>
          {a.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.imageUrl} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 10, marginBottom: 14 }} />
          )}
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>{a.title}</h2>
              <StatusChip tone="neutral">{AUDIENCE[a.audience] ?? a.audience}</StatusChip>
            </div>
            <span style={{ fontSize: 12, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
              {fmtLongDate(a.publishedAt ?? a.createdAt)}
            </span>
          </div>
          <div
            style={{ fontSize: 13, lineHeight: 1.6, color: "var(--foreground)" }}
            dangerouslySetInnerHTML={{ __html: a.content }}
          />
        </div>
      ))}
    </div>
  );
}
