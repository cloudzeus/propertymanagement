# Σταθμός βάσης, οδική απόσταση και χρεώσεις ανά ζώνη — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Μέτρηση οδικής απόστασης κάθε κτιρίου από την έδρα της εταιρείας με δωρεάν routing API και cache, ενιαίες ζώνες απόστασης στις Ρυθμίσεις, και τρεις χρεώσεις πάνω τους: υπηρεσία πακέτου `PER_ZONE`, μετάβαση τεχνικού στη σύμβαση έργου, προσαύξηση αυτοψίας συνεργάτη.

**Architecture:** Νέο πακέτο `lib/distance/*` (pure ζώνες/μορφοποίηση, server-only router με OSRM/ORS + haversine fallback, DB cache ανά ζεύγος συντεταγμένων, επανυπολογισμός κτιρίων με «stale» κανόνα και cron). Οι αποστάσεις αποθηκεύονται στο `Building`· οι ζώνες προκύπτουν στο read από τα km. Οι τρεις χρεώσεις ακουμπούν τα υπάρχοντα σημεία υπολογισμού (`lib/billing/service-amount.ts`, `forwardOffer`, `OfferForm` defaults) χωρίς να αλλάζουν τα υπάρχοντα μοντέλα τιμής.

**Tech Stack:** Next.js 16.2 server components/actions, Prisma 7 (custom client `lib/prisma`, enums από `@/lib/prisma/enums`), Vitest, react-icons/ri, OSRM public API / OpenRouteService.

**Spec:** `docs/superpowers/specs/2026-10-21-base-station-distance-pricing-design.md`

## Global Constraints

- Prisma: ΠΟΤΕ `prisma migrate dev`. SQL με `npx prisma migrate diff --from-config-datasource prisma.config.ts --to-schema prisma/schema.prisma --script`, αρχείο `prisma/migrations/20261021120000_base_station_distance_zones/migration.sql`, `npx prisma generate` τοπικά. Η migration ΔΕΝ εφαρμόζεται από την υλοποίηση — μόνο ο χρήστης τρέχει `npx prisma migrate deploy`.
- Το τοπικό DATABASE_URL είναι η ΠΑΡΑΓΩΓΗ: καμία test εγγραφή, κανένα script που γράφει στη DB.
- Shared checkout: commit μόνο τα δικά σου αρχεία, ποτέ `stash`/`reset`/branch switch, ποτέ push. Μην αγγίξεις `components/admin/sidebar-nav.tsx`, `lib/quick-actions.ts`, `lib/work/*`.
- UI: ελληνικά, `react-icons/ri` *Line, μεγέθη `var(--fs-*)`, server components για data, `requirePermission`. Ευρώ: `eur()` από `lib/rfq-shared`.
- RBAC registry: ΜΟΝΟ προσθετικές γραμμές στο `lib/rbac/registry.ts` (νέο module `settings-distance`).
- Routing API: 1 κλήση/δευτερόλεπτο, User-Agent `Orithon-PropertyManagement/1.0`, timeout 8 s, ποτέ από τον browser, κάθε αποτυχία → `ESTIMATE` (haversine × 1,3).
- Ζώνες προεπιλογής: A ≤10 km (0 €), B ≤30 (15 €), C ≤60 (35 €), D ανοιχτή (60 €). Κανόνας: `km ≤ maxKm`.
- Tests: Vitest, mocks όπως `app/actions/rfq.test.ts` (`vi.hoisted` + `vi.mock("@/lib/db")`). Γνωστά προϋπάρχοντα κόκκινα: 9 tsc errors, ~339 eslint, 2 failing tests — κανένα νέο.
- Wiki: κάθε νέα σελίδα app → άρθρο με `route:` στο `docs/wiki/pages` (`lib/help/coverage.test.ts`).

## Review Focus

1. Ζώνες με μη αριθμητικά/αρνητικά όρια ή ποσά από τη φόρμα → `validateZones` επιστρέφει μήνυμα, τίποτα δεν αποθηκεύεται (Task 2 + Task 6).
2. OSRM απαντά `code: "NoRoute"` (νησί, ή συντεταγμένες στη θάλασσα) → `ESTIMATE`, όχι exception (Task 3).
3. Ίδιες συντεταγμένες βάσης και κτιρίου → 0 km, Ζώνη Α, χωρίς κλήση αν υπάρχει cache (Task 3, Task 4).
4. Υπηρεσία `PER_ZONE` με `zonePrices` που αναφέρουν ζώνη που αφαιρέθηκε από τις Ρυθμίσεις → ποσό ζώνης 0, όχι NaN (Task 7).
5. Προώθηση προσφοράς για κτίριο χωρίς απόσταση → `travelFee` 0 και `travelZone` null, η τιμή πελάτη = μόνο περιθώριο (Task 8).

---

### Task 1: Schema, migration SQL, generated client, RBAC module

**Files:**
- Modify: `prisma/schema.prisma` (enum `ServicePricingModel` ~γρ. 67, `AppSettings`, `Service`, `Building`, `Supplier`, `WorkOrder`, νέο model `DistanceCache`)
- Create: `prisma/migrations/20261021120000_base_station_distance_zones/migration.sql`
- Modify: `lib/rbac/registry.ts:44-48` (νέα γραμμή module) και `DEFAULT_PERMISSIONS` (~γρ. 146–156: `settings-distance` στα `crud(...)` του SUPER_ADMIN και του ADMIN)
- Modify: `lib/prisma/*` (output του `prisma generate`, committed)

**Interfaces:**
- Produces: πεδία `Building.distanceKm Float?`, `distanceMinutes Int?`, `distanceMethod String?`, `distanceAt DateTime?`, `distanceBaseKey String?`· `AppSettings.distanceZones Json?`· `Service.zonePrices Json?`· `Supplier.surveyZoneFees Json?`· `WorkOrder.travelFee Decimal(10,2)?`, `travelZone String?`, `travelKm Float?`· enum τιμή `PER_ZONE`· model `DistanceCache { id String @id @default(cuid()); fromLat4 Int; fromLng4 Int; toLat4 Int; toLng4 Int; km Float; minutes Int; method String; provider String; expiresAt DateTime?; createdAt DateTime @default(now()); updatedAt DateTime @updatedAt; @@unique([fromLat4, fromLng4, toLat4, toLng4]) }`.
- Produces: RBAC module key `settings-distance` (label «Σταθμός βάσης & ζώνες», href `/super-admin/settings/distance`, icon `RiRoadMapLine`, group `settings`, actions CRUD).

- [ ] **Step 1: Πρόσθεσε τα πεδία/model/enum στο `prisma/schema.prisma`** ακριβώς όπως στο Interfaces. Σχόλιο δίπλα στα `Building.distance*`: `// οδική απόσταση από τον σταθμό βάσης (lib/distance)`.

- [ ] **Step 2: Γράψε το SQL**

Run: `npx prisma migrate diff --from-config-datasource prisma.config.ts --to-schema prisma/schema.prisma --script > /private/tmp/claude-501/-Volumes-EXTERNALSSD-propertymanagement/7faade4f-d872-4ba9-ab93-6ff60d8bd905/scratchpad/distance.sql`
Expected: το αρχείο περιέχει ΜΟΝΟ `ALTER TYPE "ServicePricingModel" ADD VALUE 'PER_ZONE'`, `ALTER TABLE` για AppSettings/Service/Building/Supplier/WorkOrder, `CREATE TABLE "DistanceCache"` + unique index. Αν εμφανιστεί οτιδήποτε άλλο (π.χ. Announcement drift), αφαίρεσέ το με το χέρι. Αντέγραψε το καθαρό SQL στο `prisma/migrations/20261021120000_base_station_distance_zones/migration.sql`.

- [ ] **Step 3: Generate client**

Run: `npx prisma generate`
Expected: `lib/prisma/` ενημερωμένο, χωρίς σφάλμα. ΜΗΝ τρέξεις `migrate deploy`.

