# Occupant Full Building Info (read-only) — Design

**Date:** 2026-07-19 · **Status:** Approved by user

## Goal

Owners and residents must see **all** building information read-only — where the common areas /
installations are, **who holds keys**, the unit directory, maintenance schedule, meter readings,
and managed items — but never create or modify anything. Extends the occupant control center
(`/building/[id]`, viewer `occupant`).

## Decisions (user-approved)

1. **Εγκαταστάσεις & Κοινόχρηστοι χώροι**: full infra info incl. **key-holder and access NAMES**
   (names only — no emails/phones; those stay in the official Επαφές section).
2. Add read-only sections: **Μονάδες** (directory), **Συντηρήσεις/Ημερολόγιο**, **Μετρητές**,
   **Διαχειριζόμενα στοιχεία** (managed buildings only).

## Architecture

### 1. Data — `lib/building/occupant-data.ts`

Add to `getOccupantControlCenter` (all read-only, building-scoped, Decimals→Number, dates ISO):

- **`infra`**: `db.infraPoint.findMany({ where: { buildingId } })` → `{ id, name, type, floorLabel,
  location, locked, notes, keyHolderName (keyHolderUser.name ?? keyHolder legacy ?? null),
  accessNames (access[].user.name), media (IMAGE only: id,url,name) }`. Replaces the photo-only
  data the current gallery uses.
- **`units`**: `db.unit.findMany({ where: { buildingId }, orderBy: unitNumber })` →
  `{ id, unitNumber, unitType, floor, areaSqm, millesimes, ownerName, residentName }` (names only;
  no email/phone/financial). This is a building directory.
- **`tasks`**: `db.recurringTask.findMany({ where: { buildingId, active: true }, orderBy:
  nextDueDate })` → `{ id, title, frequency, nextDueDate, vendor }`; **`maintenanceHistory`**:
  completed `db.maintenanceLog` for the building → `{ id, title, performedAt, notes, certificateUrl }`
  (no cost / no staff-internal identity beyond the performer label already shown to residents).
- **`meterReadings`**: `db.meterReading.findMany({ where: { infraPoint: { buildingId } } })` (or the
  model's building link — verify) → `{ id, meterType, reading, period, consumption, unit,
  infraName }`, latest first.
- **`managedItems`** (only when `building.managed`): `db.managedItem.findMany({ where: {
  buildingId } })` → `{ id, name/itemTypeName, location, floorLabel, quantity, photoUrl }`.

Type-check exact model/relation/field names against `prisma/schema.prisma` at implementation
(InfraPoint verified: keyHolderUser, access→user, media type IMAGE; MeterReading link + RecurringTask
frequency/nextDueDate; ManagedItem shape). Reuse the manager `dashboard-data.ts` selects as the
reference but strip mutation-only and sensitive fields.

### 2. Shell — `components/building/occupant-shell/`

Add pills (wrapping, `?s=`), read-only, matching the existing occupant-shell idiom (Orithon
tokens, react-icons/ri Line, cursor-pointer, tabular-nums, actionable empty states):

- **Μονάδες** (`units`) — new `UnitsSection`: table/cards — Διαμέρισμα · Όροφος · Τ.μ. · Χιλιοστά ·
  Ιδιοκτήτης · Ένοικος. The viewer's own units subtly highlighted.
- **Εγκαταστάσεις** (`infra`) — rework `GallerySection` into `InstallationsSection`: card per infra
  point (icon by type, Greek type label, floor/location, `Κλειδωμένο` badge, **Κλειδιά: {name}**,
  **Πρόσβαση: {names}**, notes) with its photo thumbnails → existing lightbox. Building PHOTOS
  files appended below as «Φωτογραφίες κτηρίου».
- **Συντηρήσεις** (`maintenance`) — new `MaintenanceSection`: Επερχόμενες (title, frequency el
  label, next date, vendor) + Ιστορικό (title, date, notes, «Πιστοποιητικό» link when present).
- **Μετρητές** (`meters`) — new `MetersSection`: table — Μετρητής · Τύπος · Περίοδος · Ένδειξη ·
  Κατανάλωση.
- **Διαχειριζόμενα στοιχεία** (`items`, managed only) — new `ManagedItemsSection`: cards — name,
  location/floor, ποσότητα, photo.

Pill order: Επισκόπηση · Κοινόχρηστα · Έξοδα · Μονάδες · Εγκαταστάσεις · Συντηρήσεις · Μετρητές ·
Διαχ. στοιχεία(managed) · Συνελεύσεις · Έγγραφα · Επαφές · Ανακοινώσεις. Overview gains quick
links to Εγκαταστάσεις and Μονάδες.

### 3. Isolation & safety

Read-only: zero server-action imports in the shell (unchanged); `viewLedger` gating on
manager-grade financial/person actions stays intact. Names shown are building-directory / key-holder
facts the user explicitly wants; **no other person's email, phone, or per-unit financial data** is
exposed (those remain behind `viewLedger`). No cross-building data (all queries buildingId-scoped).

## Testing / verification

`tsc`/`build`; live tsx check on Λυδία's building — infra with key-holder names present, units
directory lists all flats, sections render; grep confirms no server-action import; final review +
push.
