# Orithon Persona Dashboards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the three `(customer)` dashboards (owner / resident / building-manager) on a shared Orithon "class" design kit with persona-specific data, stats/trend visuals, and a prominent open-tickets block.

**Architecture:** Pure aggregation helpers (`lib/dashboard/aggregations.ts`, unit-tested) feed server query fetchers (`lib/dashboard/queries.ts`) that hydrate presentational server components (`components/dashboard/*`). Pages are thin: fetch → render kit. **Everything is a server component — zero `"use client"`** (no interactivity needed; pay-now is a plain link). A new `(customer)/building` route serves `PROPERTY_ADMIN`, scoped via `ManagementAssignment`.

**Tech Stack:** Next.js 16 (server components), Prisma 7 (`@/lib/db`), react-icons/ri, Vitest, inline-SVG visuals (no chart lib), Orithon CSS tokens in `app/globals.css`.

**Design tokens (use ONLY these; no ad-hoc hex except in SVG fills derived from them):**
`--bg-canvas` `--card` `--card-hover` `--border` `--border-strong` `--foreground` `--muted-foreground` `--color-accent`(#F2A23C) `--color-success`(#2E7D5B) `--color-warning`(#CA5D00) `--color-danger`(#C0392B) `--shadow-card` `--radius`(12) `--radius-lg`(18) `--font-display`(Cormorant serif).

---

## File Structure

- Create `lib/dashboard/aggregations.ts` — pure functions (occupancy, unpaid sums, monthly trend, collection rate, money formatting). **Tested.**
- Create `lib/dashboard/aggregations.test.ts` — Vitest unit tests.
- Create `lib/dashboard/queries.ts` — persona server fetchers (`getOwnerDashboard`, `getResidentDashboard`, `getBuildingManagerDashboard`).
- Create `components/dashboard/` primitives: `hero.tsx`, `stat-tile.tsx`, `section-card.tsx`, `status-chip.tsx`, `money-row.tsx`, `progress-meter.tsx`, `donut.tsx`, `mini-bars.tsx`, `ticket-list.tsx`, `empty-state.tsx`, `pay-now-button.tsx` (client), `index.ts` (barrel).
- Modify `app/(customer)/owner/page.tsx` — rebuild on kit.
- Modify `app/(customer)/portal/page.tsx` — rebuild on kit.
- Create `app/(customer)/building/page.tsx` — building-manager dashboard.
- Modify `lib/surfaces.ts` — `PROPERTY_ADMIN` home → `/building`.
- Modify `components/admin/sidebar-nav.tsx` — `PROPERTY_ADMIN` nav → `/building`.

---

## Task 1: Aggregation helpers (TDD)

**Files:**
- Create: `lib/dashboard/aggregations.ts`
- Test: `lib/dashboard/aggregations.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// lib/dashboard/aggregations.test.ts
import { describe, it, expect } from "vitest";
import {
  formatEuro,
  occupancy,
  sumUnpaid,
  collectionRate,
  monthlyTrend,
  lastNMonths,
} from "./aggregations";

describe("formatEuro", () => {
  it("formats with euro sign and 2 decimals", () => {
    expect(formatEuro(1234.5)).toBe("€1.234,50");
    expect(formatEuro(0)).toBe("€0,00");
  });
});

describe("occupancy", () => {
  it("counts occupied/vacant and rate", () => {
    const r = occupancy([{ residentId: "a" }, { residentId: null }, { residentId: "b" }]);
    expect(r).toEqual({ total: 3, occupied: 2, vacant: 1, rate: 67 });
  });
  it("handles empty", () => {
    expect(occupancy([])).toEqual({ total: 0, occupied: 0, vacant: 0, rate: 0 });
  });
});

describe("sumUnpaid", () => {
  it("sums amount where paid flag is false", () => {
    const rows = [
      { amount: 10, paid: false },
      { amount: 5, paid: true },
      { amount: 7.5, paid: false },
    ];
    expect(sumUnpaid(rows)).toBe(17.5);
  });
});

describe("collectionRate", () => {
  it("returns collected/total and pct", () => {
    expect(collectionRate(75, 100)).toEqual({ collected: 75, total: 100, pct: 75 });
  });
  it("guards divide-by-zero", () => {
    expect(collectionRate(0, 0)).toEqual({ collected: 0, total: 0, pct: 0 });
  });
});

describe("lastNMonths", () => {
  it("returns N YYYY-MM keys ending at anchor, oldest first", () => {
    expect(lastNMonths("2026-03", 3)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(lastNMonths("2026-01", 2)).toEqual(["2025-12", "2026-01"]);
  });
});

describe("monthlyTrend", () => {
  it("buckets amounts into the month series, zero-filling gaps", () => {
    const rows = [
      { month: "2026-02", amount: 10 },
      { month: "2026-02", amount: 5 },
      { month: "2026-03", amount: 8 },
    ];
    expect(monthlyTrend(rows, ["2026-01", "2026-02", "2026-03"])).toEqual([
      { month: "2026-01", value: 0 },
      { month: "2026-02", value: 15 },
      { month: "2026-03", value: 8 },
    ]);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- lib/dashboard/aggregations.test.ts`
Expected: FAIL (module not found / exports undefined).

- [ ] **Step 3: Implement**

```ts
// lib/dashboard/aggregations.ts

/** Greek-locale euro, e.g. €1.234,50 */
export function formatEuro(n: number): string {
  return "€" + n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface Occupancy { total: number; occupied: number; vacant: number; rate: number }

export function occupancy(units: { residentId: string | null }[]): Occupancy {
  const total = units.length;
  const occupied = units.filter((u) => u.residentId !== null).length;
  const vacant = total - occupied;
  const rate = total === 0 ? 0 : Math.round((occupied / total) * 100);
  return { total, occupied, vacant, rate };
}

export function sumUnpaid(rows: { amount: number; paid: boolean }[]): number {
  return rows.reduce((acc, r) => (r.paid ? acc : acc + r.amount), 0);
}

export interface Collection { collected: number; total: number; pct: number }

export function collectionRate(collected: number, total: number): Collection {
  const pct = total === 0 ? 0 : Math.round((collected / total) * 100);
  return { collected, total, pct };
}

/** N month keys (YYYY-MM) ending at `anchor` inclusive, oldest first. */
export function lastNMonths(anchor: string, n: number): string[] {
  const [y, m] = anchor.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export interface TrendPoint { month: string; value: number }

export function monthlyTrend(
  rows: { month: string; amount: number }[],
  months: string[],
): TrendPoint[] {
  const bucket = new Map<string, number>(months.map((mm) => [mm, 0]));
  for (const r of rows) {
    if (bucket.has(r.month)) bucket.set(r.month, (bucket.get(r.month) ?? 0) + r.amount);
  }
  return months.map((mm) => ({ month: mm, value: bucket.get(mm) ?? 0 }));
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- lib/dashboard/aggregations.test.ts`
Expected: PASS (all cases).

Note: `formatEuro` test asserts `€1.234,50` — `toLocaleString("el-GR")` produces `1.234,50`. If the CI Node ICU lacks el-GR, fall back is out of scope; el-GR is standard in Node 20+.

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/aggregations.ts lib/dashboard/aggregations.test.ts
git commit -m "feat(dashboard): pure aggregation helpers for persona dashboards"
```

---

## Task 2: Presentational primitives — visuals

**Files:** Create all under `components/dashboard/`. These are server components (no `"use client"`) except where noted.

- [ ] **Step 1: `status-chip.tsx`**

```tsx
// components/dashboard/status-chip.tsx
import type { ReactNode } from "react";

type Tone = "success" | "warning" | "danger" | "neutral" | "accent";
const TONE: Record<Tone, string> = {
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  accent: "var(--color-accent)",
  neutral: "var(--muted-foreground)",
};

export function StatusChip({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const c = TONE[tone];
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
      background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c, whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}
```

- [ ] **Step 2: `section-card.tsx`**

```tsx
// components/dashboard/section-card.tsx
import type { ReactNode } from "react";
import Link from "next/link";
import { RiArrowRightLine } from "react-icons/ri";

export function SectionCard({
  title, viewAllHref, viewAllLabel = "Όλα", children,
}: { title: string; viewAllHref?: string; viewAllLabel?: string; children: ReactNode }) {
  return (
    <section style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", boxShadow: "var(--shadow-card)", padding: 24,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>{title}</h2>
        {viewAllHref && (
          <Link href={viewAllHref} style={{
            fontSize: 12, color: "var(--color-accent)", display: "flex", alignItems: "center",
            gap: 4, textDecoration: "none", fontWeight: 600,
          }}>
            {viewAllLabel} <RiArrowRightLine />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
```

- [ ] **Step 3: `empty-state.tsx`**

```tsx
// components/dashboard/empty-state.tsx
import type { IconType } from "react-icons";

export function EmptyState({ icon: Icon, label }: { icon: IconType; label: string }) {
  return (
    <div style={{ padding: "32px 0", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
      <Icon style={{ fontSize: 30, opacity: 0.35, display: "block", margin: "0 auto 8px" }} />
      {label}
    </div>
  );
}
```

- [ ] **Step 4: `mini-bars.tsx` (inline-SVG trend)**

```tsx
// components/dashboard/mini-bars.tsx
import type { TrendPoint } from "@/lib/dashboard/aggregations";

const MONTH_ABBR = ["Ιαν","Φεβ","Μαρ","Απρ","Μαϊ","Ιουν","Ιουλ","Αυγ","Σεπ","Οκτ","Νοε","Δεκ"];

export function MiniBars({ data, height = 72 }: { data: TrendPoint[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = 26, gap = 14, w = data.length * (barW + gap);
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${height + 18}`} role="img" aria-label="Μηνιαία τάση" style={{ display: "block" }}>
      {data.map((d, i) => {
        const h = Math.round((d.value / max) * height);
        const x = i * (barW + gap);
        const mLabel = MONTH_ABBR[Number(d.month.split("-")[1]) - 1];
        return (
          <g key={d.month}>
            <rect x={x} y={height - h} width={barW} height={Math.max(2, h)} rx={5}
              fill="var(--color-accent)" opacity={i === data.length - 1 ? 1 : 0.4} />
            <text x={x + barW / 2} y={height + 14} textAnchor="middle" fontSize="10"
              fill="var(--muted-foreground)">{mLabel}</text>
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 5: `donut.tsx` (inline-SVG)**

```tsx
// components/dashboard/donut.tsx
export function Donut({
  value, total, label, tone = "var(--color-accent)",
}: { value: number; total: number; label: string; tone?: string }) {
  const pct = total === 0 ? 0 : value / total;
  const r = 42, c = 2 * Math.PI * r;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width="104" height="104" viewBox="0 0 104 104">
        <circle cx="52" cy="52" r={r} fill="none" stroke="var(--muted)" strokeWidth="12" />
        <circle cx="52" cy="52" r={r} fill="none" stroke={tone} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 52 52)" />
        <text x="52" y="50" textAnchor="middle" fontSize="22" fontWeight="700"
          fill="var(--foreground)" style={{ fontFamily: "var(--font-display)" }}>{Math.round(pct * 100)}%</text>
        <text x="52" y="68" textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">{value}/{total}</text>
      </svg>
      <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{label}</span>
    </div>
  );
}
```

- [ ] **Step 6: `progress-meter.tsx`**

```tsx
// components/dashboard/progress-meter.tsx
export function ProgressMeter({ pct, label }: { pct: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{label}</span>}
      <div style={{ height: 10, borderRadius: 999, background: "var(--muted)", overflow: "hidden" }}>
        <div style={{ width: `${clamped}%`, height: "100%", borderRadius: 999,
          background: "linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 70%, #fff))" }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: `stat-tile.tsx`**

```tsx
// components/dashboard/stat-tile.tsx
import type { ReactNode } from "react";
import Link from "next/link";
import type { IconType } from "react-icons";

export function StatTile({
  label, value, sub, icon: Icon, href, tone = "var(--color-accent)", trend, children,
}: {
  label: string; value: ReactNode; sub?: string; icon: IconType; href?: string;
  tone?: string; trend?: { dir: "up" | "down"; pct: number }; children?: ReactNode;
}) {
  const inner = (
    <div style={{
      position: "relative", background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", padding: "20px 22px",
      display: "flex", flexDirection: "column", gap: 8, overflow: "hidden", height: "100%",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: tone }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, color: "var(--muted-foreground)", fontWeight: 500 }}>{label}</span>
        <Icon style={{ fontSize: 20, color: tone }} />
      </div>
      <span style={{ fontSize: 30, fontWeight: 700, color: "var(--foreground)", lineHeight: 1,
        fontFamily: "var(--font-display)" }}>{value}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {sub && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{sub}</span>}
        {trend && (
          <span style={{ fontSize: 11, fontWeight: 600,
            color: trend.dir === "up" ? "var(--color-success)" : "var(--color-danger)" }}>
            {trend.dir === "up" ? "▲" : "▼"} {trend.pct}%
          </span>
        )}
      </div>
      {children}
    </div>
  );
  return href ? (
    <Link href={href} className="dash-tile" style={{ textDecoration: "none" }}>{inner}</Link>
  ) : <div className="dash-tile">{inner}</div>;
}
```

- [ ] **Step 8: `money-row.tsx`**

```tsx
// components/dashboard/money-row.tsx
import { formatEuro } from "@/lib/dashboard/aggregations";
import { StatusChip } from "./status-chip";

export function MoneyRow({
  title, subtitle, amount, paid,
}: { title: string; subtitle?: string; amount: number; paid: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 14px", background: "var(--bg-canvas)", borderRadius: 8,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{subtitle}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)",
          fontFamily: "var(--font-display)" }}>{formatEuro(amount)}</span>
        <StatusChip tone={paid ? "success" : "warning"}>{paid ? "Πληρωμένο" : "Οφειλή"}</StatusChip>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: `ticket-list.tsx`**

```tsx
// components/dashboard/ticket-list.tsx
import { RiToolsLine } from "react-icons/ri";
import { StatusChip } from "./status-chip";
import { EmptyState } from "./empty-state";

export interface TicketItem {
  id: string; title: string; status: string; priority: string; createdAt: Date;
}
const PRIORITY_TONE: Record<string, "danger" | "warning" | "accent" | "neutral"> = {
  URGENT: "danger", HIGH: "warning", NORMAL: "accent", LOW: "neutral",
};
function ageLabel(d: Date): string {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days <= 0) return "σήμερα";
  if (days === 1) return "χθες";
  return `πριν ${days} μέρες`;
}

export function TicketList({ tickets }: { tickets: TicketItem[] }) {
  if (tickets.length === 0) return <EmptyState icon={RiToolsLine} label="Δεν υπάρχουν ανοιχτά αιτήματα" />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {tickets.map((t) => (
        <div key={t.id} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px", background: "var(--bg-canvas)", borderRadius: 8,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              {t.status === "IN_PROGRESS" ? "Σε εξέλιξη" : "Ανοιχτό"} · {ageLabel(t.createdAt)}
            </div>
          </div>
          <StatusChip tone={PRIORITY_TONE[t.priority] ?? "neutral"}>{t.priority}</StatusChip>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 10: `hero.tsx`**

```tsx
// components/dashboard/hero.tsx
import type { ReactNode } from "react";

export function Hero({ title, subtitle, aside }: { title: ReactNode; subtitle?: string; aside?: ReactNode }) {
  return (
    <div style={{
      position: "relative", overflow: "hidden", borderRadius: "var(--radius-lg)",
      border: "1px solid var(--border)", boxShadow: "var(--shadow-card)",
      background: "linear-gradient(120deg, var(--card) 0%, var(--card-hover) 55%, color-mix(in srgb, var(--color-accent) 14%, var(--card)) 100%)",
      padding: "26px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20,
    }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--foreground)", margin: 0,
          fontFamily: "var(--font-display)" }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginTop: 6 }}>{subtitle}</p>}
      </div>
      {aside && <div style={{ flexShrink: 0 }}>{aside}</div>}
    </div>
  );
}
```

- [ ] **Step 11: `pay-now-button.tsx` (server component — plain link, no interactivity)**

```tsx
// components/dashboard/pay-now-button.tsx
import { RiBankCardLine } from "react-icons/ri";
import { formatEuro } from "@/lib/dashboard/aggregations";

export function PayNowButton({ amount, href = "/portal/payments" }: { amount: number; href?: string }) {
  return (
    <a href={href} style={{
      display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px",
      borderRadius: 999, background: "var(--color-accent)", color: "#1b1c1a",
      fontSize: 14, fontWeight: 700, textDecoration: "none", boxShadow: "var(--shadow-btn)",
    }}>
      <RiBankCardLine style={{ fontSize: 18 }} /> Πληρωμή τώρα · {formatEuro(amount)}
    </a>
  );
}
```

- [ ] **Step 12: `index.ts` barrel + hover CSS**

```ts
// components/dashboard/index.ts
export { Hero } from "./hero";
export { StatTile } from "./stat-tile";
export { SectionCard } from "./section-card";
export { StatusChip } from "./status-chip";
export { MoneyRow } from "./money-row";
export { ProgressMeter } from "./progress-meter";
export { Donut } from "./donut";
export { MiniBars } from "./mini-bars";
export { TicketList, type TicketItem } from "./ticket-list";
export { EmptyState } from "./empty-state";
export { PayNowButton } from "./pay-now-button";
```

Append to `app/globals.css` (hover lift for tiles):

```css
.dash-tile { transition: transform .16s ease, box-shadow .16s ease; display: block; height: 100%; }
.dash-tile:hover { transform: translateY(-2px); }
```

- [ ] **Step 13: Typecheck + commit**

Run: `npx tsc --noEmit` (expect no new errors in `components/dashboard/**` or `lib/dashboard/**`).

```bash
git add components/dashboard app/globals.css
git commit -m "feat(dashboard): Orithon presentational primitives kit"
```

---

## Task 3: Persona query fetchers

**Files:** Create `lib/dashboard/queries.ts`.

- [ ] **Step 1: Implement fetchers**

```ts
// lib/dashboard/queries.ts
import { db } from "@/lib/db";
import { lastNMonths, monthlyTrend, occupancy, collectionRate } from "./aggregations";

function anchorMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const OPEN = ["OPEN", "IN_PROGRESS"];

export async function getOwnerDashboard(userId: string) {
  const months = lastNMonths(anchorMonth(), 6);
  const [units, allocations, tickets] = await Promise.all([
    db.unit.findMany({ where: { ownerId: userId }, include: { building: true }, orderBy: { createdAt: "desc" } }),
    db.expenseAllocation.findMany({
      where: { unit: { ownerId: userId } },
      include: { expense: { select: { month: true } } },
    }),
    db.maintenanceRequest.findMany({
      where: { unit: { ownerId: userId }, status: { in: OPEN } },
      orderBy: { createdAt: "desc" }, take: 6,
    }),
  ]);
  const occ = occupancy(units.map((u) => ({ residentId: u.residentId })));
  const owedRows = allocations.map((a) => ({ amount: Number(a.ownerAmount), paid: a.ownerPaid }));
  const owed = owedRows.reduce((s, r) => (r.paid ? s : s + r.amount), 0);
  const trend = monthlyTrend(
    allocations.map((a) => ({ month: a.expense.month, amount: Number(a.ownerAmount) })),
    months,
  );
  return { units, occ, owed, trend, tickets };
}

export async function getResidentDashboard(userId: string, companyId?: string) {
  const months = lastNMonths(anchorMonth(), 6);
  const [unit, allocations, tickets, announcements] = await Promise.all([
    db.unit.findFirst({ where: { residentId: userId }, include: { building: true } }),
    db.expenseAllocation.findMany({
      where: { unit: { residentId: userId } },
      include: { expense: { select: { month: true, description: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.maintenanceRequest.findMany({
      where: { reportedById: userId, status: { in: OPEN } },
      orderBy: { createdAt: "desc" }, take: 6,
    }),
    db.announcement.findMany({
      where: { building: companyId ? { companyId } : {}, status: "ACTIVE" },
      orderBy: { createdAt: "desc" }, take: 5,
    }),
  ]);
  const balance = allocations.reduce((s, a) => (a.tenantPaid ? s : s + Number(a.tenantAmount)), 0);
  const trend = monthlyTrend(
    allocations.map((a) => ({ month: a.expense.month, amount: Number(a.tenantAmount) })),
    months,
  );
  return { unit, allocations, balance, trend, tickets, announcements };
}

/** Building IDs this PROPERTY_ADMIN manages (building- or property-level assignments). */
async function managedBuildingIds(userId: string): Promise<string[]> {
  const assignments = await db.managementAssignment.findMany({
    where: { userId },
    select: { buildingId: true, propertyId: true },
  });
  const direct = assignments.map((a) => a.buildingId).filter((x): x is string => !!x);
  const propertyIds = assignments.map((a) => a.propertyId).filter((x): x is string => !!x);
  let viaProperty: string[] = [];
  if (propertyIds.length) {
    const bs = await db.building.findMany({ where: { propertyId: { in: propertyIds } }, select: { id: true } });
    viaProperty = bs.map((b) => b.id);
  }
  return Array.from(new Set([...direct, ...viaProperty]));
}

export async function getBuildingManagerDashboard(userId: string) {
  const months = lastNMonths(anchorMonth(), 6);
  const month = anchorMonth();
  const buildingIds = await managedBuildingIds(userId);
  const where = { buildingId: { in: buildingIds } };

  const [buildings, monthAllocations, allAllocations, expenses, tickets, announcements] = await Promise.all([
    db.building.findMany({ where: { id: { in: buildingIds } } }),
    db.expenseAllocation.findMany({
      where: { unit: { building: where }, expense: { month } },
      include: { unit: { select: { unitNumber: true } }, expense: { select: { month: true } } },
    }),
    db.expenseAllocation.findMany({
      where: { unit: { building: where } },
      include: { expense: { select: { month: true } } },
    }),
    db.buildingExpense.findMany({ where: { ...where, month }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.maintenanceRequest.findMany({ where: { ...where, status: { in: OPEN } }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.announcement.findMany({ where: { building: where, status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 4 }),
  ]);

  const totalMonth = monthAllocations.reduce((s, a) => s + Number(a.tenantAmount) + Number(a.ownerAmount), 0);
  const collectedMonth = monthAllocations.reduce(
    (s, a) => s + (a.tenantPaid ? Number(a.tenantAmount) : 0) + (a.ownerPaid ? Number(a.ownerAmount) : 0), 0);
  const collection = collectionRate(collectedMonth, totalMonth);
  const debtors = monthAllocations.filter((a) => !a.tenantPaid || !a.ownerPaid);
  const debtorAmount = debtors.reduce(
    (s, a) => s + (a.tenantPaid ? 0 : Number(a.tenantAmount)) + (a.ownerPaid ? 0 : Number(a.ownerAmount)), 0);
  const expensesTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const trend = monthlyTrend(
    allAllocations
      .filter((a) => a.tenantPaid || a.ownerPaid)
      .map((a) => ({ month: a.expense.month, amount: (a.tenantPaid ? Number(a.tenantAmount) : 0) + (a.ownerPaid ? Number(a.ownerAmount) : 0) })),
    months,
  );
  return { buildings, monthAllocations, collection, debtors, debtorAmount, expenses, expensesTotal, trend, tickets, announcements };
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (expect no new errors). If a Prisma relation name differs (e.g. `building.propertyId`), fix to match `schema.prisma` before committing.

```bash
git add lib/dashboard/queries.ts
git commit -m "feat(dashboard): persona server query fetchers"
```

---

## Task 4: Owner dashboard rebuild

**Files:** Modify `app/(customer)/owner/page.tsx` (replace whole file).

- [ ] **Step 1: Replace file**

```tsx
// app/(customer)/owner/page.tsx
import { auth } from "@/auth";
import { getOwnerDashboard } from "@/lib/dashboard/queries";
import { formatEuro } from "@/lib/dashboard/aggregations";
import {
  Hero, StatTile, SectionCard, Donut, MiniBars, TicketList, StatusChip, EmptyState,
} from "@/components/dashboard";
import { RiHome3Line, RiMoneyEuroCircleLine, RiPieChartLine, RiToolsLine } from "react-icons/ri";

export default async function OwnerDashboard() {
  const session = await auth();
  const userId = (session?.user as any)?.id ?? "";
  const { units, occ, owed, trend, tickets } = await getOwnerDashboard(userId);
  const firstName = session?.user?.name?.split(" ")[0] ?? "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Hero
        title={`Καλησπέρα, ${firstName}`}
        subtitle={`${occ.total} ${occ.total === 1 ? "ακίνητο" : "ακίνητα"} · ${occ.rate}% πληρότητα`}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="dash-grid">
        <StatTile label="Ιδιοκτησίες" value={occ.total} sub="Μονάδες μου" icon={RiHome3Line} href="/owner/units" />
        <StatTile label="Ενοικιασμένες" value={occ.occupied} sub={`${occ.vacant} κενές`} icon={RiPieChartLine}
          tone="var(--color-success)" href="/owner/units" />
        <StatTile label="Οφειλές μου" value={formatEuro(owed)} sub="Κοινόχρηστα ιδιοκτήτη" icon={RiMoneyEuroCircleLine}
          tone={owed > 0 ? "var(--color-warning)" : "var(--color-success)"} />
        <StatTile label="Ανοιχτά αιτήματα" value={tickets.length} sub="Στα ακίνητά μου" icon={RiToolsLine}
          tone="var(--color-danger)" href="/owner/maintenance" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }} className="dash-cols">
        <SectionCard title="Οι μονάδες μου" viewAllHref="/owner/units">
          {units.length === 0 ? (
            <EmptyState icon={RiHome3Line} label="Δεν υπάρχουν καταχωρημένες μονάδες" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {units.slice(0, 8).map((u) => (
                <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", background: "var(--bg-canvas)", borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>{u.unitNumber}</div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{u.building?.name}</div>
                  </div>
                  <StatusChip tone={u.residentId ? "success" : "warning"}>
                    {u.residentId ? "Ενοικιασμένο" : "Κενό"}
                  </StatusChip>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionCard title="Πληρότητα">
            <Donut value={occ.occupied} total={occ.total} label="ενοικιασμένες μονάδες" tone="var(--color-success)" />
          </SectionCard>
          <SectionCard title="Χρεώσεις ανά μήνα">
            <MiniBars data={trend} />
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Ανοιχτά αιτήματα συντήρησης" viewAllHref="/owner/maintenance">
        <TicketList tickets={tickets.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, createdAt: t.createdAt }))} />
      </SectionCard>
    </div>
  );
}
```

- [ ] **Step 2: Verify (run app)**

Run the app (see Task 7 verify skill) and load `/owner` while impersonating a `PROPERTY_OWNER` (super-admin View-as). Expect: hero, 4 tiles, occupancy donut, monthly bars, open-tickets list; warm cream + amber only; no console errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(customer)/owner/page.tsx"
git commit -m "feat(owner): Orithon persona dashboard rebuild"
```

---

## Task 5: Resident dashboard rebuild

**Files:** Modify `app/(customer)/portal/page.tsx` (replace whole file).

- [ ] **Step 1: Replace file**

```tsx
// app/(customer)/portal/page.tsx
import { auth } from "@/auth";
import { getResidentDashboard } from "@/lib/dashboard/queries";
import { formatEuro } from "@/lib/dashboard/aggregations";
import {
  Hero, StatTile, SectionCard, MoneyRow, MiniBars, TicketList, EmptyState, PayNowButton,
} from "@/components/dashboard";
import { RiMoneyEuroCircleLine, RiCalendarLine, RiToolsLine, RiNotification2Line } from "react-icons/ri";

export default async function PortalDashboard() {
  const session = await auth();
  const userId = (session?.user as any)?.id ?? "";
  const companyId = (session?.user as any)?.companyId;
  const { unit, allocations, balance, trend, tickets, announcements } = await getResidentDashboard(userId, companyId);
  const firstName = session?.user?.name?.split(" ")[0] ?? "";
  const currentDue = allocations.find((a) => !a.tenantPaid);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Hero
        title={`Καλώς ήρθατε, ${firstName}`}
        subtitle={unit ? `${unit.building?.name} · ${unit.unitNumber}` : "Πύλη ενοικιαστή"}
        aside={balance > 0 ? <PayNowButton amount={balance} /> : undefined}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="dash-grid">
        <StatTile label="Υπόλοιπο κοινοχρήστων" value={formatEuro(balance)} sub={balance > 0 ? "Προς πληρωμή" : "Ενημερωμένο"}
          icon={RiMoneyEuroCircleLine} tone={balance > 0 ? "var(--color-warning)" : "var(--color-success)"} />
        <StatTile label="Τρέχουσα δόση" value={currentDue ? formatEuro(Number(currentDue.tenantAmount)) : "—"}
          sub={currentDue ? currentDue.expense.month : "Καμία εκκρεμότητα"} icon={RiCalendarLine} />
        <StatTile label="Αιτήματά μου" value={tickets.length} sub="Ανοιχτά" icon={RiToolsLine}
          tone="var(--color-danger)" href="/portal/requests" />
        <StatTile label="Ανακοινώσεις" value={announcements.length} sub="Ενεργές" icon={RiNotification2Line}
          tone="var(--color-accent)" href="/portal/announcements" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }} className="dash-cols">
        <SectionCard title="Ιστορικό κοινοχρήστων" viewAllHref="/portal/payments">
          {allocations.length === 0 ? (
            <EmptyState icon={RiMoneyEuroCircleLine} label="Δεν υπάρχουν χρεώσεις" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {allocations.slice(0, 6).map((a) => (
                <MoneyRow key={a.id} title={a.expense.description || `Κοινόχρηστα ${a.expense.month}`}
                  subtitle={a.expense.month} amount={Number(a.tenantAmount)} paid={a.tenantPaid} />
              ))}
            </div>
          )}
        </SectionCard>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionCard title="Κοινόχρηστα ανά μήνα"><MiniBars data={trend} /></SectionCard>
          <SectionCard title="Ανακοινώσεις" viewAllHref="/portal/announcements">
            {announcements.length === 0 ? (
              <EmptyState icon={RiNotification2Line} label="Δεν υπάρχουν ανακοινώσεις" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {announcements.map((ann) => (
                  <div key={ann.id} style={{ padding: "12px 14px", background: "var(--bg-canvas)", borderRadius: 8,
                    borderLeft: "3px solid var(--color-accent)" }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>{ann.title}</div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Ανοιχτά αιτήματα συντήρησης" viewAllHref="/portal/requests">
        <TicketList tickets={tickets.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, createdAt: t.createdAt }))} />
      </SectionCard>
    </div>
  );
}
```

- [ ] **Step 2: Verify** — load `/portal` as `PROPERTY_RESIDENT`; expect balance headline + Pay-now when >0, history rows, monthly bars, announcements, tickets.

- [ ] **Step 3: Commit**

```bash
git add "app/(customer)/portal/page.tsx"
git commit -m "feat(resident): Orithon persona dashboard rebuild with pay-now"
```

---

## Task 6: Building-manager dashboard + routing

**Files:**
- Create `app/(customer)/building/page.tsx`
- Modify `lib/surfaces.ts:21` (`PROPERTY_ADMIN` home)
- Modify `components/admin/sidebar-nav.tsx` (PROPERTY_ADMIN Dashboard href → `/building`)

- [ ] **Step 1: Create building dashboard**

```tsx
// app/(customer)/building/page.tsx
import { auth } from "@/auth";
import { getBuildingManagerDashboard } from "@/lib/dashboard/queries";
import { formatEuro } from "@/lib/dashboard/aggregations";
import {
  Hero, StatTile, SectionCard, ProgressMeter, MoneyRow, MiniBars, Donut, TicketList, EmptyState,
} from "@/components/dashboard";
import { RiMoneyEuroCircleLine, RiUserUnfollowLine, RiToolsLine, RiWallet3Line } from "react-icons/ri";

export default async function BuildingManagerDashboard() {
  const session = await auth();
  const userId = (session?.user as any)?.id ?? "";
  const {
    buildings, monthAllocations, collection, debtors, debtorAmount,
    expenses, expensesTotal, trend, tickets,
  } = await getBuildingManagerDashboard(userId);
  const buildingName = buildings.map((b) => b.name).join(", ") || "Οι πολυκατοικίες μου";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Hero title={buildingName} subtitle={`Εισπράξεις μήνα: ${formatEuro(collection.collected)} / ${formatEuro(collection.total)} · ${collection.pct}%`} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="dash-grid">
        <StatTile label="Εισπράξεις μήνα" value={`${collection.pct}%`} sub={formatEuro(collection.collected)}
          icon={RiMoneyEuroCircleLine} tone="var(--color-success)">
          <div style={{ marginTop: 8 }}><ProgressMeter pct={collection.pct} /></div>
        </StatTile>
        <StatTile label="Οφειλέτες" value={debtors.length} sub={formatEuro(debtorAmount)} icon={RiUserUnfollowLine}
          tone="var(--color-warning)" />
        <StatTile label="Ανοιχτά αιτήματα" value={tickets.length} sub="Συντηρήσεις" icon={RiToolsLine}
          tone="var(--color-danger)" href="/manager/maintenance" />
        <StatTile label="Έξοδα μήνα" value={formatEuro(expensesTotal)} sub={`${expenses.length} καταχωρήσεις`}
          icon={RiWallet3Line} tone="var(--color-accent)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }} className="dash-cols">
        <SectionCard title="Κατάσταση εισπράξεων ανά μονάδα">
          {monthAllocations.length === 0 ? (
            <EmptyState icon={RiMoneyEuroCircleLine} label="Δεν έχουν εκδοθεί κοινόχρηστα αυτόν τον μήνα" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {monthAllocations.slice(0, 8).map((a) => (
                <MoneyRow key={a.id} title={`Μονάδα ${a.unit.unitNumber}`}
                  amount={Number(a.tenantAmount) + Number(a.ownerAmount)}
                  paid={a.tenantPaid && a.ownerPaid} />
              ))}
            </div>
          )}
        </SectionCard>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionCard title="Εισπράξεις">
            <Donut value={Math.round(collection.collected)} total={Math.round(collection.total)} label="εισπραγμένα" tone="var(--color-success)" />
          </SectionCard>
          <SectionCard title="Εισπράξεις ανά μήνα"><MiniBars data={trend} /></SectionCard>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="dash-cols">
        <SectionCard title="Ανοιχτά αιτήματα συντήρησης" viewAllHref="/manager/maintenance">
          <TicketList tickets={tickets.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, createdAt: t.createdAt }))} />
        </SectionCard>
        <SectionCard title="Έξοδα μήνα" viewAllHref="/manager/properties">
          {expenses.length === 0 ? (
            <EmptyState icon={RiWallet3Line} label="Δεν υπάρχουν έξοδα" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {expenses.map((e) => (
                <MoneyRow key={e.id} title={e.description || e.category || "Έξοδο"} subtitle={e.supplierName || e.month}
                  amount={Number(e.amount)} paid={e.paid} />
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update home path** — in `lib/surfaces.ts`, change `PROPERTY_ADMIN: "/portal"` to `PROPERTY_ADMIN: "/building"` in `HOME_BY_ROLE`.

- [ ] **Step 3: Update sidebar nav** — in `components/admin/sidebar-nav.tsx`, in the `PROPERTY_ADMIN` config block, change the "Dashboard" item `href: "/manager"` to `href: "/building"`. Leave the other PROPERTY_ADMIN items (`/manager/properties`, `/manager/units`, `/manager/maintenance`, `/manager/announcements`) unchanged for this task.

- [ ] **Step 4: Update surfaces test if present** — Run `npm test -- lib/surfaces.test.ts`. If a case asserts `PROPERTY_ADMIN` home is `/portal`, update it to `/building`. If no such case, no change.

- [ ] **Step 5: Verify** — load `/building` as `PROPERTY_ADMIN` (View-as). Expect building-scoped collection %, debtors, per-unit collection rows, expenses, tickets.

- [ ] **Step 6: Commit**

```bash
git add "app/(customer)/building/page.tsx" lib/surfaces.ts components/admin/sidebar-nav.tsx lib/surfaces.test.ts
git commit -m "feat(building-manager): building-scoped dashboard + PROPERTY_ADMIN route"
```

---

## Task 7: Responsive + full verification

**Files:** Modify `app/globals.css` (responsive grids).

- [ ] **Step 1: Add responsive rules**

```css
/* dashboard responsive */
@media (max-width: 1024px) {
  .dash-grid { grid-template-columns: repeat(2, 1fr) !important; }
  .dash-cols { grid-template-columns: 1fr !important; }
}
@media (max-width: 560px) {
  .dash-grid { grid-template-columns: 1fr !important; }
}
```

- [ ] **Step 2: Full run + typecheck + tests**

Run: `npx tsc --noEmit` → no new errors.
Run: `npm test` → all pass.
Use the `run` skill / `npm run dev` to load `/owner`, `/portal`, `/building` via super-admin View-as for each role; resize to check 4→2→1 collapse; confirm no ad-hoc Fluent colors remain and serif display renders.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(dashboard): responsive grids for persona dashboards"
```

---

## Self-review notes
- Spec coverage: shared kit (T2), stats/trend visuals (MiniBars/Donut in T4-6), open-tickets block (TicketList in all three), persona data via ExpenseAllocation/BuildingExpense/UnitPayment/Maintenance (T3), building-scoped PROPERTY_ADMIN routing (T6), serif+amber-only visual language (tokens throughout). 
- Prisma field assumptions to confirm at execution: `building.propertyId` exists (used in `managedBuildingIds`); `expenseAllocation.expense.month/description` selectable. Fix names against `schema.prisma` if they differ before committing each task.
- `UnitPayment` is referenced in the spec as an available model but the chosen κοινόχρηστα source is `ExpenseAllocation` (richer tenant/owner split); `UnitPayment` left unused — acceptable (YAGNI).