- [ ] **Step 4: RBAC** — πρόσθεσε στο `lib/rbac/registry.ts` μετά τη γραμμή του `settings-contracts`:
`{ key: "settings-distance", label: "Σταθμός βάσης & ζώνες", surface: "company", menu: { href: "/super-admin/settings/distance", icon: "RiRoadMapLine", group: "settings" }, actions: [...CRUD] },`
και `"settings-distance"` μέσα στο `crud("settings", "settings-payments", "settings-contracts", …)` των SUPER_ADMIN και ADMIN. Έλεγξε ότι το `RiRoadMapLine` υπάρχει στον icon map που χρησιμοποιεί το sidebar (`grep -rn "RiRoadMapLine" components lib`); αν ο χάρτης εικονιδίων είναι ρητός, πρόσθεσέ το εκεί.

- [ ] **Step 5: Έλεγχος τύπων**

Run: `npx tsc --noEmit 2>&1 | grep -v "auth.ts\|costs/\|ForgotPasswordForm\|otp.ts\|prisma.config.ts\|seed.ts" | head`
Expected: κανένα νέο σφάλμα.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261021120000_base_station_distance_zones lib/prisma lib/rbac/registry.ts
git commit -m "feat(distance): schema for base-station distances, zones, PER_ZONE, travel fee, supplier zone fees + settings-distance module"
```

---

### Task 2: Ζώνες (pure)

**Files:**
- Create: `lib/distance/zones.ts`
- Test: `lib/distance/zones.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type DistanceMethod = "ROAD" | "ESTIMATE";
  export type DistanceZone = { code: string; label: string; maxKm: number | null; travelFee: number };
  export const DEFAULT_ZONES: DistanceZone[];
  export const MAX_ZONES = 8;
  export function parseZones(json: unknown): DistanceZone[];
  export function validateZones(zones: DistanceZone[]): string | null;
  export function zoneForKm(zones: DistanceZone[], km: number | null | undefined): DistanceZone | null;
  export function zoneFee(zones: DistanceZone[], code: string | null | undefined): number;
  export function zoneLabel(zones: DistanceZone[], code: string | null | undefined): string; // «Ζώνη Β» | «χωρίς ζώνη»
  export function formatDistance(km: number | null, minutes: number | null, method: DistanceMethod | null): string;
  export function summarizeZones(zones: DistanceZone[], codes: (string | null)[]): string; // «Ζώνη Β ×2, Ζώνη Γ ×1, χωρίς ζώνη ×1»
  ```
- Αρχείο χωρίς `server-only` (χρησιμοποιείται από client components).

- [ ] **Step 1: Γράψε τα failing tests** στο `lib/distance/zones.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_ZONES, parseZones, validateZones, zoneForKm, zoneFee, zoneLabel, formatDistance, summarizeZones } from "./zones";

describe("parseZones", () => {
  it("falls back to defaults for null/invalid", () => {
    expect(parseZones(null)).toEqual(DEFAULT_ZONES);
    expect(parseZones("x")).toEqual(DEFAULT_ZONES);
    expect(parseZones([{ code: "A" }])).toEqual(DEFAULT_ZONES); // λείπει travelFee → άκυρο
  });
  it("keeps a valid stored list", () => {
    const z = [{ code: "N", label: "Κοντά", maxKm: 5, travelFee: 0 }, { code: "F", label: "Μακριά", maxKm: null, travelFee: 20 }];
    expect(parseZones(z)).toEqual(z);
  });
});
describe("validateZones", () => {
  it("accepts defaults", () => expect(validateZones(DEFAULT_ZONES)).toBeNull());
  it("rejects empty, duplicate codes, non-increasing limits, closed last zone, negative fee, NaN, > MAX", () => {
    expect(validateZones([])).toMatch(/τουλάχιστον/);
    expect(validateZones([{ code: "A", label: "a", maxKm: 10, travelFee: 0 }, { code: "A", label: "b", maxKm: null, travelFee: 0 }])).toMatch(/κωδικ/);
    expect(validateZones([{ code: "A", label: "a", maxKm: 30, travelFee: 0 }, { code: "B", label: "b", maxKm: 10, travelFee: 0 }, { code: "C", label: "c", maxKm: null, travelFee: 0 }])).toMatch(/αύξουσα/);
    expect(validateZones([{ code: "A", label: "a", maxKm: 10, travelFee: 0 }])).toMatch(/τελευταία/);
    expect(validateZones([{ code: "A", label: "a", maxKm: null, travelFee: -1 }])).toMatch(/ποσ/);
    expect(validateZones([{ code: "A", label: "a", maxKm: Number.NaN, travelFee: 0 }, { code: "B", label: "b", maxKm: null, travelFee: 0 }])).toMatch(/km/);
  });
});
describe("zoneForKm", () => {
  it("uses km <= maxKm, open last zone, null for unknown", () => {
    expect(zoneForKm(DEFAULT_ZONES, 0)!.code).toBe("A");
    expect(zoneForKm(DEFAULT_ZONES, 10)!.code).toBe("A");
    expect(zoneForKm(DEFAULT_ZONES, 10.1)!.code).toBe("B");
    expect(zoneForKm(DEFAULT_ZONES, 999)!.code).toBe("D");
    expect(zoneForKm(DEFAULT_ZONES, null)).toBeNull();
  });
});
describe("zoneFee / zoneLabel", () => {
  it("returns 0 and «χωρίς ζώνη» for unknown codes", () => {
    expect(zoneFee(DEFAULT_ZONES, "B")).toBe(15);
    expect(zoneFee(DEFAULT_ZONES, "Z")).toBe(0);
    expect(zoneFee(DEFAULT_ZONES, null)).toBe(0);
    expect(zoneLabel(DEFAULT_ZONES, "B")).toBe("Ζώνη Β");
    expect(zoneLabel(DEFAULT_ZONES, null)).toBe("χωρίς ζώνη");
  });
});
describe("formatDistance", () => {
  it("formats road, estimate and missing", () => {
    expect(formatDistance(23.4, 35, "ROAD")).toBe("23,4 km · περ. 35′");
    expect(formatDistance(23.4, null, "ESTIMATE")).toBe("≈ 23,4 km (εκτίμηση)");
    expect(formatDistance(null, null, null)).toBe("—");
  });
});
describe("summarizeZones", () => {
  it("counts per zone in zone order, unknown last", () => {
    expect(summarizeZones(DEFAULT_ZONES, ["B", null, "C", "B"])).toBe("Ζώνη Β ×2, Ζώνη Γ ×1, χωρίς ζώνη ×1");
  });
});
```

- [ ] **Step 2: Run** `npx vitest run lib/distance/zones.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Υλοποίησε `lib/distance/zones.ts`** με τα signatures του Interfaces. Μηνύματα `validateZones` (ακριβώς, για τα tests): «Χρειάζεται τουλάχιστον μία ζώνη», «Οι κωδικοί ζωνών πρέπει να είναι μοναδικοί», «Τα όρια km πρέπει να είναι σε αύξουσα σειρά», «Η τελευταία ζώνη πρέπει να είναι ανοιχτή (χωρίς όριο km)», «Τα ποσά πρέπει να είναι ≥ 0», «Τα όρια km πρέπει να είναι θετικοί αριθμοί», «Μέγιστο 8 ζώνες». Ελληνικά labels προεπιλογής «Ζώνη Α/Β/Γ/Δ». km με `toLocaleString("el-GR", { maximumFractionDigits: 1 })`.

