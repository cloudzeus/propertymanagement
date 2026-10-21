# Spec: Σταθμός βάσης, οδική απόσταση και χρεώσεις ανά ζώνη

**Date:** 2026-10-21
**Status:** Approved (brainstorming)
**Builds on:** geocoding (`lib/geocoding.ts`, `app/actions/property-geodata.ts`, `lib/suppliers.ts#geocodeSupplierAddress`), haversine στο `lib/supplier-ranking.ts`, κατάλογος υπηρεσιών (`app/actions/services.ts`, `lib/billing/service-amount.ts`), RFQ → προσφορά → σύμβαση έργου (`app/actions/rfq.ts`, `lib/rfq-shared.ts`, `lib/contracts.ts`), Ρυθμίσεις hub (`app/(company)/super-admin/settings`, `AppSettings`), cron-in-code (`lib/cron/jobs.ts`), per-page wiki (`lib/help/*`, `docs/wiki/pages`).

## Σκοπός

Λόγια του χρήστη: «ορισμένες υπηρεσίες και χρεώσεις θα έχουν να κάνουν με την χιλιομετρική απόσταση από τον σταθμό βάσης και θα πρέπει να έχουμε τον υπολογισμό απόστασης με κάποιο free geodata api που να μπορεί να υπολογίζει απόσταση από την βάση που θα έχουμε ορίσει στις ρυθμίσεις».

1. **Σταθμός βάσης** = η έδρα της εταιρείας διαχείρισης, με δική της κάρτα στις Ρυθμίσεις.
2. **Οδική απόσταση** κάθε κτιρίου από τη βάση, από δωρεάν routing API, αποθηκευμένη στο κτίριο και επανυπολογιζόμενη μόνο όταν αλλάζει κάτι.
3. **Ενιαίες ζώνες απόστασης** (Α–Δ) ορισμένες στις Ρυθμίσεις, που τροφοδοτούν τρεις χρεώσεις: υπηρεσίες πακέτου ανά ζώνη, μετάβαση τεχνικού στη σύμβαση έργου, προσαύξηση αυτοψίας συνεργάτη.

## Αποφάσεις (locked με τον χρήστη)

| Θέμα | Απόφαση |
|---|---|
| Σταθμός βάσης | Μία βάση = `Company.lat/lng` της διαχειρίστριας εταιρείας (πρώτη `Company`). Καμία νέα οντότητα. Χωρίς συντεταγμένες → καμία απόσταση, καμία χρέωση απόστασης, προειδοποίηση. |
| Απόσταση | Οδική (driving) από δωρεάν API, με εφεδρεία ευθεία × 1,3 σημασμένη «κατ' εκτίμηση». Κρατάμε km **και** λεπτά οδήγησης. |
| Μοντέλο τιμής | Ένας πίνακας ζωνών στις Ρυθμίσεις (προεπιλογή Α 0–10, Β 10–30, Γ 30–60, Δ 60+ km). Όχι €/km. |
| Υπηρεσίες πακέτου | Νέο μοντέλο `PER_ZONE`: βασική τιμή + ποσό ζώνης **ανά κτίριο του ακινήτου, άθροισμα**. |
| Μετάβαση τεχνικού | Γραμμή `travelFee` στη σύμβαση έργου (`WorkOrder`), προσυμπληρωμένη από τη ζώνη του κτιρίου, επεξεργάσιμη, μηδέν σε καλυπτόμενες βλάβες. |
| Αυτοψία συνεργάτη | Ο συνεργάτης ορίζει προσαύξηση ανά ζώνη (`surveyZoneFees`), μετρημένη από τη **δική του** έδρα ως το κτίριο, με τις ίδιες ζώνες. Η προσφορά προσυμπληρώνει αυτοψία = βασική + ζώνη. |
| Παραγωγή | Το τοπικό DATABASE_URL είναι η παραγωγή: η migration εφαρμόζεται μόνο με ρητή εντολή του χρήστη· καμία test εγγραφή. |

## Εκτός σκοπού

Πολλαπλές βάσεις, χρέωση €/km, μετάβαση σε καλυπτόμενες βλάβες, χάρτης διαδρομής, αλλαγή κατάταξης συνεργατών (μένει haversine), SoftOne, πελατοκεντρικά τιμολόγια πέραν του υπάρχοντος `ServiceInvoiceLine`.

