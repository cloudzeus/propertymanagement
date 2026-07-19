# Occupant Full Building Info (read-only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Owners/residents see all building info read-only in the control center — installations with key-holders, unit directory, maintenance schedule, meters, managed items — no create/modify.

**Architecture:** Extend `lib/building/occupant-data.ts` with 5 read-only building-scoped queries; add matching read-only sections to `components/building/occupant-shell/` (rework the photo gallery into a full installations section). No new server actions; `viewLedger` gating untouched.

**Tech Stack:** Next.js 16 server components + client shell, Prisma 7, Orithon tokens, react-icons/ri, vitest.

**Spec:** `docs/superpowers/specs/2026-07-19-occupant-full-building-info-design.md`

Conventions: branch `main`; stage only touched files; trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Ignore pre-existing failures: vitest `lib/cms/landing-types.test.ts`; tsc `app/actions/auth.ts`, `lib/otp.ts`, `prisma.config.ts`, `prisma/seed.ts`, `app/api/super-admin/costs/*`, `components/forms/ForgotPasswordForm.tsx`.

Verified schema fields:
- `InfraPoint{ name, type(InfraType), floorLabel, location, locked, notes, keyHolder(legacy String), keyHolderUser→User{name}, access:InfraAccess[]→user:User{name}, media:InfraMedia[](type IMAGE){id,url,name} }`. `InfraType = ELECTRICITY|OTE|ROOF|ANTENNA|BOILER|PUMP|FIRE|WATER|OTHER`.
- `Unit{ unitNumber, unitType, floor, areaSqm, millesimes, owner→User{name}, resident→User{name} }`.
- `RecurringTask{ title, frequency(TaskFrequency), nextDueDate, vendor, active }`.
- `MaintenanceLog{ performedAt, notes, documentFile→BuildingFile{url}, recurringTask→{title} }` (do NOT select cost/performedBy — staff-internal).
- `MeterReading{ buildingId, meterType(MeterType), meterNumber, periodFrom, periodTo, previousReading, currentReading, consumption, unit, infraPoint→{name} }`.
- `ManagedItem{ itemType→ManagedItemType{name}, location, floorLabel, quantity, photoUrl }`.

---

### Task 1: occupant-data building-info queries

**Files:** Modify `lib/building/occupant-data.ts`.

- [ ] **Step 1:** In the main `Promise.all` (or a second batch), add these queries scoped to `buildingId`. Currently the loader fetches `infraPoint` media-only for the gallery — REPLACE that with the full infra select below (the gallery/installations section consumes it):

```ts
db.infraPoint.findMany({
  where: { buildingId }, orderBy: { createdAt: "asc" },
  select: {
    id: true, name: true, type: true, floorLabel: true, location: true, locked: true, notes: true,
    keyHolder: true,
    keyHolderUser: { select: { name: true } },
    access: { select: { user: { select: { name: true } } } },
    media: { where: { type: "IMAGE" }, orderBy: { createdAt: "asc" }, select: { id: true, url: true, name: true } },
  },
}),
db.unit.findMany({
  where: { buildingId }, orderBy: { unitNumber: "asc" },
  select: {
    id: true, unitNumber: true, unitType: true, floor: true, areaSqm: true, millesimes: true,
    owner: { select: { name: true } }, resident: { select: { name: true } },
  },
}),
db.recurringTask.findMany({
  where: { buildingId, active: true }, orderBy: { nextDueDate: "asc" },
  select: { id: true, title: true, frequency: true, nextDueDate: true, vendor: true },
}),
db.maintenanceLog.findMany({
  where: { buildingId }, orderBy: { performedAt: "desc" }, take: 50,
  select: { id: true, performedAt: true, notes: true, documentFile: { select: { url: true } }, recurringTask: { select: { title: true } } },
}),
db.meterReading.findMany({
  where: { buildingId }, orderBy: [{ periodTo: "desc" }, { createdAt: "desc" }], take: 60,
  select: { id: true, meterType: true, meterNumber: true, periodFrom: true, periodTo: true, previousReading: true, currentReading: true, consumption: true, unit: true, infraPoint: { select: { name: true } } },
}),
db.managedItem.findMany({
  where: { buildingId }, orderBy: [{ location: "asc" }, { createdAt: "asc" }],
  select: { id: true, location: true, floorLabel: true, quantity: true, photoUrl: true, itemType: { select: { name: true } } },
}),
```

- [ ] **Step 2:** Map to serializable shapes on the return object:
  - `infra`: `{ id, name, type, floorLabel, location, locked, notes, keyHolderName: p.keyHolderUser?.name ?? p.keyHolder ?? null, accessNames: p.access.map(a => a.user.name).filter(Boolean), media }`.
  - `units`: `{ id, unitNumber, unitType, floor, areaSqm, millesimes: Number|null, ownerName: u.owner?.name ?? null, residentName: u.resident?.name ?? null }`.
  - `tasks`: `{ id, title, frequency, nextDueDate: iso, vendor }`.
  - `maintenanceHistory`: `{ id, taskTitle: l.recurringTask.title, performedAt: iso, notes, certificateUrl: l.documentFile?.url ?? null }`.
  - `meterReadings`: Decimals→Number, dates iso, `infraName: r.infraPoint?.name ?? null`.
  - `managedItems`: `{ id, name: m.itemType.name, location, floorLabel, quantity, photoUrl }` (only include the array when `building.property.managed`; else `[]`).
  Keep existing `gallery` building-PHOTOS files (or fold into the installations section — see Task 2). Add all six to the returned object; `OccupantData` type updates automatically (return-type inferred).