- [ ] **Step 4: Run** `npx vitest run lib/distance/zones.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit** `git add lib/distance/zones.ts lib/distance/zones.test.ts && git commit -m "feat(distance): zone table parsing, validation, lookup and formatting"`

---

### Task 3: Throttle + routing providers

**Files:**
- Create: `lib/distance/throttle.ts`, `lib/distance/router.ts`
- Test: `lib/distance/throttle.test.ts`, `lib/distance/router.test.ts`

**Interfaces:**
- Consumes: `haversineKm` από `@/lib/supplier-ranking`, `DistanceMethod` από Task 2.
- Produces:
  ```ts
  // throttle.ts (pure)
  export function createThrottle(minIntervalMs: number, deps?: { now?: () => number; sleep?: (ms: number) => Promise<void> }): <T>(fn: () => Promise<T>) => Promise<T>;
  export const providerThrottle: ReturnType<typeof createThrottle>; // 1000 ms, module singleton
  // router.ts (server-only)
  export type LatLng = { lat: number; lng: number };
  export type RouteProvider = "osrm" | "ors" | "haversine";
  export type RouteResult = { km: number; minutes: number; method: DistanceMethod; provider: RouteProvider };
  export type RouterDeps = { fetch?: typeof fetch; env?: { ORS_API_KEY?: string; NEXT_PUBLIC_SITE_URL?: string }; throttle?: <T>(fn: () => Promise<T>) => Promise<T>; timeoutMs?: number };
  export function estimateRoute(from: LatLng, to: LatLng): RouteResult; // haversine × 1.3, minutes = km/50×60, provider "haversine", method "ESTIMATE"
  export async function routeDistance(from: LatLng, to: LatLng, deps?: RouterDeps): Promise<RouteResult>;
  ```
- Στρογγύλεμα: `km = Math.round(m / 100) / 10`, `minutes = Math.round(s / 60)`.

- [ ] **Step 1: Throttle test** `lib/distance/throttle.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createThrottle } from "./throttle";
describe("createThrottle", () => {
  it("spaces calls by the interval using the injected clock", async () => {
    let t = 0; const sleeps: number[] = [];
    const throttle = createThrottle(1000, { now: () => t, sleep: async (ms) => { sleeps.push(ms); t += ms; } });
    await throttle(async () => 1); t += 200;
    await throttle(async () => 2);
    await throttle(async () => 3);
    expect(sleeps).toEqual([800, 1000]);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run lib/distance/throttle.test.ts` — Expected: FAIL.
- [ ] **Step 3: Υλοποίησε `throttle.ts`**: κρατά `last` χρόνο και ένα promise-chain ώστε ταυτόχρονες κλήσεις να σειριοποιούνται.
- [ ] **Step 4: Run** — Expected: PASS.

- [ ] **Step 5: Router tests** `lib/distance/router.test.ts` (mocked fetch, `throttle: (fn) => fn()`):

```ts
import { describe, it, expect, vi } from "vitest";
import { routeDistance, estimateRoute } from "./router";
const A = { lat: 37.98, lng: 23.73 }, B = { lat: 38.0, lng: 23.8 };
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;
const noThrottle = { throttle: <T,>(fn: () => Promise<T>) => fn() };

describe("routeDistance", () => {
  it("parses OSRM when no ORS key", async () => {
    const fetchMock = vi.fn(async () => ok({ code: "Ok", routes: [{ distance: 23456, duration: 2100 }] }));
    const r = await routeDistance(A, B, { ...noThrottle, fetch: fetchMock as never, env: {} });
    expect(r).toEqual({ km: 23.5, minutes: 35, method: "ROAD", provider: "osrm" });
    const url = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("router.project-osrm.org/route/v1/driving/23.73,37.98;23.8,38");
    expect(((fetchMock.mock.calls[0] as unknown[])[1] as RequestInit).headers).toMatchObject({ "User-Agent": expect.stringContaining("Orithon-PropertyManagement") });
  });
  it("prefers ORS when ORS_API_KEY is set", async () => {
    const fetchMock = vi.fn(async () => ok({ routes: [{ summary: { distance: 10000, duration: 600 } }] }));
    const r = await routeDistance(A, B, { ...noThrottle, fetch: fetchMock as never, env: { ORS_API_KEY: "k" } });
    expect(r).toEqual({ km: 10, minutes: 10, method: "ROAD", provider: "ors" });
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("api.openrouteservice.org/v2/directions/driving-car");
  });
  it("falls back to the estimate on NoRoute, non-200, throw and timeout", async () => {
    const est = estimateRoute(A, B);
    for (const f of [
      vi.fn(async () => ok({ code: "NoRoute", routes: [] })),
      vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) }) as unknown as Response),
      vi.fn(async () => { throw new Error("net"); }),
    ]) expect(await routeDistance(A, B, { ...noThrottle, fetch: f as never, env: {} })).toEqual(est);
    const hanging = vi.fn((_: string, init?: RequestInit) => new Promise<Response>((_, rej) => init?.signal?.addEventListener("abort", () => rej(new Error("aborted")))));
    expect(await routeDistance(A, B, { ...noThrottle, fetch: hanging as never, env: {}, timeoutMs: 5 })).toEqual(est);
  });
  it("estimate = haversine × 1.3, 50 km/h", () => {
    const r = estimateRoute(A, A);
    expect(r).toEqual({ km: 0, minutes: 0, method: "ESTIMATE", provider: "haversine" });
  });
});
```

- [ ] **Step 6: Run** `npx vitest run lib/distance/router.test.ts` — Expected: FAIL.
- [ ] **Step 7: Υλοποίησε `router.ts`** (`import "server-only"`): επιλογή παρόχου από `deps.env ?? process.env`, `AbortController` με `setTimeout(timeoutMs ?? 8000)` (καθάρισε το timer), `cache: "no-store"`, headers `User-Agent: Orithon-PropertyManagement/1.0 (+${siteUrl})`; ORS: `POST` JSON `{ coordinates: [[lng,lat],[lng,lat]] }`, header `Authorization: key`. Κάθε throw/μη-ok/άκυρο σώμα → `estimateRoute`. Οι κλήσεις παρόχου περνούν από `deps.throttle ?? providerThrottle`.
- [ ] **Step 8: Run** — Expected: PASS.
- [ ] **Step 9: Commit** `git add lib/distance/throttle.ts lib/distance/throttle.test.ts lib/distance/router.ts lib/distance/router.test.ts && git commit -m "feat(distance): OSRM/ORS road routing with throttle, timeout and haversine fallback"`

---

### Task 4: Cache στη DB + σταθμός βάσης

**Files:**
- Create: `lib/distance/cache.ts`, `lib/distance/base.ts`
- Test: `lib/distance/cache.test.ts`, `lib/distance/base.test.ts`

**Interfaces:**
- Consumes: `routeDistance`, `RouteResult`, `LatLng` (Task 3); `db` από `@/lib/db`.
- Produces:
  ```ts
  // cache.ts
  export function coordKey(p: LatLng): { lat4: number; lng4: number }; // Math.round(x * 10000)
  export const ESTIMATE_TTL_MS = 24 * 60 * 60 * 1000;
  export async function cachedDistance(from: LatLng, to: LatLng, opts?: { force?: boolean; route?: typeof routeDistance; now?: () => Date }): Promise<RouteResult>;
  // base.ts
  export type BaseStation = { lat: number; lng: number; address: string; key: string };
  export function baseKey(p: LatLng): string; // `${lat4},${lng4}`
  export async function getBaseStation(): Promise<BaseStation | null>; // πρώτη Company κατά createdAt· null όταν lat/lng null
  ```

- [ ] **Step 1: Tests** `lib/distance/cache.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const m = vi.hoisted(() => ({ row: null as null | Record<string, unknown>, upserts: [] as unknown[] }));
vi.mock("@/lib/db", () => ({ db: { distanceCache: {
  findUnique: vi.fn(async () => m.row),
  upsert: vi.fn(async (args: { create: Record<string, unknown> }) => { m.upserts.push(args); return args.create; }),
} } }));
import { cachedDistance, coordKey } from "./cache";
const A = { lat: 37.98123456, lng: 23.73 }, B = { lat: 38, lng: 23.8 };
const road = { km: 23.5, minutes: 35, method: "ROAD" as const, provider: "osrm" as const };
const est = { km: 10, minutes: 12, method: "ESTIMATE" as const, provider: "haversine" as const };
beforeEach(() => { m.row = null; m.upserts.length = 0; });

