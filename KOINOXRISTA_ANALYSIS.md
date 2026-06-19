# Ανάλυση Κοινοχρήστων Πολυκατοικίας — Πλήρης Οδηγός για Εφαρμογή

> **Σκοπός:** Αυτό το έγγραφο αποτελεί την πλήρη τεχνική και νομική βάση για την υλοποίηση εφαρμογής υπολογισμού κοινοχρήστων με Next.js 16.2+, Prisma ORM, PostgreSQL.

---

## 1. ΝΟΜΟΘΕΤΙΚΟ ΠΛΑΙΣΙΟ

### 1.1 Βασική Νομοθεσία

| Νόμος / ΦΕΚ | Θέμα | Σημασία για εφαρμογή |
|---|---|---|
| **Ν.3741/1929** ΦΕΚ 4 Α'/09-01-1929 | Ιδιοκτησία κατ' ορόφους — ο θεμέλιος νόμος | Ορίζει το δικαίωμα οριζόντιας ιδιοκτησίας |
| **ΑΚ 1002** | Ορισμός οριζόντιας ιδιοκτησίας στον Αστικό Κώδικα | Νομική βάση ιδιοκτησίας |
| **ΑΚ 1117** | Κανονισμός πολυκατοικίας — δεσμευτικότητα | Κανονισμός υπερισχύει εφόσον δεν αντίκειται σε νόμο |
| **ΝΔ 1024/1971** ΦΕΚ 232 Α' | Διηρημένη ιδιοκτησία σε οικοδομές εξ αδιαιρέτου | Επεκτείνει τη διαχείριση |
| **Ν.1562/1985** ΦΕΚ 150 Α' | 65% πλειοψηφία για τροποποίηση κανονισμού | Ποσοστό έγκρισης αλλαγών |
| **Ν.1512/1985** ΦΕΚ 4 Α' | Κατανομή δαπανών κεντρικής θέρμανσης | Βάση για heating algorithm |
| **ΠΔ 27.9.1985** ΦΕΚ 631 Δ'/07-11-1985 | Τεχνική οδηγία κατανομής θέρμανσης — συντελεστές **εi** και **fi** | **Κρίσιμο** για θέρμανση |
| **Ν.3175/2003** ΦΕΚ 207 Α' | Τροποποιήσεις κανονισμού θέρμανσης | Συμπλήρωμα ΠΔ 1985 |
| **ΚΥΑ 20.8.1997** ΦΕΚ 815 Β' | Κατασκευή και λειτουργία ανελκυστήρων | Elevator χιλιοστά |
| **ΚΥΑ 22.12.2008** ΦΕΚ 2604 Β' | Τροποποίηση ανελκυστήρων | Συμπλήρωμα elevator |
| **Ν.4067/2012** ΦΕΚ 79 Α' | ΝΟΚ — Νέος Οικοδομικός Κανονισμός | Ορισμός κοινοχρήστων χώρων |
| **Ν.4495/2017** ΦΕΚ 167 Α' | Έλεγχος κατασκευών — ψηφιακή αδειοδότηση | eBuilding registry |
| **Ν.4843/2021** | Κοινόχρηστα σε κτήρια μικτής χρήσης | Κατανομή σε mixed-use |
| **Ν.5073/2023** | Ψηφιακή διαχείριση — myDATA κοινοχρήστων από 1/1/2024 | **Υποχρεωτικό** 2024+ |

### 1.2 Κανονισμός Πολυκατοικίας (Κανονισμός)

Ο κανονισμός πολυκατοικίας είναι το **ιδιωτικό συμφωνητικό** μεταξύ ιδιοκτητών που καθορίζει:
- Τον τρόπο υπολογισμού κοινοχρήστων
- Τον πίνακα χιλιοστών για κάθε κατηγορία
- Τα δικαιώματα χρήσης κοινοχρήστων χώρων
- Τις αρμοδιότητες διαχειριστή

**Ιεραρχία:** Νόμος > Κανονισμός > Απόφαση γενικής συνέλευσης

**Τροποποίηση:** Απαιτεί 65% (Ν.1562/1985) ή 100% συναίνεση ανάλογα με το είδος αλλαγής.

### 1.3 Πεδίο Εφαρμογής ανά Τύπο Κτηρίου

| Τύπος Κτηρίου | Εφαρμοστέοι Νόμοι | Ιδιαιτερότητες |
|---|---|---|
| Αμιγής κατοικία | Ν.3741/1929, ΑΚ 1002, ΑΚ 1117 | Τυπική εφαρμογή |
| Μικτή χρήση (κατοικίες + καταστήματα) | + Ν.4843/2021 | Διαφορετικά χιλιοστά για ισόγεια/καταστήματα |
| Εμπορικό/επαγγελματικό | + ΦΠΑ 24% διαφανής | ΦΠΑ εκπεστέο για επιχειρήσεις |
| Γραφειακό κτήριο | + τιμολόγιο παροχής υπηρεσιών | Διαχειριστής → τιμολόγιο |

---

## 2. ΣΥΣΤΗΜΑ ΧΙΛΙΟΣΤΩΝ (Thousandths System)

### 2.1 Ορισμός

Κάθε διαμέρισμα λαμβάνει **συντελεστή χιλιοστών** που εκφράζει το ποσοστό συμμετοχής του στα κοινόχρηστα. Το σύνολο όλων των χιλιοστών σε κάθε κατηγορία **= 1000**.

```
Για N διαμερίσματα:
Σ(χιλιοστά_i) = 1000  για i = 1..N
```

### 2.2 Τύποι Χιλιοστών

Κάθε διαμέρισμα έχει **3 ξεχωριστά σύνολα χιλιοστών**:

| Κατηγορία | Βάση Υπολογισμού | Σύνολο |
|---|---|---|
| **Γενικά χιλιοστά** (οικοπέδου/γενικής χρήσης) | Εμβαδόν (m²) | = 1000 |
| **Χιλιοστά ανελκυστήρα** | Εμβαδόν × συντελεστής ορόφου | = 1000 |
| **Χιλιοστά θέρμανσης** | Όγκος (m³) ή BTU ή thermostat hours | = 1000 |

### 2.3 Υπολογισμός Γενικών Χιλιοστών

```
χιλιοστά_i = (εμβαδόν_i / Σεμβαδόν_όλων) × 1000

Παράδειγμα:
Διαμέρισμα Α1: 80 m²
Διαμέρισμα Α2: 60 m²
Διαμέρισμα Β1: 100 m²
Σύνολο: 240 m²

χιλιοστά_Α1 = (80/240) × 1000 = 333.33
χιλιοστά_Α2 = (60/240) × 1000 = 250.00
χιλιοστά_Β1 = (100/240) × 1000 = 416.67
Σύνολο = 1000.00 ✓
```

### 2.4 Υπολογισμός Χιλιοστών Ανελκυστήρα

Ο ανελκυστήρας επιβαρύνει περισσότερο τα ψηλότερα ορόφια:

```
βάρος_ανελκυστήρα_i = εμβαδόν_i × (1 + 0.10 × αριθμός_ορόφου_i)

Παράδειγμα (βάσει κανονισμού):
Ισόγειο (όροφος 0): βάρος = εμβαδόν × 1.00  → συντελεστής 0% (συχνά εξαιρείται)
1ος όροφος:          βάρος = εμβαδόν × 1.10  → +10%
2ος όροφος:          βάρος = εμβαδόν × 1.20  → +20%
3ος όροφος:          βάρος = εμβαδόν × 1.30  → +30%
...κ.ο.κ.

χιλιοστά_ανελκ_i = (βάρος_ανελκ_i / Σβάρη_ανελκ) × 1000
```

**Σημείωση:** Ισόγεια καταστήματα και υπόγεια **συνήθως εξαιρούνται** από ανελκυστήρα (χιλιοστά = 0).

### 2.5 Υπολογισμός Χιλιοστών Θέρμανσης

**Μέθοδος Α — Ογκομετρική (χωρίς μετρητές):**
```
χιλιοστά_θέρμ_i = (όγκος_i / Σόγκοι) × 1000

Όγκος = εμβαδόν × ύψος_ορόφου
```

**Μέθοδος Β — Με θερμιδομετρητές (ΠΔ 27.9.1985):**
```
Κατανομή θέρμανσης:
- 70% βάσει μετρητών κατανάλωσης (θερμιδομετρητές/thermostat hours)
- 30% βάσει χιλιοστών (ογκομετρικά)

Δαπάνη_θέρμ_i = Συνολική_θέρμανση × [0.70 × (μέτρηση_i / Σμετρήσεις) + 0.30 × (χιλιοστά_θέρμ_i / 1000)]
```

**Μέθοδος Γ — BTU αριθμός θερμαντικών σωμάτων:**
```
χιλιοστά_θέρμ_i = (BTU_i / ΣBTU) × 1000
```

---

## 3. ΚΑΤΗΓΟΡΙΕΣ ΔΑΠΑΝΩΝ

### 3.1 Πλήρης Κατάλογος Κατηγοριών

