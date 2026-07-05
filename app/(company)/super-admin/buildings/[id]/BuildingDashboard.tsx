"use client";

import { useState } from "react";
import Link from "next/link";
import {
  RiBuildingLine, RiMapPinLine, RiArrowRightSLine, RiEditLine, RiAddLine,
  RiDashboardLine, RiHome4Line, RiGroupLine, RiUserStarLine, RiFolderLine,
  RiCalendarTodoLine, RiContactsBook3Line, RiSettings3Line, RiWallet3Line,
  RiBankCardLine, RiToolsLine, RiMegaphoneLine, RiScales3Line, RiMoneyEuroCircleLine,
  RiPieChartLine, RiSpeedUpLine, RiAlarmWarningLine,
} from "react-icons/ri";
import { CategorySplitSettings } from "@/components/buildings/CategorySplitSettings";
import { FilesPanel, type FileRow } from "./FilesPanel";
import { PeoplePanel, type Person } from "./PeoplePanel";
import { UnitsPanel, type Unit } from "./UnitsPanel";
import { ManagersPanel } from "./ManagersPanel";
import { AnnouncementsPanel } from "./AnnouncementsPanel";
import { AssembliesPanel } from "./AssembliesPanel";
import { ContactsPanel, type ContactRow } from "./ContactsPanel";
import { InfraPanel, type InfraRow } from "./InfraPanel";
import { CalendarPanel, type TaskRow } from "./CalendarPanel";
import { ExpensesPanel, type ExpenseRow } from "@/components/buildings/ExpensesPanel";
import { KoinochristaPanel } from "@/components/buildings/KoinochristaPanel";
import { type CategorySplit } from "@/components/buildings/ExpenseReviewForm";
import { MillesimeGrid, type MillesimeUnit } from "./MillesimeGrid";
import { DistributionTab } from "./DistributionTab";
import { ExclusionMatrix } from "./ExclusionMatrix";
import { HeatingReadingsPanel } from "./HeatingReadingsPanel";
import { type HeatingReadingDTO } from "@/app/actions/heating-readings";
import { MeterReadingsPanel, type MeterReadingDTO } from "./MeterReadingsPanel";
import { MaintenanceTab, type MaintenanceHistoryRow } from "./MaintenanceTab";
import { AuditDrawer } from "./AuditDrawer";
import type { AuditTab } from "@/lib/buildings/audit";

type Building = {
  id: string; name: string; address: string; city: string; postalCode: string;
  floors: number | null; basements: number | null; hasElevator: boolean;
  propertyId: string; propertyName: string; customerName: string;
  elevatorSurchargePerFloor: number; elevatorExemptGroundFloor: boolean;
  heatingMeterUnit: string | null;
};
type Kpis = {
  units: number; millesimes: number; files: number;
  infraPoints: number; contacts: number; recurringTasks: number;
};
type OverviewData = {
  paid: number; unpaid: number; openCount: number;
  openRequests: { id: string; title: string; status: string; priority: string; createdAt: string }[];
  upcomingTasks: { id: string; title: string; nextDueDate: string | null }[];
};

type TabKey =
  | "overview" | "units" | "people" | "managers" | "files" | "calendar"
  | "contacts" | "infra" | "expenses" | "readings" | "splitsettings" | "millesimes" | "koino" | "pay" | "maint" | "maintenance" | "ann" | "assemblies";

