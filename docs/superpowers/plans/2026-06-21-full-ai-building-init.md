# Full AI Building Initialization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the onboarding wizard so the AI captures units (floor/area/type) + elevator + heating from natural language, shows a live-editable units table with auto-computed millesimes, and one button creates the whole building shell with millesimes already filled.

**Architecture:** Add a second tool (`setUnits`) to the existing onboarding agent; grow the pure payload/millesime builder using the existing `lib/millesimes.ts` (`distributeWeights`/`elevatorWeight`); make the wizard's right pane an editable units table with live millesime preview; extend the single write action to persist units (floor/area/type) + precomputed millesimes + elevator params + heating override in one transaction. AI never writes; the action re-validates with Zod.

**Tech Stack:** Next.js 16.2, Prisma 7, Zod v4 (`z.toJSONSchema`), Vitest, React. DeepSeek AI core already shipped.

**Spec:** [docs/superpowers/specs/2026-06-21-full-ai-building-init-design.md](../specs/2026-06-21-full-ai-building-init-design.md)

**Conventions:** Prisma enums from `@/lib/prisma/enums`; `db` from `@/lib/db`. Reuse `lib/millesimes.ts`: `distributeWeights(items: {id,weight}[]) → {id, value: number|null}[]` and `elevatorWeight(areaSqm, floor, surchargePerFloor, exemptGround) → number`. The existing wizard files: `lib/ai/agents/building-onboarding.ts`, `app/actions/building-onboarding.ts`, `app/actions/building-onboarding-payload.ts`, `app/(dashboard)/super-admin/customers/[id]/onboarding/OnboardingWizard.tsx`.

---

## File Structure

- **Modify** `lib/ai/agents/building-onboarding.ts` — rename schema to `buildingInfoSchema` (drop `totalApartments`, add elevator fields), add `unitSchema`/`setUnitsSchema`, register a second tool, update the system prompt + registry.
- **Modify** `lib/ai/agents/index.ts` — the agent now exposes two tools (already an array; just confirm the registry passes them through).
- **Rewrite** `app/actions/building-onboarding-payload.ts` — `buildOnboardingPayload` now takes building info + units, normalizes units, and computes the 3 millesime sets via the pure libs.
- **Modify** `app/actions/building-onboarding.ts` — persist units with floor/area/type + precomputed millesimes + elevator params.
- **Modify** `OnboardingWizard.tsx` — building fields + editable units table + live millesime totals; dispatch both tools.
- **Update** the schema test (`lib/ai/agents/building-onboarding.test.ts`) and payload test (`app/actions/building-onboarding-payload.test.ts`).

---

## Task 1: Agent schemas + second tool + prompt

**Files:**
- Modify: `lib/ai/agents/building-onboarding.ts`
- Modify: `lib/ai/agents/building-onboarding.test.ts`

- [ ] **Step 1: Replace the test file** `lib/ai/agents/building-onboarding.test.ts` with coverage of the new schemas:

```ts
import { describe, it, expect } from "vitest";
import { buildingInfoSchema, setUnitsSchema } from "./building-onboarding";

describe("buildingInfoSchema", () => {
  it("accepts partial building info incl. elevator fields", () => {
    expect(buildingInfoSchema.safeParse({ managerName: "Γ", hasElevator: true, elevatorSurchargePerFloor: 0.1 }).success).toBe(true);
    expect(buildingInfoSchema.safeParse({}).success).toBe(true);
  });
  it("rejects an unknown heating type", () => {
    expect(buildingInfoSchema.safeParse({ heatingType: "SOLAR" }).success).toBe(false);
  });
  it("rejects a surcharge outside 0..1", () => {
    expect(buildingInfoSchema.safeParse({ elevatorSurchargePerFloor: 2 }).success).toBe(false);
  });
});

describe("setUnitsSchema", () => {
  it("accepts an array of partial units", () => {
    expect(setUnitsSchema.safeParse({ units: [{ floor: 1, areaSqm: 80 }, { unitType: "SHOP" }] }).success).toBe(true);
  });
  it("rejects negative area and non-integer floor", () => {
    expect(setUnitsSchema.safeParse({ units: [{ areaSqm: -5 }] }).success).toBe(false);
    expect(setUnitsSchema.safeParse({ units: [{ floor: 1.5 }] }).success).toBe(false);
  });
  it("rejects an unknown unit type", () => {
    expect(setUnitsSchema.safeParse({ units: [{ unitType: "VILLA" }] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run lib/ai/agents/building-onboarding.test.ts`