| Κατηγορία | Υποκατηγορίες | Χιλιοστά Κατανομής |
|---|---|---|
| **Γενικές κοινές δαπάνες** | Καθαρισμός εισόδου/σκάλας, Φωτισμός (ΔΕΗ κοινοχρήστων), Νερό (βασική κατανάλωση), Ασφάλιση κτηρίου, Φύλαξη, Μικροεπισκευές | Γενικά χιλιοστά |
| **Ανελκυστήρας** | Συντήρηση ανελκυστήρα, Ρεύμα ανελκυστήρα, Πιστοποίηση (ΕΛΟΤ), Ασφάλιση ανελκυστήρα | Χιλιοστά ανελκυστήρα |
| **Κεντρική θέρμανση** | Πετρέλαιο/φυσικό αέριο, Συντήρηση καυστήρα, Ρεύμα αντλιών, Επισκευές λεβητοστασίου | Χιλιοστά θέρμανσης |
| **Νερό** | Κοινόχρηστο νερό κήπου/πισίνας, Κοινή αντλία | Γενικά χιλιοστά ή ισομερής |
| **Διαχείριση** | Αμοιβή διαχειριστή, Λογιστική, Νομικές συμβουλές | Γενικά χιλιοστά |
| **Αποθεματικό** | Έκτακτες δαπάνες, Ανακαίνιση | Γενικά χιλιοστά |
| **Κεραία/Δίκτυα** | Κοινή κεραία, Δίκτυο διανομής καλωδίων | Γενικά χιλιοστά |
| **Χώρος στάθμευσης** | Φωτισμός, Συντήρηση rampe, Πόρτα parking | Χιλιοστά θέσεων parking |

### 3.2 Δαπάνες Ανά Τύπο Κτηρίου

#### Αμιγής Κατοικία
- Όλες οι παραπάνω κατηγορίες
- Ισόγειο/υπόγειο: συνήθως χωρίς χιλιοστά ανελκυστήρα

#### Μικτή Χρήση (κατοικίες + καταστήματα)
- Καταστήματα ισογείου: εξαιρούνται ανελκυστήρα, θέρμανση (αν ανεξάρτητη)
- Ξεχωριστός υπολογισμός για το εμπορικό και οικιστικό τμήμα
- Κτήριο μπορεί να έχει **δύο πίνακες χιλιοστών**: ένα για residential, ένα για commercial

#### Εμπορικό / Γραφειακό Κτήριο
- Κοινόχρηστα = επαγγελματικές δαπάνες
- ΦΠΑ 24% εκπεστέο για επιχειρήσεις εγγεγραμμένες στο μητρώο ΦΠΑ
- Τιμολόγιο αντί απόδειξης

---

## 4. ΑΛΓΟΡΙΘΜΟΙ ΥΠΟΛΟΓΙΣΜΟΥ

### 4.1 Κύριος Αλγόριθμος (Master Algorithm)

```typescript
// Βασική φόρμουλα
function calculateMonthlyExpense(
  apartment: Apartment,
  month: string,
  expenses: Expense[]
): ApartmentExpense {
  
  let totalForApartment = 0;
  const breakdown: ExpenseBreakdown[] = [];
  
  for (const expense of expenses) {
    const category = expense.category; // GENERAL | ELEVATOR | HEATING | WATER | etc.
    const totalAmount = expense.amount;
    
    // Επιλογή σωστού πίνακα χιλιοστών
    const millostosRatio = getMillostosRatio(apartment, category);
    
    // Υπολογισμός μεριδίου
    const share = totalAmount * millostosRatio;
    
    breakdown.push({
      expenseId: expense.id,
      category,
      totalAmount,
      millostosRatio,
      apartmentShare: share
    });
    
    totalForApartment += share;
  }
  
  return {
    apartmentId: apartment.id,
    month,
    total: totalForApartment,
    breakdown
  };
}

function getMillostosRatio(apartment: Apartment, category: ExpenseCategory): number {
  switch (category) {
    case 'GENERAL':
      return apartment.generalMillostos / 1000;
    case 'ELEVATOR':
      return apartment.elevatorMillostos / 1000;
    case 'HEATING':
      return apartment.heatingMillostos / 1000;
    case 'WATER':
      return apartment.waterMillostos / 1000;
    default:
      return apartment.generalMillostos / 1000;
  }
}
```

### 4.2 Αλγόριθμος Υπολογισμού Πίνακα Χιλιοστών

```typescript
function buildMillostosTable(apartments: ApartmentInput[]): MillostosTable {
  // 1. Γενικά χιλιοστά — βάσει εμβαδόν
  const totalArea = apartments.reduce((sum, a) => sum + a.area, 0);
  
  // 2. Χιλιοστά ανελκυστήρα — εμβαδόν × floor coefficient
  const elevatorWeights = apartments.map(a => ({
    id: a.id,
    weight: a.hasElevatorAccess 
      ? a.area * (1 + 0.10 * a.floor) 
      : 0  // ισόγεια/υπόγεια συνήθως εξαιρούνται
  }));
  const totalElevatorWeight = elevatorWeights.reduce((sum, e) => sum + e.weight, 0);
  
  // 3. Χιλιοστά θέρμανσης — ογκομετρικά
  const totalVolume = apartments
    .filter(a => a.hasHeating)
    .reduce((sum, a) => sum + a.volume, 0);
  
  return apartments.map(a => {
    const elevWeight = elevatorWeights.find(e => e.id === a.id)!.weight;
    
    return {
      apartmentId: a.id,
      generalMillostos: normalize((a.area / totalArea) * 1000),
      elevatorMillostos: totalElevatorWeight > 0 
        ? normalize((elevWeight / totalElevatorWeight) * 1000) 
        : 0,
      heatingMillostos: a.hasHeating && totalVolume > 0
        ? normalize((a.volume / totalVolume) * 1000) 
        : 0,
    };
  });
}

// Στρογγυλοποίηση ώστε σύνολο = 1000.000
function normalize(value: number): number {
  return Math.round(value * 1000) / 1000;
}
```

### 4.3 Αλγόριθμος Θέρμανσης με Θερμιδομετρητές (ΠΔ 1985)

```typescript
interface HeatingMeterReading {
  apartmentId: string;
  period: string;  // YYYY-MM
  units: number;   // θερμιδικές μονάδες ή ώρες θερμοστάτη
}

function calculateHeatingWithMeters(
  totalHeatingCost: number,
  readings: HeatingMeterReading[],
  apartments: Apartment[],
  fixedShare: number = 0.30,    // 30% σταθερό βάσει χιλιοστών
  variableShare: number = 0.70  // 70% μεταβλητό βάσει μετρητών
): HeatingExpenseResult[] {
  
  const totalUnits = readings.reduce((sum, r) => sum + r.units, 0);
  const fixedAmount = totalHeatingCost * fixedShare;
  const variableAmount = totalHeatingCost * variableShare;
  
  return apartments.map(apt => {
    const reading = readings.find(r => r.apartmentId === apt.id);
    const aptUnits = reading?.units ?? 0;
    
    // Σταθερό κομμάτι: βάσει χιλιοστών θέρμανσης
    const fixedPart = fixedAmount * (apt.heatingMillostos / 1000);
    
    // Μεταβλητό κομμάτι: βάσει πραγματικής κατανάλωσης
    const variablePart = totalUnits > 0 
      ? variableAmount * (aptUnits / totalUnits) 
      : 0;
    
    return {
      apartmentId: apt.id,
      fixedPart,
      variablePart,
      total: fixedPart + variablePart
    };
  });
}
```

### 4.4 Αλγόριθμος Ισομερούς Κατανομής

Για δαπάνες που κατανέμονται ισόποσα ανά ιδιοκτησία (π.χ. φύλαξη):

```typescript
function equalDistribution(
  totalAmount: number,
  activeApartments: Apartment[]
): Map<string, number> {
  const perUnit = totalAmount / activeApartments.length;
  const result = new Map<string, number>();
  activeApartments.forEach(apt => result.set(apt.id, perUnit));
  return result;
}
```

### 4.5 Μικτός Αλγόριθμος (Composite Distribution)

Για δαπάνες που κατανέμονται με σύνθετο τρόπο:

```typescript
interface DistributionRule {
  percentage: number;     // π.χ. 0.60
  millostosType: string;  // 'GENERAL' | 'ELEVATOR' | 'HEATING' | 'EQUAL'
}

function compositeDistribution(
  totalAmount: number,
  rules: DistributionRule[],
  apartments: Apartment[]
): Map<string, number> {
  
  // Validation: rules percentages must sum to 1
  const totalPct = rules.reduce((sum, r) => sum + r.percentage, 0);
  if (Math.abs(totalPct - 1.0) > 0.001) throw new Error('Rules must sum to 100%');
  
  const result = new Map<string, number>(apartments.map(a => [a.id, 0]));
  
  for (const rule of rules) {
    const portion = totalAmount * rule.percentage;
    
    for (const apt of apartments) {
      const share = getShareByType(apt, rule.millostosType, apartments, portion);
      result.set(apt.id, (result.get(apt.id) ?? 0) + share);
    }
  }
  
  return result;
}
```

---

## 4b. ΝΟΜΙΚΕΣ ΑΝΑΦΟΡΕΣ ΑΛΓΟΡΙΘΜΩΝ (Legal Basis Layer)

> Κάθε υπολογισμός που εκτελεί η εφαρμογή πρέπει να συνοδεύεται από τη νομική του βάση, ώστε να εμφανίζεται στις αναφορές, στους λογαριασμούς και στο compliance dashboard.

### 4b.1 TypeScript Types — Νομικές Αναφορές

```typescript
// types/legal.ts

export interface LegalReference {
  law: string;           // π.χ. "ΠΔ 27.9.1985"
  fek: string;           // π.χ. "ΦΕΚ 631 Δ'/07-11-1985"
  article?: string;      // π.χ. "Άρθρο 3, παρ. 2"
  title: string;         // Σύντομη περιγραφή
  description: string;   // Πλήρης περιγραφή του τι ορίζει
  url?: string;          // Link σε ΦΕΚ / e-nomothesia
}

export interface CalculationLegalBasis {
  calculationType: CalculationType;
  references: LegalReference[];
  complianceNote: string;  // Κείμενο για εμφάνιση στον λογαριασμό
}

export type CalculationType = 
  | 'GENERAL_MILLOSTOS'
  | 'ELEVATOR_MILLOSTOS'
  | 'HEATING_VOLUME'
  | 'HEATING_METERS'
  | 'HEATING_BTU'
  | 'EQUAL_DISTRIBUTION'
  | 'RESERVE_FUND'
  | 'REGULATION_CUSTOM';
```