const TABS: { key: TabKey; label: string; icon: React.ElementType; badge?: (k: Kpis) => number | undefined }[] = [
  { key: "overview", label: "Επισκόπηση", icon: RiDashboardLine },
  { key: "units", label: "Μονάδες", icon: RiHome4Line, badge: (k) => k.units || undefined },
  { key: "people", label: "Ένοικοι", icon: RiGroupLine },
  { key: "managers", label: "Διαχειριστές", icon: RiUserStarLine },
  { key: "files", label: "Αρχεία", icon: RiFolderLine, badge: (k) => k.files || undefined },
  { key: "calendar", label: "Ημερολόγιο", icon: RiCalendarTodoLine, badge: (k) => k.recurringTasks || undefined },
  { key: "contacts", label: "Επαφές", icon: RiContactsBook3Line, badge: (k) => k.contacts || undefined },
  { key: "infra", label: "Εγκαταστάσεις", icon: RiSettings3Line, badge: (k) => k.infraPoints || undefined },
  { key: "expenses", label: "Έξοδα", icon: RiMoneyEuroCircleLine },
  { key: "readings", label: "Ενδείξεις μετρητών", icon: RiSpeedUpLine },
  { key: "splitsettings", label: "Ρυθμίσεις κατανομής", icon: RiPieChartLine },
  { key: "millesimes", label: "Χιλιοστά & Κατανομή", icon: RiScales3Line },
  { key: "koino", label: "Κοινόχρηστα", icon: RiWallet3Line },
  { key: "pay", label: "Πληρωμές", icon: RiBankCardLine },
  { key: "maint", label: "Αιτήματα βλαβών", icon: RiAlarmWarningLine },
  { key: "maintenance", label: "Συντηρήσεις", icon: RiToolsLine, badge: (k) => k.recurringTasks || undefined },
  { key: "ann", label: "Ανακοινώσεις", icon: RiMegaphoneLine },
  { key: "assemblies", label: "Συνελεύσεις", icon: RiGroupLine },
];

