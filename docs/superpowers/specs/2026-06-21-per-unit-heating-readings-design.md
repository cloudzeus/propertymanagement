# Spec: Per-unit ενδείξεις θέρμανσης (πλήρες METERED_70_30)

**Date:** 2026-06-21
**Status:** Approved (brainstorming)
**Σχετικά:** Ολοκληρώνει το `METERED_70_30` του [2026-06-21-millesimes-sets-elevator-exemptions-design.md](2026-06-21-millesimes-sets-elevator-exemptions-design.md). Σήμερα η μέθοδος κάνει fallback σε καθαρά χιλιοστά θέρμανσης γιατί δεν υπάρχουν per-unit μετρήσεις· αυτό το spec τις προσθέτει.

## Σκοπός

Να μπορεί ο διαχειριστής να καταχωρεί **ένδειξη κατανάλωσης θέρμανσης ανά μονάδα ανά μήνα**, ώστε οι δαπάνες θέρμανσης με μέθοδο `METERED_70_30` να κατανέμονται 70% βάσει πραγματικής κατανάλωσης + 30% βάσει χιλιοστών θέρμανσης (ΠΔ 27.9.1985), με διαφανή ανάλυση στην εκτύπωση.

## Αρχή σχεδίασης

Καμία αλλαγή στη μαθηματική λογική κατανομής: το `resolveWeights("METERED_70_30", units, meterReadings)` **ήδη** υλοποιεί το 70/30. Η μόνη αλλαγή είναι ότι ο allocation context **φορτώνει & περνά** ένα `Map<unitId, consumption>` αντί για `null`. Οι ενδείξεις είναι αγνωστικές ως προς τη μονάδα μέτρησης — μόνο η σχετική αναλογία μετράει· κρατάμε προαιρετική ετικέτα μονάδας για την εκτύπωση.

---

## 1. Μοντέλο δεδομένων

### 1.1 Νέος πίνακας `UnitHeatingReading`

```prisma
model UnitHeatingReading {
  id              String   @id @default(cuid())
  buildingId      String
  building        Building @relation(fields: [buildingId], references: [id], onDelete: Cascade)
  unitId          String
  unit            Unit     @relation(fields: [unitId], references: [id], onDelete: Cascade)
  period          String   // YYYY-MM (ίδιο κλειδί με τα κοινόχρηστα)
  previousReading Decimal? @db.Decimal(12,3)
  currentReading  Decimal? @db.Decimal(12,3)
  consumption     Decimal? @db.Decimal(12,3) // = current - previous (αποθηκευμένο)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@unique([unitId, period])
  @@index([buildingId, period])
}
```
Back-relations: `Unit.heatingReadings UnitHeatingReading[]`, `Building.heatingReadings UnitHeatingReading[]`.

Ξεχωριστός από το υπάρχον building-level `MeterReading` (που είναι OCR/expense-level) — διαφορετικός σκοπός, να μην μπερδεύονται.

### 1.2 `Building` — ετικέτα μονάδας μέτρησης

```prisma
heatingMeterUnit String? // π.χ. "μονάδες" | "ώρες" | "kWh" — μόνο για εμφάνιση
```

---

## 2. Καθαρή λογική κατανάλωσης (`lib/heating-readings.ts`)

```ts
export type ReadingRow = { unitId: string; previousReading: number | null; currentReading: number | null };
export type ConsumptionResult = { unitId: string; consumption: number | null; negative: boolean };

/** consumption = current - previous· null όταν λείπει ένδειξη· negative=true όταν
 *  current < previous (πιθανό σφάλμα/reset μετρητή — warning στο UI, consumption κρατιέται 0). */
export function computeConsumption(rows: ReadingRow[]): ConsumptionResult[];

/** Map<unitId, consumption> για το resolveWeights — μόνο μη-null, μη-negative τιμές. */
export function toConsumptionMap(rows: ReadingRow[]): Map<string, number>;
```
Καθαρές, δοκιμαζόμενες απομονωμένα. `negative` consumption → θεωρείται 0 στη Map (δεν μετράει αρνητικά).

---

## 3. Σύνδεση στην κατανομή

Στο `app/actions/building-expenses.ts`:
- `loadAllocContext(buildingId, categoryId, month)` → προσθήκη `month` παραμέτρου. Όταν η effective basis είναι `METERED_70_30`, φορτώνει `db.unitHeatingReading.findMany({ where: { buildingId, period: month } })` και χτίζει το consumption map (`toConsumptionMap`). Αλλιώς `null`.
- `buildAllocUnits(loaded, basis, meterReadings)` καλείται με το πραγματικό map (όχι `null`).
- Όλοι οι caller (`createBuildingExpense`, `updateBuildingExpense`, `previewExpenseAllocation`) περνούν το `month` (η δαπάνη/φόρμα το έχει ήδη).
- Το υπάρχον fallback (χωρίς ενδείξεις → καθαρά χιλιοστά θέρμανσης + έντιμη ετικέτα) παραμένει.

