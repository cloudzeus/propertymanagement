"use client";

import { useState } from "react";
import Link from "next/link";
import {
  RiBuildingLine, RiMapPinLine, RiArrowRightSLine, RiEditLine, RiAddLine,
  RiDashboardLine, RiHome4Line, RiGroupLine, RiUserStarLine, RiFolderLine,
  RiCalendarTodoLine, RiContactsBook3Line, RiSettings3Line, RiWallet3Line,
  RiBankCardLine, RiToolsLine, RiMegaphoneLine, RiScales3Line,
} from "react-icons/ri";

type Building = {
  id: string; name: string; address: string; city: string; postalCode: string;
  floors: number | null; basements: number | null; hasElevator: boolean;
  propertyId: string; propertyName: string; customerName: string;
};
type Kpis = {
  units: number; millesimes: number; files: number;
  infraPoints: number; contacts: number; recurringTasks: number;
};

type TabKey =
  | "overview" | "units" | "people" | "managers" | "files" | "calendar"
  | "contacts" | "infra" | "koino" | "pay" | "maint" | "ann";

const TABS: { key: TabKey; label: string; icon: React.ElementType; badge?: (k: Kpis) => number | undefined }[] = [
  { key: "overview", label: "Επισκόπηση", icon: RiDashboardLine },
  { key: "units", label: "Μονάδες", icon: RiHome4Line, badge: (k) => k.units || undefined },
  { key: "people", label: "Ένοικοι", icon: RiGroupLine },
  { key: "managers", label: "Διαχειριστές", icon: RiUserStarLine },
  { key: "files", label: "Αρχεία", icon: RiFolderLine, badge: (k) => k.files || undefined },
  { key: "calendar", label: "Ημερολόγιο", icon: RiCalendarTodoLine, badge: (k) => k.recurringTasks || undefined },
  { key: "contacts", label: "Επαφές", icon: RiContactsBook3Line, badge: (k) => k.contacts || undefined },
  { key: "infra", label: "Εγκαταστάσεις", icon: RiSettings3Line, badge: (k) => k.infraPoints || undefined },
  { key: "koino", label: "Κοινόχρηστα", icon: RiWallet3Line },
  { key: "pay", label: "Πληρωμές", icon: RiBankCardLine },
  { key: "maint", label: "Συντήρηση", icon: RiToolsLine },
  { key: "ann", label: "Ανακοινώσεις", icon: RiMegaphoneLine },
];

export function BuildingDashboard({ building, kpis }: { building: Building; kpis: Kpis }) {
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
          <Overview building={building} />
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

function Overview({ building }: { building: Building }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14 }}>
      <Card title="Σύνοψη κτηρίου">
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>
          Πελάτης: <b style={{ color: "var(--foreground)" }}>{building.customerName}</b> · Ιδιοκτησία:{" "}
          <Link href={`/super-admin/properties/${building.propertyId}`} style={{ color: "var(--color-primary)" }}>{building.propertyName}</Link>
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--muted-foreground)" }}>
          Χρησιμοποίησε τις καρτέλες παραπάνω για Αρχεία, Ημερολόγιο, Επαφές, Εγκαταστάσεις,
          Κοινόχρηστα και Πληρωμές. (Τα modules ενεργοποιούνται σταδιακά.)
        </p>
      </Card>
      <Card title="Γρήγορες ενέργειες">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button style={btn}><RiAddLine /> Αρχείο</button>
          <button style={btn}><RiAddLine /> Επαφή</button>
          <button style={btn}><RiAddLine /> Εργασία</button>
          <button style={btn}><RiAddLine /> Σημείο</button>
        </div>
      </Card>
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
