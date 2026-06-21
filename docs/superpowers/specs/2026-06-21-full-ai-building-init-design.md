# Spec: Πλήρης AI οδηγός αρχικοποίησης κτηρίου (μονάδες + ανελκυστήρας + θέρμανση + χιλιοστά)

**Date:** 2026-06-21
**Status:** Approved (brainstorming)
**Επεκτείνει:** τον shipped onboarding wizard ([2026-06-21-ai-agent-core-onboarding-wizard-design.md](2026-06-21-ai-agent-core-onboarding-wizard-design.md)). Ξαναχρησιμοποιεί τον AI πυρήνα (`runAgentStream`/`useAiChat`) και τα pure libs χιλιοστών (`lib/millesimes.ts`). Από «shell» (4 πεδία) γίνεται **πλήρης δομή** ώστε τα χιλιοστά να βγαίνουν αυτόματα και το κτήριο να είναι λειτουργικό για κοινόχρηστα.

## Σκοπός

Ο διαχειριστής, μέσα από μία συνομιλία, αρχικοποιεί κτήριο + μονάδες (όροφος/τ.μ./τύπος) + ανελκυστήρα + τύπο θέρμανσης. Το AI μετατρέπει φυσική περιγραφή σε επεξεργάσιμο πίνακα μονάδων· τα 3 σετ χιλιοστών υπολογίζονται live· ένα κουμπί «Δημιουργία» γράφει τα πάντα ατομικά.

## Αρχές (locked)

- **Scope = δομή + βασικά (A).** Μονάδες με όροφο/τ.μ./τύπο, ανελκυστήρας (ύπαρξη + επιβάρυνση/όροφο + εξαίρεση ισογείου), θέρμανση→μέθοδος, αυτόματα χιλιοστά. ΟΧΙ εξαιρέσεις/κανονισμός, ΟΧΙ ιδιοκτήτες/ενοίκους (μένουν στα grids).
- **Per-unit capture = φυσική περιγραφή → επεξεργάσιμος πίνακας (A).** Το AI επεκτείνει· ο πίνακας δεξιά διορθώνεται με κλικ ή λεκτικά.
- **AI never writes.** Tool calls ενημερώνουν μόνο client state· `createBuildingFromOnboarding` είναι ο μόνος write path, re-validates με Zod.
- **Μηδέν νέα μαθηματικά χιλιοστών.** Reuse `distributeWeights` + `elevatorWeight`.

---

## 1. Agent tools (`lib/ai/agents/building-onboarding.ts`)

Δύο Zod tools (το `totalApartments` καταργείται — προκύπτει από το πλήθος units):

```ts
export const HEATING_TYPES = ["CENTRAL", "AUTONOMOUS_HOURS", "AUTONOMOUS_METERS", "GAS"] as const;
export const UNIT_TYPES = ["APARTMENT", "SHOP", "PARKING", "OTHER"] as const;

export const buildingInfoSchema = z.object({
  address: z.string().min(1).optional(),
  managerName: z.string().min(1).optional(),
  heatingType: z.enum([...HEATING_TYPES]).optional(),
  hasElevator: z.boolean().optional(),
  elevatorSurchargePerFloor: z.number().min(0).max(1).optional(), // fraction, default 0.10
  elevatorExemptGroundFloor: z.boolean().optional(),              // default true
});

export const unitSchema = z.object({
  unitNumber: z.string().min(1).optional(), // auto-numbered if absent
  floor: z.number().int().optional(),
  areaSqm: z.number().positive().optional(),
  unitType: z.enum([...UNIT_TYPES]).optional(), // default APARTMENT
});
export const setUnitsSchema = z.object({ units: z.array(unitSchema) });
```

Two tools registered under the same `agentKey: "building-onboarding"`:
- `updateBuildingOnboardingData` → `buildingInfoSchema` (building-level + elevator).
- `setUnits` → `setUnitsSchema` (replaces the current units list).