---

## 1. Υπολογισμός απόστασης — `lib/distance/*`

Μικρές μονάδες, η καθεμία με μία ευθύνη.

### 1.1 `lib/distance/zones.ts` (pure, client-safe)

```ts
export type DistanceZone = { code: string; label: string; maxKm: number | null; travelFee: number };
export const DEFAULT_ZONES: DistanceZone[] = [
  { code: "A", label: "Ζώνη Α", maxKm: 10, travelFee: 0 },
  { code: "B", label: "Ζώνη Β", maxKm: 30, travelFee: 15 },
  { code: "C", label: "Ζώνη Γ", maxKm: 60, travelFee: 35 },
  { code: "D", label: "Ζώνη Δ", maxKm: null, travelFee: 60 },
];
export function parseZones(json: unknown): DistanceZone[];      // άκυρο/κενό → DEFAULT_ZONES
export function validateZones(z: DistanceZone[]): string | null; // μοναδικοί κωδικοί, αύξοντα maxKm, τελευταία ανοιχτή, ποσά ≥ 0
export function zoneForKm(zones: DistanceZone[], km: number | null): DistanceZone | null; // null km → null
export function zoneFee(zones: DistanceZone[], code: string | null): number; // άγνωστος κωδικός → 0
export function formatDistance(km: number | null, minutes: number | null, method: DistanceMethod | null): string; // «23 km · περ. 35′», «≈ 23 km (εκτίμηση)», «—»
```

Κανόνας ζώνης: `km ≤ maxKm` της πρώτης ζώνης που ταιριάζει (0–10 → Α, 10,1 → Β). Η τελευταία ζώνη έχει `maxKm = null`.

### 1.2 `lib/distance/router.ts` (server-only)

```ts
export type DistanceMethod = "ROAD" | "ESTIMATE";
export type RouteResult = { km: number; minutes: number; method: DistanceMethod; provider: "osrm" | "ors" | "haversine" };
export async function routeDistance(from: LatLng, to: LatLng, deps?): Promise<RouteResult>;
```

- Πάροχος 1: **OpenRouteService** όταν υπάρχει `ORS_API_KEY` (`POST https://api.openrouteservice.org/v2/directions/driving-car`, header `Authorization`). Δωρεάν tier 2 000 κλήσεις/ημέρα.
- Πάροχος 2 (προεπιλογή χωρίς κλειδί): **δημόσιος OSRM** `GET https://router.project-osrm.org/route/v1/driving/{lng},{lat};{lng},{lat}?overview=false` → `routes[0].distance` (m), `duration` (s). Header `User-Agent: Orithon-PropertyManagement/1.0 (+site url)`.
- Timeout 8 s (`AbortController`), `cache: "no-store"`. Κάθε αποτυχία (δίκτυο, μη-200, `code !== "Ok"`, κενές διαδρομές) → εφεδρεία `haversineKm × 1.3`, `minutes = km / 50 × 60`, `method: "ESTIMATE"`, `provider: "haversine"`.
- Στρογγύλεμα: km 1 δεκαδικό, λεπτά ακέραιος.
- Η συνάρτηση δέχεται `deps` (`fetch`, `env`) για τα tests· καμία κλήση από τον browser.

### 1.3 `lib/distance/cache.ts` (server-only)

Νέος πίνακας `DistanceCache`: ένα ζεύγος συντεταγμένων → ένα αποτέλεσμα, ώστε κάθε ζεύγος να ζητηθεί **μία φορά** από το API.

```ts
export function cacheKey(p: LatLng): { lat4: number; lng4: number }; // Math.round(x * 10_000) — ακέραιοι, όχι float equality
export async function cachedDistance(from: LatLng, to: LatLng, opts?: { force?: boolean }): Promise<RouteResult>;
```

- Hit → επιστρέφει από τη βάση χωρίς κλήση. Miss ή `force` → `routeDistance` και `upsert`.
- Εκτιμήσεις (`ESTIMATE`) αποθηκεύονται **μόνο** για 24 ώρες (`expiresAt`), ώστε να ξαναδοκιμαστεί το API· οι `ROAD` δεν λήγουν.
- Ρυθμός: module-level ουρά 1 κλήση/δευτερόλεπτο προς τους παρόχους (`lib/distance/throttle.ts`, pure, με injectable clock για τα tests). Τα cache hits δεν περνούν από την ουρά.