### 4b.2 Legal Basis Registry — Πλήρεις Νομικές Αναφορές

```typescript
// lib/legal/legalBasis.ts
// Κεντρικό registry νομικών αναφορών για κάθε τύπο υπολογισμού

export const LEGAL_BASIS_REGISTRY: Record<CalculationType, CalculationLegalBasis> = {

  GENERAL_MILLOSTOS: {
    calculationType: 'GENERAL_MILLOSTOS',
    complianceNote: 'Υπολογισμός βάσει αναλογίας χιλιοστών ιδιοκτησίας (Ν.3741/1929, ΑΚ 1002)',
    references: [
      {
        law: 'Ν.3741/1929',
        fek: 'ΦΕΚ 4 Α\'/09-01-1929',
        article: 'Άρθρο 4',
        title: 'Ιδιοκτησία κατ\' ορόφους — συμμετοχή σε κοινές δαπάνες',
        description: 'Ορίζει ότι κάθε ιδιοκτήτης οριζόντιας ιδιοκτησίας συμμετέχει στις κοινές δαπάνες αναλόγως της αξίας ή του εμβαδού της ιδιοκτησίας του, όπως ορίζεται στον κανονισμό.',
        url: 'https://www.e-nomothesia.gr/oikogeneiako-klhronomiko-dikaio/n-3741-1929.html'
      },
      {
        law: 'ΑΚ 1002',
        fek: 'Αστικός Κώδικας',
        title: 'Οριζόντια ιδιοκτησία',
        description: 'Ορίζει την οριζόντια ιδιοκτησία ως αυτοτελές εμπράγματο δικαίωμα σε όροφο ή τμήμα ορόφου, με αναγκαία συμμετοχή σε κοινόχρηστα κατά τα χιλιοστά ιδιοκτησίας.',
      },
      {
        law: 'ΑΚ 1117',
        fek: 'Αστικός Κώδικας',
        title: 'Κανονισμός πολυκατοικίας — υποχρεωτικότητα χιλιοστών',
        description: 'Ο κανονισμός πολυκατοικίας δεσμεύει όλους τους ιδιοκτήτες και τους διαδόχους τους. Ο πίνακας χιλιοστών αποτελεί αναπόσπαστο μέρος του κανονισμού.',
      }
    ]
  },

  ELEVATOR_MILLOSTOS: {
    calculationType: 'ELEVATOR_MILLOSTOS',
    complianceNote: 'Δαπάνες ανελκυστήρα κατανέμονται βάσει χιλιοστών με συντελεστή ορόφου (ΚΥΑ 20.8.1997, ΦΕΚ 815 Β\')',
    references: [
      {
        law: 'ΚΥΑ 20.8.1997',
        fek: 'ΦΕΚ 815 Β\'',
        title: 'Κατασκευή και λειτουργία ανελκυστήρων — κατανομή δαπανών',
        description: 'Ορίζει ότι οι δαπάνες λειτουργίας και συντήρησης ανελκυστήρα κατανέμονται βάσει χιλιοστών, λαμβανομένου υπόψη του ορόφου κάθε ιδιοκτησίας. Ιδιοκτησίες υψηλότερων ορόφων έχουν μεγαλύτερη χρήση και συνεπώς μεγαλύτερη επιβάρυνση.',
        url: 'https://www.et.gr/api/etos/1997/b/815'
      },
      {
        law: 'ΚΥΑ 22.12.2008',
        fek: 'ΦΕΚ 2604 Β\'',
        title: 'Τροποποίηση κανονισμού ανελκυστήρων',
        description: 'Τροποποιεί και συμπληρώνει την ΚΥΑ 1997, ενισχύοντας τις απαιτήσεις πιστοποίησης (ΕΛΟΤ ΕΝ 81) και τα κριτήρια κατανομής δαπανών.',
      },
      {
        law: 'Ν.3741/1929',
        fek: 'ΦΕΚ 4 Α\'/09-01-1929',
        article: 'Άρθρο 4',
        title: 'Αρχή αναλογικής συμμετοχής',
        description: 'Γενική αρχή: όποιος χρησιμοποιεί περισσότερο μια κοινή εγκατάσταση, επιβαρύνεται αναλογικά περισσότερο.',
      }
    ]
  },

  HEATING_VOLUME: {
    calculationType: 'HEATING_VOLUME',
    complianceNote: 'Δαπάνες θέρμανσης κατανέμονται βάσει κυβικού όγκου ιδιοκτησίας (Ν.1512/1985, ΦΕΚ 4 Α\')',
    references: [
      {
        law: 'Ν.1512/1985',
        fek: 'ΦΕΚ 4 Α\'',
        title: 'Κατανομή δαπανών κεντρικής θέρμανσης — μέθοδος όγκου',
        description: 'Ορίζει ότι σε απουσία θερμιδομετρητών, οι δαπάνες κεντρικής θέρμανσης κατανέμονται βάσει του θερμαινόμενου κυβικού όγκου κάθε ιδιοκτησίας (εμβαδόν × ύψος ορόφου).',
      },
      {
        law: 'ΠΔ 27.9.1985',
        fek: 'ΦΕΚ 631 Δ\'/07-11-1985',
        title: 'Τεχνικός κανονισμός κατανομής θέρμανσης',
        description: 'Θεσπίζει τους τεχνικούς συντελεστές εi (συντελεστής θέσης) και fi (συντελεστής έκθεσης) για κτήρια χωρίς θερμιδομετρητές. Η ογκομετρική μέθοδος εφαρμόζεται ως προεπιλογή όταν δεν υπάρχει εγκατεστημένο σύστημα μέτρησης.',
        url: 'https://www.et.gr/api/etos/1985/d/631'
      }
    ]
  },

  HEATING_METERS: {
    calculationType: 'HEATING_METERS',
    complianceNote: 'Δαπάνες θέρμανσης: 70% βάσει θερμιδομετρητών + 30% βάσει χιλιοστών (ΠΔ 27.9.1985, Ν.3175/2003)',
    references: [
      {
        law: 'ΠΔ 27.9.1985',
        fek: 'ΦΕΚ 631 Δ\'/07-11-1985',
        article: 'Άρθρο 5, παρ. 2',
        title: 'Κατανομή 70%/30% με θερμιδομετρητές',
        description: 'Ορίζει ρητά: το 70% των δαπανών θέρμανσης κατανέμεται αναλόγως της πραγματικής κατανάλωσης κάθε ιδιοκτησίας (βάσει ενδείξεων θερμιδομετρητή/θερμοστάτη), ενώ το υπόλοιπο 30% κατανέμεται βάσει χιλιοστών (σταθερό κομμάτι για κοινές απώλειες θερμότητας δικτύου).',
        url: 'https://www.et.gr/api/etos/1985/d/631'
      },
      {
        law: 'Ν.3175/2003',
        fek: 'ΦΕΚ 207 Α\'',
        title: 'Τροποποίηση — επικαιροποίηση μεθόδου θερμιδομετρητών',
        description: 'Ενσωματώνει οδηγία 2002/91/ΕΚ για ενεργειακή απόδοση κτηρίων, επιβεβαιώνει υποχρεωτική εγκατάσταση θερμιδομετρητών σε νέα κτήρια με κεντρική θέρμανση και επικαιροποιεί τη μέθοδο κατανομής 70%/30%.',
      },
      {
        law: 'Ν.1512/1985',
        fek: 'ΦΕΚ 4 Α\'',
        title: 'Βάση νόμου για κεντρική θέρμανση',
        description: 'Ο θεμέλιος νόμος για κατανομή δαπανών κεντρικής θέρμανσης που θέτει την υποχρέωση δίκαιης κατανομής βάσει πραγματικής κατανάλωσης.',
      }
    ]
  },

  HEATING_BTU: {
    calculationType: 'HEATING_BTU',
    complianceNote: 'Δαπάνες θέρμανσης κατανέμονται βάσει BTU θερμαντικών σωμάτων (ΠΔ 27.9.1985)',
    references: [
      {
        law: 'ΠΔ 27.9.1985',
        fek: 'ΦΕΚ 631 Δ\'/07-11-1985',
        article: 'Άρθρο 4',
        title: 'Κατανομή βάσει εγκατεστημένης θερμικής ισχύος',
        description: 'Επιτρέπει κατανομή βάσει του αθροίσματος των BTU/kcal των θερμαντικών σωμάτων κάθε ιδιοκτησίας, ως εναλλακτική της ογκομετρικής μεθόδου όταν τα θερμαντικά σώματα δεν είναι ομοιόμορφα κατανεμημένα.',
      }
    ]
  },

  EQUAL_DISTRIBUTION: {
    calculationType: 'EQUAL_DISTRIBUTION',
    complianceNote: 'Ισομερής κατανομή δαπάνης μεταξύ ιδιοκτησιών (ΑΚ 1117 — κανονισμός πολυκατοικίας)',
    references: [
      {
        law: 'ΑΚ 1117',
        fek: 'Αστικός Κώδικας',
        title: 'Κανονισμός πολυκατοικίας — ελευθερία ρύθμισης μεθόδου κατανομής',
        description: 'Ο κανονισμός πολυκατοικίας μπορεί να ορίζει ισομερή κατανομή για συγκεκριμένες κατηγορίες δαπανών (π.χ. φύλαξη, κοινόχρηστες ΤΗΛ/ΔΕΗ συνδέσεις) εφόσον συμφωνούν τα 2/3 των ιδιοκτητών.',
      },
      {
        law: 'Ν.3741/1929',
        fek: 'ΦΕΚ 4 Α\'',
        article: 'Άρθρο 4, παρ. 3',
        title: 'Δυνατότητα ισομερούς κατανομής για ορισμένες δαπάνες',
        description: 'Επιτρέπει παρέκκλιση από τον κανόνα των χιλιοστών για δαπάνες που εξ αντικειμένου δεν σχετίζονται με το μέγεθος της ιδιοκτησίας (π.χ. κόστος διαχείρισης ανά μονάδα).',
      }
    ]
  },

  RESERVE_FUND: {
    calculationType: 'RESERVE_FUND',
    complianceNote: 'Αποθεματικό έκτακτων δαπανών — προαιρετικό βάσει κανονισμού (ΑΚ 1117)',
    references: [
      {
        law: 'ΑΚ 1117',
        fek: 'Αστικός Κώδικας',
        title: 'Αποθεματικό πολυκατοικίας',
        description: 'Ο κανονισμός μπορεί να προβλέπει σχηματισμό αποθεματικού για έκτακτες δαπάνες (επισκευές, αντικαταστάσεις), το οποίο κατανέμεται ως γενικά κοινόχρηστα.',
      },
      {
        law: 'Ν.3741/1929',
        fek: 'ΦΕΚ 4 Α\'',
        article: 'Άρθρο 5',
        title: 'Εξουσίες γενικής συνέλευσης — αποφάσεις για αποθεματικό',
        description: 'Η γενική συνέλευση ιδιοκτητών έχει αρμοδιότητα να αποφασίζει για τη δημιουργία και το ύψος αποθεματικού με απλή πλειοψηφία (51%) των παρόντων.',
      }
    ]
  },

  REGULATION_CUSTOM: {
    calculationType: 'REGULATION_CUSTOM',
    complianceNote: 'Προσαρμοσμένος υπολογισμός βάσει κανονισμού πολυκατοικίας (ΑΚ 1117, Ν.3741/1929)',
    references: [
      {
        law: 'ΑΚ 1117',
        fek: 'Αστικός Κώδικας',
        title: 'Δεσμευτικότητα κανονισμού',
        description: 'Ο κανονισμός πολυκατοικίας δεσμεύει όλους τους ιδιοκτήτες και τους διαδόχους τους, εφόσον δεν αντίκειται σε αναγκαστικές διατάξεις νόμου. Προσαρμοσμένοι κανόνες κατανομής που ορίζονται στον κανονισμό είναι έγκυροι.',
      }
    ]
  }
};

// Βοηθητική συνάρτηση για ανάκτηση νομικής βάσης
export function getLegalBasis(calculationType: CalculationType): CalculationLegalBasis {
  return LEGAL_BASIS_REGISTRY[calculationType];
}

// Σύντομη νομική αναφορά για εμφάνιση σε λογαριασμό
export function getLegalCitation(calculationType: CalculationType): string {
  const basis = LEGAL_BASIS_REGISTRY[calculationType];
  const laws = basis.references.map(r => r.law).join(', ');
  return `${basis.complianceNote} [${laws}]`;
}
```