- [ ] **Step 3:** `npx tsc --noEmit 2>&1 | grep occupant-data` → empty. Commit `feat(building): full building-info queries for occupant control center`.

---

### Task 2: Read-only sections in the occupant shell

**Files:** Create `components/building/occupant-shell/{UnitsSection,InstallationsSection,MaintenanceSection,MetersSection,ManagedItemsSection}.tsx`; modify `OccupantBuildingShell.tsx`; the current `GallerySection.tsx` is reworked into `InstallationsSection` (keep the lightbox; may import its `Lightbox` if separable, else move it).

Read `OccupantBuildingShell.tsx` (pill/URL-state idiom, existing GallerySection lightbox, StatusChip, Modal). All sections read-only, Orithon tokens, react-icons/ri Line, tabular-nums for numbers, cursor-pointer on interactive rows, actionable empty states.

- [ ] **Step 1: InstallationsSection** (`infra`) — card per infra point: type icon (map InfraType→Ri icon: ELECTRICITY→RiFlashlightLine, WATER→RiDropLine, BOILER→RiFireLine, PUMP→RiWaterFlashLine, FIRE→RiFireLine, ANTENNA/OTE→RiBroadcastLine, ROOF→RiHome8Line, else RiToolsLine) + Greek type label; meta: floor · location; `Κλειδωμένο` StatusChip when locked; **Κλειδιά: {keyHolderName ?? "—"}**; **Πρόσβαση: {accessNames.join(", ") || "—"}**; notes; photo thumbnails → lightbox (reuse the gallery lightbox). Below the cards: «Φωτογραφίες κτηρίου» from `gallery` building PHOTOS (same lightbox). Empty state when no infra + no photos.
- [ ] **Step 2: UnitsSection** (`units`) — table: Διαμέρισμα · Όροφος · Τ.μ. · Χιλιοστά · Ιδιοκτήτης · Ένοικος (names, «—» when null; `tabular-nums` on numeric cols). Highlight the viewer's own units (pass `myUnitIds` from the shell) with a subtle `background: color-mix(var(--color-primary) 6%)`. Empty state.
- [ ] **Step 3: MaintenanceSection** (`maintenance`) — two blocks: «Επερχόμενες συντηρήσεις» (tasks: title, frequency el label via a small map MONTHLY→Μηνιαία etc., next date el-GR, vendor) and «Ιστορικό» (maintenanceHistory: taskTitle, date el-GR, notes, «Πιστοποιητικό» link when certificateUrl). Empty states each.
- [ ] **Step 4: MetersSection** (`meters`) — table: Μετρητής (infraName ?? meterNumber ?? meterType) · Τύπος (MeterType el label) · Περίοδος (periodFrom–periodTo el-GR) · Προηγ. · Τρέχ. · Κατανάλωση (+unit). tabular-nums. Empty state.
- [ ] **Step 5: ManagedItemsSection** (`items`) — cards: name, location · floor, «Ποσότητα: N», photo thumbnail (→ lightbox or plain img). Only reachable when managed (pill hidden otherwise). Empty state.
- [ ] **Step 6: Shell wiring** — add pills in order Επισκόπηση · Κοινόχρηστα · Έξοδα · **Μονάδες** · **Εγκαταστάσεις** · **Συντηρήσεις** · **Μετρητές** · **Διαχ. στοιχεία**(managed only) · Συνελεύσεις · Έγγραφα · Επαφές · Ανακοινώσεις. Icons: RiHome3Line (units), RiToolsLine (infra? use RiSettings3Line), RiCalendarTodoLine (maintenance), RiSpeedUpLine (meters), RiListCheck2 (items). Route the `s` values to the new sections. Pass `myUnitIds` to UnitsSection. Add Overview quick links «Εγκαταστάσεις» and «Μονάδες». Remove the standalone old gallery pill (folded into Εγκαταστάσεις) OR keep «Χώροι & Φωτογραφίες» renamed to «Εγκαταστάσεις».
- [ ] **Step 7:** `npx tsc --noEmit 2>&1 | grep occupant-shell` → empty; `npm run build`. Commit `feat(building): read-only installations, units, maintenance, meters, managed-items sections`.

---

### Task 3: Verification + ship

- [ ] `npx vitest run` (only pre-existing failure); `npx tsc --noEmit`; `npm run build`.
- [ ] Live tsx check on Λυδία's building `cmqkheuaj0003qnd4863aygce`: `infra` present with `keyHolderName`/`accessNames`; `units` lists all flats with owner/resident names; `tasks`/`maintenanceHistory`/`meterReadings`/`managedItems` shapes non-erroring.
- [ ] Grep: `grep -rn "app/actions\|use server" components/building/occupant-shell` → none (still no mutation).
- [ ] Dev smoke: `/building/[id]?s=infra` & `?s=units` render; no 500s.
- [ ] Final review agent (isolation: names only, no other-unit financials, viewLedger intact; UX per ui-ux-pro-max basics); fix; update memory; push to GitHub main.