describe("coordKey", () => { it("rounds to 4 decimals as integers", () => expect(coordKey(A)).toEqual({ lat4: 379812, lng4: 237300 })); });
describe("cachedDistance", () => {
  it("returns a ROAD hit without routing", async () => {
    m.row = { ...road, expiresAt: null }; const route = vi.fn();
    expect(await cachedDistance(A, B, { route })).toEqual(road); expect(route).not.toHaveBeenCalled();
  });
  it("routes and upserts on miss, with expiresAt only for estimates", async () => {
    const now = new Date("2026-10-21T10:00:00Z");
    expect(await cachedDistance(A, B, { route: vi.fn(async () => road), now: () => now })).toEqual(road);
    expect((m.upserts[0] as { create: { expiresAt: Date | null } }).create.expiresAt).toBeNull();
    await cachedDistance(A, B, { route: vi.fn(async () => est), now: () => now });
    expect((m.upserts[1] as { create: { expiresAt: Date } }).create.expiresAt.toISOString()).toBe("2026-10-22T10:00:00.000Z");
  });
  it("re-routes an expired estimate and on force", async () => {
    m.row = { ...est, expiresAt: new Date("2026-10-20T00:00:00Z") };
    const route = vi.fn(async () => road);
    expect(await cachedDistance(A, B, { route, now: () => new Date("2026-10-21T00:00:00Z") })).toEqual(road);
    m.row = { ...road, expiresAt: null };
    await cachedDistance(A, B, { route, force: true });
    expect(route).toHaveBeenCalledTimes(2);
  });
});
```

και `lib/distance/base.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({ company: null as null | Record<string, unknown> }));
vi.mock("@/lib/db", () => ({ db: { company: { findFirst: vi.fn(async () => m.company) } } }));
import { getBaseStation, baseKey } from "./base";
describe("getBaseStation", () => {
  it("null without coordinates", async () => { m.company = { lat: null, lng: null, address: "x", city: null }; expect(await getBaseStation()).toBeNull(); });
  it("returns coords, address and key", async () => {
    m.company = { lat: 37.98, lng: 23.73, address: "Αθηνάς 1", city: "Αθήνα", postalCode: "10551" };
    expect(await getBaseStation()).toEqual({ lat: 37.98, lng: 23.73, address: "Αθηνάς 1, 10551 Αθήνα", key: "379800,237300" });
  });
  it("baseKey matches coordKey rounding", () => expect(baseKey({ lat: 37.98123456, lng: 23.73 })).toBe("379812,237300"));
});
```

- [ ] **Step 2: Run** `npx vitest run lib/distance/cache.test.ts lib/distance/base.test.ts` — Expected: FAIL.
- [ ] **Step 3: Υλοποίησε** `cache.ts` (`server-only`; `findUnique` με το σύνθετο unique `fromLat4_fromLng4_toLat4_toLng4`; hit = row && !force && (expiresAt null || expiresAt > now); upsert create/update με τα 4 keys + `km/minutes/method/provider/expiresAt`) και `base.ts` (`findFirst({ orderBy: { createdAt: "asc" }, select: { lat, lng, address, city, postalCode } })`, address = `[address, [postalCode, city].filter(Boolean).join(" ")].filter(Boolean).join(", ")`).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `git add lib/distance/cache.ts lib/distance/cache.test.ts lib/distance/base.ts lib/distance/base.test.ts && git commit -m "feat(distance): per-pair DB cache with estimate TTL and base-station resolver"`

---

### Task 5: Απόσταση κτιρίων — επανυπολογισμός, hooks, cron

**Files:**
- Create: `lib/distance/buildings.ts`, `lib/distance/index.ts` (re-exports των pure: zones + `formatDistance`)
- Test: `lib/distance/buildings.test.ts`
- Modify: `app/actions/buildings.ts` (`createBuilding` ~γρ. 61–95, `updateBuilding` ~97–102), `app/actions/properties.ts` (`createProperty` default building ~γρ. 76–92), `app/actions/building-onboarding.ts` (μετά το `tx.building.create` ~γρ. 32–40), `app/actions/property-geodata.ts` (και οι δύο actions), `lib/cron/jobs.ts:110-118`
- Test: `lib/cron/jobs.test.ts` μόνο αν υπάρχει ήδη· αλλιώς η καταχώριση ελέγχεται στο `lib/distance/buildings.test.ts` (import `CRON_JOBS`).

**Interfaces:**
- Consumes: `getBaseStation`, `cachedDistance`, `zoneForKm`, `parseZones`.
- Produces:
  ```ts
  export type BuildingDistance = { distanceKm: number | null; distanceMinutes: number | null; distanceMethod: DistanceMethod | null; distanceAt: Date | null; distanceBaseKey: string | null };
  export async function recomputeBuildingDistance(buildingId: string, opts?: { force?: boolean }): Promise<BuildingDistance>; // γράφει στο Building, επιστρέφει τα νέα πεδία
  export async function recomputeStaleBuildings(opts?: { limit?: number; force?: boolean }): Promise<{ scanned: number; updated: number; estimated: number; skipped: number }>;
  export function isStale(b: Pick<BuildingDistance, "distanceAt" | "distanceBaseKey" | "distanceMethod">, baseKey: string): boolean;
  export async function getDistanceZones(): Promise<DistanceZone[]>; // AppSettings.distanceZones → parseZones
  export async function touchBuildingDistance(buildingId: string): Promise<void>; // try/catch wrapper για τα hooks — ποτέ throw
  ```
- Cron: `{ key: "base-distances", label: "Αποστάσεις από τη βάση", description: "Μετρά την οδική απόσταση κάθε κτιρίου από την έδρα της εταιρείας (νέα κτίρια, αλλαγή έδρας, εκτιμήσεις προς επιβεβαίωση).", schedule: { kind: "daily", hour: 3 }, run: () => recomputeStaleBuildings() }`.

- [ ] **Step 1: Tests** `lib/distance/buildings.test.ts` με mocked `@/lib/db` (`building.findUnique/findMany/update`, `appSettings.findUnique`), `./base` (`getBaseStation`), `./cache` (`cachedDistance`):

```ts
describe("isStale", () => {
  it("stale when never computed, base changed or estimate", () => {
    expect(isStale({ distanceAt: null, distanceBaseKey: null, distanceMethod: null }, "k")).toBe(true);
    expect(isStale({ distanceAt: new Date(), distanceBaseKey: "old", distanceMethod: "ROAD" }, "k")).toBe(true);
    expect(isStale({ distanceAt: new Date(), distanceBaseKey: "k", distanceMethod: "ESTIMATE" }, "k")).toBe(true);
    expect(isStale({ distanceAt: new Date(), distanceBaseKey: "k", distanceMethod: "ROAD" }, "k")).toBe(false);
  });
});
describe("recomputeBuildingDistance", () => {
  it("clears fields when there is no base or no building coords", async () => { /* base null → update με όλα null, cachedDistance not called */ });
  it("writes km/minutes/method/at/baseKey from the cache", async () => { /* base {key:"k"}, building {lat,lng}, cachedDistance → road → update data matches */ });
});
describe("recomputeStaleBuildings", () => {
  it("only touches stale rows up to the limit and counts estimates", async () => { /* 3 buildings: fresh, stale ROAD, stale ESTIMATE; limit 5 → updated 2, estimated 1 (όταν ο router επιστρέφει ESTIMATE για το ένα), skipped 1 */ });
  it("returns skipped=all when no base", async () => {});
});
describe("touchBuildingDistance", () => { it("swallows errors", async () => { /* cachedDistance throws → resolves undefined */ }); });
describe("cron registration", () => { it("has the base-distances job", async () => { const { CRON_JOBS } = await import("@/lib/cron/jobs"); expect(CRON_JOBS.find((j) => j.key === "base-distances")?.schedule).toEqual({ kind: "daily", hour: 3 }); }); });
```
Συμπλήρωσε τα σώματα με τα mocks (όπως `rfq.test.ts`). Για το cron test κάνε `vi.mock` όσα imports του `lib/cron/jobs.ts` χρειάζονται (`@/lib/notify`, `@/lib/mailgun`, `@/lib/wallet/allowance`, `@/lib/softone/sync/engine`, `@/lib/maintenance`).

- [ ] **Step 2: Run** `npx vitest run lib/distance/buildings.test.ts` — Expected: FAIL.
- [ ] **Step 3: Υλοποίησε `buildings.ts`** (`server-only`). `recomputeStaleBuildings`: φόρτωσε `findMany({ select: { id, lat, lng, distanceAt, distanceBaseKey, distanceMethod } })`, φίλτρο `isStale` (ή `force`), `slice(0, limit ?? 300)`, σειριακά `recomputeBuildingDistance`. Πρόσθεσε το cron entry στο `CRON_JOBS`.
- [ ] **Step 4: Hooks**: κάλεσε `await touchBuildingDistance(id)` μετά την εγγραφή σε `createBuilding`, `updateBuilding` (μόνο όταν `data.lat !== undefined || data.lng !== undefined`), `createProperty` (default building), `createBuildingFromOnboarding` (μετά το transaction), `geocodeProperty`, `updatePropertyGeodata`.
- [ ] **Step 5: Run** `npx vitest run lib/distance` και `npx tsc --noEmit` (φίλτρο γνωστών) — Expected: PASS, 0 νέα.
- [ ] **Step 6: Commit** `git add lib/distance app/actions/buildings.ts app/actions/properties.ts app/actions/building-onboarding.ts app/actions/property-geodata.ts lib/cron/jobs.ts && git commit -m "feat(distance): building distance recompute, write hooks and nightly base-distances job"`

---

### Task 6: Ρυθμίσεις → «Σταθμός βάσης & ζώνες απόστασης»

**Files:**
- Create: `app/actions/distance-settings.ts`, `app/(company)/super-admin/settings/distance/page.tsx`, `components/settings/DistanceSettings.tsx`, `docs/wiki/pages/super-admin-settings-distance.md`
- Test: `app/actions/distance-settings.test.ts`
- Modify: `app/(company)/super-admin/settings/page.tsx` (ομάδα «Λειτουργία», νέα κάρτα), `docs/wiki/pages/super-admin-settings.md` (μία γραμμή για την κάρτα), `docs/wiki/pages/super-admin-settings-cron.md` (η νέα εργασία)

**Interfaces:**
- Consumes: `getBaseStation`, `getDistanceZones`, `recomputeStaleBuildings`, `validateZones`, `geocodeCompanyAddress` (`app/actions/company-profile.ts`), `runCronJobNow` (`app/actions/cron.ts`), `PropertyMap` (`components/maps/PropertyMap.tsx`).
- Produces:
  ```ts
  // app/actions/distance-settings.ts ("use server")
  export async function saveDistanceZones(zones: DistanceZone[]): Promise<{ ok: true } | { error: string }>; // requirePermission("settings-distance","edit"), validateZones, appSettings.upsert distanceZones
  export async function recomputeAllDistances(): Promise<{ ok: true; result: { scanned: number; updated: number; estimated: number; skipped: number } } | { error: string }>; // edit perm, recomputeStaleBuildings({ force: true, limit: 300 })
  export async function loadDistanceOverview(): Promise<DistanceOverview>; // view perm
  export type DistanceOverview = { base: BaseStation | null; zones: DistanceZone[]; perZone: { code: string; label: string; count: number }[]; missing: number; estimated: number; stale: number; lastComputedAt: string | null; total: number };
  ```
- Σελίδα: `requirePermission("settings-distance", "view")`, φορτώνει `loadDistanceOverview` και περνά `canEdit` (perm edit) στο client component.

- [ ] **Step 1: Test** `app/actions/distance-settings.test.ts` (mock `@/lib/rbac/permissions` με `requirePermission` που throw όταν λείπει το perm, mock `@/lib/db`, mock `@/lib/distance/buildings`):

```ts
describe("saveDistanceZones", () => {
  it("rejects invalid zones without writing", async () => { expect(await saveDistanceZones([])).toEqual({ error: "Χρειάζεται τουλάχιστον μία ζώνη" }); expect(m.upsert).not.toHaveBeenCalled(); });
  it("writes valid zones", async () => { expect(await saveDistanceZones(DEFAULT_ZONES)).toEqual({ ok: true }); expect(m.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { distanceZones: DEFAULT_ZONES } })); });
  it("coerces numeric strings from the form", async () => { /* maxKm "10" → 10, travelFee "15,5" → 15.5 */ });
});
describe("loadDistanceOverview", () => {
  it("counts buildings per zone, missing, estimated and stale", async () => { /* 4 buildings: 23 km ROAD key ok, 5 km ROAD old key, 70 km ESTIMATE, null → perZone B1 A1 D1, missing 1, estimated 1, stale 2 */ });
});
```

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Υλοποίησε το action** (coerce: `Number(String(v).replace(",", "."))`).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: UI** `components/settings/DistanceSettings.tsx` ("use client", στυλ από `ProviderVivaSettings.tsx`):
  1. Κάρτα «Σταθμός βάσης»: διεύθυνση + συντεταγμένες (ή προειδοποίηση με `RiErrorWarningLine` «Δεν έχει οριστεί σταθμός βάσης — οι αποστάσεις και οι χρεώσεις ζώνης δεν υπολογίζονται»), `PropertyMap` 220px όταν υπάρχουν συντεταγμένες, κουμπιά «Geocode από τη διεύθυνση» (`geocodeCompanyAddress(companyId)` → `router.refresh()`) και link «Αλλαγή διεύθυνσης» → `/super-admin/settings/company`.
  2. Πίνακας ζωνών: στήλες Κωδικός (readonly), Όνομα, Έως km (τελευταία: κείμενο «και άνω»), Χρέωση μετάβασης (€ καθ.), αφαίρεση (`RiDeleteBinLine`, όχι στην τελευταία αν είναι μόνη). «Προσθήκη ζώνης» (κωδικός = επόμενο ελληνικό γράμμα Α…Θ, μέγιστο 8, εισάγεται ΠΡΙΝ την τελευταία ανοιχτή). «Αποθήκευση» → `saveDistanceZones`, σφάλμα inline.
  3. Κάρτα «Κατάσταση»: `total`, `perZone` chips, «Χωρίς απόσταση», «Κατ' εκτίμηση», «Προς επανυπολογισμό», `lastComputedAt`· κουμπί «Επανυπολογισμός όλων» (`recomputeAllDistances`, spinner, αποτέλεσμα «Ενημερώθηκαν 12, εκτιμήσεις 1»).
  Σελίδα `page.tsx` server: metadata `{ title: "Σταθμός βάσης & ζώνες" }`, h1 με `RiRoadMapLine`.
- [ ] **Step 6: Hub card** στο `settings/page.tsx` ομάδα «Λειτουργία» μετά τις «Προσφορές & συμβάσεις έργου»: `{ href: "/super-admin/settings/distance", label: "Σταθμός βάσης & ζώνες απόστασης", desc: "Η έδρα από την οποία μετράμε χιλιόμετρα, οι ζώνες και η χρέωση μετάβασης.", icon: <RiRoadMapLine />, mod: "settings-distance" }`.
- [ ] **Step 7: Wiki** `super-admin-settings-distance.md` με frontmatter (`route: /super-admin/settings/distance`, `roles: [SUPER_ADMIN, ADMIN]`, `area: settings`, `related: [super-admin-settings, super-admin-settings-company, super-admin-services, super-admin-settings-cron]`) και ενότητες «Τι βλέπετε εδώ», «Βήμα-βήμα», «Πώς μετριέται η απόσταση» (οδική, εφεδρεία εκτίμησης, cache, νυχτερινή εργασία), «Ζώνες και χρεώσεις» (τα τρία σημεία χρήσης). Μία γραμμή στο `super-admin-settings.md` και στο `super-admin-settings-cron.md`.
- [ ] **Step 8: Run** `npx vitest run lib/help/coverage.test.ts app/actions/distance-settings.test.ts` — Expected: PASS.
- [ ] **Step 9: Commit** `git add app/actions/distance-settings.ts app/actions/distance-settings.test.ts "app/(company)/super-admin/settings/distance" components/settings/DistanceSettings.tsx "app/(company)/super-admin/settings/page.tsx" docs/wiki/pages/super-admin-settings-distance.md docs/wiki/pages/super-admin-settings.md docs/wiki/pages/super-admin-settings-cron.md && git commit -m "feat(settings): base station & distance zones page with recompute and status"`

---

### Task 7: Υπηρεσίες πακέτου `PER_ZONE`

**Files:**
- Modify: `lib/billing/service-amount.ts` (types + `serviceLineAmount` + `computePackageTotal` + `getPropertyPackage`), `app/actions/services.ts` (`ServiceInput`, create/update, `serialize`), `app/(company)/super-admin/services/ServicesClient.tsx` (`PRICING_MODELS`, φόρμα), `app/(company)/super-admin/services/page.tsx` (πέρασε `zonePrices` + ζώνες), `components/property/PropertyPackages.tsx` (`PkgView` + `lineFor` → server lines), `app/(company)/super-admin/properties/[id]/PropertyDetailClient.tsx:92-101` (`monthlyEstimate` PER_ZONE → «ανά ζώνη»), `app/api/property/package/pay/route.ts:60-62` (description με detail), `docs/wiki/pages/super-admin-services.md`
- Test: `lib/billing/service-amount.test.ts`

**Interfaces:**
- Consumes: `DistanceZone`, `zoneForKm`, `zoneFee`, `summarizeZones`, `getDistanceZones`.
- Produces:
  ```ts
  export type PricingModel = "PER_UNIT" | "PER_BUILDING" | "PER_COMMON_AREA" | "FLAT" | "METERED_PREPAID" | "PER_ZONE";
  export type BillableService = { id: string; name: string; pricingModel: PricingModel; price: number; zonePrices?: Record<string, number> | null };
  export type PropertyCounts = { units: number; buildings: number; commonAreas: number; buildingZones: (string | null)[] };
  export type PackageLine = { …υπάρχοντα; detail: string | null };
  export function serviceLineAmount(s: BillableService, c: PropertyCounts, zones: DistanceZone[]): number;
  export function computePackageTotal(services: BillableService[], c: PropertyCounts, zones: DistanceZone[]): {...};
  ```
  `PER_ZONE`: `amount = round2(price + Σ zonePrices[code] για κάθε code στο buildingZones, άγνωστο/null → 0)`, `qty = buildings`, `detail = summarizeZones(zones, buildingZones)`. `getPropertyPackage` select `buildings: { select: { distanceKm, _count } }`, `buildingZones = buildings.map(b => zoneForKm(zones, b.distanceKm)?.code ?? null)`, `zones = await getDistanceZones()`.
- `listPropertyPackage` ήδη επιστρέφει `lines` — το `PropertyPackages.tsx` αντικαθιστά το client `lineFor` με `view.lines.find(l => l.serviceId === s.id)` (qty/amount/detail), METERED παραμένει «με χρήση».
- Services action: `ServiceInput.zonePrices?: Record<string, number> | null`, για `PER_ZONE` υποχρεωτικό αντικείμενο (κενά → 0), αποθήκευση `zonePrices` (`Prisma.DbNull` όταν null).

- [ ] **Step 1: Tests** (πρόσθεσε στο υπάρχον `service-amount.test.ts`· ενημέρωσε το `counts` με `buildingZones: [null, null]` και περάστε `DEFAULT_ZONES`):

```ts
describe("PER_ZONE", () => {
  it("adds the zone price of every building to the base price", () => {
    const s = svc({ pricingModel: "PER_ZONE", price: 10, zonePrices: { A: 0, B: 15, C: 40 } });
    expect(serviceLineAmount(s, { ...counts, buildingZones: ["B", "C"] }, DEFAULT_ZONES)).toBe(65);
  });
  it("treats unknown and missing zones as 0", () => {
    const s = svc({ pricingModel: "PER_ZONE", price: 10, zonePrices: { B: 15 } });
    expect(serviceLineAmount(s, { ...counts, buildingZones: ["Z", null] }, DEFAULT_ZONES)).toBe(10);
  });
  it("labels the line", () => {
    const r = computePackageTotal([svc({ id: "z", pricingModel: "PER_ZONE", price: 10, zonePrices: { B: 15 } })], { ...counts, buildingZones: ["B", null] }, DEFAULT_ZONES);
    expect(r.lines[0]).toMatchObject({ qty: 2, amount: 25, detail: "Ζώνη Β ×1, χωρίς ζώνη ×1" });
    expect(r.lines[0].detail).toBeDefined();
  });
});
```
Υπάρχοντα tests: `detail` = `null` για τα παλιά μοντέλα.

- [ ] **Step 2: Run** `npx vitest run lib/billing/service-amount.test.ts` — Expected: FAIL.
- [ ] **Step 3: Υλοποίησε** τα παραπάνω στο `service-amount.ts`, ενημέρωσε τους callers (`grep -rn "computePackageTotal\|serviceLineAmount\|PropertyCounts" app lib components`).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: UI**: `ServicesClient` `PRICING_MODELS += { value: "PER_ZONE", label: "Ανά ζώνη απόστασης / μήνα" }`· όταν `form.pricingModel === "PER_ZONE"`: label τιμής «Βασική τιμή (€/μήνα)» και πίνακας «Ποσό ανά ζώνη (€/κτήριο/μήνα)» μία γραμμή ανά ζώνη (prop `zones: DistanceZone[]` από το page μέσω `getDistanceZones()`), state `zonePrices: Record<string,string>`. Στήλη «Χρέωση» του DataTable: `PER_ZONE` → «Ανά ζώνη: Α 0 € · Β 15 € …`. `PropertyPackages`/`PackageTab`: PER_ZONE → label «ανά ζώνη», estimate «από € {price}», γραμμή detail με `var(--fs-12)` muted. Pay route: `description: l.detail ? `${l.name} — ${l.detail}` : l.name`.
- [ ] **Step 6: Wiki** `super-admin-services.md`: νέα παράγραφος για το «Ανά ζώνη απόστασης» (βάση + ποσό ζώνης ανά κτήριο, κτήρια χωρίς απόσταση μόνο βάση, link στο άρθρο ρυθμίσεων).
- [ ] **Step 7: Run** `npx vitest run lib/billing && npx tsc --noEmit` (φίλτρο) — Expected: PASS, 0 νέα.
- [ ] **Step 8: Commit** `git add lib/billing app/actions/services.ts "app/(company)/super-admin/services" components/property/PropertyPackages.tsx "app/(company)/super-admin/properties/[id]/PropertyDetailClient.tsx" app/api/property/package/pay/route.ts docs/wiki/pages/super-admin-services.md && git commit -m "feat(billing): PER_ZONE service pricing summed per building zone"`