Expected: FAIL (`buildingInfoSchema` / `setUnitsSchema` not exported).

- [ ] **Step 3: Rewrite `lib/ai/agents/building-onboarding.ts`:**

```ts
import { z } from "zod";

export const HEATING_TYPES = ["CENTRAL", "AUTONOMOUS_HOURS", "AUTONOMOUS_METERS", "GAS"] as const;
export type HeatingType = (typeof HEATING_TYPES)[number];
export const UNIT_TYPES = ["APARTMENT", "SHOP", "PARKING", "OTHER"] as const;
export type UnitTypeStr = (typeof UNIT_TYPES)[number];

export const buildingInfoSchema = z.object({
  address: z.string().min(1).optional(),
  managerName: z.string().min(1).optional(),
  heatingType: z.enum([...HEATING_TYPES]).optional(),
  hasElevator: z.boolean().optional(),
  elevatorSurchargePerFloor: z.number().min(0).max(1).optional(),
  elevatorExemptGroundFloor: z.boolean().optional(),
});
export type BuildingInfo = z.infer<typeof buildingInfoSchema>;

export const unitSchema = z.object({
  unitNumber: z.string().min(1).optional(),
  floor: z.number().int().optional(),
  areaSqm: z.number().positive().optional(),
  unitType: z.enum([...UNIT_TYPES]).optional(),
});
export const setUnitsSchema = z.object({ units: z.array(unitSchema) });
export type UnitInfo = z.infer<typeof unitSchema>;

const SYSTEM = `Είσαι έμπειρος βοηθός διαχείρισης πολυκατοικιών. Μιλάς άπταιστα ελληνικά, φιλικά και σύντομα.
Σκοπός σου: να αρχικοποιήσεις πλήρως μια νέα πολυκατοικία — στοιχεία κτηρίου ΚΑΙ μονάδες.

ΕΡΓΑΛΕΙΑ
- updateBuildingOnboardingData: στοιχεία κτηρίου — διεύθυνση, διαχειριστής, τύπος θέρμανσης,
  ύπαρξη ανελκυστήρα (hasElevator), και αν υπάρχει: επιβάρυνση ανά όροφο (elevatorSurchargePerFloor,
  ως κλάσμα, π.χ. 0.10 για 10%, προεπιλογή 0.10) και αν εξαιρείται το ισόγειο (elevatorExemptGroundFloor,
  προεπιλογή true).
- setUnits: ΟΛΟΚΛΗΡΟΣ ο πίνακας μονάδων ως array { unitNumber?, floor, areaSqm, unitType }.
  Κάλεσέ το με το ΠΛΗΡΕΣ array κάθε φορά που αλλάζει (αντικαθιστά τον πίνακα).

ΕΞΑΓΩΓΗ ΜΟΝΑΔΩΝ
- Επέκτεινε φυσικές περιγραφές: «ισόγειο κατάστημα 120τμ, 1ος-3ος από δύο διαμερίσματα 80τμ»
  → 1 SHOP στον όροφο 0 (120τμ) + 6 APARTMENT (2 ανά όροφο 1..3, 80τμ).
- unitType ∈ APARTMENT, SHOP, PARKING, OTHER. Αναγνώρισε: κατάστημα→SHOP, parking/θέση→PARKING.
- ΜΗΝ εφευρίσκεις τ.μ. που δεν δόθηκαν — άφησε το areaSqm κενό και ζήτα το.
- Αν λείπει unitNumber, θα αριθμηθεί αυτόματα — μην ανησυχείς.

ΚΑΝΟΝΕΣ ΑΣΦΑΛΕΙΑΣ (μη παραβιάσιμοι)
- Τύπος θέρμανσης: ΜΟΝΟ CENTRAL (κεντρική), AUTONOMOUS_HOURS (ωρομετρητές),
  AUTONOMOUS_METERS (θερμιδομετρητές), GAS (φυσικό αέριο). Αναγνώρισε προφανή συνώνυμα·
  αν δεν ταιριάζει καθαρά, ρώτα ξανά παραθέτοντας τις 4 επιλογές — μη μαντεύεις.
- ΜΗΝ εφευρίσκεις τιμές· συμπλήρωσε πεδίο μόνο όταν δοθεί ρητά ή προκύπτει ξεκάθαρα.
- Μένεις ΑΥΣΤΗΡΑ στην αρχικοποίηση πολυκατοικίας. Άσχετα αιτήματα → ευγενική άρνηση + επαναφορά.