### 4b.3 Ενσωμάτωση στον Υπολογισμό

Κάθε `ExpenseLineItem` και `BillBreakdownItem` πρέπει να φέρει τη νομική βάση:

```typescript
// Επέκταση αλγορίθμου με legal references
function calculatePeriodBillsWithLegalBasis(
  period: ExpensePeriodWithIncludes,
  heatingReadings: HeatingReading[]
): UnitBillInputWithLegal[] {
  
  const bills = calculatePeriodBills(period, heatingReadings);
  
  return bills.map(bill => ({
    ...bill,
    breakdown: bill.breakdown.map(item => ({
      ...item,
      legalBasis: getLegalBasis(mapCategoryToCalculationType(item.category, period)),
      legalCitation: getLegalCitation(mapCategoryToCalculationType(item.category, period))
    }))
  }));
}

function mapCategoryToCalculationType(
  category: ExpenseCategory,
  period: ExpensePeriodWithIncludes
): CalculationType {
  const regulation = period.building.regulations[0];
  
  switch (category) {
    case 'ELEVATOR':
      return 'ELEVATOR_MILLOSTOS';
    case 'HEATING':
      if (regulation.heatingMethod === 'METERS') return 'HEATING_METERS';
      if (regulation.heatingMethod === 'BTU')    return 'HEATING_BTU';
      return 'HEATING_VOLUME';
    case 'RESERVE_FUND':
      return 'RESERVE_FUND';
    case 'GENERAL':
    default:
      return 'GENERAL_MILLOSTOS';
  }
}
```

### 4b.4 Prisma — Αποθήκευση Νομικών Αναφορών στη ΒΔ

Προσθήκη πεδίων στα υπάρχοντα models για legal traceability:

```prisma
// Προσθήκη στο model BillBreakdownItem
model BillBreakdownItem {
  id              String    @id @default(cuid())
  billId          String
  bill            UnitBill  @relation(fields: [billId], references: [id])
  
  category        ExpenseCategory
  description     String
  millostosValue  Float
  amount          Float
  
  // ΝΟΜΙΚΗ ΒΑΣΗ — για compliance display
  calculationType String?   // 'GENERAL_MILLOSTOS' | 'ELEVATOR_MILLOSTOS' | κτλ.
  legalCitation   String?   // π.χ. "Βάσει ΠΔ 27.9.1985, 70%/30% θέρμανση"
  legalLaws       String[]  // ["ΠΔ 27.9.1985", "Ν.3175/2003"]
}

// Προσθήκη στο model Expense
model Expense {
  // ... υπάρχοντα πεδία ...
  
  // ΝΟΜΙΚΗ ΒΑΣΗ
  legalCalculationType String?  // Τύπος υπολογισμού
  legalBasisJson       Json?    // Πλήρες LegalBasis object (για audit)
}
```

### 4b.5 Compliance Display στο UI

```typescript
// components/bills/LegalBasisBadge.tsx
// Εμφανίζει τη νομική βάση κάθε κατηγορίας δαπάνης

interface LegalBasisBadgeProps {
  calculationType: CalculationType;
  compact?: boolean;
}

export function LegalBasisBadge({ calculationType, compact = false }: LegalBasisBadgeProps) {
  const basis = getLegalBasis(calculationType);
  
  if (compact) {
    // Compact: μόνο τα ονόματα νόμων ως badges
    return (
      <div className="flex gap-1 flex-wrap">
        {basis.references.map(ref => (
          <Badge key={ref.law} variant="outline" className="text-xs">
            {ref.law}
          </Badge>
        ))}
      </div>
    );
  }
  
  // Full: tooltip με πλήρη περιγραφή
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex gap-1 cursor-help">
            <Info className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Νομ. βάση</span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">
          <p className="font-semibold mb-2">{basis.complianceNote}</p>
          {basis.references.map(ref => (
            <div key={ref.law} className="mb-2">
              <p className="font-medium">{ref.law} — {ref.title}</p>
              {ref.fek && <p className="text-xs opacity-70">{ref.fek}</p>}
              {ref.article && <p className="text-xs">{ref.article}</p>}
            </div>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Χρήση στο BillBreakdown:
// <LegalBasisBadge calculationType="HEATING_METERS" />
// Εμφανίζει: "ΠΔ 27.9.1985" | "Ν.3175/2003" | "Ν.1512/1985"
// Με hover tooltip: πλήρης περιγραφή
```

### 4b.6 PDF Λογαριασμός — Νομική Υποσημείωση

Κάθε PDF λογαριασμός εκτυπώνει στο τέλος τις νομικές αναφορές:

```typescript
// Υποσημείωση PDF λογαριασμού
const LEGAL_FOOTER_TEXT = {
  GENERAL: 'Γενικά κοινόχρηστα: Ν.3741/1929, ΑΚ 1002, ΑΚ 1117',
  ELEVATOR: 'Ανελκυστήρας: ΚΥΑ 20.8.1997 (ΦΕΚ 815 Β\'), ΚΥΑ 22.12.2008 (ΦΕΚ 2604 Β\')',
  HEATING_METERS: 'Θέρμανση (μετρητές): ΠΔ 27.9.1985 (ΦΕΚ 631 Δ\'), Ν.3175/2003 — Κατανομή 70% κατανάλωση / 30% χιλιοστά',
  HEATING_VOLUME: 'Θέρμανση (ογκομετρική): Ν.1512/1985, ΠΔ 27.9.1985',
  RESERVE: 'Αποθεματικό: ΑΚ 1117 — Κανονισμός πολυκατοικίας',
  MYDATA: 'Υποχρεωτική διαβίβαση στο myDATA (ΑΑΔΕ) βάσει Ν.5073/2023',
  PRESCRIPTION: 'Απαίτηση κοινοχρήστων παραγράφεται μετά 5ετία (ΑΚ 250)'
};
```

---

## 5. ΤΥΠΟΙ ΚΤΗΡΙΩΝ — ΕΙΔΙΚΟΙ ΚΑΝΟΝΕΣ

### 5.1 Αμιγής Κατοικία

**Κανόνες:**
- Ισόγεια: χιλιοστά ανελκυστήρα = 0 (εξαίρεση εκτός αν ο κανονισμός ορίζει διαφορετικά)
- Υπόγεια/αποθήκες: χιλιοστά θέρμανσης = 0
- Parking: ξεχωριστός πίνακας ή γενικά χιλιοστά ανά θέση

**Γενικός Τύπος Μηνιαίου Λογαριασμού:**
```
Κοινόχρηστο_μήνα = 
  (Γενικές_δαπάνες × γεν.χιλιοστά / 1000) +
  (Ανελκυστήρας × ανελκ.χιλιοστά / 1000) +
  (Θέρμανση_σταθερό × θέρμ.χιλιοστά / 1000) +
  (Θέρμανση_μεταβλητό × μέτρηση_i / Σμετρήσεις) +
  Αποθεματικό_i
```

