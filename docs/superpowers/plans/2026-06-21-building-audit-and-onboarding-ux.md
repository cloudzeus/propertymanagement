# Building Audit + Onboarding Chat Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rule-based "audit entries" drawer to the building dashboard, and redesign the onboarding chat into a floating bottom-right widget with conversation-UX polish and an address geocode mini-map.

**Architecture:** Part A is a pure `auditBuilding()` consumed by a read-only server action and a dashboard drawer. Part B extracts the chat into a reusable `AiChatWidget` (wrapping the unchanged `useAiChat`, plus a new `retry()`), makes the onboarding body full-width, and adds a debounced geocode map reusing `/api/geocode` + `PropertyMap`. No new millesime math, no AI-core changes.

**Tech Stack:** Next.js 16.2, Prisma 7, Vitest, React, maplibre-gl, react-icons/ri.

**Spec:** [docs/superpowers/specs/2026-06-21-building-audit-and-onboarding-ux-design.md](../specs/2026-06-21-building-audit-and-onboarding-ux-design.md)

**Verified field names:** `Customer.afm` (nullable ΑΦΜ); `Unit.ownerId`/`Unit.residentId`/`Unit.occupancies` (`UnitOccupancy{ userId, role, endDate }`); `Unit.millesimesSource`; `BuildingDashboard.tsx` has a `TabKey` union + `TABS` array + KPI row. Geocode: `GET /api/geocode?address=` → `{ results: { lat, lng, displayName, city?, postalCode?, country? }[] }`. Map: `components/maps/PropertyMap.tsx`.

---

## File Structure

- **Create** `lib/buildings/audit.ts` (+test) — pure `auditBuilding`.
- **Create** `app/actions/building-audit.ts` — `auditBuildingEntries` server action.
- **Create** `app/(dashboard)/super-admin/buildings/[id]/AuditDrawer.tsx` — the findings drawer + trigger button; mounted in `BuildingDashboard.tsx`.
- **Modify** `hooks/useAiChat.ts` — add `retry()`.
- **Create** `components/ai/AiChatWidget.tsx` — floating chat widget + 5 UX items.
- **Modify** `app/(dashboard)/super-admin/customers/[id]/onboarding/OnboardingWizard.tsx` — full-width body + use `AiChatWidget`; geocode map; pass geo fields.
- **Create** `app/(dashboard)/super-admin/customers/[id]/onboarding/AddressGeocode.tsx` — debounced geocode + mini map.
- **Modify** `lib/ai/agents/building-onboarding.ts` (`buildingInfoSchema`), `app/actions/building-onboarding-payload.ts`, `app/actions/building-onboarding.ts` — optional `city/postalCode/lat/lng`.

---

## PART A — Building entry audit

### Task 1: Pure `auditBuilding` (`lib/buildings/audit.ts`)

**Files:**
- Create: `lib/buildings/audit.ts`
- Test: `lib/buildings/audit.test.ts`

- [ ] **Step 1: Write the failing test** — create `lib/buildings/audit.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { auditBuilding, type AuditInput } from "./audit";

const baseUnit = {
  unitNumber: "1", floor: 1, areaSqm: 100,
  millesimes: 1000, millesimesElevator: 1000, millesimesHeating: 1000,
  ownerId: "o1", residentId: null, hasOccupancyOwner: false, hasOccupancyResident: false,
  millesimesSource: "AUTO",
};
const base: AuditInput = {
  building: { name: "Β", address: "Ακαδημίας 12", hasElevator: true },
  units: [baseUnit],
  customer: { vat: "123" },
  heating: { meteredCategoryExists: false, readingsForLatestPeriod: 0 },
  exclusions: [],
};
const has = (fs: ReturnType<typeof auditBuilding>, sev: string, frag: string) =>
  fs.some((f) => f.severity === sev && f.title.includes(frag));

describe("auditBuilding", () => {
  it("clean building → no errors", () => {
    expect(auditBuilding(base).filter((f) => f.severity === "error")).toHaveLength(0);
  });
  it("unit without area or floor → error", () => {
    expect(has(auditBuilding({ ...base, units: [{ ...baseUnit, areaSqm: null }] }), "error", "τ.μ")).toBe(true);
    expect(has(auditBuilding({ ...base, units: [{ ...baseUnit, floor: null }] }), "error", "όροφο")).toBe(true);
  });
  it("negative area → error", () => {
    expect(has(auditBuilding({ ...base, units: [{ ...baseUnit, areaSqm: -5 }] }), "error", "Αρνητικ")).toBe(true);
  });
  it("duplicate unit numbers → error", () => {
    const fs = auditBuilding({ ...base, units: [baseUnit, { ...baseUnit, millesimes: 0 }] });
    expect(has(fs, "error", "Διπλ")).toBe(true);
  });
  it("general millesimes not 1000 → error", () => {
    const fs = auditBuilding({ ...base, units: [{ ...baseUnit, millesimes: 980 }] });
    expect(has(fs, "error", "Γενικά χιλιοστά")).toBe(true);
  });
  it("no units → error", () => {
    expect(has(auditBuilding({ ...base, units: [] }), "error", "καμία μονάδα")).toBe(true);
  });
  it("unit with no owner and no resident → warning", () => {
    const fs = auditBuilding({ ...base, units: [{ ...baseUnit, ownerId: null, residentId: null }] });
    expect(has(fs, "warning", "χωρίς ιδιοκτήτη")).toBe(true);
  });
  it("metered heating but no readings → warning", () => {
    const fs = auditBuilding({ ...base, heating: { meteredCategoryExists: true, readingsForLatestPeriod: 0 } });
    expect(has(fs, "warning", "ενδείξεις")).toBe(true);
  });
  it("exclusion zeroing a whole expense → warning", () => {
    const fs = auditBuilding({ ...base, exclusions: [{ categoryId: "c", excludedUnitCount: 1, totalUnits: 1 }] });
    expect(has(fs, "warning", "μηδενίζει")).toBe(true);
  });
  it("customer without ΑΦΜ → warning", () => {
    expect(has(auditBuilding({ ...base, customer: { vat: null } }), "warning", "ΑΦΜ")).toBe(true);
  });
  it("MANUAL millesimes → info", () => {
    const fs = auditBuilding({ ...base, units: [{ ...baseUnit, millesimesSource: "MANUAL" }] });
    expect(has(fs, "info", "κανονισμ")).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run lib/buildings/audit.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement** — create `lib/buildings/audit.ts`:

```ts
export type Severity = "error" | "warning" | "info";
export type AuditTab = "info" | "units" | "millesimes" | "distribution" | "exclusions" | "heating" | "customer";
export type Finding = { severity: Severity; title: string; detail: string; tab: AuditTab };