System prompt additions: expand ranges/patterns into units («1ος-3ος από δύο 80τμ» → 6 units), infer `unitType` (κατάστημα→SHOP, parking→PARKING), never invent `areaSqm` that wasn't stated (leave undefined), ask for elevator existence + (if yes) surcharge/ground-floor exemption, keep the existing guardrails (valid options, on-topic, no invented values, confirmation summary).

JSON Schema for both tools via `z.toJSONSchema`. The registry entry exposes both tools.

---

## 2. UI — building fields + editable units table + live millesimes

`OnboardingWizard.tsx` (right pane) becomes:
- **Building section:** Διαχειριστής, Διεύθυνση, Θέρμανση (→ derived method label), Ανελκυστήρας (ναι/όχι), και αν ναι: «επιβάρυνση/όροφο %» + «εξαίρεση ισογείου». All driven by `updateBuildingOnboardingData` tool calls, but also directly editable.
- **Units table (editable):** rows `{ unitNumber, floor, areaSqm, unitType }`. `setUnits` tool calls replace the array; the user can edit any cell, add/remove rows. Auto-number blank `unitNumber`s by position.
- **Live millesimes preview (client-side, pure libs):**
  - general/heating: `distributeWeights(units.map(u => ({ id, weight: areaSqm ?? 0 })))`.
  - elevator: `distributeWeights(units.map(u => ({ id, weight: elevatorWeight(areaSqm, floor, surcharge, exemptGround) })))` — only when `hasElevator`.
  - Column totals show ✓ at 1000. Units missing τ.μ. flash a warning and are excluded (millesime null), consistent with `distributeWeights`.
- **Create button** disabled until ≥1 unit with τ.μ. and the required building fields (address, managerName, heatingType) are present.

`onToolCall` dispatches by tool name: `updateBuildingOnboardingData` → merge building state; `setUnits` → replace units array.

---

## 3. Write action (`app/actions/building-onboarding.ts`)

`createBuildingFromOnboarding(customerId, payload)` is extended. The pure `buildOnboardingPayload` grows to:
- normalize units (auto-number, default `unitType: "APARTMENT"`),
- compute the 3 millesime sets from the units + elevator params using the pure libs (returns per-unit `{ millesimes, millesimesElevator, millesimesHeating }`),
- `meteredHeating` flag (AUTONOMOUS_METERS).

The action (super-admin, Zod-revalidated) in one `$transaction`:
1. Property → Building (`hasElevator`, `elevatorSurchargePerFloor`, `elevatorExemptGroundFloor`, `technicalNotes` manager).
2. `unit.create` per unit with `floor`, `areaSqm`, `unitType`, and the precomputed `millesimes`/`millesimesElevator`/`millesimesHeating` (sources stay AUTO). Set `unitsCount`.
3. Heating override METERED_70_30 when metered (existing `BuildingCategoryOverride` mechanism).
Returns `{ buildingId }`, redirect to the building detail (grids ready, χιλιοστά already filled).

Validation: reject if no unit has τ.μ. (can't compute χιλιοστά) or required building fields missing — clear Greek error.

---

## 4. Tests, errors, scope

- **Pure tests** (`building-onboarding-payload.ts`):
  - unit normalization: auto-numbering, default type, range not expanded here (AI does that — the payload receives concrete units).
  - millesime computation: general/heating sum to 1000; elevator excludes ground floor when exempt and sums to 1000; a unit without τ.μ. → millesime null, others still sum to 1000.
  - `meteredHeating` only for AUTONOMOUS_METERS.
- **Zod tests:** `setUnitsSchema` accepts an array of partial units; rejects negative area / non-integer floor.
- **Errors:** units without τ.μ. excluded with a UI warning; empty table → create disabled; AI-supplied bad values rejected server-side.
- **Out of scope:** exclusions/regulation overrides, owners/residents, per-radiator data, conversation persistence.

## 5. Reuse / non-duplication

- AI core (`runAgentStream`, `useAiChat`, registry, SSE) unchanged — only a second tool added to the existing agent definition.
- Millesime math reused from `lib/millesimes.ts` (`distributeWeights`, `elevatorWeight`) — no new formulas.
- The wizard page/route stays at `customers/[id]/onboarding`.