### 5.2 Μικτή Χρήση (Κατοικίες + Καταστήματα)

**Κανόνες (βάσει Ν.4843/2021):**
- Καταστήματα ισογείου: πληρώνουν μόνο γενικά κοινόχρηστα (καθαρισμός, φωτισμός εισόδου)
- Εξαιρούνται: ανελκυστήρας, κεντρική θέρμανση (αν έχουν αυτόνομη)
- Ο κανονισμός μπορεί να ορίζει μειωμένο συντελεστή (π.χ. 50%) για καταστήματα

**Παράδειγμα Δομής Χιλιοστών:**
```
Κτήριο με 4 διαμερίσματα + 2 καταστήματα:

Κατάστημα 1 (ισόγειο): γεν.χιλ=120, ανελκ.χιλ=0, θέρμ.χιλ=0
Κατάστημα 2 (ισόγειο): γεν.χιλ=80, ανελκ.χιλ=0, θέρμ.χιλ=0
Δ/σμα Α1 (1ος):        γεν.χιλ=200, ανελκ.χιλ=220, θέρμ.χιλ=250
Δ/σμα Α2 (1ος):        γεν.χιλ=150, ανελκ.χιλ=165, θέρμ.χιλ=190
Δ/σμα Β1 (2ος):        γεν.χιλ=250, ανελκ.χιλ=303, θέρμ.χιλ=310
Δ/σμα Β2 (2ος):        γεν.χιλ=200, ανελκ.χιλ=312, θέρμ.χιλ=250

Σύνολο γεν: 1000 ✓, Σύνολο ανελκ: 1000 ✓, Σύνολο θέρμ: 1000 ✓
```

### 5.3 Εμπορικό / Γραφειακό Κτήριο

**Κανόνες:**
- Συνήθως ένας πίνακας χιλιοστών (γενικά)
- ΦΠΑ 24% επί κοινοχρήστων — εκπεστέο για εγγεγραμμένους στο ΦΠΑ
- Διαχειριστής εκδίδει τιμολόγιο παροχής υπηρεσιών
- myDATA υποχρεωτικό από 1/1/2024

---

## 6. ΦΟΡΟΛΟΓΙΚΕΣ ΚΑΙ ΔΙΟΙΚΗΤΙΚΕΣ ΥΠΟΧΡΕΩΣΕΙΣ

### 6.1 ΑΦΜ Πολυκατοικίας

- Υποχρεωτική απόκτηση ΑΦΜ από ΔΟΥ
- Νέος διαχειριστής: δήλωση αλλαγής εντός **1 μηνός**
- Χρησιμοποιείται για: λογαριασμούς ΔΕΗ/ΕΥΔΑΠ, σύμβαση πετρελαίου, συντηρητές

### 6.2 myDATA (από 1/1/2024, Ν.5073/2023)

- Υποχρεωτική διαβίβαση παραστατικών κοινοχρήστων στο myDATA (ΑΑΔΕ)
- Αφορά κτήρια που λαμβάνουν τιμολόγια ≥ 100€/έτος
- Ο διαχειριστής αναρτά τα κοινόχρηστα ως **έσοδα** και τα αντίστοιχα τιμολόγια ως **δαπάνες**

### 6.3 ΦΠΑ Κοινοχρήστων

| Κτήριο | ΦΠΑ | Εκπεστεότητα |
|---|---|---|
| Αμιγής κατοικία | Δεν εφαρμόζεται ΦΠΑ στα κοινόχρηστα | — |
| Μικτή χρήση (επαγγ. μέρος) | ΦΠΑ 24% | Εκπεστέο για επιχειρήσεις |
| Εμπορικό κτήριο | ΦΠΑ 24% | Εκπεστέο |

### 6.4 Αποδείξεις και Πιστοποιητικά

- Διαχειριστής εκδίδει **απόδειξη είσπραξης** κοινοχρήστων σε κάθε ιδιοκτήτη
- Για πώληση ακινήτου: απαιτείται **πιστοποιητικό αναλογίας κοινοχρήστων** (βεβαίωση οφειλής ή μη)
- Τήρηση βιβλίων/αρχείων: **5 χρόνια** (παραγραφή οφειλών)

### 6.5 Παραγραφή

Απλήρωτα κοινόχρηστα παραγράφονται μετά από **5 χρόνια** (ΑΚ 250).

---

## 7. ΔΟΜΗ ΒΑΣΗΣ ΔΕΔΟΜΕΝΩΝ (PostgreSQL + Prisma)

### 7.1 Πλήρες Prisma Schema

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================
// AUTHENTICATION (Auth.js)
// ============================================================

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  role          UserRole  @default(MANAGER)
  
  accounts      Account[]
  sessions      Session[]
  managedBuildings Building[] @relation("BuildingManager")
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  @@unique([identifier, token])
}

enum UserRole {
  ADMIN       // Σύστημα
  MANAGER     // Διαχειριστής πολυκατοικίας
  OWNER       // Ιδιοκτήτης
  TENANT      // Ενοικιαστής (view-only)
}

// ============================================================
// BUILDING — Πολυκατοικία
// ============================================================

model Building {
  id              String          @id @default(cuid())
  name            String          // "Πολυκατοικία Κηφισιάς 45"
  address         String
  city            String
  postalCode      String
  afm             String?         // ΑΦΜ πολυκατοικίας
  doy             String?         // ΔΟΥ
  buildingType    BuildingType    @default(RESIDENTIAL)
  constructionYear Int?
  totalFloors     Int
  hasElevator     Boolean         @default(false)
  hasHeating      Boolean         @default(false)
  heatingType     HeatingType?
  hasPool         Boolean         @default(false)
  hasParking      Boolean         @default(false)
  
  managerId       String
  manager         User            @relation("BuildingManager", fields: [managerId], references: [id])
  
  regulations     BuildingRegulation[]
  units           Unit[]
  expenses        Expense[]
  expensePeriods  ExpensePeriod[]
  millostosConfig MillostosConfig[]
  
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}

enum BuildingType {
  RESIDENTIAL         // Αμιγής κατοικία
  MIXED_USE           // Μικτή χρήση
  COMMERCIAL          // Εμπορικό
  OFFICE              // Γραφεία
}

enum HeatingType {
  OIL                 // Πετρέλαιο
  GAS                 // Φυσικό αέριο
  DISTRICT            // Τηλεθέρμανση
  ELECTRIC            // Ηλεκτρικό
  NONE
}

// ============================================================
// BUILDING REGULATION — Κανονισμός Πολυκατοικίας
// ============================================================

model BuildingRegulation {
  id                String    @id @default(cuid())
  buildingId        String
  building          Building  @relation(fields: [buildingId], references: [id])
  
  version           Int       @default(1)
  validFrom         DateTime
  validUntil        DateTime?
  isActive          Boolean   @default(true)
  
  // Κανόνες ανελκυστήρα
  elevatorFloorCoefficient Float @default(0.10)  // 10% per floor
  elevatorGroundFloorIncluded Boolean @default(false)
  elevatorBasementIncluded    Boolean @default(false)
  
  // Κανόνες θέρμανσης
  heatingFixedShare     Float  @default(0.30)   // 30% σταθερό
  heatingVariableShare  Float  @default(0.70)   // 70% μεταβλητό
  heatingMethod         HeatingCalculationMethod @default(VOLUME)
  
  // Κανόνες αποθεματικού
  reserveFundPercentage Float  @default(0.10)   // 10% επί συνολικών
  
  content           String?   @db.Text   // Κείμενο κανονισμού
  
  createdAt         DateTime  @default(now())
}

enum HeatingCalculationMethod {
  VOLUME              // Ογκομετρικά
  METERS              // Θερμιδομετρητές (ΠΔ 1985)
  BTU                 // BTU θερμαντικών σωμάτων
  EQUAL               // Ισομερής
}

// ============================================================
// UNIT — Ιδιοκτησία (Διαμέρισμα / Κατάστημα / Γραφείο)
// ============================================================

model Unit {
  id              String      @id @default(cuid())
  buildingId      String
  building        Building    @relation(fields: [buildingId], references: [id])
  
  identifier      String      // "Α1", "Β2", "ΙΣ1" (κατάστημα ισογείου)
  unitType        UnitType    @default(APARTMENT)
  floor           Int         // -1=υπόγειο, 0=ισόγειο, 1=1ος, κ.ο.κ.
  area            Float       // τ.μ.
  volume          Float?      // m³ (εμβαδόν × ύψος)
  ceilingHeight   Float?      // ύψος ορόφου σε μ.
  
  // Αποκλεισμοί από κατηγορίες
  hasElevatorAccess  Boolean  @default(true)
  hasHeating         Boolean  @default(true)
  hasWaterMeter      Boolean  @default(false)
  
  // BTU θερμαντικών σωμάτων (αν χρησιμοποιείται)
  heatingBTU         Int?
  
  // Ιδιοκτήτης / Ενοικιαστής
  ownerships         Ownership[]
  
  // Πίνακας χιλιοστών (αυτόματος ή χειροκίνητος)
  millostosEntries   MillostosEntry[]
  
  // Μετρήσεις θέρμανσης
  heatingReadings    HeatingReading[]
  
  // Πληρωμές
  payments           Payment[]
  
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  
  @@unique([buildingId, identifier])
}

enum UnitType {
  APARTMENT           // Διαμέρισμα
  SHOP                // Κατάστημα
  OFFICE              // Γραφείο
  STORAGE             // Αποθήκη
  PARKING             // Θέση parking
  COMMON              // Κοινόχρηστος χώρος
}

// ============================================================
// OWNERSHIP — Ιδιοκτησία / Ενοικίαση
// ============================================================