### 1.4 `lib/distance/base.ts` (server-only)

```ts
export async function getBaseStation(): Promise<{ lat: number; lng: number; address: string; key: string } | null>;
```
Πρώτη `Company` κατά `createdAt`. `key = "{lat4},{lng4}"` — η «έκδοση» της βάσης που αποθηκεύεται στα κτίρια, ώστε αλλαγή έδρας να ακυρώνει τις αποστάσεις αυτόματα.

### 1.5 `lib/distance/buildings.ts` (server-only)

```ts
export async function recomputeBuildingDistance(buildingId: string, opts?: { force?: boolean }): Promise<BuildingDistance | null>;
export async function recomputeStaleBuildings(opts?: { limit?: number; force?: boolean }): Promise<{ scanned: number; updated: number; estimated: number; skipped: number }>;
export function buildingZone(zones, b: { distanceKm: number | null }): DistanceZone | null;
```

- `recomputeBuildingDistance`: χωρίς βάση ή χωρίς `lat/lng` κτιρίου → καθαρίζει τα πεδία (`null`) και επιστρέφει `null`. Αλλιώς `cachedDistance(base, building)` → γράφει `distanceKm/distanceMinutes/distanceMethod/distanceAt/distanceBaseKey`.
- «Stale» = `distanceAt null` **ή** `distanceBaseKey ≠ τρέχον key` **ή** `distanceMethod = ESTIMATE` (ξαναδοκιμάζεται). `limit` προεπιλογή 300 ανά εκτέλεση (≈ 5′ με 1 κλήση/δευτ. στη χειρότερη περίπτωση).
- Καλείται: (α) μετά από κάθε εγγραφή κτιρίου που αλλάζει `lat/lng` (`createBuilding`, `updateBuilding`, `createBuildingFromOnboarding`, `createProperty` για το default κτίριο, και τα `geocodeProperty`/`updatePropertyGeodata` του `property-geodata.ts`, που παρά το όνομά τους γράφουν `Building.lat/lng`) — `await` με `try/catch`, ποτέ δεν αποτυγχάνει την εγγραφή· (β) από το cron job· (γ) από το κουμπί «Επανυπολογισμός όλων».

### 1.6 `lib/distance/suppliers.ts` (server-only)

```ts
export async function supplierToBuilding(supplierId: string, buildingId: string): Promise<(RouteResult & { zone: DistanceZone | null }) | null>;
```
`cachedDistance(supplier, building)` + ζώνη με τον κοινό πίνακα. Δεν αποθηκεύεται στον `Supplier` (το ζεύγος ζει στο `DistanceCache`).

### 1.7 Cron job `base-distances`

Στο `CRON_JOBS`: `{ key: "base-distances", label: "Αποστάσεις από τη βάση", schedule: daily 03:00, run: recomputeStaleBuildings }`. Εμφανίζεται στο `/super-admin/settings/cron` όπως τα υπόλοιπα.

---

## 2. Δεδομένα (Prisma, migration `20261021120000_base_station_distance_zones`)

Όλα προσθετικά. Καμία αλλαγή σε υπάρχοντα πεδία.

| Μοντέλο | Πεδία |
|---|---|
| `AppSettings` | `distanceZones Json?` — `DistanceZone[]`, `null` = προεπιλογές |
| `enum ServicePricingModel` | `+ PER_ZONE` |
| `Service` | `zonePrices Json?` — `Record<zoneCode, number>` (€/μήνα ανά κτίριο στη ζώνη) |
| `Building` | `distanceKm Float?`, `distanceMinutes Int?`, `distanceMethod String?` («ROAD»/«ESTIMATE»), `distanceAt DateTime?`, `distanceBaseKey String?` |
| `Supplier` | `surveyZoneFees Json?` — `Record<zoneCode, number>` |
| `WorkOrder` | `travelFee Decimal(10,2)?`, `travelZone String?`, `travelKm Float?` |
| νέο `DistanceCache` | `id`, `fromLat4 Int`, `fromLng4 Int`, `toLat4 Int`, `toLng4 Int`, `km Float`, `minutes Int`, `method String`, `provider String`, `expiresAt DateTime?`, `createdAt`, `updatedAt`; `@@unique([fromLat4, fromLng4, toLat4, toLng4])` |