Όταν υπάρχουν τα βασικά κτηρίου (διεύθυνση, διαχειριστής, θέρμανση) και ≥1 μονάδα με τ.μ., κάνε
σύντομη σύνοψη και πες στον χρήστη να ελέγξει τον πίνακα δεξιά και να πατήσει «Δημιουργία».`;

export const buildingOnboardingAgent = {
  system: SYSTEM,
  tools: [
    {
      name: "updateBuildingOnboardingData",
      description: "Ενημέρωσε τα στοιχεία του κτηρίου (διεύθυνση, διαχειριστής, θέρμανση, ανελκυστήρας).",
      parameters: z.toJSONSchema(buildingInfoSchema),
    },
    {
      name: "setUnits",
      description: "Όρισε ΟΛΟΚΛΗΡΟ τον πίνακα μονάδων (αντικαθιστά τον προηγούμενο).",
      parameters: z.toJSONSchema(setUnitsSchema),
    },
  ],
};
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/ai/agents/building-onboarding.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Confirm the registry passes both tools** — `lib/ai/agents/index.ts` already spreads `buildingOnboardingAgent` (`{ system, tools }`); no change needed. Verify:

Run: `npx tsc --noEmit 2>&1 | grep -E "lib/ai/agents"`
Expected: NO matches.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/agents/building-onboarding.ts lib/ai/agents/building-onboarding.test.ts
git commit -m "feat(onboarding): building-info + setUnits tools, elevator fields"
```

> NOTE: this removes the old `onboardingSchema`/`HeatingType`-only export and `totalApartments`. Tasks 2 and 3 update the consumers (`building-onboarding-payload.ts`, the action, the wizard). Expect those files to have type errors until Tasks 2–4 land — that's fine within this plan; do not "fix" them by reverting this task.

---

## Task 2: Pure payload + millesime builder

**Files:**
- Rewrite: `app/actions/building-onboarding-payload.ts`
- Rewrite: `app/actions/building-onboarding-payload.test.ts`

- [ ] **Step 1: Write the failing tests** — replace `app/actions/building-onboarding-payload.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildOnboardingPayload } from "./building-onboarding-payload";

const base = {
  building: { address: "Ακαδημίας 12", managerName: "Γ", heatingType: "CENTRAL" as const, hasElevator: true, elevatorSurchargePerFloor: 0.1, elevatorExemptGroundFloor: true },
};

describe("buildOnboardingPayload", () => {
  it("auto-numbers blank unit numbers and defaults type to APARTMENT", () => {
    const p = buildOnboardingPayload({ ...base, units: [{ floor: 1, areaSqm: 80 }, { floor: 2, areaSqm: 80 }] });
    expect(p.units.map((u) => u.unitNumber)).toEqual(["1", "2"]);
    expect(p.units[0].unitType).toBe("APARTMENT");
  });

  it("computes general millesimes from area summing to 1000", () => {
    const p = buildOnboardingPayload({ ...base, units: [{ floor: 1, areaSqm: 100 }, { floor: 2, areaSqm: 100 }, { floor: 3, areaSqm: 200 }] });
    const sum = p.units.reduce((s, u) => s + (u.millesimes ?? 0), 0);
    expect(Math.round(sum)).toBe(1000);
  });

  it("excludes a unit without area from millesimes (null) but others still sum to 1000", () => {
    const p = buildOnboardingPayload({ ...base, units: [{ floor: 1, areaSqm: 100 }, { floor: 1 }] });
    const noArea = p.units.find((u) => u.areaSqm == null)!;
    expect(noArea.millesimes).toBeNull();
    expect(Math.round(p.units.reduce((s, u) => s + (u.millesimes ?? 0), 0))).toBe(1000);
  });

  it("ground floor gets 0 elevator millesimes when exempt; elevator set sums to 1000", () => {
    const p = buildOnboardingPayload({ ...base, units: [{ floor: 0, areaSqm: 100, unitType: "SHOP" }, { floor: 1, areaSqm: 100 }, { floor: 2, areaSqm: 100 }] });
    const ground = p.units.find((u) => u.floor === 0)!;
    expect(ground.millesimesElevator).toBe(0);
    const sumElev = p.units.reduce((s, u) => s + (u.millesimesElevator ?? 0), 0);
    expect(Math.round(sumElev)).toBe(1000);
  });

  it("no elevator → elevator millesimes all null", () => {
    const p = buildOnboardingPayload({ building: { ...base.building, hasElevator: false }, units: [{ floor: 1, areaSqm: 80 }] });
    expect(p.units[0].millesimesElevator).toBeNull();
  });

  it("flags metered heating only for AUTONOMOUS_METERS", () => {
    expect(buildOnboardingPayload({ building: { ...base.building, heatingType: "AUTONOMOUS_METERS" }, units: [{ floor: 1, areaSqm: 1 }] }).meteredHeating).toBe(true);
    expect(buildOnboardingPayload({ ...base, units: [{ floor: 1, areaSqm: 1 }] }).meteredHeating).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run app/actions/building-onboarding-payload.test.ts`