model Ownership {
  id            String    @id @default(cuid())
  unitId        String
  unit          Unit      @relation(fields: [unitId], references: [id])
  userId        String
  user          User      @relation(fields: [userId], references: [id])
  
  role          OwnershipRole  @default(OWNER)
  percentage    Float          @default(100)   // Ποσοστό συνιδιοκτησίας
  validFrom     DateTime
  validUntil    DateTime?
  isActive      Boolean        @default(true)
  
  createdAt     DateTime  @default(now())
}

enum OwnershipRole {
  OWNER
  TENANT          // Ενοικιαστής — ευθύνη πληρωμής κοινοχρήστων
}

// ============================================================
// MILLOSTOS CONFIG — Πίνακας Χιλιοστών
// ============================================================

model MillostosConfig {
  id              String    @id @default(cuid())
  buildingId      String
  building        Building  @relation(fields: [buildingId], references: [id])
  
  name            String    // "Γενικά", "Ανελκυστήρας", "Θέρμανση"
  category        ExpenseCategory
  calculationMethod MillostosMethod  @default(AUTO)
  
  entries         MillostosEntry[]
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

enum MillostosMethod {
  AUTO            // Αυτόματος υπολογισμός βάσει εμβαδόν/όγκου
  MANUAL          // Χειροκίνητος (από κανονισμό)
  FLOOR_WEIGHTED  // Εμβαδόν × floor coefficient
}

model MillostosEntry {
  id                String          @id @default(cuid())
  configId          String
  config            MillostosConfig @relation(fields: [configId], references: [id])
  unitId            String
  unit              Unit            @relation(fields: [unitId], references: [id])
  
  value             Float           // 0-1000
  isExcluded        Boolean         @default(false)  // 0 αποκλεισμός
  
  validFrom         DateTime        @default(now())
  validUntil        DateTime?
  
  @@unique([configId, unitId])
}

// ============================================================
// EXPENSE PERIOD — Λογιστική Περίοδος
// ============================================================

model ExpensePeriod {
  id            String    @id @default(cuid())
  buildingId    String
  building      Building  @relation(fields: [buildingId], references: [id])
  
  year          Int
  month         Int       // 1-12
  status        PeriodStatus  @default(DRAFT)
  
  totalAmount   Float     @default(0)
  notes         String?
  
  expenses      Expense[]
  bills         UnitBill[]
  
  closedAt      DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  @@unique([buildingId, year, month])
}

enum PeriodStatus {
  DRAFT           // Προσχέδιο
  CALCULATED      // Υπολογισμένο
  SENT            // Αποσταλμένο σε ιδιοκτήτες
  CLOSED          // Κλειστό/Οριστικοποιημένο
}

// ============================================================
// EXPENSE — Δαπάνη
// ============================================================

model Expense {
  id              String          @id @default(cuid())
  buildingId      String
  building        Building        @relation(fields: [buildingId], references: [id])
  periodId        String
  period          ExpensePeriod   @relation(fields: [periodId], references: [id])
  
  category        ExpenseCategory
  subcategory     String?         // "Συντήρηση καυστήρα", "ΔΕΗ κοινοχρήστων", etc.
  description     String
  amount          Float
  vatAmount       Float           @default(0)
  totalAmount     Float           // amount + vatAmount
  
  // Παραστατικό
  invoiceNumber   String?
  invoiceDate     DateTime?
  vendorName      String?
  vendorAfm       String?
  
  // Κατανομή
  distributionType DistributionType @default(MILLOSTOS)
  millostosCategory ExpenseCategory?  // Ποιον πίνακα χιλιοστών χρησιμοποιεί
  
  // myDATA
  mydataStatus    MyDataStatus    @default(PENDING)
  mydataId        String?
  
  lineItems       ExpenseLineItem[]
  
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}

enum ExpenseCategory {
  GENERAL         // Γενικά κοινόχρηστα
  ELEVATOR        // Ανελκυστήρας
  HEATING         // Θέρμανση
  WATER           // Νερό
  MANAGEMENT      // Διαχείριση
  RESERVE_FUND    // Αποθεματικό
  ANTENNA         // Κεραία/τηλεόραση
  PARKING         // Χώρος στάθμευσης
  SECURITY        // Ασφάλεια/φύλαξη
  EXTRAORDINARY   // Έκτακτη δαπάνη
}

enum DistributionType {
  MILLOSTOS       // Βάσει χιλιοστών
  EQUAL           // Ισομερής
  AREA            // Βάσει τ.μ.
  FLOOR           // Ανά όροφο
  MANUAL          // Χειροκίνητα
  COMPOSITE       // Σύνθετος (π.χ. 70%+30%)
}

enum MyDataStatus {
  PENDING
  SUBMITTED
  ACCEPTED
  REJECTED
}

// ============================================================
// EXPENSE LINE ITEM — Ανάλυση Κατανομής
// ============================================================

model ExpenseLineItem {
  id              String    @id @default(cuid())
  expenseId       String
  expense         Expense   @relation(fields: [expenseId], references: [id])
  
  unitId          String
  millostosValue  Float     // χιλιοστά που χρησιμοποιήθηκαν
  amount          Float     // Ποσό για αυτή την ιδιοκτησία
  
  @@unique([expenseId, unitId])
}

// ============================================================
// UNIT BILL — Μηνιαίος Λογαριασμός ανά Ιδιοκτησία
// ============================================================

model UnitBill {
  id              String          @id @default(cuid())
  periodId        String
  period          ExpensePeriod   @relation(fields: [periodId], references: [id])
  unitId          String
  unit            Unit            @relation(fields: [unitId], references: [id])
  
  totalAmount     Float
  paidAmount      Float           @default(0)
  remainingAmount Float
  status          BillStatus      @default(PENDING)
  
  dueDate         DateTime?
  
  breakdown       BillBreakdownItem[]
  payments        Payment[]
  
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  
  @@unique([periodId, unitId])
}

enum BillStatus {
  PENDING
  PARTIALLY_PAID
  PAID
  OVERDUE
}

model BillBreakdownItem {
  id              String    @id @default(cuid())
  billId          String
  bill            UnitBill  @relation(fields: [billId], references: [id])
  
  category        ExpenseCategory
  description     String
  millostosValue  Float
  amount          Float
}

// ============================================================
// PAYMENT — Πληρωμή
// ============================================================

model Payment {
  id              String          @id @default(cuid())
  unitId          String
  unit            Unit            @relation(fields: [unitId], references: [id])
  billId          String?
  bill            UnitBill?       @relation(fields: [billId], references: [id])
  
  amount          Float
  paymentDate     DateTime
  method          PaymentMethod
  reference       String?         // αριθμός τραπεζικής συναλλαγής
  notes           String?
  
  receiptNumber   String?         // αριθμός απόδειξης
  
  createdAt       DateTime        @default(now())
}

enum PaymentMethod {
  CASH
  BANK_TRANSFER
  CHECK
  CARD
}

// ============================================================
// HEATING READING — Μετρήσεις Θερμιδομετρητών
// ============================================================

model HeatingReading {
  id              String    @id @default(cuid())
  unitId          String
  unit            Unit      @relation(fields: [unitId], references: [id])
  
  readingDate     DateTime
  periodYear      Int
  periodMonth     Int
  units           Float     // θερμιδικές μονάδες ή ώρες
  readingType     HeatingReadingType  @default(THERMOSTAT_HOURS)
  
  createdAt       DateTime  @default(now())
  
  @@unique([unitId, periodYear, periodMonth])
}

enum HeatingReadingType {
  THERMOSTAT_HOURS    // Ώρες θερμοστάτη
  HEAT_UNITS          // Θερμιδικές μονάδες
  BTU_RATIO           // BTU αναλογία
}

// ============================================================
// ANNOUNCEMENT — Ανακοινώσεις
// ============================================================

model Announcement {
  id              String    @id @default(cuid())
  buildingId      String
  title           String
  content         String    @db.Text
  isPublished     Boolean   @default(false)
  publishedAt     DateTime?
  
  createdAt       DateTime  @default(now())
}

// ============================================================
// AUDIT LOG — Ιστορικό Αλλαγών
// ============================================================

model AuditLog {
  id              String    @id @default(cuid())
  userId          String?
  buildingId      String?
  
  action          String    // CREATE_EXPENSE, CALCULATE_PERIOD, etc.
  entityType      String    // Expense, Unit, Payment
  entityId        String
  
  before          Json?
  after           Json?
  
  ipAddress       String?
  createdAt       DateTime  @default(now())
}
```

---

## 8. ΔΟΜΗ ΕΦΑΡΜΟΓΗΣ (Next.js 16.2+)

### 8.1 Δομή Φακέλων

```
koinoxrista-app/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── register/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                    # Dashboard layout με sidebar
│   │   ├── page.tsx                      # Overview
│   │   ├── buildings/
│   │   │   ├── page.tsx                  # Λίστα κτηρίων
│   │   │   ├── new/
│   │   │   │   └── page.tsx              # Νέο κτήριο
│   │   │   └── [buildingId]/
│   │   │       ├── page.tsx              # Dashboard κτηρίου
│   │   │       ├── units/
│   │   │       │   ├── page.tsx          # Λίστα ιδιοκτησιών
│   │   │       │   └── [unitId]/
│   │   │       │       └── page.tsx      # Ιδιοκτησία
│   │   │       ├── millostos/
│   │   │       │   └── page.tsx          # Πίνακας χιλιοστών
│   │   │       ├── expenses/
│   │   │       │   ├── page.tsx          # Δαπάνες
│   │   │       │   └── new/
│   │   │       │       └── page.tsx      # Νέα δαπάνη
│   │   │       ├── periods/
│   │   │       │   ├── page.tsx          # Λογιστικές περίοδοι
│   │   │       │   └── [periodId]/
│   │   │       │       ├── page.tsx      # Περίοδος
│   │   │       │       └── calculate/
│   │   │       │           └── page.tsx  # Υπολογισμός
│   │   │       ├── payments/
│   │   │       │   └── page.tsx          # Πληρωμές
│   │   │       └── reports/
│   │   │           └── page.tsx          # Αναφορές
│   │   └── settings/
│   │       └── page.tsx
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts              # Auth.js handler
│   │   ├── buildings/
│   │   │   ├── route.ts                  # GET, POST
│   │   │   └── [id]/
│   │   │       ├── route.ts              # GET, PUT, DELETE
│   │   │       ├── units/
│   │   │       │   └── route.ts
│   │   │       ├── millostos/
│   │   │       │   ├── route.ts          # GET, POST
│   │   │       │   └── calculate/
│   │   │       │       └── route.ts      # POST — αυτόματος υπολογισμός
│   │   │       ├── expenses/
│   │   │       │   └── route.ts
│   │   │       └── periods/
│   │   │           ├── route.ts
│   │   │           └── [periodId]/
│   │   │               ├── route.ts
│   │   │               ├── calculate/
│   │   │               │   └── route.ts  # POST — υπολογισμός κοινοχρήστων
│   │   │               └── bills/
│   │   │                   └── route.ts  # GET — λογαριασμοί ανά ιδιοκτησία
│   │   ├── units/
│   │   │   └── [id]/
│   │   │       ├── payments/
│   │   │       │   └── route.ts
│   │   │       └── heating/
│   │   │           └── route.ts
│   │   └── mydata/
│   │       └── submit/
│   │           └── route.ts              # myDATA submission
│   └── layout.tsx
├── components/
│   ├── ui/                               # shadcn components
│   ├── buildings/
│   │   ├── BuildingCard.tsx
│   │   └── BuildingForm.tsx
│   ├── millostos/
│   │   ├── MillostosTable.tsx           # Πίνακας χιλιοστών (editable)
│   │   └── MillostosCalculator.tsx      # Auto-calc component
│   ├── expenses/
│   │   ├── ExpenseForm.tsx
│   │   └── ExpenseList.tsx
│   ├── periods/
│   │   ├── PeriodDashboard.tsx
│   │   └── CalculationWizard.tsx        # Step-by-step υπολογισμός
│   ├── bills/
│   │   ├── BillCard.tsx
│   │   └── BillBreakdown.tsx
│   └── payments/
│       └── PaymentForm.tsx
├── lib/
│   ├── auth.ts                          # Auth.js config
│   ├── prisma.ts                        # Prisma client singleton
│   ├── calculations/
│   │   ├── millostos.ts                 # Αλγόριθμος χιλιοστών
│   │   ├── heating.ts                   # Αλγόριθμος θέρμανσης
│   │   ├── elevator.ts                  # Αλγόριθμος ανελκυστήρα
│   │   └── period.ts                    # Master calculation engine
│   ├── mydata/
│   │   └── client.ts                    # myDATA API client
│   └── validators/
│       ├── building.ts                  # Zod schemas
│       ├── expense.ts
│       └── millostos.ts
├── types/
│   └── index.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
└── .env
```

### 8.2 Κύριες Σελίδες και Λειτουργίες

| Σελίδα | Λειτουργία | Components |
|---|---|---|
| `/buildings` | Λίστα κτηρίων του χρήστη | BuildingCard, GSAP animate-in |
| `/buildings/new` | Wizard δημιουργίας κτηρίου (5 βήματα) | BuildingForm, shadcn Stepper |
| `/buildings/[id]` | Overview: χρεώσεις, ληξιπρόθεσμα, γράφημα | Dashboard cards |
| `/buildings/[id]/millostos` | Πίνακας χιλιοστών — επεξεργασία + auto-calc | MillostosTable (editable grid) |
| `/buildings/[id]/expenses` | Δαπάνες ανά κατηγορία | ExpenseList + filters |
| `/buildings/[id]/periods/[id]/calculate` | Step-by-step wizard υπολογισμού | CalculationWizard |
| `/buildings/[id]/periods/[id]` | Preview λογαριασμών πριν αποστολή | BillCard per unit |
| Unit owner view | Ο ιδιοκτήτης βλέπει μόνο τους δικούς του λογαριασμούς | BillBreakdown |

---

## 9. API ENDPOINTS

### 9.1 Buildings

```typescript
// GET /api/buildings
// Επιστρέφει κτήρια του authenticated user

// POST /api/buildings
// Body: { name, address, buildingType, totalFloors, hasElevator, hasHeating, ... }

// GET /api/buildings/[id]
// Πλήρεις πληροφορίες κτηρίου + stats

// PUT /api/buildings/[id]
// Ενημέρωση στοιχείων κτηρίου

// DELETE /api/buildings/[id]
// Μόνο admin, soft delete
```

### 9.2 Millostos (Πίνακας Χιλιοστών)

```typescript
// POST /api/buildings/[id]/millostos/calculate
// Body: { method: 'AUTO' | 'FLOOR_WEIGHTED', category: 'GENERAL' | 'ELEVATOR' | 'HEATING' }
// Response: { entries: [{ unitId, value, calculationBase }] }

// Αυτόματος υπολογισμός:
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { method, category } = await req.json();
  const units = await prisma.unit.findMany({ where: { buildingId: params.id } });
  const building = await prisma.building.findUnique({ 
    where: { id: params.id },
    include: { regulations: { where: { isActive: true }, take: 1 } }
  });
  
  const regulation = building.regulations[0];
  const entries = buildMillostosTable(units, category, regulation);
  
  // Validation: sum must equal 1000
  const total = entries.reduce((sum, e) => sum + e.value, 0);
  if (Math.abs(total - 1000) > 0.01) {
    return Response.json({ error: 'Millostos do not sum to 1000' }, { status: 422 });
  }
  
  return Response.json({ entries, total });
}
```

### 9.3 Period Calculation (Κεντρικός Υπολογισμός)

```typescript
// POST /api/buildings/[id]/periods/[periodId]/calculate
// Τρέχει τον master calculation engine

