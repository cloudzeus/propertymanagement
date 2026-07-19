"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  RiBuildingLine, RiMapPinLine, RiDashboardLine, RiMoneyEuroCircleLine,
  RiGroupLine, RiToolsLine, RiMegaphoneLine, RiHome4Line, RiScales3Line,
  RiFolderLine, RiSettings3Line, RiContactsBook3Line, RiSettings4Line,
} from "react-icons/ri";
import type { BuildingDashboardData } from "@/lib/building/dashboard-data";
import type { BuildingCaps } from "@/lib/building-caps";
import type { AuditTab } from "@/lib/buildings/audit";
import { ManagedBadge } from "@/components/ui/managed-badge";
import { AutoRefresh } from "@/components/realtime/AutoRefresh";
import { AuditDrawer } from "@/components/building/AuditDrawer";
import { CategorySplitSettings } from "@/components/buildings/CategorySplitSettings";
import { FilesPanel } from "@/components/building/FilesPanel";
import { PeoplePanel } from "@/components/building/PeoplePanel";
import { UnitsPanel } from "@/components/building/UnitsPanel";
import { AnnouncementsPanel } from "@/components/building/AnnouncementsPanel";
import { AssembliesPanel } from "@/components/building/AssembliesPanel";
import { ContactsPanel } from "@/components/building/ContactsPanel";
import { InfraPanel } from "@/components/building/InfraPanel";
import { CalendarPanel } from "@/components/building/CalendarPanel";
import { ExpensesPanel } from "@/components/buildings/ExpensesPanel";
import { KoinochristaPanel } from "@/components/buildings/KoinochristaPanel";
import { MillesimeGrid } from "@/components/building/MillesimeGrid";
import { DistributionTab } from "@/components/building/DistributionTab";
import { ExclusionMatrix } from "@/components/building/ExclusionMatrix";
import { HeatingReadingsPanel } from "@/components/building/HeatingReadingsPanel";
import { MeterReadingsPanel } from "@/components/building/MeterReadingsPanel";
import { MaintenanceTab } from "@/components/building/MaintenanceTab";
import { ManagedItemsPanel } from "@/components/building/ManagedItemsPanel";
import { PropertyVivaSetup } from "@/components/property/PropertyVivaSetup";
import { PropertyPackages } from "@/components/property/PropertyPackages";
import { RequestsPanel } from "./RequestsPanel";
import { SECTIONS, type SectionKey } from "./sections";
import { ManagerOverview } from "./ManagerOverview";

const SECTION_ICONS: Record<SectionKey, React.ElementType> = {
  overview: RiDashboardLine,
  finance: RiMoneyEuroCircleLine,
  building: RiBuildingLine,
  people: RiGroupLine,
  maintenance: RiToolsLine,
  communication: RiMegaphoneLine,
  settings: RiSettings4Line,
};

type Props = BuildingDashboardData & {
  can: BuildingCaps;
  viewer: "staff" | "manager";
  managed: boolean;
  siblings: { id: string; name: string }[];
  providerConfigured: boolean;
};