export type AuditUnit = {
  unitNumber: string; floor: number | null; areaSqm: number | null;
  millesimes: number | null; millesimesElevator: number | null; millesimesHeating: number | null;
  ownerId: string | null; residentId: string | null; hasOccupancyOwner: boolean; hasOccupancyResident: boolean;
  millesimesSource: string;
};
export type AuditInput = {
  building: { name: string; address: string; hasElevator: boolean };
  units: AuditUnit[];
  customer: { vat: string | null };
  heating: { meteredCategoryExists: boolean; readingsForLatestPeriod: number };
  exclusions: { categoryId: string; excludedUnitCount: number; totalUnits: number }[];
};

const sumNonNull = (xs: (number | null)[]) => xs.reduce<number>((s, v) => s + (v ?? 0), 0);
const near1000 = (n: number) => Math.abs(n - 1000) <= 0.5;

export function auditBuilding(input: AuditInput): Finding[] {
  const f: Finding[] = [];
  const { units } = input;

  if (units.length === 0) {
    f.push({ severity: "error", title: "Το κτήριο δεν έχει καμία μονάδα", detail: "Προσθέστε μονάδες για να εκδοθούν κοινόχρηστα.", tab: "units" });
    return f;
  }

  const noArea = units.filter((u) => u.areaSqm == null).map((u) => u.unitNumber);
  if (noArea.length) f.push({ severity: "error", title: `${noArea.length} μονάδες χωρίς τ.μ. (${noArea.join(", ")})`, detail: "Χωρίς τετραγωνικά δεν υπολογίζονται χιλιοστά.", tab: "units" });
  const noFloor = units.filter((u) => u.floor == null).map((u) => u.unitNumber);
  if (noFloor.length) f.push({ severity: "error", title: `${noFloor.length} μονάδες χωρίς όροφο (${noFloor.join(", ")})`, detail: "Ο όροφος χρειάζεται για τα χιλιοστά ανελκυστήρα.", tab: "units" });
  const neg = units.filter((u) => (u.areaSqm ?? 0) < 0).map((u) => u.unitNumber);
  if (neg.length) f.push({ severity: "error", title: `Αρνητικά τ.μ. (${neg.join(", ")})`, detail: "Διορθώστε τα τετραγωνικά.", tab: "units" });

  const seen = new Set<string>(); const dup = new Set<string>();
  for (const u of units) { if (seen.has(u.unitNumber)) dup.add(u.unitNumber); seen.add(u.unitNumber); }
  if (dup.size) f.push({ severity: "error", title: `Διπλά νούμερα μονάδων (${[...dup].join(", ")})`, detail: "Κάθε μονάδα πρέπει να έχει μοναδικό αριθμό.", tab: "units" });

  const g = sumNonNull(units.map((u) => u.millesimes));
  if (!near1000(g)) f.push({ severity: "error", title: `Γενικά χιλιοστά = ${Math.round(g)} (όχι 1000)`, detail: "Συμπληρώστε τ.μ. ή πατήστε «Επανυπολογισμός».", tab: "millesimes" });
  const h = sumNonNull(units.map((u) => u.millesimesHeating));
  if (units.some((u) => u.millesimesHeating != null) && !near1000(h)) f.push({ severity: "error", title: `Χιλιοστά θέρμανσης = ${Math.round(h)} (όχι 1000)`, detail: "Ελέγξτε τα χιλιοστά θέρμανσης.", tab: "millesimes" });
  if (input.building.hasElevator) {
    const e = sumNonNull(units.map((u) => u.millesimesElevator));
    if (!near1000(e)) f.push({ severity: "error", title: `Χιλιοστά ανελκυστήρα = ${Math.round(e)} (όχι 1000)`, detail: "Ελέγξτε τα χιλιοστά ανελκυστήρα.", tab: "millesimes" });
    if (units.every((u) => (u.millesimesElevator ?? 0) === 0)) f.push({ severity: "warning", title: "Ανελκυστήρας χωρίς χιλιοστά", detail: "Το κτήριο έχει ανελκυστήρα αλλά όλες οι μονάδες έχουν 0. Υπολογίστε χιλιοστά ανελκυστήρα.", tab: "millesimes" });
  }

  const orphan = units.filter((u) => !u.ownerId && !u.residentId && !u.hasOccupancyOwner && !u.hasOccupancyResident).map((u) => u.unitNumber);
  if (orphan.length) f.push({ severity: "warning", title: `${orphan.length} μονάδες χωρίς ιδιοκτήτη/ένοικο (${orphan.join(", ")})`, detail: "Οι χρεώσεις τους δεν θα αντιστοιχούν σε άτομο.", tab: "units" });

  if (input.heating.meteredCategoryExists && input.heating.readingsForLatestPeriod === 0)
    f.push({ severity: "warning", title: "Θέρμανση με μετρητές χωρίς ενδείξεις", detail: "Καταχωρήστε ενδείξεις θέρμανσης για τη φετινή περίοδο.", tab: "heating" });

  for (const ex of input.exclusions)
    if (ex.totalUnits > 0 && ex.excludedUnitCount === ex.totalUnits)
      f.push({ severity: "warning", title: "Εξαίρεση μηδενίζει δαπάνη", detail: "Όλες οι μονάδες εξαιρούνται από μια κατηγορία — η δαπάνη δεν θα κατανεμηθεί σε κανέναν.", tab: "exclusions" });

  if (!input.building.address) f.push({ severity: "warning", title: "Λείπει διεύθυνση κτηρίου", detail: "Συμπληρώστε τη διεύθυνση.", tab: "info" });
  if (!input.building.name) f.push({ severity: "warning", title: "Λείπει όνομα κτηρίου", detail: "Συμπληρώστε το όνομα.", tab: "info" });
  if (!input.customer.vat) f.push({ severity: "warning", title: "Ο πελάτης δεν έχει ΑΦΜ", detail: "Συμπληρώστε το ΑΦΜ του πελάτη για τιμολόγηση.", tab: "customer" });

  const manual = units.filter((u) => u.millesimesSource === "MANUAL").length;
  if (manual) f.push({ severity: "info", title: `${manual} μονάδες με χιλιοστά κανονισμού (χειροκίνητα)`, detail: "Δεν αλλάζουν με τον αυτόματο επανυπολογισμό.", tab: "millesimes" });

  return f;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/buildings/audit.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/buildings/audit.ts lib/buildings/audit.test.ts
git commit -m "feat(audit): pure rule-based building entry audit"
```

---

### Task 2: Audit server action (`app/actions/building-audit.ts`)

**Files:**
- Create: `app/actions/building-audit.ts`

- [ ] **Step 1: Read auth + data patterns** — read `app/actions/building-millesimes.ts` (for `requireSuperAdmin`) and how units/occupancies/exclusions/heating readings are queried in `building-expenses.ts` / `heating-readings.ts`. Reuse the patterns.

- [ ] **Step 2: Implement** — create `app/actions/building-audit.ts`:

```ts
"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { auditBuilding, type AuditInput, type Finding } from "@/lib/buildings/audit";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const user = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (user?.role !== "SUPER_ADMIN") throw new Error("Forbidden");
}