export async function POST(req: Request, { params }: { params: { id: string, periodId: string } }) {
  const period = await prisma.expensePeriod.findUnique({
    where: { id: params.periodId },
    include: {
      expenses: true,
      building: {
        include: {
          units: { include: { millostosEntries: true } },
          regulations: { where: { isActive: true }, take: 1 }
        }
      }
    }
  });

  if (period.status !== 'DRAFT') {
    return Response.json({ error: 'Period already calculated' }, { status: 409 });
  }

  // Τρέξε heating readings αν υπάρχουν μετρητές
  const heatingReadings = await prisma.heatingReading.findMany({
    where: { 
      unit: { buildingId: params.id },
      periodYear: period.year,
      periodMonth: period.month
    }
  });

  // Master calculation
  const bills = calculatePeriodBills(period, heatingReadings);
  
  // Persist
  await prisma.$transaction([
    ...bills.map(bill => 
      prisma.unitBill.upsert({
        where: { periodId_unitId: { periodId: params.periodId, unitId: bill.unitId } },
        create: { ...bill, periodId: params.periodId },
        update: bill
      })
    ),
    prisma.expensePeriod.update({
      where: { id: params.periodId },
      data: { 
        status: 'CALCULATED',
        totalAmount: bills.reduce((sum, b) => sum + b.totalAmount, 0)
      }
    })
  ]);

  return Response.json({ success: true, billCount: bills.length });
}
```

---

## 10. CALCULATION ENGINE (Πλήρης Υλοποίηση)

### 10.1 lib/calculations/period.ts

```typescript
import { ExpensePeriod, Unit, MillostosEntry, HeatingReading } from '@prisma/client';

export function calculatePeriodBills(
  period: ExpensePeriodWithIncludes,
  heatingReadings: HeatingReading[]
): UnitBillInput[] {
  
  const { expenses, building } = period;
  const { units, regulations } = building;
  const regulation = regulations[0];
  
  const billMap = new Map<string, UnitBillInput>();
  
  // Initialize bills for all units
  units.forEach(unit => {
    billMap.set(unit.id, {
      unitId: unit.id,
      totalAmount: 0,
      breakdown: []
    });
  });
  
  for (const expense of expenses) {
    let distribution: Map<string, number>;
    
    switch (expense.distributionType) {
      case 'MILLOSTOS':
        distribution = distributionByMillostos(
          expense.amount,
          units,
          expense.millostosCategory ?? expense.category
        );
        break;
        
      case 'EQUAL':
        distribution = equalDistribution(expense.amount, units);
        break;
        
      case 'COMPOSITE':
        // Ειδική περίπτωση θέρμανσης με μετρητές
        if (expense.category === 'HEATING' && regulation.heatingMethod === 'METERS') {
          distribution = heatingWithMeters(
            expense.amount,
            units,
            heatingReadings,
            regulation.heatingFixedShare,
            regulation.heatingVariableShare
          );
        } else {
          distribution = distributionByMillostos(expense.amount, units, expense.category);
        }
        break;
        
      default:
        distribution = distributionByMillostos(expense.amount, units, 'GENERAL');
    }
    
    // Προσθήκη στους λογαριασμούς
    distribution.forEach((amount, unitId) => {
      const bill = billMap.get(unitId)!;
      bill.totalAmount += amount;
      bill.breakdown.push({
        category: expense.category,
        description: expense.description,
        millostosValue: getMillostosValue(units.find(u => u.id === unitId)!, expense.category),
        amount
      });
    });
  }
  
  // Υπολογισμός remaining amount
  return Array.from(billMap.values()).map(bill => ({
    ...bill,
    paidAmount: 0,
    remainingAmount: bill.totalAmount,
    status: 'PENDING'
  }));
}