Expected: FAIL.

- [ ] **Step 3: Rewrite `app/actions/building-onboarding-payload.ts`:**

```ts
import { distributeWeights, elevatorWeight } from "@/lib/millesimes";
import type { BuildingInfo, UnitInfo } from "@/lib/ai/agents/building-onboarding";

export type OnboardingPayloadInput = { building: BuildingInfo; units: UnitInfo[] };

export type BuiltUnit = {
  unitNumber: string;
  floor: number | null;
  areaSqm: number | null;
  unitType: "APARTMENT" | "SHOP" | "PARKING" | "OTHER";
  millesimes: number | null;
  millesimesElevator: number | null;
  millesimesHeating: number | null;
};

/** Pure: normalize units + compute the 3 millesime sets. No server deps. */
export function buildOnboardingPayload(input: OnboardingPayloadInput) {
  const surcharge = input.building.elevatorSurchargePerFloor ?? 0.1;
  const exemptGround = input.building.elevatorExemptGroundFloor ?? true;
  const hasElevator = input.building.hasElevator ?? false;

  const norm = input.units.map((u, i) => ({
    unitNumber: u.unitNumber?.trim() || String(i + 1),
    floor: u.floor ?? null,
    areaSqm: u.areaSqm ?? null,
    unitType: (u.unitType ?? "APARTMENT") as BuiltUnit["unitType"],
    _key: String(i),
  }));

  const general = new Map(distributeWeights(norm.map((u) => ({ id: u._key, weight: u.areaSqm ?? 0 }))).map((r) => [r.id, r.value]));
  const heating = general; // same basis (area)
  const elevator = hasElevator
    ? new Map(distributeWeights(norm.map((u) => ({ id: u._key, weight: elevatorWeight(u.areaSqm ?? 0, u.floor, surcharge, exemptGround) }))).map((r) => [r.id, r.value]))
    : null;

  const units: BuiltUnit[] = norm.map((u) => ({
    unitNumber: u.unitNumber,
    floor: u.floor,
    areaSqm: u.areaSqm,
    unitType: u.unitType,
    millesimes: general.get(u._key) ?? null,
    millesimesElevator: elevator ? (elevator.get(u._key) ?? null) : null,
    millesimesHeating: heating.get(u._key) ?? null,
  }));

  return {
    building: {
      address: input.building.address ?? "",
      managerName: input.building.managerName ?? "",
      hasElevator,
      elevatorSurchargePerFloor: surcharge,
      elevatorExemptGroundFloor: exemptGround,
    },
    units,
    meteredHeating: input.building.heatingType === "AUTONOMOUS_METERS",
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run app/actions/building-onboarding-payload.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add app/actions/building-onboarding-payload.ts app/actions/building-onboarding-payload.test.ts
git commit -m "feat(onboarding): pure payload computes units + 3 millesime sets"
```

---

## Task 3: Write action persists units + millesimes + elevator

**Files:**
- Modify: `app/actions/building-onboarding.ts`

- [ ] **Step 1: Rewrite `createBuildingFromOnboarding`** to validate building + units, build the payload, and persist everything. Replace the file's imports + validation + transaction:

```ts
"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { buildingInfoSchema, setUnitsSchema } from "@/lib/ai/agents/building-onboarding";
import { buildOnboardingPayload } from "./building-onboarding-payload";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const user = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (user?.role !== "SUPER_ADMIN") throw new Error("Forbidden");
}

async function managingCompanyId(): Promise<string> {
  const c = await db.company.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!c) throw new Error("No managing company");
  return c.id;
}

export async function createBuildingFromOnboarding(
  customerId: string,
  raw: unknown,
): Promise<{ buildingId: string } | { error: string }> {
  await requireSuperAdmin();
  const data = (raw ?? {}) as { building?: unknown; units?: unknown };
  const building = buildingInfoSchema.safeParse(data.building);
  const unitsParsed = setUnitsSchema.safeParse({ units: Array.isArray((data.units as any)) ? data.units : [] });
  if (!building.success || !building.data.address || !building.data.managerName || !building.data.heatingType) {
    return { error: "Συμπληρώστε διεύθυνση, διαχειριστή και τύπο θέρμανσης." };
  }
  if (!unitsParsed.success || unitsParsed.data.units.length === 0) {
    return { error: "Προσθέστε τουλάχιστον μία μονάδα." };
  }
  const payload = buildOnboardingPayload({ building: building.data, units: unitsParsed.data.units });
  if (!payload.units.some((u) => u.areaSqm != null && u.areaSqm > 0)) {
    return { error: "Συμπληρώστε τετραγωνικά σε τουλάχιστον μία μονάδα για να υπολογιστούν τα χιλιοστά." };
  }
  const companyId = await managingCompanyId();

  const buildingId = await db.$transaction(async (tx) => {
    const property = await tx.property.create({
      data: { companyId, customerId, name: payload.building.address, address: payload.building.address },
    });
    const b = await tx.building.create({
      data: {
        companyId, propertyId: property.id,
        name: payload.building.address, address: payload.building.address,
        city: "", postalCode: "", country: "Greece",
        hasElevator: payload.building.hasElevator,
        elevatorSurchargePerFloor: payload.building.elevatorSurchargePerFloor,
        elevatorExemptGroundFloor: payload.building.elevatorExemptGroundFloor,
        unitsCount: payload.units.length,
        technicalNotes: `Διαχειριστής: ${payload.building.managerName}`,
      },
    });
    await tx.unit.createMany({
      data: payload.units.map((u) => ({
        buildingId: b.id,
        unitNumber: u.unitNumber,
        floor: u.floor ?? undefined,
        areaSqm: u.areaSqm ?? undefined,
        unitType: u.unitType,
        millesimes: u.millesimes ?? undefined,
        millesimesElevator: u.millesimesElevator ?? undefined,
        millesimesHeating: u.millesimesHeating ?? undefined,
      })),
    });
    if (payload.meteredHeating) {
      const heatingCat = await tx.expenseCategory.findFirst({
        where: { defaultBasis: { in: ["HEATING_MILLESIMES", "METERED_70_30"] } },
        select: { id: true, defaultTenantPct: true, defaultOwnerPct: true },
      });
      if (heatingCat) {
        await tx.buildingCategoryOverride.upsert({
          where: { buildingId_categoryId: { buildingId: b.id, categoryId: heatingCat.id } },
          create: { buildingId: b.id, categoryId: heatingCat.id, distributionBasis: "METERED_70_30", tenantPct: heatingCat.defaultTenantPct, ownerPct: heatingCat.defaultOwnerPct },
          update: { distributionBasis: "METERED_70_30" },
        });
      }
    }
    return b.id;
  });

  revalidatePath(`/super-admin/customers/${customerId}`);
  return { buildingId };
}
```
Notes: confirm `Unit` accepts `unitType` as the string enum value (it imports `UnitType` from `@/lib/prisma/enums`; the string literal "APARTMENT" etc. satisfies it). `createMany` with `undefined` fields omits them (Prisma treats `undefined` as "not set"). If `unitType` typing complains, cast to the Prisma `UnitType` enum.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep "building-onboarding.ts"`
Expected: NO matches. (The `unitType`/`millesimes*` fields exist on `Unit` from earlier features.)

- [ ] **Step 3: Commit**

```bash
git add app/actions/building-onboarding.ts
git commit -m "feat(onboarding): persist units with floor/area/type + millesimes + elevator"
```

---

## Task 4: Wizard UI — building fields + editable units table + live millesimes

**Files:**
- Modify: `app/(dashboard)/super-admin/customers/[id]/onboarding/OnboardingWizard.tsx`

- [ ] **Step 1: Read the current `OnboardingWizard.tsx`** to keep its chat pane, `useAiChat` wiring, and styling. You are replacing the right pane (was 4 read-only cells) with building fields + an editable units table, and changing `onToolCall` to dispatch two tools.

- [ ] **Step 2: Replace the component** with the two-tool version + editable table + live millesimes. Keep the left chat pane as-is; change state, `onToolCall`, the right pane, and the create payload:

```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAiChat } from "@/hooks/useAiChat";
import { createBuildingFromOnboarding } from "@/app/actions/building-onboarding";
import { type HeatingType, type UnitTypeStr } from "@/lib/ai/agents/building-onboarding";
import { distributeWeights, elevatorWeight } from "@/lib/millesimes";