function latestPeriod(): string { return ""; } // not date-dependent; see note

export async function auditBuildingEntries(buildingId: string): Promise<Finding[]> {
  await requireSuperAdmin();
  const building = await db.building.findUnique({
    where: { id: buildingId },
    select: {
      name: true, address: true, hasElevator: true,
      property: { select: { customer: { select: { afm: true } } } },
      units: {
        select: {
          unitNumber: true, floor: true, areaSqm: true,
          millesimes: true, millesimesElevator: true, millesimesHeating: true,
          ownerId: true, residentId: true, millesimesSource: true,
          occupancies: { where: { endDate: null }, select: { role: true } },
        },
      },
    },
  });
  if (!building) throw new Error("Δεν βρέθηκε κτήριο.");

  // Heating: is there a metered category (default or building override) and any reading in the most recent period?
  const meteredCategoryExists =
    (await db.expenseCategory.count({
      where: { OR: [{ defaultBasis: "METERED_70_30" }, { overrides: { some: { buildingId, distributionBasis: "METERED_70_30" } } }] },
    })) > 0;
  const latest = await db.unitHeatingReading.findFirst({ where: { buildingId }, orderBy: { period: "desc" }, select: { period: true } });
  const readingsForLatestPeriod = latest
    ? await db.unitHeatingReading.count({ where: { buildingId, period: latest.period, currentReading: { not: null } } })
    : 0;

  // Exclusions: count excluded units per category.
  const exclusionRows = await db.unitCategoryExclusion.groupBy({ by: ["categoryId"], where: { unit: { buildingId } }, _count: { _all: true } });
  const totalUnits = building.units.length;
  const exclusions = exclusionRows.map((r) => ({ categoryId: r.categoryId, excludedUnitCount: r._count._all, totalUnits }));

  const input: AuditInput = {
    building: { name: building.name, address: building.address, hasElevator: building.hasElevator },
    units: building.units.map((u) => ({
      unitNumber: u.unitNumber, floor: u.floor, areaSqm: u.areaSqm,
      millesimes: u.millesimes, millesimesElevator: u.millesimesElevator, millesimesHeating: u.millesimesHeating,
      ownerId: u.ownerId, residentId: u.residentId,
      hasOccupancyOwner: u.occupancies.some((o) => o.role === "OWNER"),
      hasOccupancyResident: u.occupancies.some((o) => o.role === "RESIDENT"),
      millesimesSource: u.millesimesSource,
    })),
    customer: { vat: building.property?.customer?.afm ?? null },
    heating: { meteredCategoryExists, readingsForLatestPeriod },
    exclusions,
  };
  return auditBuilding(input);
}
```
Remove the unused `latestPeriod` stub. Confirm the `Building → property → customer` relation path and `OccupancyRole` values (`OWNER`/`RESIDENT`) against the schema; adjust if the relation name differs (e.g. building links to property which links to customer). If `areaSqm` is a Float and arrives as a number, no conversion needed; if any field is Decimal, convert with `Number()`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep "building-audit"`
Expected: NO matches.