---

### Task 8: Μετάβαση τεχνικού στη σύμβαση έργου

**Files:**
- Modify: `app/actions/rfq.ts` (`ForwardInput`, `forwardOffer` ~γρ. 213–240), `lib/rfq-shared.ts` (`WorkOrderDTO`, `RfqDTO` building distance), `lib/rfq.ts` (`workOrderToCompanyDTO`/`CustomerDTO` mapping, `loadRfqPanel` → `building: { distanceKm, distanceMinutes, distanceMethod }` + `zones`), `components/maintenance/rfq-panel.tsx` (`OfferRow` ~γρ. 137–175, `Kv` τιμής ~γρ. 115), `components/maintenance/offer-card.tsx` (~γρ. 60–68), `lib/contracts.ts` (`DEFAULT_TEMPLATES.WO_CUSTOMER` + `vars.travel_clause`), `app/(company)/super-admin/settings/contracts/*` (κείμενο βοήθειας placeholders: πρόσθεσε `{{travel_clause}}` στη λίστα), `docs/wiki/pages/admin-maintenance-detail.md`, `docs/wiki/flows/suppliers.md`
- Test: `app/actions/rfq.test.ts` (νέο describe), `lib/contracts.test.ts`

**Interfaces:**
- Consumes: `getDistanceZones`, `zoneForKm`, `zoneFee`, `zoneLabel`, `formatDistance`.
- Produces:
  ```ts
  export type ForwardInput = { …υπάρχοντα; travelFee?: number | null };
  // rfq-shared
  export type WorkOrderDTO = { …; travelFee: number | null; travelZone: string | null; travelKm: number | null };
  export type RfqPanelDefaults = { markupPct: number; warrantyMonths: number; building: { distanceKm: number | null; distanceMinutes: number | null; distanceMethod: DistanceMethod | null; zoneCode: string | null; zoneLabel: string; travelFee: number } };
  ```
  `forwardOffer`: `zone = zoneForKm(zones, building.distanceKm)`, `defaultTravel = covered ? 0 : zoneFee(zones, zone?.code)`, `travelFee = covered ? 0 : Math.max(0, input.travelFee ?? defaultTravel)`, `customerPrice = covered ? 0 : input.customerPrice ?? applyMarkup(supplierPrice, markup) + travelFee`, αποθήκευση `travelFee`, `travelZone: zone?.code ?? null`, `travelKm: building.distanceKm`.
  Contract var `travel_clause`: `travelFee > 0 ? `Στο τίμημα περιλαμβάνεται χρέωση μετάβασης **${eur(travelFee)}** (${zoneLabel}, ${km} km).` : ""`.