function distributionByMillostos(
  amount: number,
  units: UnitWithMillostos[],
  category: string
): Map<string, number> {
  const result = new Map<string, number>();
  
  units.forEach(unit => {
    const entry = unit.millostosEntries.find(e => e.config.category === category);
    const ratio = entry && !entry.isExcluded ? entry.value / 1000 : 0;
    result.set(unit.id, amount * ratio);
  });
  
  return result;
}
```

---

## 11. ΠΕΡΙΒΑΛΛΟΝ ΕΚΤΕΛΕΣΗΣ ΚΑΙ ΡΥΘΜΙΣΕΙΣ

### 11.1 .env

```env
DATABASE_URL="postgresql://user:password@localhost:5432/koinoxrista"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# myDATA API (ΑΑΔΕ)
MYDATA_USER_ID=""
MYDATA_SUBSCRIPTION_KEY=""
MYDATA_API_URL="https://mydataapidev.aade.gr"  # staging

# Email (για αποστολή λογαριασμών)
SMTP_HOST=""
SMTP_PORT=""
SMTP_USER=""
SMTP_PASS=""
```

### 11.2 Εξαρτήσεις

```json
{
  "dependencies": {
    "next": "^16.2.0",
    "@prisma/client": "^5.x",
    "next-auth": "^5.x",        // Auth.js v5
    "@auth/prisma-adapter": "^2.x",
    "zod": "^3.x",
    "gsap": "^3.x",
    "react-hook-form": "^7.x",
    "@hookform/resolvers": "^3.x",
    
    // shadcn dependencies
    "class-variance-authority": "^0.7.x",
    "clsx": "^2.x",
    "tailwind-merge": "^2.x",
    "@radix-ui/react-*": "latest",
    
    // PDF generation για λογαριασμούς
    "@react-pdf/renderer": "^3.x",
    
    // Excel export
    "xlsx": "^0.18.x",
    
    // Date handling
    "date-fns": "^3.x"
  },
  "devDependencies": {
    "prisma": "^5.x",
    "typescript": "^5.x",
    "@types/node": "^20.x",
    "@types/react": "^18.x"
  }
}
```

---

## 11b. DEEPSEEK OCR — ΑΡΧΙΚΟΠΟΙΗΣΗ ΚΤΗΡΙΟΥ ΑΠΟ ΚΑΝΟΝΙΣΜΟ

> Πλήρης τεχνική τεκμηρίωση στο αρχείο `DEEPSEEK_OCR_PROMPTS.md`

### Ροή Αρχικοποίησης Κτηρίου

```
PDF/Scan κανονισμού
        ↓
[pdf-parse ή Tesseract OCR]  ← αν χρειάζεται
        ↓
   Raw text κανονισμού
        ↓
DeepSeek API — Pass 1: EXTRACTION
  • System: EXTRACTION_SYSTEM_PROMPT (ορίζει JSON schema)
  • User: κείμενο κανονισμού
  • model: deepseek-chat, temperature: 0.1
  • response_format: { type: "json_object" }
        ↓
   ExtractedRegulation JSON
        ↓
DeepSeek API — Pass 2: VALIDATION
  • Ελέγχει: σύνολα χιλιοστών = 1000, consistency rules
  • Auto-fixes όσα μπορεί
  • Παράγει validationReport
        ↓
  confidence: HIGH/MEDIUM/LOW
        ↓
   HIGH/MEDIUM → auto-seed στη ΒΔ (seedBuildingFromExtraction)
   LOW → παρουσίαση για manual review + INTERACTIVE CLARIFICATION PROMPT
        ↓
  Wizard UI: εμφάνιση extracted data για επιβεβαίωση/διόρθωση
        ↓
   POST /api/buildings/extract-regulation?autoSeed=true
        ↓
  Κτήριο αρχικοποιημένο με: Building + Regulation + Units + MillostosTable
```

### Τι Εξάγεται Αυτόματα από τον Κανονισμό

| Στοιχείο | Αυτόματο | Από κανονισμό | Fallback |
|---|---|---|---|
| Στοιχεία κτηρίου (διεύθυνση κτλ.) | ✅ | Αν αναφέρεται | Χειροκίνητα |
| Λίστα ιδιοκτησιών + ορόφοι | ✅ | Από πίνακα | Χειροκίνητα |
| Εμβαδά (τ.μ.) | ✅ | Αν αναφέρεται | Χειροκίνητα |
| Πίνακας χιλιοστών | ✅ | Αν υπάρχει ρητός πίνακας | Auto-calc |
| Μέθοδος θέρμανσης (70%/30%) | ✅ | Από άρθρα κανονισμού | Default: VOLUME |
| Συντελεστής ανελκυστήρα | ✅ | Αν αναφέρεται | Default: 10% |
| Εξαιρέσεις ισογείου/υπογείου | ✅ | Από κανόνες | Default rules |
| Αποθεματικό % | ✅ | Αν αναφέρεται | null |
| Στοιχεία ιδιοκτητών | ✅ | Αν αναφέρονται | Χειροκίνητα |
| ΑΦΜ πολυκατοικίας | ✅ | Αν αναφέρεται | Χειροκίνητα |

### Σημεία Ενσωμάτωσης στη ΒΔ

```typescript
// Μετά το extraction, 1 transaction δημιουργεί:
// Building → BuildingRegulation → Unit[] → MillostosConfig[] → MillostosEntry[]

// Endpoint:
// POST /api/buildings/extract-regulation
// Body: FormData { regulation: File, autoSeed: boolean }
// Response: { buildingId, extraction, warnings }
```

---

## 12. ΠΡΟΤΕΙΝΟΜΕΝΗ ΣΕΙΡΑ ΥΛΟΠΟΙΗΣΗΣ

### Phase 1 — Foundation (Sprint 1-2)
1. Next.js project setup + Prisma + PostgreSQL
2. Auth.js authentication (email/password + Google)
3. Building CRUD (δημιουργία/επεξεργασία κτηρίου)
4. Unit management (ιδιοκτησίες)

### Phase 2 — Millostos Engine (Sprint 3)
5. MillostosConfig model + UI
6. Auto-calculation algorithm (GENERAL + ELEVATOR)
7. Manual override UI (editable πίνακας)
8. Validation (sum = 1000)

### Phase 3 — Expense & Calculation (Sprint 4-5)
9. Expense categories + CRUD
10. ExpensePeriod management
11. Master calculation engine
12. UnitBill generation

### Phase 4 — Heating Special Case (Sprint 6)
13. HeatingReading model + UI
14. Heating calculation με θερμιδομετρητές (70%/30%)
15. BTU method support

### Phase 5 — Payments & Reports (Sprint 7)
16. Payment recording
17. PDF λογαριασμός generation
18. Excel export
19. Overdue tracking

### Phase 6 — Compliance (Sprint 8)
20. myDATA API integration
21. ΑΦΜ management
22. Audit log

---

## 13. ΕΠΑΛΗΘΕΥΣΗ ΙΣΧΥΡΙΣΜΩΝ (Adversarial Check)

| Ισχυρισμός | Πηγή | Επαλήθευση | Status |
|---|---|---|---|
| Χιλιοστά ανελκυστήρα: +10% ανά όροφο | cityengineering.gr, koinoxrista.info | Τυπικός κανόνας — μπορεί να διαφέρει ανά κανονισμό | ✅ Επαληθεύτηκε |
| 70%/30% θέρμανση | ΠΔ 27.9.1985, billys.gr | Ορίζεται ρητά στο ΠΔ 1985 | ✅ Επαληθεύτηκε |
| Παραγραφή 5 ετών | ΑΚ 250 | Γενική παραγραφή αξιώσεων | ✅ Επαληθεύτηκε |
| myDATA από 1/1/2024 | Ν.5073/2023 | Υποχρεωτικό για κτήρια/συναλλαγές | ✅ Επαληθεύτηκε |
| 65% για τροποποίηση κανονισμού | Ν.1562/1985 | Ρητά στο νόμο | ✅ Επαληθεύτηκε |
| Ισόγεια εξαιρούνται ανελκ. | Τυπική πρακτική | Εξαρτάται από κανονισμό — **όχι απόλυτο** | ⚠️ Configurable |
| ΑΦΜ αλλαγή εντός 1 μήνα | ΑΑΔΕ οδηγίες | Διοικητική υποχρέωση, δεν απορρέει από συγκεκριμένο νόμο | ⚠️ Verify with ΑΑΔΕ |

---

## 14. ΠΗΓΕΣ

1. **billys.gr/koinochrista/pos-ipologizontai/** — Μέθοδοι υπολογισμού κοινοχρήστων
2. **billys.gr/blog/koinochrista/koinoxrista-polikatoikiwn-nomothesia/** — Πλήρης πίνακας νομοθεσίας
3. **billys.gr/blog/polikatoikia/forologikes-ypochreoseis-polykatoikias/** — Φορολογικές υποχρεώσεις
4. **koinoxrista.info/ypologismos-koinoxriston.php** — Σύστημα χιλιοστών
5. **proper.gr/online-ypologismos-koinoxriston-odigos/** — Οδηγός 2026
6. **polikatikia.gr/diaxirisi/koinohrista-ti-perilamvanoun/** — Κατηγορίες δαπανών
7. **cityengineering.gr/yphresies/ypologismos-pinaka-xilioston/** — Επαγγελματικός υπολογισμός πίνακα χιλιοστών
8. **ΠΔ 27.9.1985** (ΦΕΚ 631 Δ') — Κατανομή θέρμανσης
9. **Ν.1512/1985**, **Ν.5073/2023** — Νομοθετικές πηγές

---

*Τελευταία ενημέρωση: Ιούνιος 2026 | Έκδοση: 1.0*
*Για χρήση ως context σε Claude Code για ανάπτυξη εφαρμογής κοινοχρήστων*