- [ ] **Step 4: Commit**

```bash
git add app/actions/building-audit.ts
git commit -m "feat(audit): server action loading building data into auditBuilding"
```

---

### Task 3: Audit drawer + dashboard button

**Files:**
- Create: `app/(dashboard)/super-admin/buildings/[id]/AuditDrawer.tsx`
- Modify: `app/(dashboard)/super-admin/buildings/[id]/BuildingDashboard.tsx`

- [ ] **Step 1: Read `BuildingDashboard.tsx`** — note the KPI/header area, the `TabKey` type, and the `setTab`/tab-state mechanism (so a finding's link can switch tabs). Find how tab state is held (a `useState<TabKey>`).

- [ ] **Step 2: Create `AuditDrawer.tsx`** (client):

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { RiStethoscopeLine, RiCloseLine, RiRefreshLine, RiErrorWarningLine, RiAlertLine, RiInformationLine, RiCheckboxCircleLine } from "react-icons/ri";
import { auditBuildingEntries } from "@/app/actions/building-audit";
import type { Finding, AuditTab } from "@/lib/buildings/audit";

const SEV = {
  error: { color: "#dc2626", icon: RiErrorWarningLine, label: "σφάλματα" },
  warning: { color: "#f59e0b", icon: RiAlertLine, label: "προειδοποιήσεις" },
  info: { color: "#0a8", icon: RiInformationLine, label: "προτάσεις" },
} as const;

export function AuditDrawer({ buildingId, onGoToTab }: { buildingId: string; onGoToTab?: (tab: AuditTab) => void }) {
  const [open, setOpen] = useState(false);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () => startTransition(async () => setFindings(await auditBuildingEntries(buildingId)));
  useEffect(() => { if (open && findings === null) run(); /* eslint-disable-next-line */ }, [open]);

  const counts = (s: keyof typeof SEV) => findings?.filter((f) => f.severity === s).length ?? 0;

  return (
    <>
      <button onClick={() => setOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <RiStethoscopeLine /> Έλεγχος καταχωρήσεων
      </button>
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
          <div onClick={() => setOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.25)" }} />
          <aside style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 380, background: "var(--card, #fff)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", boxShadow: "-8px 0 24px rgba(0,0,0,.12)" }}>
            <div style={{ padding: 14, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <b>Έλεγχος καταχωρήσεων</b>
              <button onClick={() => setOpen(false)} aria-label="Κλείσιμο"><RiCloseLine /></button>
            </div>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", gap: 14, fontSize: 12 }}>
              {(Object.keys(SEV) as (keyof typeof SEV)[]).map((s) => (
                <span key={s} style={{ color: SEV[s].color, fontWeight: 700 }}>● {counts(s)} {SEV[s].label}</span>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: "auto", fontSize: 13 }}>
              {pending && <div style={{ padding: 16, color: "#888" }}>Έλεγχος…</div>}
              {!pending && findings && findings.length === 0 && (
                <div style={{ padding: 20, color: "#0a8", display: "flex", gap: 8, alignItems: "center" }}><RiCheckboxCircleLine /> Όλα εντάξει — καμία ένδειξη προβλήματος.</div>
              )}
              {!pending && findings && (["error", "warning", "info"] as const).flatMap((sev) =>
                findings.filter((f) => f.severity === sev).map((f, i) => {
                  const S = SEV[sev];
                  return (
                    <div key={sev + i} style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ color: S.color, fontWeight: 600, display: "flex", gap: 6, alignItems: "center" }}><S.icon /> {f.title}</div>
                      <div style={{ color: "var(--muted-foreground, #777)", fontSize: 12, margin: "3px 0" }}>{f.detail}</div>
                      {onGoToTab && <button onClick={() => { onGoToTab(f.tab); setOpen(false); }} style={{ color: "#0a7", fontSize: 12, background: "none", border: "none", padding: 0, cursor: "pointer" }}>→ Διόρθωση</button>}
                    </div>
                  );
                }),
              )}
            </div>
            <div style={{ padding: 12, borderTop: "1px solid var(--border)" }}>
              <button onClick={run} disabled={pending} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><RiRefreshLine /> Επανέλεγχος</button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Mount in `BuildingDashboard.tsx`** — import `AuditDrawer` and render the button in the header/KPI area. Wire `onGoToTab` to the dashboard's tab setter (map `AuditTab` → the dashboard `TabKey`: `info`→an overview/details tab, `units`→units tab, `millesimes`/`distribution`/`exclusions`/`heating`→the `"millesimes"` tab since those panels live there, `customer`→leave as a no-op link or the building's customer page). Use the existing `setTab` state. Keep it minimal: the most useful jumps are `units` and `millesimes`.

```tsx
// near the KPI row / header:
<AuditDrawer buildingId={building.id} onGoToTab={(t) => {
  const map: Record<string, TabKey> = { units: "units" as TabKey, millesimes: "millesimes" as TabKey, distribution: "millesimes" as TabKey, exclusions: "millesimes" as TabKey, heating: "millesimes" as TabKey, info: ("info" as TabKey), customer: ("info" as TabKey) };
  const target = map[t]; if (target) setTab(target);
}} />
```
Adjust the `TabKey` literals to ones that actually exist (check the `TABS` array — if there's no `"units"` tab key, point to whichever tab renders units). If the dashboard has no `setTab` exposed where the button sits, lift the button to where tab state lives, or omit `onGoToTab` (drawer still works, just without jump links).

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit 2>&1 | grep -E "AuditDrawer|BuildingDashboard"`
Expected: NO matches. Then `npm run lint 2>&1 | grep -i AuditDrawer || echo clean` — fix lint in new file only.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/super-admin/buildings/[id]/AuditDrawer.tsx" "app/(dashboard)/super-admin/buildings/[id]/BuildingDashboard.tsx"
git commit -m "feat(audit): dashboard drawer with severity findings + tab jumps"
```

---

## PART B — Onboarding chat redesign

### Task 4: `useAiChat` retry()

**Files:**
- Modify: `hooks/useAiChat.ts`

- [ ] **Step 1: Add `retry()`** — track the last user message text in a ref; expose a `retry()` that re-sends it. Read the file; add:
  - a `lastSent` ref set to `text` inside `send()` right after `const text = input.trim()`.
  - a `retry` callback that, if `!isStreaming && lastSent.current`, sets input to `lastSent.current` and calls `send()` — simplest: refactor `send` to accept an optional explicit text, `const send = useCallback(async (forced?: string) => { const text = (forced ?? input).trim(); ... }`. Then `retry = () => send(lastSent.current ?? "")`.
  - Return `retry` in the hook's return object.
  Keep existing behavior identical for the no-arg `send()`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep useAiChat`
Expected: NO matches.

- [ ] **Step 3: Commit**

```bash
git add hooks/useAiChat.ts
git commit -m "feat(ai): useAiChat exposes retry() for failed sends"
```

---

### Task 5: `AiChatWidget` (floating widget + 5 UX items)

**Files:**
- Create: `components/ai/AiChatWidget.tsx`

- [ ] **Step 1: Implement** — create `components/ai/AiChatWidget.tsx` (client). It wraps `useAiChat`, renders a collapsible bottom-right panel, and adds: typing indicator, applied-badges, quick-reply chips, error+retry, auto-scroll.

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { RiRobot2Line, RiCloseLine, RiSendPlane2Line, RiArrowDownLine } from "react-icons/ri";
import { useAiChat } from "@/hooks/useAiChat";

export type AppliedBadge = { id: string; label: string };

export function AiChatWidget({
  agentKey, onToolCall, title = "Βοηθός AI", greeting, quickReplies = [],
}: { agentKey: string; onToolCall: (name: string, args: unknown) => void; title?: string; greeting?: string; quickReplies?: string[] }) {
  const [open, setOpen] = useState(true);
  const [badges, setBadges] = useState<AppliedBadge[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  const { messages, input, setInput, send, isStreaming, error, retry } = useAiChat({
    agentKey,
    onToolCall: (name, args) => {
      onToolCall(name, args);
      // applied badges: summarize changed keys
      const keys = args && typeof args === "object" ? Object.keys(args as object) : [];
      const label = keys.length ? `✓ ${keys.slice(0, 3).join(", ")}` : "✓ ενημερώθηκε";
      setBadges((b) => [...b.slice(-4), { id: `${Date.now()}-${b.length}`, label }]);
    },
  });

  // auto-scroll
  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    if (atBottom) el.scrollTop = el.scrollHeight;
  }, [messages, atBottom]);
  const onScroll = () => {
    const el = scrollRef.current; if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
  };

  const lastAssistant = messages[messages.length - 1];
  const showTyping = isStreaming && (!lastAssistant || lastAssistant.role !== "assistant" || lastAssistant.content === "");

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ position: "fixed", right: 20, bottom: 20, zIndex: 60, width: 56, height: 56, borderRadius: "50%", background: "#0a7", color: "#fff", border: "none", boxShadow: "0 8px 24px rgba(0,0,0,.2)", fontSize: 24, cursor: "pointer" }} aria-label="Άνοιγμα βοηθού">
        <RiRobot2Line />
      </button>
    );
  }

  return (
    <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 60, width: 340, height: 440, background: "#fff", border: "1px solid #d4d4d4", borderRadius: 14, boxShadow: "0 12px 32px rgba(0,0,0,.18)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ background: "linear-gradient(90deg,#0a7,#0a8a6a)", color: "#fff", padding: "10px 12px", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}><RiRobot2Line /> {title}</span>
        <button onClick={() => setOpen(false)} aria-label="Κλείσιμο" style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}><RiCloseLine /></button>
      </div>

      <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, overflowY: "auto", padding: 10, fontSize: 13, lineHeight: 1.5, background: "#fafafa", position: "relative" }}>
        {messages.length === 0 && greeting && <div style={{ marginBottom: 8 }}><Bubble role="assistant">{greeting}</Bubble></div>}
        {messages.map((m) => <div key={m.id} style={{ marginBottom: 8, textAlign: m.role === "user" ? "right" : "left" }}><Bubble role={m.role}>{m.content || (isStreaming ? "…" : "")}</Bubble></div>)}
        {showTyping && <div style={{ marginBottom: 8 }}><Bubble role="assistant"><Dots /></Bubble></div>}
        {badges.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            {badges.map((b) => <span key={b.id} style={{ background: "#ecfdf5", color: "#0a7", borderRadius: 8, padding: "3px 8px", fontSize: 11 }}>{b.label}</span>)}
          </div>
        )}
        {error && (
          <div style={{ marginTop: 8, color: "#c00", fontSize: 12 }}>
            {error} <button onClick={retry} style={{ color: "#0a7", background: "none", border: "none", cursor: "pointer" }}>Ξανά</button>
          </div>
        )}
      </div>

      {!atBottom && (
        <button onClick={() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; setAtBottom(true); }} style={{ position: "absolute", right: 14, bottom: 70, background: "#0a7", color: "#fff", border: "none", borderRadius: 14, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>
          <RiArrowDownLine /> νέο μήνυμα
        </button>
      )}

      {messages.length === 0 && quickReplies.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "0 10px 8px" }}>
          {quickReplies.map((q) => <button key={q} onClick={() => { setInput(q); setTimeout(() => send(), 0); }} style={{ border: "1px solid #0a7", color: "#0a7", background: "none", borderRadius: 14, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>{q}</button>)}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); send(); }} style={{ display: "flex", gap: 6, padding: 8, borderTop: "1px solid #eee" }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Μήνυμα…" disabled={isStreaming} style={{ flex: 1 }} />
        <button type="submit" disabled={isStreaming || !input.trim()} aria-label="Αποστολή"><RiSendPlane2Line /></button>
      </form>
    </div>
  );
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  return <span style={{ display: "inline-block", padding: "6px 10px", borderRadius: 12, background: role === "user" ? "#0a7" : "#fff", color: role === "user" ? "#fff" : "#1a1a1a", border: role === "user" ? "none" : "1px solid #eee", maxWidth: "85%", textAlign: "left" }}>{children}</span>;
}
function Dots() {
  return <span style={{ letterSpacing: 3, color: "#999" }}>● ● ●</span>;
}
```
Note: the `quickReplies`/`send()` use `setInput` then `send()` — since `send` reads `input` from state which updates async, prefer the `send(forced?)` form from Task 4: call `send(q)` directly for quick replies, and `setInput("")` is handled inside send. Adjust the quick-reply onClick to `onClick={() => send(q)}` once Task 4's `send(forced?)` exists.

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit 2>&1 | grep AiChatWidget`
Expected: NO matches. `npm run lint 2>&1 | grep -i AiChatWidget || echo clean` — fix in new file only (e.g. exhaustive-deps: it's fine to disable for the open-effect with a comment).

- [ ] **Step 3: Commit**

```bash
git add components/ai/AiChatWidget.tsx
git commit -m "feat(ai): reusable floating AiChatWidget with typing/badges/chips/retry/autoscroll"
```

---

### Task 6: Geocode fields in agent/payload/action

**Files:**
- Modify: `lib/ai/agents/building-onboarding.ts`
- Modify: `app/actions/building-onboarding-payload.ts`
- Modify: `app/actions/building-onboarding.ts`
- Modify: `app/actions/building-onboarding-payload.test.ts`

- [ ] **Step 1: Add optional geo fields to `buildingInfoSchema`** in `lib/ai/agents/building-onboarding.ts`:

```ts
export const buildingInfoSchema = z.object({
  address: z.string().min(1).optional(),
  managerName: z.string().min(1).optional(),
  heatingType: z.enum([...HEATING_TYPES]).optional(),
  hasElevator: z.boolean().optional(),
  elevatorSurchargePerFloor: z.number().min(0).max(1).optional(),
  elevatorExemptGroundFloor: z.boolean().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});
```
(These are client-supplied from geocoding, not the AI — but adding them to the schema lets the same shape flow through Zod re-validation in the action.)

- [ ] **Step 2: Carry them through `buildOnboardingPayload`** — in `app/actions/building-onboarding-payload.ts`, add to the returned `building` object: `city: input.building.city ?? "", postalCode: input.building.postalCode ?? "", lat: input.building.lat ?? null, lng: input.building.lng ?? null`. Add a test asserting they pass through:

```ts
it("carries geocoded city/postalCode/lat/lng", () => {
  const p = buildOnboardingPayload({ building: { ...base.building, city: "Αθήνα", postalCode: "10672", lat: 37.98, lng: 23.73 }, units: [{ floor: 1, areaSqm: 80 }] });
  expect(p.building.city).toBe("Αθήνα");
  expect(p.building.postalCode).toBe("10672");
  expect(p.building.lat).toBe(37.98);
});
```

- [ ] **Step 3: Persist in the action** — in `app/actions/building-onboarding.ts`, when creating Property + Building, use the geocoded values: set `Property.city/postalCode/lat/lng` and `Building.city/postalCode/lat/lng` from `payload.building` (replace the empty-string defaults). Keep empty-string fallback only when absent (Building requires non-null city/postalCode strings → use `payload.building.city || ""`).

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run app/actions/building-onboarding-payload.test.ts`
Expected: PASS.
Run: `npx tsc --noEmit 2>&1 | grep -E "building-onboarding"`
Expected: NO matches.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/agents/building-onboarding.ts app/actions/building-onboarding-payload.ts app/actions/building-onboarding-payload.test.ts app/actions/building-onboarding.ts
git commit -m "feat(onboarding): thread geocoded city/postalCode/lat/lng into building creation"
```

---

### Task 7: Onboarding redesign — full-width body + widget + geocode map

**Files:**
- Create: `app/(dashboard)/super-admin/customers/[id]/onboarding/AddressGeocode.tsx`
- Modify: `app/(dashboard)/super-admin/customers/[id]/onboarding/OnboardingWizard.tsx`

- [ ] **Step 1: Read `components/maps/PropertyMap.tsx`** to learn its props (center/lat/lng, marker, height) so the geocode block can render a small read-only map. Note the exact prop names.

- [ ] **Step 2: Create `AddressGeocode.tsx`** (client) — debounced geocode + mini map + city/postal text. Calls `GET /api/geocode?address=`, takes the first result, renders `PropertyMap` (small height) + «<city/displayName> · ΤΚ <postalCode>». Calls back `onResolved({ city, postalCode, lat, lng })` so the wizard can store + submit them.

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { PropertyMap } from "@/components/maps/PropertyMap"; // adjust import/props to the real component

type Resolved = { city?: string; postalCode?: string; lat: number; lng: number; displayName: string };

export function AddressGeocode({ address, onResolved }: { address?: string; onResolved: (r: Resolved | null) => void }) {
  const [res, setRes] = useState<Resolved | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!address || address.trim().length < 4) { setRes(null); onResolved(null); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
        const data = await r.json();
        const first = data?.results?.[0];
        if (first) { const out: Resolved = { city: first.city, postalCode: first.postalCode, lat: first.lat, lng: first.lng, displayName: first.displayName }; setRes(out); onResolved(out); }
        else { setRes(null); onResolved(null); }
      } catch { setRes(null); onResolved(null); }
    }, 600);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  if (!res) return null;
  return (
    <div style={{ marginTop: 8, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", maxWidth: 360 }}>
      <div style={{ height: 140 }}><PropertyMap lat={res.lat} lng={res.lng} /></div>
      <div style={{ padding: 8, fontSize: 12, color: "var(--muted-foreground, #666)" }}>
        📍 {res.city || res.displayName}{res.postalCode ? ` · ΤΚ ${res.postalCode}` : ""}
      </div>
    </div>
  );
}
```
Adjust `PropertyMap` usage to its REAL props (Step 1). If `PropertyMap` needs more (zoom, markers array), pass minimal valid props for a single read-only pin.

- [ ] **Step 3: Refactor `OnboardingWizard.tsx`** — remove the left chat column; render the form + units table as the full-width body; mount `<AiChatWidget agentKey="building-onboarding" onToolCall={...} greeting={...} quickReplies={["Έχει ασανσέρ","Κεντρική θέρμανση","Δεν ξέρω, βοήθησέ με"]} />` (fixed-position, so it floats). Keep the existing `onToolCall` routing (`updateBuildingOnboardingData`→info incl. now city/postalCode/lat/lng if the AI ever sends them; `setUnits`→units). Add geo state:

```tsx
const [geo, setGeo] = useState<{ city?: string; postalCode?: string; lat?: number; lng?: number }>({});
// under the address field:
<AddressGeocode address={info.address} onResolved={(r) => setGeo(r ? { city: r.city, postalCode: r.postalCode, lat: r.lat, lng: r.lng } : {})} />
// in create():
const res = await createBuildingFromOnboarding(selectedCustomerId, { building: { ...info, ...geo }, units });
```
Keep the customer picker (added previously). The page layout: a single scrollable column (building fields + units table) at full width; the widget floats over it.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit 2>&1 | grep -E "OnboardingWizard|AddressGeocode"`
Expected: NO matches. Lint the two files; fix issues in them only.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/super-admin/customers/[id]/onboarding/AddressGeocode.tsx" "app/(dashboard)/super-admin/customers/[id]/onboarding/OnboardingWizard.tsx"
git commit -m "feat(onboarding): full-width body + floating AiChatWidget + address geocode map"
```

---

### Task 8: Full suite + manual smoke

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: PASS — including `lib/buildings/audit.test.ts` and the updated payload suite. Report totals.

- [ ] **Step 2: Feature-wide typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "audit|AuditDrawer|AiChatWidget|AddressGeocode|OnboardingWizard|useAiChat|building-onboarding"`
Expected: NO matches.

- [ ] **Step 3: Manual smoke (needs DEEPSEEK_API_KEY + a customer)**

Run: `npm run dev`
- Building dashboard → «Έλεγχος καταχωρήσεων» → drawer lists findings with counts; a finding's «→ Διόρθωση» switches tab.
- `/super-admin/onboarding` → form full width, AI as bottom-right widget (collapses to 🤖 bubble); typing dots before reply; «✓ …» badges after the AI fills fields; quick-reply chips; type an address → mini map + «πόλη · ΤΚ» appears; create → building has city/postalCode/lat/lng.

- [ ] **Step 4: Commit (empty if nothing changed)**

```bash
git commit --allow-empty -m "chore: building audit + onboarding UX verified"
```

---

## Notes for the implementer

- **Audit is read-only + deterministic** — pure `auditBuilding` is the single source of truth; the action only loads data. Tests cover each rule.
- **`AiChatWidget` reuses `useAiChat`** untouched except the new `retry()`. All domain specifics stay in the onboarding `onToolCall`.
- **Geocode is best-effort** — never blocks creation; map hidden on no-result/error; resolved fields are optional in the Zod schema.
- **`send(forced?)`** (Task 4) makes quick-replies reliable (avoids the setState-then-read race). Use `send(q)` for chips.
- **`PropertyMap` props** — verify the real prop names in Task 7 Step 1; the snippet assumes `lat`/`lng`. Adjust to whatever the component expects (it may take `center={[lng,lat]}` or a markers array).
- **Tab mapping** — only wire jumps to tabs that actually exist in `TABS`; `millesimes`/`distribution`/`exclusions`/`heating` all live under the «Χιλιοστά & Κατανομή» tab.