- [ ] **Step 1: Tests** στο `app/actions/rfq.test.ts` — πρόσθεσε mocks `supplierOffer.findUnique`, `workOrder.create` (καταγραφή `data`), `appSettings.findUnique` (με `distanceZones: null`), `$transaction: (fn) => fn(db)`, `serviceRequest.update`, `supplierOffer.update/updateMany`, και `vi.mock("@/lib/distance/buildings", () => ({ getDistanceZones: async () => DEFAULT_ZONES }))`. Κάνε το `offer.rfq.building` να περιέχει `distanceKm: 23` (ζώνη B):

```ts
describe("forwardOffer — travel fee", () => {
  it("defaults the travel fee from the building zone and adds it to the customer price", async () => {
    await forwardOffer("o1", { markupPct: 10 });
    expect(m.woCreated[0]).toMatchObject({ supplierPrice: 100, customerPrice: 125, travelFee: 15, travelZone: "B", travelKm: 23, markupPct: 10 });
  });
  it("uses the manual travel fee and manual price when given", async () => {
    await forwardOffer("o1", { markupPct: 10, travelFee: 5, customerPrice: 150 });
    expect(m.woCreated[0]).toMatchObject({ customerPrice: 150, travelFee: 5, travelZone: "B" });
  });
  it("is zero for covered work and for buildings without distance", async () => {
    await forwardOffer("o1", { covered: true });
    expect(m.woCreated[0]).toMatchObject({ customerPrice: 0, travelFee: 0 });
    m.offer.rfq.building.distanceKm = null;
    await forwardOffer("o1", { markupPct: 10 });
    expect(m.woCreated[1]).toMatchObject({ customerPrice: 110, travelFee: 0, travelZone: null, travelKm: null });
  });
});
```
και στο `lib/contracts.test.ts`:

