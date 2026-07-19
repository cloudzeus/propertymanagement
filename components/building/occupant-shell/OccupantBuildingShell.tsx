"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  RiArrowRightLine, RiBankCardLine, RiBuildingLine, RiCalendarTodoLine, RiCheckLine, RiContactsBook3Line,
  RiDashboardLine, RiFolderLine, RiGroupLine, RiHome3Line, RiHome4Line, RiListCheck2, RiMailLine,
  RiMapPinLine, RiMegaphoneLine, RiMoneyEuroCircleLine, RiPhoneLine, RiSettings3Line, RiSpeedUpLine,
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
import { type QuickPayProps } from "./QuickPayCard";

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
  /** Server-computed κοινόχρηστα quick-pay outstanding + flag (amounts never client-trusted). */
  quickPay?: Omit<QuickPayProps, "buildingId">;
};

/**
 * Read-only occupant control center for /building/[id] — the owner/resident
 * counterpart of BuildingManagerShell (same pill/hero/?s= idiom, zero mutations).
 */
export function OccupantBuildingShell(props: Props) {
  const {
    building, myUnits, months, selectedMonth, statements, managerName, expensesByMonth,
    heatingReadings, gallery, infra, units, tasks, maintenanceHistory, meterReadings, managedItems,
    assemblies, files, contacts, announcements, viewerRole, managed, quickPay,
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
            buildingId={building.id}
            quickPay={quickPay}
            myUnits={myUnits}
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
          <ExpensesSection expensesByMonth={expensesByMonth} />
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

function Overview({ buildingId, quickPay, myUnits, selectedMonth, statements, announcements, assemblies, requestsHref, onNavigate }: {
  buildingId: string;
  quickPay?: Omit<QuickPayProps, "buildingId">;
  myUnits: OccupantData["myUnits"];
  selectedMonth: string;
  statements: OccupantData["statements"];
  announcements: OccupantData["announcements"];
  assemblies: OccupantData["assemblies"];
  requestsHref: string;
  onNavigate: (s: SectionKey) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  // Inline Viva pay handler (mirrors QuickPayCard). Amounts are NEVER sent —
  // the route recomputes them; the client only names the scope (building/unit).
  const [busy, setBusy] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  const enabled = quickPay?.enabled ?? false;
  const total = (quickPay?.totalCents ?? 0) / 100;

  async function pay(scope: string, unitId?: string) {
    if (!enabled) return;
    setPayError(null);
    setBusy(scope);
    try {
      const res = await fetch("/api/koinochrista/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(unitId ? { buildingId, unitId } : { buildingId }),
      });
      if (res.status === 503) { setPayError("Οι online πληρωμές δεν είναι ακόμη διαθέσιμες."); return; }
      if (!res.ok) { setPayError("Σφάλμα πληρωμής. Δοκιμάστε ξανά."); return; }
      const data = (await res.json()) as { checkoutUrl?: string };
      if (data.checkoutUrl) { window.location.href = data.checkoutUrl; return; }
      setPayError("Σφάλμα πληρωμής. Δοκιμάστε ξανά.");
    } catch {
      setPayError("Σφάλμα δικτύου. Δοκιμάστε ξανά.");
    } finally {
      setBusy(null);
    }
  }

  // Deep-link to the per-apartment notice, preserving the selected month.
  const goToNotice = (unitId: string) => {
    const q = new URLSearchParams();
    q.set("s", "koino");
    q.set("unit", unitId);
    const month = search.get("month");
    if (month) q.set("month", month);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  const now = Date.now();
  const nextAssembly = assemblies
    .filter((a) => a.status !== "CANCELLED" && new Date(a.scheduledAt).getTime() >= now)
    .pop(); // list is desc — the last future entry is the soonest
  const latestAnn = announcements[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* summary hero — money first */}
      <div style={{ ...card, padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={cardCaps}>Συνολική οφειλή</span>
              <StatusChip tone={total > 0 ? "warning" : "success"}>{total > 0 ? "Εκκρεμεί" : "Εξοφλημένο"}</StatusChip>
            </div>
            <div style={{ fontSize: 40, fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1.1, marginTop: 6, color: total > 0 ? "var(--color-warning)" : "var(--foreground)" }}>
              {eur(total)}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 6 }}>
              {myUnits.length} {myUnits.length === 1 ? "διαμέρισμα" : "διαμερίσματα"} · {monthLabel(selectedMonth)}
            </div>
          </div>
          {total > 0 && (
            <button
              type="button"
              disabled={!enabled || busy != null}
              onClick={() => pay("all")}
              title={!enabled ? "Το Viva της ιδιοκτησίας δεν έχει ρυθμιστεί" : undefined}
              style={heroPayBtn(enabled)}
            >
              <RiBankCardLine style={{ fontSize: 18 }} />
              {!enabled ? "Σύντομα διαθέσιμο" : busy === "all" ? "Μεταφορά…" : `Πληρωμή όλων ${eur(total)}`}
            </button>
          )}
        </div>
        {!enabled && total > 0 && (
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 12 }}>
            Οι online πληρωμές θα είναι σύντομα διαθέσιμες.
          </div>
        )}
        {payError && (
          <div style={{ fontSize: 12.5, color: "var(--color-danger)", marginTop: 10 }}>{payError}</div>
        )}
      </div>

      <div className="dash-cols" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, alignItems: "start" }}>
        {/* left: one unified card per unit (outstanding + current month + χιλιοστά + actions) */}
        <div style={{ display: "grid", gridTemplateColumns: myUnits.length > 1 ? "repeat(auto-fill, minmax(300px, 1fr))" : "1fr", gap: 16 }}>
          {myUnits.map((u) => {
            const out = (quickPay?.perUnit.find((p) => p.unitId === u.id)?.amountCents ?? 0) / 100;
            const share = statements.find((s) => s.unitId === u.id)?.myPayable ?? 0;
            return (
              <div key={u.id} style={{ ...card, display: "flex", flexDirection: "column", gap: 14 }}>
                {/* header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: "color-mix(in srgb, var(--color-accent) 16%, transparent)", color: "var(--foreground)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <RiHome4Line style={{ fontSize: 20 }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "var(--foreground)" }}>Μονάδα {u.unitNumber}</div>
                      <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                        {[UNIT_TYPE[u.unitType] ?? u.unitType, floorLabel(u.floor), u.areaSqm != null ? `${u.areaSqm.toLocaleString("el-GR", { maximumFractionDigits: 1 })} μ²` : null]
                          .filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </div>
                  <StatusChip tone={u.isOwner ? "accent" : "info"}>{u.rel}</StatusChip>
                </div>

                {/* money block — the dominant element */}
                <div style={{ background: "var(--bg-canvas)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                  {out > 0 ? (
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div>
                        <div style={cardCaps}>Οφειλή</div>
                        <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "var(--color-warning)", lineHeight: 1.15, marginTop: 2 }}>
                          {eur(out)}
                        </div>
                      </div>
                      <StatusChip tone="warning">Εκκρεμεί</StatusChip>
                    </div>
                  ) : (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--color-success)", fontSize: 15, fontWeight: 700 }}>
                      <RiCheckLine style={{ fontSize: 18 }} /> Εξοφλημένο
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 8, fontVariantNumeric: "tabular-nums" }}>
                    Τρέχων μήνας ({monthLabel(selectedMonth)}): {eur(share)}
                  </div>
                </div>

                {/* χιλιοστά — de-emphasized chip row */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <MilleChip label="Κοινόχρηστα" value={mill(u.millesimes)} />
                  <MilleChip label="Ανελκυστήρας" value={mill(u.millesimesElevator)} />
                  <MilleChip label="Θέρμανση" value={mill(u.millesimesHeating)} />
                </div>

                {/* actions */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
                  <button type="button" onClick={() => goToNotice(u.id)} style={secondaryBtn}>
                    <RiWallet3Line style={{ fontSize: 16 }} /> Ειδοποιητήριο
                  </button>
                  {out > 0 && (
                    <button
                      type="button"
                      disabled={!enabled || busy != null}
                      onClick={() => pay(u.id, u.id)}
                      title={!enabled ? "Το Viva της ιδιοκτησίας δεν έχει ρυθμιστεί" : undefined}
                      style={unitPayBtn(enabled)}
                    >
                      <RiBankCardLine style={{ fontSize: 16 }} />
                      {!enabled ? "Σύντομα" : busy === u.id ? "Μεταφορά…" : `Πληρωμή ${eur(out)}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* right: secondary actions + next assembly + latest announcement */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={card}>
          <div style={cardCaps}>Γρήγορες ενέργειες</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            <Link href={requestsHref} style={quickAction}>
              <RiToolsLine style={{ fontSize: 17 }} /> Δήλωση βλάβης
            </Link>
            <button type="button" onClick={() => onNavigate("infra")} style={quickAction}>
              <RiSettings3Line style={{ fontSize: 17 }} /> Εγκαταστάσεις & κλειδιά
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
    </div>
  );
}

function MilleChip({ label, value }: { label: string; value: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999,
      background: "var(--bg-canvas)", border: "1px solid var(--border)", fontSize: 11.5, color: "var(--muted-foreground)",
    }}>
      {label} <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--foreground)" }}>{value}</span>
    </span>
  );
}

const quickAction: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 9, padding: "11px 13px", minHeight: 40, borderRadius: 9,
  border: "1px solid var(--border)", background: "var(--bg-canvas)", color: "var(--foreground)",
  fontSize: 13.5, fontWeight: 700, cursor: "pointer", textDecoration: "none", textAlign: "left", width: "100%",
};

const heroPayBtn = (active: boolean): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 20px", minHeight: 44,
  borderRadius: 10, border: `1px solid ${active ? "var(--color-primary)" : "var(--border)"}`,
  background: active ? "var(--color-primary)" : "var(--bg-muted, var(--bg-canvas))",
  color: active ? "#fff" : "var(--muted-foreground)",
  fontSize: 15, fontWeight: 800, fontVariantNumeric: "tabular-nums",
  cursor: active ? "pointer" : "not-allowed", whiteSpace: "nowrap",
});

const unitPayBtn = (active: boolean): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 14px", minHeight: 40,
  borderRadius: 9, flex: 1, border: `1px solid ${active ? "var(--color-primary)" : "var(--border)"}`,
  background: active ? "var(--color-primary)" : "var(--bg-muted, var(--bg-canvas))",
  color: active ? "#fff" : "var(--muted-foreground)",
  fontSize: 13, fontWeight: 800, fontVariantNumeric: "tabular-nums",
  cursor: active ? "pointer" : "not-allowed", whiteSpace: "nowrap",
});

const secondaryBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 14px", minHeight: 40,
  borderRadius: 9, flex: 1, border: "1px solid var(--border)", background: "var(--bg-canvas)", color: "var(--foreground)",
  fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
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