export function BuildingDashboard({ building, kpis, units, files, people, contacts, infraPoints, floorOptions, tasks, expenses, categorySplits, today, millesimeUnits, exclusionUnits, expenseCategories, categoryOverrides, unitExclusions, usesMeteredHeating, heatingPeriod, heatingReadingRows, meterReadingRows, overview, maintenanceHistory }: { building: Building; kpis: Kpis; units: Unit[]; files: FileRow[]; people: Person[]; contacts: ContactRow[]; infraPoints: InfraRow[]; floorOptions: string[]; tasks: TaskRow[]; expenses: ExpenseRow[]; categorySplits: CategorySplit[]; today: string; millesimeUnits: MillesimeUnit[]; exclusionUnits: Array<{ id: string; unitNumber: string; unitType: string }>; expenseCategories: Array<{ id: string; name: string; defaultBasis: string }>; categoryOverrides: Array<{ categoryId: string; distributionBasis: string | null }>; unitExclusions: Array<{ unitId: string; categoryId: string }>; usesMeteredHeating: boolean; heatingPeriod: string; heatingReadingRows: HeatingReadingDTO[]; meterReadingRows: MeterReadingDTO[]; overview: OverviewData; maintenanceHistory: MaintenanceHistoryRow[] }) {
  const [tab, setTab] = useState<TabKey>("overview");

  const subParts = [
    [building.address, building.city].filter(Boolean).join(", ") || null,
    building.floors ? `${building.floors} όροφοι` : null,
    building.basements ? `${building.basements} υπόγεια` : null,
    building.hasElevator ? "Ανελκυστήρας" : null,
  ].filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted-foreground)" }}>
        <Link href="/super-admin/properties" style={{ color: "var(--muted-foreground)", textDecoration: "none" }}>Ιδιοκτησίες</Link>
        <RiArrowRightSLine />
        <Link href={`/super-admin/properties/${building.propertyId}`} style={{ color: "var(--muted-foreground)", textDecoration: "none" }}>{building.propertyName}</Link>
        <RiArrowRightSLine />
        <span style={{ color: "var(--foreground)", fontWeight: 600 }}>{building.name}</span>
      </div>

      {/* hero */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 54, height: 54, borderRadius: 8, background: "var(--color-primary)18", color: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <RiBuildingLine style={{ fontSize: 28 }} />
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.15, color: "var(--foreground)" }}>{building.name}</div>
              <div style={{ fontSize: 13, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 10, marginTop: 3, flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><RiMapPinLine /> {building.postalCode || "—"}</span>
                {subParts.map((p, i) => (
                  <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--border-strong)" }} />{p}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <AuditDrawer buildingId={building.id} onGoToTab={(t: AuditTab) => {
              const map: Record<AuditTab, TabKey> = { units: "units", millesimes: "millesimes", distribution: "millesimes", exclusions: "millesimes", heating: "millesimes", info: "overview", customer: "overview" };
              const target = map[t]; if (target) setTab(target);
            }} />
            <Link href={`/super-admin/properties/${building.propertyId}`} style={btn}><RiEditLine /> Επεξεργασία</Link>
            <button style={{ ...btn, ...btnPrimary }}><RiAddLine /> Ενέργεια</button>
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginTop: 16 }}>
          <Kpi icon={RiHome4Line} label="Μονάδες" value={String(kpis.units)} />
          <Kpi icon={RiScales3Line} label="Χιλιοστά" value={`${kpis.millesimes}‰`} />
          <Kpi icon={RiFolderLine} label="Αρχεία" value={String(kpis.files)} />
          <Kpi icon={RiSettings3Line} label="Εγκαταστάσεις" value={String(kpis.infraPoints)} />
          <Kpi icon={RiContactsBook3Line} label="Επαφές" value={String(kpis.contacts)} />
        </div>
      </div>

      {/* 2-row wrapping tabs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          const badge = t.badge?.(kpis);
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 9999,
              padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              border: `1px solid ${active ? "var(--color-primary)" : "var(--border)"}`,
              background: active ? "var(--color-primary)" : "var(--card)",
              color: active ? "#fff" : "var(--muted-foreground)",
            }}>
              <Icon style={{ fontSize: 16 }} /> {t.label}
              {badge != null && (
                <span style={{ fontSize: 10, fontWeight: 800, padding: "0 6px", borderRadius: 9999, background: active ? "rgba(255,255,255,.25)" : "var(--bg-canvas)", color: active ? "#fff" : "var(--muted-foreground)" }}>{badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* panels */}
      <div>
        {tab === "overview" ? (
          <Overview building={building} data={overview} setTab={setTab} />
        ) : tab === "units" ? (
          <UnitsPanel buildingId={building.id} units={units} />
        ) : tab === "managers" ? (
          <ManagersPanel buildingId={building.id} />
        ) : tab === "files" ? (
          <FilesPanel buildingId={building.id} files={files} />
        ) : tab === "people" ? (
          <PeoplePanel people={people} />
        ) : tab === "contacts" ? (
          <ContactsPanel buildingId={building.id} contacts={contacts} />
        ) : tab === "infra" ? (
          <InfraPanel buildingId={building.id} points={infraPoints} floorOptions={floorOptions} />
        ) : tab === "calendar" ? (
          <CalendarPanel buildingId={building.id} tasks={tasks} today={today} />
        ) : tab === "expenses" ? (
          <ExpensesPanel buildingId={building.id} expenses={expenses} categories={categorySplits} />
        ) : tab === "readings" ? (
          <MeterReadingsPanel rows={meterReadingRows} />
        ) : tab === "splitsettings" ? (
          <CategorySplitSettings buildingId={building.id} rows={categorySplits} />
        ) : tab === "millesimes" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <MillesimeGrid
              buildingId={building.id}
              units={millesimeUnits}
              elevatorSurchargePerFloor={building.elevatorSurchargePerFloor}
              elevatorExemptGroundFloor={building.elevatorExemptGroundFloor}
            />
            <DistributionTab buildingId={building.id} categories={expenseCategories} overrides={categoryOverrides} />
            <ExclusionMatrix buildingId={building.id} units={exclusionUnits} categories={expenseCategories} exclusions={unitExclusions} />
            {usesMeteredHeating && (
              <HeatingReadingsPanel
                buildingId={building.id}
                period={heatingPeriod}
                rows={heatingReadingRows}
                heatingMeterUnit={building.heatingMeterUnit ?? null}
              />
            )}
          </div>
        ) : tab === "maintenance" ? (
          <MaintenanceTab rows={maintenanceHistory} buildingId={building.id} />
        ) : tab === "koino" ? (
          <KoinochristaPanel buildingId={building.id} />
        ) : tab === "ann" ? (
          <AnnouncementsPanel buildingId={building.id} />
        ) : tab === "assemblies" ? (
          <AssembliesPanel buildingId={building.id} />
        ) : (
          <Placeholder label={TABS.find((t) => t.key === tab)?.label ?? ""} />
        )}
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "11px 13px", background: "var(--bg-canvas)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted-foreground)", fontWeight: 600 }}>
        <Icon style={{ fontSize: 15 }} /> {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 3, color: "var(--foreground)" }}>{value}</div>
    </div>
  );
}