```ts
describe("renderContract — travel clause", () => {
  it("renders the travel clause on the customer side when a fee exists", async () => {
    m.wo = { ...baseWo(), travelFee: 15, travelZone: "B", travelKm: 23 };
    const { html } = await renderContract("WO_CUSTOMER", "w1");
    expect(html).toContain("χρέωση μετάβασης");
    expect(html).toContain("15,00 €");
    expect(html).toContain("Ζώνη Β");
  });
  it("omits it when there is no fee", async () => {
    const { html } = await renderContract("WO_CUSTOMER", "w1");
    expect(html).not.toContain("χρέωση μετάβασης");
  });
});
```
(Το `renderContract` φορτώνει ζώνες μέσω `getDistanceZones` — mock το `@/lib/distance/buildings` και εκεί.)

- [ ] **Step 2: Run** `npx vitest run app/actions/rfq.test.ts lib/contracts.test.ts` — Expected: FAIL.
- [ ] **Step 3: Υλοποίησε** action, DTOs, mapping, contracts (`{{travel_clause}}` στο default template μετά το `{{survey_clause}}`; `renderContract` select `travelFee/travelZone/travelKm`).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: UI**: `OfferRow` — γραμμή «Μετάβαση: {zoneLabel} · {formatDistance}» με `<input type=number>` state `travel` (default `defaults.building.travelFee`), η `price` ξαναϋπολογίζεται `applyMarkup(o.amount, markup) + travel` όταν αλλάζει markup ή travel (όχι όταν ο χρήστης έχει πληκτρολογήσει τιμή — κράτα flag `priceTouched`), `covered` → travel disabled 0. `forwardOffer(o.id, { …, travelFee: Number(travel) })`. Στο `Kv «Τιμή πελάτη»` των WO: suffix «(εκ των οποίων μετάβαση {eur(travelFee)} · {zoneLabel})» όταν `travelFee > 0`. `offer-card.tsx` γρ. ~61: δίπλα στην αυτοψία `{w.travelFee > 0 && <span>Μετάβαση {eur(w.travelFee)} ({zoneLabel})</span>}` — το `zoneLabel` υπολογίζεται με `zoneLabel(zones, w.travelZone)` όπου οι ζώνες περνούν ως prop από τη σελίδα portal (`getDistanceZones()`); αν δεν θέλεις νέο prop, αποθήκευσε και εμφάνισε `travelZone` ως «Ζώνη {code}».
- [ ] **Step 6: Wiki**: `admin-maintenance-detail.md` (ενότητα προώθησης προσφοράς: η μετάβαση), `flows/suppliers.md` (η γραμμή μετάβασης στην προσφορά/σύμβαση Α).
- [ ] **Step 7: Run** `npx vitest run app/actions/rfq.test.ts lib/contracts.test.ts lib/help && npx tsc --noEmit` (φίλτρο) — Expected: PASS.
- [ ] **Step 8: Commit** `git add app/actions/rfq.ts app/actions/rfq.test.ts lib/rfq-shared.ts lib/rfq.ts components/maintenance/rfq-panel.tsx components/maintenance/offer-card.tsx lib/contracts.ts lib/contracts.test.ts "app/(company)/super-admin/settings/contracts" docs/wiki && git commit -m "feat(rfq): zone-based travel fee on forwarded offers, work orders and contract A"`

---

### Task 9: Αυτοψία συνεργάτη ανά ζώνη

**Files:**
- Create: `lib/distance/suppliers.ts`
- Test: `lib/distance/suppliers.test.ts`
- Modify: `lib/suppliers-shared.ts` (`SupplierDTO.surveyZoneFees: Record<string, number> | null`, `SupplierFormInput.surveyZoneFees?`), `lib/suppliers.ts:100-125` (`supplierToDTO`), `app/actions/suppliers.ts:70-100` (`normalizeForm`: κάθε τιμή `Math.max(0, Number)` ή 0, `undefined` → μην αγγίξεις), `components/suppliers/SupplierFormModal.tsx:133-145` (πίνακας ζωνών κάτω από «Χρέωση αυτοψίας», prop `zones`), `components/suppliers/SupplierHeader.tsx:54` («Αυτοψία 30,00 € + ζώνη Β 10 €…» συνοπτικά: «+ ζώνες»), οι σελίδες που render `SupplierHeader`/`SupplierFormModal` (πέρασε `zones` από `getDistanceZones()`: `/super-admin/suppliers/[id]`, `/marketplace/profile`, λίστες με modal), `app/(marketplace)/marketplace/rfq/[id]/page.tsx` + `OfferForm.tsx` (`defaults.distance`), `lib/rfq.ts` (`loadRfqPanel` → `OfferDTO.supplierDistance`), `components/maintenance/rfq-panel.tsx` (εμφάνιση km συνεργάτη ανά προσφορά), `docs/wiki/pages/marketplace-profile.md`, `marketplace-rfq-detail.md`, `super-admin-suppliers-detail.md`

**Interfaces:**
- Produces:
  ```ts
  // lib/distance/suppliers.ts
  export type SupplierDistance = { km: number; minutes: number; method: DistanceMethod; zone: DistanceZone | null; zoneFee: number };
  export async function supplierToBuilding(supplierId: string, buildingId: string): Promise<SupplierDistance | null>; // null όταν λείπουν συντεταγμένες
  export function surveyDefault(base: number | null, fees: Record<string, number> | null | undefined, zoneCode: string | null): number | null; // pure: base null & fee 0 → null· αλλιώς (base ?? 0) + fee
  ```
  `OfferForm.defaults += distance: { km: number; minutes: number; method: DistanceMethod; zoneLabel: string; zoneFee: number } | null`. `OfferDTO += supplierDistance: { km: number; method: DistanceMethod } | null` (η εταιρεία βλέπει «23 km από την έδρα του συνεργάτη»).

- [ ] **Step 1: Tests** `lib/distance/suppliers.test.ts` (mock db `supplier.findUnique`, `building.findUnique`, `./cache`, `./buildings#getDistanceZones`):

```ts
describe("surveyDefault", () => {
  it("adds the zone fee to the base", () => { expect(surveyDefault(30, { B: 10 }, "B")).toBe(40); expect(surveyDefault(null, { B: 10 }, "B")).toBe(10); expect(surveyDefault(null, null, "B")).toBeNull(); expect(surveyDefault(30, { B: 10 }, null)).toBe(30); });
});
describe("supplierToBuilding", () => {
  it("returns null without coordinates", async () => {});
  it("returns distance, zone and the supplier's fee for that zone", async () => { /* 23 km → zone B, supplier fees {B:10} → zoneFee 10 */ });
});
```

