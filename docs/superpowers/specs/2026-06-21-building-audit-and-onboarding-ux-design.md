# Spec: Building entry audit + Onboarding chat redesign (floating widget, UX, geocode map)

**Date:** 2026-06-21
**Status:** Approved (brainstorming)

Two independent features, designed together:
- **A — Building entry audit:** a button on the building dashboard that runs a deterministic, rule-based check of the building's data and shows what's missing/wrong with clear, plain-language findings + a link to the fix.
- **B — Onboarding chat redesign:** the onboarding page becomes a full-width form/units table with the AI agent as a collapsible bottom-right chat widget; the conversation gets 5 UX polish items; and when an address is entered, a mini map + resolved city/postal-code confirm the location.

Reuses existing infra: `useAiChat`/AI core, `lib/millesimes.ts`, `/api/geocode` (`geocodeAddress` → `{lat,lng,city,postalCode}`), `components/maps/PropertyMap.tsx` (maplibre-gl), the existing building dashboard tabs.

---

## PART A — Building entry audit

### A.1 Pure audit (`lib/buildings/audit.ts`)

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

export function auditBuilding(input: AuditInput): Finding[];
```

Rules (each emits a `Finding` when it fires):
- **error** — any unit with `areaSqm == null` or `floor == null`; any unit with `areaSqm < 0`; duplicate `unitNumber`; building with 0 units; general millesimes sum (of non-null) not within 0.5 of 1000; elevator millesimes sum ≠ 1000 when `hasElevator`; heating millesimes sum ≠ 1000 when any unit has a non-null `millesimesHeating`.
- **warning** — unit with no owner AND no resident (occupancy or direct); `hasElevator` true but every `millesimesElevator` is 0/null; a metered heating category exists but `readingsForLatestPeriod === 0`; an exclusion where `excludedUnitCount === totalUnits` (zeroes the whole expense); missing building `address` or `name`; customer `vat` is null.
- **info** — count of units with `millesimesSource === "MANUAL"` (regulation overrides) — informational only.

Messages are plain-language with concrete numbers, e.g. `title: "Γενικά χιλιοστά = 980 (όχι 1000)"`, `detail: "Λείπουν 20‰. Συμπληρώστε τ.μ. ή πατήστε «Επανυπολογισμός»."`, `tab: "millesimes"`. Tested per-rule.

### A.2 Server action (`app/actions/building-audit.ts`)

```ts
export async function auditBuildingEntries(buildingId: string): Promise<Finding[]>;
```
`requireSuperAdmin`-style auth (match the building actions). Loads the building + units (with owner/resident + occupancies) + customer VAT + heating category/readings + exclusion counts, maps to `AuditInput`, returns `auditBuilding(input)`. Read-only — no writes.

### A.3 UI (drawer in the building dashboard)

- A button «🩺 Έλεγχος καταχωρήσεων» in the dashboard header area (`BuildingDashboard.tsx`).
- Opens a right-side drawer (`AuditDrawer.tsx`, client): on open calls `auditBuildingEntries(building.id)`.
- Header shows severity counters (`N σφάλματα · M προειδοποιήσεις · K προτάσεις`). Findings grouped by severity, each row: icon + title + detail + a «→ <tab>» link that switches the dashboard tab (reuse the existing `TabKey` switch). «Επανέλεγχος» button re-runs.
- Clear, understandable copy; no jargon. Empty state: «✓ Όλα εντάξει — καμία ένδειξη προβλήματος».

---

## PART B — Onboarding chat redesign

### B.1 Layout

`/super-admin/onboarding` and the per-customer onboarding page render the form + units table at **full width** (the current right pane becomes the page body). The AI chat moves into a **floating bottom-right widget** that collapses to a 🤖 bubble.

New reusable component `components/ai/AiChatWidget.tsx` (`"use client"`):
```ts
type AiChatWidgetProps = {
  agentKey: string;
  onToolCall: (name: string, args: unknown) => void;
  title?: string;            // default "Βοηθός AI"
  greeting?: string;
  quickReplies?: string[];   // optional chips
};
```
Internally uses `useAiChat`. Renders the bubble/expanded states, message bubbles, input. `OnboardingWizard` stops rendering its own left chat column and instead renders `<AiChatWidget … />` + the form/table body.

### B.2 Five conversation UX items (inside `AiChatWidget`)

1. **Typing indicator** — when `isStreaming` is true and the latest assistant message is still empty, show animated `● ● ●`.
2. **Applied badges** — the widget tracks the last `onToolCall` and shows small green «✓ …» chips summarizing what changed (e.g. «✓ Διεύθυνση», «✓ 8 μονάδες», «✓ Θέρμανση»). Derived from the tool name + args keys.
3. **Quick-reply chips** — render `quickReplies` as clickable chips that set the input and send. Onboarding passes a few (e.g. «Έχει ασανσέρ», «Κεντρική θέρμανση»).
4. **Error + retry** — on `error` from `useAiChat`, show the message with a «Ξανά» button that re-sends the last user message. (Add a `retry()` to `useAiChat` that re-runs the last send.)
5. **Auto-scroll** — scroll to the newest message on update; if the user has scrolled up, show a «↓ νέο μήνυμα» pill instead of yanking them down.

### B.3 Address geocode mini-map

In the onboarding page body (next to the address field), a small confirmation block:
- When `info.address` changes (debounced ~600ms, min length), call `GET /api/geocode?address=<addr>` → take the first result.
- Show a small maplibre map (reuse/wrap `components/maps/PropertyMap.tsx`) centered on `{lat,lng}` with a pin, plus text «<περιοχή/πόλη> · ΤΚ <postalCode>».
- Store the resolved `city`, `postalCode`, `lat`, `lng` in component state and pass them through `createBuildingFromOnboarding` so the Property/Building rows get them (fields already exist: `city`, `postalCode`, `lat`, `lng`). Extend the building-info payload/action to accept optional `city/postalCode/lat/lng`.
- No result / error → hide the map silently; never blocks creation. Map lazy-loads only when there's an address.

### B.4 Data flow / errors / testing

- Audit: server action → pure `auditBuilding` → drawer. Pure unit tests per rule (error/warning/info + edge cases: duplicate numbers, negative area, sums off by <0.5 pass).
- Widget: `useAiChat` unchanged except an added `retry()`. UX items are presentational. No new tests required beyond a small `retry()` behavior note (manual).
- Geocode: reuses tested `/api/geocode`; debounced; resolved fields optional in the action (Zod `.optional()`), so missing geocode still creates the building.

### B.5 Scope / non-goals

- Audit only **detects + links**; it does not auto-fix.
- No AI-phrased audit explanations (future).
- The map is confirmation-only; no manual pin-drag in the wizard (the existing `PropertyMapPicker` covers editing elsewhere).
- `useAiChat` core stays domain-agnostic; the widget and onboarding hold all domain specifics.

### B.6 Reuse summary

`useAiChat`, `/api/geocode` + `lib/geocoding.ts`, `components/maps/PropertyMap.tsx`, `lib/millesimes.ts`, existing dashboard `TabKey` switching, existing onboarding payload/action (extended with optional geo fields).