Το SQL γράφεται με `npx prisma migrate diff --from-config-datasource prisma.config.ts --to-schema prisma/schema.prisma --script`, ελέγχεται με το χέρι (μόνο οι παραπάνω αλλαγές), και εφαρμόζεται με `npx prisma migrate deploy` **μόνο από τον χρήστη**. Enum: `ALTER TYPE "ServicePricingModel" ADD VALUE 'PER_ZONE'`.

RBAC: νέο module `settings-distance` («Σταθμός βάσης & ζώνες», `/super-admin/settings/distance`, icon `RiRoadMapLine`, group `settings`, CRUD) — **μόνο προσθετικές γραμμές** στο `lib/rbac/registry.ts`, default σε SUPER_ADMIN + ADMIN, backfill με `prisma/seed-rbac.ts` (τρέχει ο χρήστης μαζί με τη migration).

---

## 3. Ρυθμίσεις → «Σταθμός βάσης & ζώνες απόστασης»

Σελίδα `app/(company)/super-admin/settings/distance/page.tsx` (server, `requirePermission("settings-distance","view")`) + client `components/settings/DistanceSettings.tsx`. Κάρτα στο hub (ομάδα «Λειτουργία»).

1. **Κάρτα βάσης**: διεύθυνση της εταιρείας, συντεταγμένες, μικρός χάρτης (`PropertyMap`), κουμπί «Geocode από τη διεύθυνση» (υπάρχον `geocodeCompanyAddress`) και σύνδεσμος «Αλλαγή διεύθυνσης» → `/super-admin/settings/company`. Χωρίς συντεταγμένες: προειδοποίηση «Δεν έχει οριστεί σταθμός βάσης — οι αποστάσεις και οι χρεώσεις ζώνης δεν υπολογίζονται».
2. **Πίνακας ζωνών**: γραμμές με κωδικό (μη επεξεργάσιμος), όνομα, «έως km» (η τελευταία «και άνω»), «Χρέωση μετάβασης (€ καθ.)». Προσθήκη/αφαίρεση ζώνης (ελάχιστο 1, μέγιστο 8). Αποθήκευση → `saveDistanceZones` (`settings-distance:edit`, `validateZones`). Αλλαγή ζωνών **δεν** ξαναμετρά αποστάσεις (οι ζώνες προκύπτουν από τα km στο read).
3. **Κατάσταση**: μετρητές «κτίρια ανά ζώνη», «χωρίς απόσταση», «κατ' εκτίμηση», τελευταίος υπολογισμός, κουμπί «Επανυπολογισμός όλων» → `runCronJobNow("base-distances")` (υπάρχον action) με `force` για τα παλιά.

Actions: `app/actions/distance-settings.ts` — `saveDistanceZones(zones)`, `recomputeAllDistances()`; `app/actions/suppliers.ts` + `supplier-profile` — αποδοχή `surveyZoneFees`.

---

## 4. Υπηρεσίες πακέτου `PER_ZONE`

- `ServicesClient`: νέα επιλογή «Ανά ζώνη απόστασης / μήνα». Όταν επιλεγεί, εμφανίζεται πίνακας «Ποσό ανά ζώνη (€/κτίριο/μήνα)» με μία γραμμή ανά ζώνη των Ρυθμίσεων· το πεδίο «Τιμή» γίνεται «Βασική τιμή (€/μήνα)». `createService/updateService` δέχονται `zonePrices`.
- `lib/billing/service-amount.ts`:
  - `PropertyCounts` += `buildingZones: (string | null)[]` (ένας κωδικός ανά κτίριο, `null` = χωρίς απόσταση).
  - `BillableService` += `zonePrices?: Record<string, number> | null`.
  - `PER_ZONE`: `amount = price + Σ_buildings zonePrices[zone] (null zone → 0)`, `qty = buildings`.
  - `PackageLine` += `detail?: string` π.χ. «Ζώνη Β ×2, Ζώνη Γ ×1, χωρίς ζώνη ×1».
  - `getPropertyPackage` φορτώνει `distanceKm` κτιρίων + ζώνες από `AppSettings`.