type BuildingInfo = { address?: string; managerName?: string; heatingType?: HeatingType; hasElevator?: boolean; elevatorSurchargePerFloor?: number; elevatorExemptGroundFloor?: boolean };
type UnitRow = { unitNumber?: string; floor?: number | null; areaSqm?: number | null; unitType?: UnitTypeStr };
const HEATING_LABEL: Record<HeatingType, string> = { CENTRAL: "Κεντρική", AUTONOMOUS_HOURS: "Αυτονομία (ωρομετρητές)", AUTONOMOUS_METERS: "Αυτονομία (θερμιδομετρητές)", GAS: "Φυσικό αέριο" };

export function OnboardingWizard({ customerId, customerName }: { customerId: string; customerName: string }) {
  const router = useRouter();
  const [info, setInfo] = useState<BuildingInfo>({ hasElevator: false, elevatorSurchargePerFloor: 0.1, elevatorExemptGroundFloor: true });
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const { messages, input, setInput, send, isStreaming, error } = useAiChat({
    agentKey: "building-onboarding",
    onToolCall: (name, args) => {
      if (name === "updateBuildingOnboardingData") setInfo((f) => ({ ...f, ...(args as BuildingInfo) }));
      else if (name === "setUnits") setUnits(((args as { units?: UnitRow[] }).units ?? []).map((u) => ({ ...u })));
    },
  });

  // Live millesimes (pure libs)
  const mil = useMemo(() => {
    const surcharge = info.elevatorSurchargePerFloor ?? 0.1;
    const exempt = info.elevatorExemptGroundFloor ?? true;
    const g = new Map(distributeWeights(units.map((u, i) => ({ id: String(i), weight: u.areaSqm ?? 0 }))).map((r) => [r.id, r.value]));
    const e = info.hasElevator ? new Map(distributeWeights(units.map((u, i) => ({ id: String(i), weight: elevatorWeight(u.areaSqm ?? 0, u.floor ?? null, surcharge, exempt) }))).map((r) => [r.id, r.value])) : null;
    const sum = (m: Map<string, number | null>) => [...m.values()].reduce((s, v) => s + (v ?? 0), 0);
    return { g, e, gSum: sum(g), eSum: e ? sum(e) : 0 };
  }, [units, info.hasElevator, info.elevatorSurchargePerFloor, info.elevatorExemptGroundFloor]);

  const setUnit = (i: number, patch: Partial<UnitRow>) => setUnits((us) => us.map((u, j) => (j === i ? { ...u, ...patch } : u)));
  const addUnit = () => setUnits((us) => [...us, { unitType: "APARTMENT" }]);
  const removeUnit = (i: number) => setUnits((us) => us.filter((_, j) => j !== i));

  const hasArea = units.some((u) => (u.areaSqm ?? 0) > 0);
  const complete = !!(info.address && info.managerName && info.heatingType && units.length && hasArea);
  const method = info.heatingType === "AUTONOMOUS_METERS" ? "70/30 μετρητής" : "χιλιοστά θέρμανσης";

  function create() {
    setErr(null);
    startTransition(async () => {
      const res = await createBuildingFromOnboarding(customerId, { building: info, units });
      if ("error" in res) { setErr(res.error); return; }
      router.push(`/super-admin/buildings/${res.buildingId}`);
    });
  }

  const num = (v: string) => (v === "" ? null : Number(v));

  return (
    <div style={{ display: "flex", gap: 16, height: "calc(100vh - 120px)" }}>
      {/* LEFT: chat (unchanged from prior version) */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", border: "1px solid var(--border)", borderRadius: 8 }}>
        <div style={{ padding: 12, borderBottom: "1px solid var(--border)", fontWeight: 600 }}>AI Onboarding — {customerName}</div>
        <div style={{ flex: 1, overflowY: "auto", padding: 12, fontSize: 14, lineHeight: 1.6 }}>
          {messages.length === 0 && <div style={{ color: "var(--muted-foreground)" }}>Περιγράψτε το κτήριο και τις μονάδες (όροφοι, τ.μ.), τη θέρμανση και τον ανελκυστήρα.</div>}
          {messages.map((m) => (
            <div key={m.id} style={{ marginBottom: 10, textAlign: m.role === "user" ? "right" : "left" }}>
              <span style={{ display: "inline-block", padding: "6px 10px", borderRadius: 10, background: m.role === "user" ? "#eef2ff" : "#f4f4f6" }}>{m.content || (isStreaming ? "…" : "")}</span>
            </div>
          ))}
          {error && <div style={{ color: "#c00" }}>{error}</div>}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(); }} style={{ display: "flex", gap: 8, padding: 10, borderTop: "1px solid var(--border)" }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Γράψτε μήνυμα…" disabled={isStreaming} style={{ flex: 1 }} />
          <button type="submit" disabled={isStreaming || !input.trim()}>➤</button>
        </form>
      </div>

      {/* RIGHT: building fields + units table */}
      <div style={{ flex: 1.3, border: "1px solid var(--border)", borderRadius: 8, padding: 16, overflowY: "auto" }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Στοιχεία κτηρίου <span style={{ fontSize: 11, color: "#16a34a" }}>● live</span></div>
        <label style={{ display: "block", marginBottom: 6 }}>Διαχειριστής <input value={info.managerName ?? ""} onChange={(e) => setInfo((f) => ({ ...f, managerName: e.target.value }))} /></label>
        <label style={{ display: "block", marginBottom: 6 }}>Διεύθυνση <input value={info.address ?? ""} onChange={(e) => setInfo((f) => ({ ...f, address: e.target.value }))} /></label>
        <label style={{ display: "block", marginBottom: 6 }}>Θέρμανση
          <select value={info.heatingType ?? ""} onChange={(e) => setInfo((f) => ({ ...f, heatingType: (e.target.value || undefined) as HeatingType }))}>
            <option value="">—</option>
            {(Object.keys(HEATING_LABEL) as HeatingType[]).map((h) => <option key={h} value={h}>{HEATING_LABEL[h]}</option>)}
          </select>
          {info.heatingType && <span style={{ fontSize: 11, color: "#f59e0b" }}> → {method}</span>}
        </label>
        <label style={{ display: "block", marginBottom: 6 }}>
          <input type="checkbox" checked={!!info.hasElevator} onChange={(e) => setInfo((f) => ({ ...f, hasElevator: e.target.checked }))} /> Ανελκυστήρας
        </label>
        {info.hasElevator && (
          <div style={{ display: "flex", gap: 12, fontSize: 13, marginBottom: 6 }}>
            <label>Επιβάρυνση/όροφο %
              <input type="number" style={{ width: 70 }} value={Math.round((info.elevatorSurchargePerFloor ?? 0.1) * 100)} onChange={(e) => setInfo((f) => ({ ...f, elevatorSurchargePerFloor: Number(e.target.value) / 100 }))} />
            </label>
            <label><input type="checkbox" checked={info.elevatorExemptGroundFloor ?? true} onChange={(e) => setInfo((f) => ({ ...f, elevatorExemptGroundFloor: e.target.checked }))} /> Εξαίρεση ισογείου</label>
          </div>
        )}

        <div style={{ fontWeight: 700, margin: "14px 0 6px" }}>Μονάδες</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: "#f4f4f6", textAlign: "right" }}>
            <th style={{ textAlign: "left", padding: 6 }}>Αρ.</th><th>Όροφος</th><th>τ.μ.</th><th>Τύπος</th><th>Γεν.‰</th><th>Ανελ.‰</th><th></th>
          </tr></thead>
          <tbody>
            {units.map((u, i) => (
              <tr key={i} style={{ borderTop: "1px solid #eee", textAlign: "right" }}>
                <td style={{ textAlign: "left" }}><input style={{ width: 50 }} value={u.unitNumber ?? ""} placeholder={String(i + 1)} onChange={(e) => setUnit(i, { unitNumber: e.target.value })} /></td>
                <td><input style={{ width: 50 }} type="number" value={u.floor ?? ""} onChange={(e) => setUnit(i, { floor: num(e.target.value) as number | null })} /></td>
                <td><input style={{ width: 60 }} type="number" value={u.areaSqm ?? ""} onChange={(e) => setUnit(i, { areaSqm: num(e.target.value) })} /></td>
                <td>
                  <select value={u.unitType ?? "APARTMENT"} onChange={(e) => setUnit(i, { unitType: e.target.value as UnitTypeStr })}>
                    <option value="APARTMENT">Διαμέρισμα</option><option value="SHOP">Κατάστημα</option><option value="PARKING">Parking</option><option value="OTHER">Άλλο</option>
                  </select>
                </td>
                <td style={{ color: (u.areaSqm ?? 0) > 0 ? undefined : "#c00" }}>{mil.g.get(String(i)) ?? "—"}</td>
                <td>{mil.e ? (mil.e.get(String(i)) ?? "—") : "—"}</td>
                <td><button type="button" onClick={() => removeUnit(i)}>✕</button></td>
              </tr>
            ))}
            <tr style={{ borderTop: "2px solid #ddd", fontWeight: 700, background: "#fafafa", textAlign: "right" }}>
              <td style={{ textAlign: "left", padding: 6 }}>Σύνολο</td><td></td><td></td><td></td>
              <td style={{ color: Math.round(mil.gSum) === 1000 ? "#0a8" : "#c00" }}>{Math.round(mil.gSum)}</td>
              <td style={{ color: !mil.e ? "#999" : Math.round(mil.eSum) === 1000 ? "#0a8" : "#c00" }}>{mil.e ? Math.round(mil.eSum) : "—"}</td><td></td>
            </tr>
          </tbody>
        </table>
        <button type="button" onClick={addUnit} style={{ marginTop: 8 }}>+ Μονάδα</button>

        {err && <div style={{ color: "#c00", marginTop: 10 }}>{err}</div>}
        <button onClick={create} disabled={!complete || pending} style={{ marginTop: 14, width: "100%" }}>
          {pending ? "Δημιουργία…" : "Δημιουργία & συνέχεια στις λεπτομέρειες →"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit 2>&1 | grep -E "OnboardingWizard"`
Expected: NO matches.
Run: `npm run lint 2>&1 | grep -i "OnboardingWizard" || echo "lint clean"`
Fix lint in this file only.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/super-admin/customers/[id]/onboarding/OnboardingWizard.tsx"
git commit -m "feat(onboarding): editable units table + live millesimes in wizard"
```

---

## Task 5: Full suite + manual smoke

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: PASS — including the rewritten agent-schema and payload suites. Report totals.

- [ ] **Step 2: Feature-wide typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "building-onboarding|OnboardingWizard|lib/ai/agents"`
Expected: NO matches.

- [ ] **Step 3: Manual smoke (needs `DEEPSEEK_API_KEY`)**

Run: `npm run dev`
Open a customer → «Νέα πολυκατοικία με AI». Type: «Ακαδημίας 12, διαχειριστής Γιάννης, αυτονομία με θερμιδομετρητές, έχει ασανσέρ. Ισόγειο κατάστημα 120τμ, 1ος και 2ος από δύο διαμερίσματα 80τμ.» Expect: building fields fill; the units table shows 5 rows (1 SHOP floor 0, 4 APARTMENT floors 1-2); general totals 1000 (✓), elevator totals 1000 with the shop at 0; method shows «70/30 μετρητής». Edit a τ.μ. cell → totals recompute. «Δημιουργία» → building created with units + millesimes, redirect to its detail page; open the millesimes grid to confirm the 3 sets are filled and the heating override is METERED.

- [ ] **Step 4: Commit (empty if nothing changed)**

```bash
git commit --allow-empty -m "chore(onboarding): full AI building init verified"
```

---

## Notes for the implementer

- **No new millesime math** — `buildOnboardingPayload` and the wizard both call `distributeWeights`/`elevatorWeight` from `lib/millesimes.ts`. Keep them consistent (same surcharge/exempt inputs) so the preview matches what the action persists.
- **AI never writes** — `setUnits`/`updateBuildingOnboardingData` only mutate client state; `createBuildingFromOnboarding` re-validates building + units with Zod and is the sole write path.
- **`undefined` vs `null` in `createMany`** — pass `undefined` (not `null`) for unset optional unit fields so Prisma omits them and applies column defaults/null.
- **Units missing τ.μ.** are excluded from millesimes (value `null`) by `distributeWeights`; the table flags them red and the create button stays disabled until at least one unit has τ.μ.
- **Removed `totalApartments` / `onboardingSchema`** — Task 1 deletes them; Tasks 2–4 update every consumer. After Task 4 the whole feature typechecks.