const PRIORITY: Record<string, { label: string; color: string }> = {
  URGENT: { label: "Επείγον", color: "#c50f1f" }, HIGH: { label: "Υψηλή", color: "#CA5D00" },
  NORMAL: { label: "Κανονική", color: "#0078D4" }, LOW: { label: "Χαμηλή", color: "#707070" },
};
const REQ_STATUS: Record<string, string> = { OPEN: "Ανοιχτό", IN_PROGRESS: "Σε εξέλιξη" };

function eur(n: number): string {
  return n.toLocaleString("el-GR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}
function fmtDay(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("el-GR", { day: "2-digit", month: "short" });
}

function Overview({ building, data, setTab }: { building: Building; data: OverviewData; setTab: (t: TabKey) => void }) {
  const total = data.paid + data.unpaid;
  const pct = total > 0 ? Math.round((data.paid / total) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Paid / Unpaid */}
      <Card title="Εξοφλημένα / Ανεξόφλητα (κοινόχρηστα)">
        {total === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>Δεν υπάρχουν κατανομές κοινοχρήστων ακόμη.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <Stat label="Εξοφλημένα" value={eur(data.paid)} color="#107C10" />
              <Stat label="Ανεξόφλητα" value={eur(data.unpaid)} color="#c50f1f" />
              <Stat label="Ποσοστό είσπραξης" value={`${pct}%`} color="#0078D4" />
            </div>
            <div style={{ height: 14, borderRadius: 9999, overflow: "hidden", display: "flex", background: "#c50f1f22" }}>
              <div style={{ width: `${pct}%`, background: "#107C10" }} />
              <div style={{ flex: 1, background: "#c50f1f" }} />
            </div>
            <div>
              <button onClick={() => setTab("pay")} style={{ ...btn, ...btnPrimary }}><RiBankCardLine /> Πληρωμές</button>
            </div>
          </div>
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Open maintenance requests */}
        <Card title={`Ανοιχτά αιτήματα συντήρησης${data.openCount ? ` (${data.openCount})` : ""}`}>
          {data.openRequests.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>Δεν υπάρχουν ανοιχτά αιτήματα. 👍</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.openRequests.map((r) => {
                const p = PRIORITY[r.priority] ?? PRIORITY.NORMAL;
                return (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8 }}>
                    <RiToolsLine style={{ color: p.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{REQ_STATUS[r.status] ?? r.status} · {fmtDay(r.createdAt)}</div>
                    </div>
                    <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: `${p.color}18`, color: p.color }}>{p.label}</span>
                  </div>
                );
              })}
              <button onClick={() => setTab("maint")} style={btn}><RiToolsLine /> Όλα τα αιτήματα</button>
            </div>
          )}
        </Card>

        {/* Upcoming maintenance (recurring tasks) */}
        <Card title="Επερχόμενες συντηρήσεις">
          {data.upcomingTasks.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>Δεν υπάρχουν προγραμματισμένες εργασίες.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.upcomingTasks.map((t) => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8 }}>
                  <RiCalendarTodoLine style={{ color: "var(--color-primary)", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                  <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)" }}>{fmtDay(t.nextDueDate)}</span>
                </div>
              ))}
              <button onClick={() => setTab("calendar")} style={btn}><RiCalendarTodoLine /> Ημερολόγιο</button>
            </div>
          )}
        </Card>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: "var(--muted-foreground)" }}>
        Πελάτης: <b style={{ color: "var(--foreground)" }}>{building.customerName}</b> · Ιδιοκτησία:{" "}
        <Link href={`/super-admin/properties/${building.propertyId}`} style={{ color: "var(--color-primary)" }}>{building.propertyName}</Link>
      </p>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
      <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)", fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>{title}</div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: 40, textAlign: "center", color: "var(--muted-foreground)", fontSize: 14 }}>
      «{label}» — ενεργοποιείται σε επόμενη φάση.
    </div>
  );
}

const btn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid var(--border)",
  background: "var(--card)", color: "var(--foreground)", borderRadius: 4, padding: "7px 13px",
  fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "none",
};
const btnPrimary: React.CSSProperties = { background: "var(--color-primary)", color: "#fff", borderColor: "var(--color-primary)" };