- `PropertyPackages.tsx`: δείχνει το `detail` κάτω από τη γραμμή. `ServiceInvoiceLine.description` = «{name} — {detail}».

---

## 5. Μετάβαση τεχνικού στη σύμβαση έργου

- `forwardOffer(offerId, input)`: `ForwardInput += travelFee?: number | null`. Server: υπολογίζει ζώνη/km του κτιρίου (`buildingZone`), `defaultTravel = covered ? 0 : zoneFee`. `travelFee = covered ? 0 : (input.travelFee ?? defaultTravel)`, clamp ≥ 0. `customerPrice = input.customerPrice ?? applyMarkup(supplierPrice, markup) + travelFee`. Αποθηκεύει `travelFee/travelZone/travelKm`. `markupPct` παραμένει το περιθώριο επί της τιμής συνεργάτη.
- `rfq-panel.tsx` `OfferRow`: γραμμή «Μετάβαση: Ζώνη Β · 23 km» με αριθμητικό πεδίο προσυμπληρωμένο· η τιμή πελάτη ξαναϋπολογίζεται = περιθώριο + μετάβαση (ο χρήστης μπορεί να την αλλάξει χειροκίνητα όπως σήμερα). Τα δεδομένα ζώνης/km έρχονται από τη σελίδα (server) στο `RfqPanel` props.
- `WorkOrderDTO += travelFee: number | null; travelZone: string | null; travelKm: number | null` (ορατό και στον πελάτη — είναι δική του χρέωση). Το `Kv «Τιμή πελάτη»` στο panel και η κάρτα προσφοράς του πελάτη (`/portal/maintenance/[id]`) δείχνουν «εκ των οποίων μετάβαση 15,00 € (Ζώνη Β)».
- `lib/contracts.ts`: placeholder `{{travel_clause}}` → «Στο τίμημα περιλαμβάνεται χρέωση μετάβασης **15,00 €** (Ζώνη Β, 23 km).» ή κενό. Προστίθεται στο `DEFAULT_TEMPLATES.WO_CUSTOMER` μετά το `{{survey_clause}}`. Αποθηκευμένα πρότυπα στη DB δεν αλλάζουν αυτόματα· η σελίδα προτύπων αναφέρει το νέο placeholder (το `price.net` περιλαμβάνει ήδη τη μετάβαση, άρα η σύμβαση παραμένει σωστή και χωρίς αυτό).

---

## 6. Αυτοψία συνεργάτη ανά ζώνη

- `Supplier.surveyZoneFees`: επεξεργασία στο `SupplierFormModal` (εταιρεία) και στο `/marketplace/profile` (συνεργάτης): πίνακας «Προσαύξηση αυτοψίας ανά ζώνη (€ καθ.)» με τις ζώνες της εταιρείας, κενό = 0. Εμφάνιση στο `SupplierHeader` («Αυτοψία 30 € + ζώνη»).
- `/marketplace/rfq/[id]/page.tsx`: υπολογίζει `supplierToBuilding` και περνά στο `OfferForm` `defaults.surveyFee = siteSurveyFee + zoneFee`, `defaults.distance = { km, minutes, zone, method }`. Το `OfferForm` δείχνει «Απόσταση από την έδρα σας: 23 km · περ. 35′ · Ζώνη Β (+10,00 €)» πάνω από το πεδίο αυτοψίας. Χωρίς συντεταγμένες συνεργάτη ή κτιρίου → μόνο η βασική, χωρίς μήνυμα απόστασης.
- Η εταιρεία βλέπει τα ίδια km στο `RfqPanel` (στήλη ανά προσφορά, «23 km από την έδρα του συνεργάτη»).
- Η κατάταξη (`lib/supplier-ranking.ts`, `rfq-candidates.ts`) **δεν αλλάζει** (haversine, χωρίς API κλήσεις για δεκάδες υποψηφίους).

---

## 7. Πού φαίνεται η απόσταση κτιρίου

- Κάρτα κτιρίου στο `/super-admin/properties/[id]` (και admin/manager αντίστοιχα): «23 km · περ. 35′ · Ζώνη Β» ή «≈ 23 km (εκτίμηση)», με badge «χωρίς απόσταση» όταν λείπει, και ενέργεια «Επανυπολογισμός» (`recomputeBuildingDistanceAction`, `properties:edit`).
- Κεφαλίδα βλάβης `/admin/maintenance/[id]` (δίπλα στη διεύθυνση) και `RfqPanel`.
- Κέντρο εργασιών/ημερολόγιο: **δεν** αλλάζουν (άλλες συνεδρίες τα δουλεύουν).