- [ ] **Step 2: Run** — Expected: FAIL. **Step 3:** Υλοποίησε. **Step 4: Run** — PASS.
- [ ] **Step 5: Wire-up** όπως στα Files: `normalizeForm` + DTO + modal πίνακας (label «Προσαύξηση αυτοψίας ανά ζώνη (€ καθ.)», hint «κενό = 0 · ζώνες από τον σταθμό βάσης της εταιρείας, μετρημένες από τη δική σας έδρα»), `marketplace/rfq/[id]/page.tsx`: `const d = await supplierToBuilding(ctx.supplierId, data.rfq.buildingId)` (χρειάζεται `buildingId` στο `loadSupplierRfq` DTO — πρόσθεσέ το), `defaults.surveyFee = surveyDefault(sup.siteSurveyFee, sup.surveyZoneFees, d?.zone?.code ?? null)`. `OfferForm`: πάνω από το πεδίο αυτοψίας, όταν `defaults.distance`: «Απόσταση από την έδρα σας: {formatDistance} · {zoneLabel}{zoneFee > 0 ? ` (+${eur(zoneFee)})` : ""}». `loadRfqPanel`: για κάθε offer `cachedDistance(supplier, building)` ΜΟΝΟ από cache hit (νέο export `peekCachedDistance(from, to)` στο `cache.ts` που δεν καλεί router) ώστε η σελίδα βλάβης να μην κάνει API κλήσεις· χωρίς hit → null.
- [ ] **Step 6: Wiki** τρεις σελίδες (μία παράγραφος η καθεμία).
- [ ] **Step 7: Run** `npx vitest run lib/distance app/actions lib/help && npx tsc --noEmit` (φίλτρο) — Expected: PASS.
- [ ] **Step 8: Commit** `git add lib/distance/suppliers.ts lib/distance/suppliers.test.ts lib/distance/cache.ts lib/suppliers-shared.ts lib/suppliers.ts app/actions/suppliers.ts components/suppliers lib/rfq.ts lib/rfq-shared.ts components/maintenance/rfq-panel.tsx "app/(marketplace)/marketplace/rfq/[id]" "app/(marketplace)/marketplace/profile" "app/(company)/super-admin/suppliers" docs/wiki && git commit -m "feat(suppliers): survey fee surcharge per distance zone from the supplier's own base"`

---

### Task 10: Εμφάνιση απόστασης κτιρίου (ακίνητο, βλάβη)

**Files:**
- Modify: `app/(company)/super-admin/customers/CustomerTree.tsx:31` (`TBuilding += distanceKm, distanceMinutes, distanceMethod, zoneLabel`), building row rendering στο ίδιο αρχείο (badge δίπλα στη διεύθυνση + ενέργεια «Επανυπολογισμός απόστασης»), `app/(company)/super-admin/properties/[id]/page.tsx:49-51` (map τα νέα πεδία + `zones`), `app/(company)/super-admin/customers/*` όπου φτιάχνεται `TBuilding` (grep `hasFireSafety: b.hasFireSafety`), `app/actions/buildings.ts` (νέο action `recomputeBuildingDistanceAction(buildingId)` με `requireSuperAdmin` → `recomputeBuildingDistance(id, { force: true })`), `lib/maintenance-requests.ts:221-262` (`building: { select: { name, distanceKm, distanceMinutes, distanceMethod } }`), `components/maintenance/types.ts` (`FaultDetail += buildingDistance: string | null`), `components/maintenance/request-detail.tsx:117` (suffix ` · {buildingDistance}`), `docs/wiki/pages/super-admin-properties-detail.md`

**Interfaces:**
- Consumes: `formatDistance`, `zoneForKm`, `zoneLabel`, `getDistanceZones`, `recomputeBuildingDistance`.
- Produces: `recomputeBuildingDistanceAction(buildingId: string): Promise<{ ok: true; label: string } | { error: string }>`.

- [ ] **Step 1: Test** στο υπάρχον `lib/maintenance-requests.test.ts` αν υπάρχει (αλλιώς `components/maintenance/types` δεν χρειάζεται test): `loadFaultDetail` επιστρέφει `buildingDistance: "23 km · περ. 35′ · Ζώνη Β"` όταν το building έχει 23/35/ROAD, `null` χωρίς απόσταση. Αν δεν υπάρχει test αρχείο για το loader, πρόσθεσε pure helper `describeBuildingDistance(b, zones): string | null` στο `lib/distance/zones.ts` και test του εκεί (`"23 km · περ. 35′ · Ζώνη Β"`, `"≈ 70 km (εκτίμηση) · Ζώνη Δ"`, null).
- [ ] **Step 2: Run** — FAIL. **Step 3:** Υλοποίησε helper + wiring + badge (στυλ: `fontSize: "var(--fs-11)"`, `RiRoadMapLine`, muted· «χωρίς απόσταση» με `RiErrorWarningLine`· «προς επανυπολογισμό» όταν `distanceBaseKey` ≠ τρέχον — πέρασε `stale: boolean` από το page). **Step 4: Run** — PASS.
- [ ] **Step 5: Wiki** `super-admin-properties-detail.md`: παράγραφος «Απόσταση από τη βάση».
- [ ] **Step 6: Run** `npx vitest run && npx tsc --noEmit` (φίλτρο) και `npx eslint <touched files>` — Expected: μόνο τα 2 γνωστά failing tests, 0 νέα tsc/eslint.
- [ ] **Step 7: Commit** `git add "app/(company)/super-admin/customers/CustomerTree.tsx" "app/(company)/super-admin/properties/[id]/page.tsx" app/actions/buildings.ts lib/maintenance-requests.ts components/maintenance/types.ts components/maintenance/request-detail.tsx lib/distance/zones.ts lib/distance/zones.test.ts docs/wiki/pages/super-admin-properties-detail.md && git commit -m "feat(distance): show base distance and zone on building cards and fault detail"`

---

### Task 11: Επαλήθευση στον browser, memory, hand-over

**Files:**
- Create: `~/.claude/projects/-Volumes-EXTERNALSSD-propertymanagement/memory/project_base_station_distance.md` + γραμμή στο `MEMORY.md`
- Create: `/Users/kozyris/Library/Application Support/Claude/side-session-notes/local_d495e2b3-12a3-4067-8413-158ebae5f72d/base-station-distance-handover.md`

- [ ] **Step 1:** `preview_start` με launch config `dev-3002`. Η σελίδα `/super-admin/settings/distance` ΔΕΝ δουλεύει πριν τη migration (λείπουν στήλες) — ζήτα από τον χρήστη (AskUserQuestion) να τρέξει:
  ```bash
  npx prisma migrate deploy && npx tsx --env-file=.env prisma/seed-rbac.ts && npx tsx --env-file=.env scripts/index-wiki.ts
  ```
- [ ] **Step 2:** Μετά την εφαρμογή: άνοιξε `/super-admin/settings/distance` (κάρτα βάσης, ζώνες, κατάσταση), `/super-admin/settings` (νέα κάρτα), `/super-admin/services` (φόρμα με «Ανά ζώνη απόστασης» — μην αποθηκεύσεις νέα υπηρεσία), `/super-admin/properties/[id]` ενός υπάρχοντος ακινήτου (badge απόστασης — πάτα «Επανυπολογισμός απόστασης» ΜΟΝΟ αν ο χρήστης το εγκρίνει: γράφει στο Building/DistanceCache), `/super-admin/settings/cron` (η νέα εργασία). Screenshots στο scratchpad. `read_console_messages` χωρίς σφάλματα.
- [ ] **Step 3:** Memory αρχείο (status, μοντέλα, πού ζει κάθε χρέωση, κανόνες API/cache, τι ΔΕΝ έγινε) + index γραμμή.
- [ ] **Step 4:** Hand-over note: commits, αρχεία, εντολές για τον χρήστη, τι επαληθεύτηκε στον browser και τι όχι, προϋπάρχοντα κόκκινα.
- [ ] **Step 5:** `mcp__ccd_turn__wrap_up`.