export function BuildingManagerShell(props: Props) {
  const {
    building, kpis, can, viewer, managed, siblings, providerConfigured,
    units, files, people, contacts, infraPoints, floorOptions, tasks,
    expenses, categorySplits, today, millesimeUnits, exclusionUnits,
    expenseCategories, categoryOverrides, unitExclusions,
    usesMeteredHeating, heatingPeriod, heatingReadingRows, meterReadingRows,
    overview, maintenanceHistory, managedItems, managedItemTypes,
    maintenanceRequests, maintenanceCategories,
  } = props;

  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const sParam = search.get("s");
  const section: SectionKey = SECTIONS.some((x) => x.key === sParam) ? (sParam as SectionKey) : "overview";
  const sectionDef = SECTIONS.find((x) => x.key === section)!;
  const flags = { managed, metered: usesMeteredHeating };
  const visibleTabs = sectionDef.tabs.filter((t) => !t.visible || t.visible(can, flags));
  const tParam = search.get("t");
  const tab: string | null = visibleTabs.some((t) => t.key === tParam) ? tParam : (visibleTabs[0]?.key ?? null);

  const navigate = useCallback((s: SectionKey, t?: string) => {
    const q = new URLSearchParams();
    if (s !== "overview") q.set("s", s);
    if (t) q.set("t", t);
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname]);

  const subParts = [
    [building.address, building.city].filter(Boolean).join(", ") || null,
    building.floors ? `${building.floors} όροφοι` : null,
    building.basements ? `${building.basements} υπόγεια` : null,
    building.hasElevator ? "Ανελκυστήρας" : null,
  ].filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <AutoRefresh buildingId={building.id} />
      {/* hero */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 54, height: 54, borderRadius: 8, background: "var(--color-primary)18", color: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <RiBuildingLine style={{ fontSize: 28 }} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.15, color: "var(--foreground)" }}>{building.name}</div>
                <ManagedBadge managed={building.propertyManaged} />
              </div>
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
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {siblings.length > 1 && (
              <select
                value={building.id}
                onChange={(e) => router.push(`/building/${e.target.value}`)}
                aria-label="Επιλογή κτηρίου"
                style={{
                  border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)",
                  borderRadius: 6, padding: "7px 10px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                {siblings.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            {can.viewAudit && (
              <AuditDrawer buildingId={building.id} onGoToTab={(t: AuditTab) => {
                const map: Record<AuditTab, [SectionKey, string?]> = {
                  units: ["building", "units"],
                  millesimes: ["building", "millesimes"],
                  distribution: ["building", "millesimes"],
                  exclusions: ["building", "millesimes"],
                  heating: ["building", "millesimes"],
                  info: ["overview"],
                  customer: ["overview"],
                };
                const target = map[t];
                if (target) navigate(target[0], target[1]);
              }} />
            )}
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

      {/* section bar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {SECTIONS.map((s) => {
          const Icon = SECTION_ICONS[s.key];
          const active = section === s.key;
          return (
            <button key={s.key} onClick={() => navigate(s.key)} style={{
              display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 9999,
              padding: "8px 15px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              border: `1px solid ${active ? "var(--color-primary)" : "var(--border)"}`,
              background: active ? "var(--color-primary)" : "var(--card)",
              color: active ? "#fff" : "var(--muted-foreground)",
            }}>
              <Icon style={{ fontSize: 16 }} /> {s.label}
            </button>
          );
        })}
      </div>

      {/* sub-tab row */}
      {visibleTabs.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: -8 }}>
          {visibleTabs.map((t) => {
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => navigate(section, t.key)} style={{
                borderRadius: 6, padding: "5px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                border: "1px solid transparent",
                borderBottom: `2px solid ${active ? "var(--color-primary)" : "transparent"}`,
                background: active ? "var(--color-primary)12" : "transparent",
                color: active ? "var(--color-primary)" : "var(--muted-foreground)",
              }}>
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* panels */}
      <div>
        {section === "overview" ? (
          <ManagerOverview building={building} data={overview} can={can} onNavigate={navigate} />
        ) : tab === "units" ? (
          <UnitsPanel buildingId={building.id} units={units} can={can} />
        ) : tab === "files" ? (
          <FilesPanel buildingId={building.id} files={files} can={can} />
        ) : tab === "people" ? (
          <PeoplePanel people={people} can={can} />
        ) : tab === "contacts" ? (
          <ContactsPanel buildingId={building.id} contacts={contacts} can={can} />
        ) : tab === "infra" ? (
          <InfraPanel buildingId={building.id} points={infraPoints} floorOptions={floorOptions} can={can} />
        ) : tab === "manageditems" && building.propertyManaged ? (
          <ManagedItemsPanel buildingId={building.id} items={managedItems} itemTypes={managedItemTypes} floorOptions={floorOptions} can={can} />
        ) : tab === "calendar" ? (
          <CalendarPanel buildingId={building.id} tasks={tasks} today={today} can={can} />
        ) : tab === "expenses" ? (
          <ExpensesPanel buildingId={building.id} expenses={expenses} categories={categorySplits} can={can} />
        ) : tab === "readings" ? (
          <MeterReadingsPanel rows={meterReadingRows} />
        ) : tab === "splitsettings" ? (
          <CategorySplitSettings buildingId={building.id} rows={categorySplits} can={can} />
        ) : tab === "millesimes" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <MillesimeGrid
              buildingId={building.id}
              units={millesimeUnits}
              elevatorSurchargePerFloor={building.elevatorSurchargePerFloor}
              elevatorExemptGroundFloor={building.elevatorExemptGroundFloor}
              can={can}
            />
            <DistributionTab buildingId={building.id} categories={expenseCategories} overrides={categoryOverrides} can={can} />
            <ExclusionMatrix buildingId={building.id} units={exclusionUnits} categories={expenseCategories} exclusions={unitExclusions} can={can} />
            {usesMeteredHeating && (
              <HeatingReadingsPanel
                buildingId={building.id}
                period={heatingPeriod}
                rows={heatingReadingRows}
                heatingMeterUnit={building.heatingMeterUnit ?? null}
                can={can}
              />
            )}
          </div>
        ) : tab === "maint" ? (
          <RequestsPanel
            buildingId={building.id}
            buildingName={building.name}
            units={units.map((u) => ({ id: u.id, unitNumber: u.unitNumber }))}
            requests={maintenanceRequests}
            categories={maintenanceCategories}
            can={can}
          />
        ) : tab === "maintenance" ? (
          <MaintenanceTab rows={maintenanceHistory} tasks={tasks} buildingId={building.id} can={can} />
        ) : tab === "koino" ? (
          <KoinochristaPanel buildingId={building.id} can={can} />
        ) : tab === "ann" ? (
          <AnnouncementsPanel buildingId={building.id} can={can} />
        ) : tab === "assemblies" ? (
          <AssembliesPanel buildingId={building.id} can={can} linkToDetail={viewer !== "manager"} showTestButton={viewer !== "manager"} />
        ) : tab === "viva" ? (
          <PropertyVivaSetup propertyId={building.propertyId} />
        ) : tab === "packages" ? (
          <PropertyPackages propertyId={building.propertyId} providerConfigured={providerConfigured} />
        ) : (
          <Placeholder label={visibleTabs.find((t) => t.key === tab)?.label ?? sectionDef.label} />
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

function Placeholder({ label }: { label: string }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: 40, textAlign: "center", color: "var(--muted-foreground)", fontSize: 14 }}>
      «{label}» — ενεργοποιείται σε επόμενη φάση.
    </div>
  );
}