---

## 8. Σφάλματα & όρια

| Περίπτωση | Συμπεριφορά |
|---|---|
| API κάτω / timeout / rate-limited | `ESTIMATE` (haversine × 1,3), cache 24 ώρες, ξαναδοκιμή από το cron. Ποτέ exception προς τον χρήστη. |
| Κτίριο χωρίς `lat/lng` | Πεδία `null`, badge «χωρίς απόσταση», `PER_ZONE` χρεώνει μόνο βασική, μετάβαση 0 με σημείωση. |
| Βάση χωρίς συντεταγμένες | Όπως παραπάνω για όλα τα κτίρια + προειδοποίηση στις Ρυθμίσεις. |
| Αλλαγή έδρας | Νέο `distanceBaseKey` → όλα τα κτίρια stale → cron/κουμπί. Οι παλιές τιμές μένουν ορατές με badge «προς επανυπολογισμό». |
| Αλλαγή ζωνών | Άμεση ισχύς στο read· υπάρχουσες συμβάσεις έργου κρατούν τα αποθηκευμένα `travelFee/travelZone`. |
| Σφάλμα cache upsert (race) | `upsert` με το unique κλειδί· σε conflict ξαναδιαβάζουμε. |

---

## 9. Δοκιμές (Vitest, TDD)

| Αρχείο | Καλύπτει |
|---|---|
| `lib/distance/zones.test.ts` | parse/validate/zoneForKm όρια (10 → Α, 10,1 → Β, 999 → Δ), zoneFee άγνωστου, formatDistance |
| `lib/distance/router.test.ts` | parsing OSRM & ORS με mocked fetch, timeout → ESTIMATE, μη-Ok → ESTIMATE, στρογγύλεμα, επιλογή παρόχου από env |
| `lib/distance/throttle.test.ts` | 1 κλήση/δευτ. με fake clock |
| `lib/distance/cache.test.ts` | cacheKey, hit χωρίς fetch, miss → upsert, ESTIMATE λήγει, force |
| `lib/distance/buildings.test.ts` | stale κανόνες, χωρίς βάση → null, hooks γράφουν σωστά πεδία (mocked db όπως `rfq.test.ts`) |
| `lib/billing/service-amount.test.ts` | PER_ZONE άθροισμα ανά κτίριο, null ζώνη, detail label |
| `app/actions/rfq.test.ts` | forwardOffer: default travelFee από ζώνη, covered → 0, χειροκίνητο, customerPrice = markup + travel, αποθήκευση travel* |
| `lib/contracts.test.ts` | travel_clause παρόν/κενό |
| `app/actions/distance-settings.test.ts` | permission gate, validateZones errors |
| `lib/help/coverage.test.ts` | νέα σελίδα wiki |

Browser (localhost:3002, συνδεδεμένος χρήστης): σελίδα Ρυθμίσεων, κάρτα κτιρίου με απόσταση, υπηρεσία PER_ZONE στον κατάλογο (χωρίς αποθήκευση νέας υπηρεσίας στην παραγωγή — μόνο το φόρμα), προφίλ συνεργάτη. Καμία προώθηση προσφοράς/σύμβαση στην παραγωγή.

---

## 10. Wiki, memory, παράδοση

- Νέο `docs/wiki/pages/super-admin-settings-distance.md`· ενημερώσεις: `super-admin-settings.md`, `super-admin-services.md`, `admin-maintenance-detail.md`, `marketplace-rfq-detail.md`, `marketplace-profile.md`, `super-admin-suppliers-detail.md`, `super-admin-properties-detail.md`, `super-admin-settings-cron.md`, `flows/suppliers.md` (γραμμή μετάβασης). Χαρτογράφηση route → άρθρο στο `lib/help/*`.
- Memory: νέο `project_base_station_distance.md` + γραμμή στο `MEMORY.md`.
- Hand-over note στον shared φάκελο της συνεδρίας, με τις εντολές που τρέχει ο χρήστης (`migrate deploy`, `seed-rbac`, `index-wiki`).