---

## 4. Server actions (`app/actions/heating-readings.ts`)

`requireSuperAdmin` + `assertUnitInBuilding` pattern (όπως [building-millesimes.ts]).

- `listHeatingReadings(buildingId, period)` → ενδείξεις περιόδου + auto «previousReading» από το `currentReading` του προηγούμενου μήνα (max period < αυτή) όταν δεν υπάρχει ήδη τιμή· εξαιρεί μονάδες με `UnitCategoryExclusion` σε κατηγορία θέρμανσης.
- `saveHeatingReading(buildingId, unitId, period, currentReading)` → upsert· υπολογίζει `previousReading` (από προηγ. μήνα) & `consumption`· γράφει.
- `bulkSaveHeatingReadings(buildingId, period, items[])` → πολλαπλά σε μία transaction.
- `saveHeatingMeterUnit(buildingId, label)` → γράφει το `Building.heatingMeterUnit` (ετικέτα μονάδας μέτρησης).

---

## 5. UI — πάνελ «Ενδείξεις θέρμανσης»

Client component `HeatingReadingsPanel.tsx`, τοποθετημένο στη ροή κοινοχρήστων του μήνα. **Εμφανίζεται μόνο** αν το κτήριο έχει ≥1 κατηγορία με `defaultBasis`/override = `METERED_70_30` (αλλιώς κρυφό).

- Header: επιλογή περιόδου (YYYY-MM) + ετικέτα μονάδας μέτρησης (`heatingMeterUnit`, editable → `saveHeatingMeterUnit`).
- Πίνακας ανά μονάδα (εξαιρώντας τις εξαιρεμένες από θέρμανση): Μονάδα | Προηγ. ένδειξη (read-only, auto) | Τρέχουσα ένδειξη (input) | Κατανάλωση (auto = τρέχ.−προηγ.) | Μερίδιο 70% (live %).
- Auto «προηγούμενη» από προηγ. μήνα· auto κατανάλωση με **warning** σε αρνητικό/κενό· live προεπισκόπηση αναλογίας.
- Save ανά κελί (on blur) ή «Αποθήκευση όλων» → `bulkSaveHeatingReadings` → `router.refresh()`.

---

## 6. Εκτύπωση — μέγιστη, εύκολη ανάγνωση

Επέκταση του `breakdownNote` ώστε για `METERED_70_30` (με ενδείξεις) να περιλαμβάνει την κατανάλωση + μονάδα + αναλογία. Παράδειγμα γραμμής:

> **Θέρμανση (πετρέλαιο) — 72,40 €**
> Συνολική δαπάνη 500,00 € · Μέθοδος: 70% κατανάλωση + 30% χιλιοστά
> Κατανάλωσή σας: 78 μονάδες από 280 (27,9%) · Χιλιοστά θέρμανσης: 160,00‰

Γενική αρχή για όλες τις χρεώσεις: καθαρή ιεραρχία — τίτλος+ποσό έντονα, μικρή γκρι επεξήγηση, σαφές «Μερίδιό σας», ευδιάκριτο «Σύνολο μήνα». Το consumption note παράγεται στο `buildAllocUnits` (όπου υπάρχει ήδη το `meterReadings` map) και αποθηκεύεται per-allocation στο `breakdownNote`.

Σημείωση: το `breakdownNote` είναι **per-expense** (ίδιο για όλες τις μονάδες μιας δαπάνης), οπότε περιλαμβάνει τη μέθοδο + σύνολο κατανάλωσης· τα per-unit νούμερα (η ένδειξη της κάθε μονάδας) μπαίνουν στη γραμμή από τα δεδομένα της κάθε allocation αν χρειαστεί. Για το πρώτο release αρκεί το per-expense note (μέθοδος + συνολική κατανάλωση + μονάδα)· τα per-unit consumption νούμερα είναι nice-to-have.

---

## 7. Δοκιμές

- `lib/heating-readings.ts`: `computeConsumption` (κανονικό, κενό, αρνητικό→negative flag), `toConsumptionMap` (παραλείπει null/negative).
- Integration-level (μέσω `resolveWeights`): METERED με consumption map → σωστή 70/30 κατανομή· χωρίς map → fallback θέρμανσης.
- `listHeatingReadings`: auto previous από προηγ. μήνα· εξαίρεση μονάδων εκτός θέρμανσης.

## 8. Εκτός scope

- Import ενδείξεων από CSV/αρχείο.
- Αυτόματη ανάγνωση μετρητών (IoT/API).
- Per-σώμα (radiator-level) ανάλυση — μόνο per-μονάδα.
- Per-unit consumption νούμερα στη γραμμή εκτύπωσης (nice-to-have, βλ. §6).
