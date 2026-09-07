# Ροές της εφαρμογής ανά λειτουργία

**Έκδοση 1.0 — 7 Σεπτεμβρίου 2026.** Το έγγραφο περιγράφει με διαγράμματα (Mermaid) **κάθε λειτουργία** της πλατφόρμας Orithon: ποιος την ξεκινά, από ποια βήματα περνά, ποιες καταστάσεις παίρνει και τι ειδοποιήσεις παράγει. Απευθύνεται στα στελέχη της εταιρείας, στους πελάτες-διαχειριστές και σε εξωτερικούς συνεργάτες (π.χ. integrator SoftOne). Η τεχνική τεκμηρίωση ανά αρχείο βρίσκεται στο `docs/wiki`.

> Σύμβαση ρόλων: **Στέλεχος** = SUPER_ADMIN / ADMIN / MANAGER / EMPLOYEE (εταιρεία διαχείρισης) · **Διαχειριστής** = PROPERTY_ADMIN (πελάτης) · **Ιδιοκτήτης / Ένοικος** = PROPERTY_OWNER / PROPERTY_RESIDENT · **Συνεργάτης** = COLLABORATOR (προμηθευτής).

## 0. Χάρτης της εφαρμογής

```mermaid
flowchart TB
  subgraph PUB["Δημόσιο site (CMS, el/en)"]
    L["Αρχική · Τιμές · FAQ · Νέα · Επικοινωνία · Demo · Newsletter"]
  end
  subgraph CO["Επιφάνεια εταιρείας /super-admin · /admin · /staff"]
    C1["Πελάτες → Ιδιοκτησίες → Κτήρια → Μονάδες"]
    C2["Συντηρήσεις · Συμβάσεις έργου · Ετήσιο πρόγραμμα · Ημερολόγιο"]
    C3["Συνεργάτες & Προμηθευτές · Κατάλογος υπηρεσιών"]
    C4["Τιμολόγηση · Πακέτα · Πορτοφόλια · Viva"]
    C5["Ρυθμίσεις · Ρόλοι · Brand · Cron · Ενσωματώσεις (SoftOne)"]
    C6["CMS · Newsletter & συναινέσεις"]
  end
  subgraph CU["Επιφάνεια πελάτη /building · /owner · /portal"]
    U1["Κέντρο ελέγχου κτηρίου (διαχειριστής)"]
    U2["Λογαριασμοί κοινοχρήστων · Αιτήματα · Ανακοινώσεις · Αρχεία"]
    U3["Συνελεύσεις · Πίνακας ανακοινώσεων (signage)"]
  end
  subgraph MK["Επιφάνεια συνεργάτη /marketplace"]
    M1["Αναθέσεις · Αιτήματα προσφοράς · Συμβάσεις έργου · Υπηρεσίες & τιμές · Ομάδα"]
  end
  R["/report — Δήλωση βλάβης (όλοι, mobile-first)"]
  P["/print — Εκτυπωτικά"]
  PUB -->|εγγραφή / demo| CO
  CO <--> CU
  CO <--> MK
  CU --> R & P
  CO --> R & P
  MK --> R
```

## 1. Είσοδος, ρόλοι και επιφάνειες

Κάθε χρήστης έχει **έναν** ρόλο· ο ρόλος ορίζει την επιφάνεια (εταιρεία / πελάτης / συνεργάτης) και τα δικαιώματα από τον πίνακα «Ρόλοι» (RBAC, επεξεργάσιμος από τον Super Admin). Ο Super Admin μπορεί να δει την εφαρμογή «ως» άλλος χρήστης (View-as) με πλήρη καταγραφή.

```mermaid
sequenceDiagram
  autonumber
  actor U as Χρήστης
  participant A as Auth.js (credentials)
  participant R as RBAC (Role / RolePermission)
  participant S as Επιφάνεια
  U->>A: email + κωδικός
  A-->>U: session (ρόλος, εταιρεία, πελάτης)
  A->>R: φόρτωση δικαιωμάτων ρόλου (modules × view/create/edit/delete)
  R-->>S: δυναμικό μενού + guards σελίδων/actions
  S-->>U: αρχική ρόλου (/super-admin · /admin · /staff · /building · /owner · /portal · /marketplace)
  opt Αλλαγή κωδικού
    U->>A: αίτημα αλλαγής → OTP με email → νέος κωδικός
  end
  opt View-as (Super Admin)
    U->>S: επιλογή χρήστη → cookie impersonation → effective session
    S-->>U: banner «Έξοδος από προεπισκόπηση» · audit log
  end
```

```mermaid
flowchart LR
  A["Νέος χρήστης πελάτη<br/>(ανάθεση σε μονάδα)"] --> B{"Υπάρχει ήδη<br/>λογαριασμός με το email;"}
  B -- όχι --> C["Δημιουργία χρήστη + email καλωσορίσματος<br/>(αρχικός κωδικός)"]
  B -- ναι --> D["Ίδιος χρήστης, ένας ρόλος:<br/>ο ανώτερος (ADMIN > OWNER > RESIDENT)"]
  C & D --> E["Ένας χρήστης μπορεί να είναι ιδιοκτήτης σε ένα<br/>και ένοικος σε άλλο διαμέρισμα"]
```

## 2. Νέα πολυκατοικία με AI (onboarding)

```mermaid
sequenceDiagram
  autonumber
  actor S as Στέλεχος
  participant W as Wizard (split-screen)
  participant AI as DeepSeek agent
  participant DB as Βάση
  S->>W: περιγραφή κτηρίου με φυσική γλώσσα ή/και έγγραφα
  W->>AI: μηνύματα + εργαλεία (πρόταση δομής)
  AI-->>W: πελάτης, ιδιοκτησία, κτήριο, όροφοι, μονάδες, χιλιοστά, επαφές
  S->>W: διόρθωση / επιβεβαίωση στον πίνακα προεπισκόπησης
  W->>DB: createBuildingFromOnboarding (transaction)
  DB-->>S: /building/[id] έτοιμο · geocoding διεύθυνσης (MapTiler)
  Note over W,DB: Κόστος tokens → «AI Κόστη / Tokens» (markup Super Admin)
```

## 3. Πελάτες, ιδιοκτησίες, κτήρια, μονάδες, ένοικοι

```mermaid
flowchart TD
  CU["Πελάτης (φυσικό / νομικό πρόσωπο)<br/>= παραλήπτης τιμολόγησης"] --> PR["Ιδιοκτησία (managed ✓/✗)"]
  PR --> B["Κτήριο (διεύθυνση, όροφοι, ανελκυστήρας, χιλιοστά)"]
  B --> UN["Μονάδες (διαμέρισμα · κατάστημα · parking)"]
  UN --> OW["Ιδιοκτήτης"]
  UN --> RE["Ένοικος (occupancy με ημερομηνίες)"]
  PR --> MA["Διαχειριστής (ManagementAssignment)<br/>managed: στέλεχος · self-managed: πελάτης/ιδιοκτήτης"]
  B --> CA["Κοινόχρηστοι χώροι · Εγκαταστάσεις (InfraPoint) · Επαφές · Αρχεία · Στοιχεία διαχείρισης"]
  style CU fill:#f1efe6,stroke:#333
```

**Απομόνωση δεδομένων:** κάθε πελάτης βλέπει μόνο τα δικά του κτήρια, μονάδες, ενοίκους και ιδιωτικούς προμηθευτές· ο έλεγχος γίνεται σε κάθε server action (`requireBuildingCap`, `BuildingCaps`).

```mermaid
sequenceDiagram
  autonumber
  actor M as Διαχειριστής / Στέλεχος
  participant B as Κτήριο
  participant U as Μονάδα
  participant E as Email
  M->>U: «Ανάθεση» ιδιοκτήτη ή ενοίκου (όνομα, email, ημερομηνίες)
  U->>U: createOccupant / assignOccupant (ή μαζικά)
  U-->>E: πρόσκληση με στοιχεία εισόδου (μία φορά ανά email)
  M->>U: λήξη μίσθωσης → setOccupancyDates / clearOccupant
  U-->>B: ιστορικό ενοικιάσεων · τα κοινόχρηστα κατανέμονται στον ένοικο της περιόδου
```

## 4. Έξοδα και κοινόχρηστα

Η κεντρική οικονομική ροή: από το παραστατικό μέχρι το ειδοποιητήριο και την είσπραξη.

```mermaid
flowchart TD
  A["Παραστατικό (φωτογραφία / PDF)"] --> B["OCR + AI εξαγωγή<br/>προμηθευτής, ΑΦΜ, αριθμός, ημερομηνία, καθαρό, ΦΠΑ"]
  B --> C["Έξοδο DRAFT → έλεγχος → CONFIRMED<br/>κατηγορία · βάση κατανομής · % ενοίκων/ιδιοκτητών · μήνας"]
  C --> D{"Βάση κατανομής"}
  D -->|"Χιλιοστά κοινοχρήστων"| E1["αναλογία ανά μονάδα"]
  D -->|"Χιλιοστά ανελκυστήρα"| E2
  D -->|"Χιλιοστά θέρμανσης / 70-30 με ενδείξεις"| E3
  D -->|"Ισόποσα ανά μονάδα"| E4
  E1 & E2 & E3 & E4 --> F["ExpenseAllocation ανά μονάδα<br/>unitShare · ownerAmount · tenantAmount"]
  F --> G["Έκδοση κοινοχρήστων μήνα<br/>includeExpensesInIssuance → status ISSUED, issuedMonth"]
  G --> H["Ειδοποιητήρια: οθόνη ιδιοκτήτη/ενοίκου · email με Word/PDF · Εκτυπωτικά"]
  H --> I["Πληρωμές: καταχώρηση από διαχειριστή (μετρητά, τράπεζα, κάρτα)<br/>ή Viva quick-pay του ακινήτου (gated)"]
  I --> J["Κατάσταση πληρωμών · υπενθυμίσεις · απόδειξη είσπραξης"]
```

```mermaid
stateDiagram-v2
  [*] --> DRAFT: OCR / χειροκίνητη καταχώρηση
  DRAFT --> CONFIRMED: έλεγχος στελέχους / διαχειριστή
  CONFIRMED --> ISSUED: έκδοση κοινοχρήστων μήνα (κλείδωμα ποσών)
  CONFIRMED --> DRAFT: διόρθωση
  ISSUED --> [*]
  note right of ISSUED: Οι κατανομές είναι οριστικές — διορθώσεις μόνο με νέα εγγραφή
```

Χιλιοστά: τρία σετ (γενικά, ανελκυστήρα, θέρμανσης). Χωρίς κανονισμό υπολογίζονται αυτόματα βάσει νόμου (τ.μ., όροφος) με δυνατότητα χειροκίνητης παράκαμψης ανά μονάδα.

```mermaid
sequenceDiagram
  autonumber
  actor O as Ιδιοκτήτης / Ένοικος
  participant P as /owner/payments · /portal/payments
  participant V as Viva (λογαριασμός του ακινήτου)
  participant DB as Βάση
  O->>P: «Πληρωμή» ανεξόφλητων αναλογιών (αν ενεργό για το ακίνητο)
  P->>V: createPropertyVivaOrder (ποσό, κωδικός παραγγελίας)
  V-->>O: σελίδα πληρωμής Viva
  V-->>P: επιστροφή + επαλήθευση συναλλαγής (server-side)
  P->>DB: allocation.paid = true, μέθοδος VIVA, ημερομηνία
  DB-->>O: απόδειξη · ενημέρωση υπολοίπου
```

## 5. Ενδείξεις θέρμανσης

```mermaid
flowchart LR
  A["Καταχώρηση ενδείξεων ανά μονάδα και περίοδο<br/>(προηγούμενη · τρέχουσα → κατανάλωση)"] --> B["Έξοδο θέρμανσης με βάση METERED_70_30"]
  B --> C["70 % κατά κατανάλωση · 30 % κατά χιλιοστά θέρμανσης"]
  C --> D["Αναλογίες μονάδων · οι ενδείξεις τυπώνονται στο ειδοποιητήριο"]
```

## 6. Δήλωση βλάβης και συντηρήσεις

Μία σελίδα `/report` για όλους (mobile-first, φωτογραφία). Ο κανόνας κάλυψης αποφασίζει αν η βλάβη καλύπτεται από τη σύμβαση διαχείρισης ή χρειάζεται προσφορά.

```mermaid
sequenceDiagram
  autonumber
  actor R as Δηλών (ένοικος · ιδιοκτήτης · διαχειριστής · στέλεχος · συνεργάτης)
  participant F as /report
  participant MR as MaintenanceRequest
  participant CR as Κανόνες κάλυψης & SLA
  participant N as Ειδοποιήσεις (bell + email)
  R->>F: κτήριο, μονάδα, κατηγορία, περιγραφή, φωτογραφίες
  F->>MR: createMaintenanceRequest (status OPEN)
  MR->>CR: κατηγορία × managed × κανόνας → covered ✓/✗ · slaDueAt
  CR-->>MR: covered, προθεσμία SLA
  MR-->>N: στέλεχος υπεύθυνος · διαχειριστής κτηρίου
  alt Καλύπτεται
    N-->>R: «Το αίτημά σας παρελήφθη»
  else Δεν καλύπτεται
    MR->>MR: ανοίγει RFQ (βλ. §7) → προσφορά προς τον πελάτη
  end
```

```mermaid
stateDiagram-v2
  [*] --> OPEN
  OPEN --> ACKNOWLEDGED: ανάληψη από στέλεχος (assignRequest)
  ACKNOWLEDGED --> SCHEDULED: ραντεβού / ανάθεση συνεργάτη (assignRequestSupplier)
  SCHEDULED --> IN_PROGRESS: έναρξη εργασιών
  IN_PROGRESS --> ON_HOLD: αναμονή ανταλλακτικών / πρόσβασης
  ON_HOLD --> IN_PROGRESS
  IN_PROGRESS --> COMPLETED: ολοκλήρωση + σχόλιο / φωτογραφίες
  OPEN --> CANCELLED
  ACKNOWLEDGED --> CANCELLED
  COMPLETED --> [*]
  note right of SCHEDULED: Εξοπλισμός περιορισμένης πρόσβασης — offerSlots, ο ένοικος επιλέγει (bookSlot)
```

```mermaid
flowchart LR
  E["Κάθε αλλαγή κατάστασης / σχόλιο"] --> B["Καμπανάκι (in-app, SSE realtime)"]
  E --> M["Email με πρότυπο Orithon"]
  E --> H["Ιστορικό (MaintenanceStatusEvent)"]
  S["SLA"] --> D{"Λήγει;"}
  D -- ναι --> W["Επισήμανση «εκτός SLA» στο dashboard"]
```

## 7. Αίτημα προσφοράς → σύμβαση έργου → παραλαβή

Back-to-back: ο συνεργάτης δίνει **τιμή συνεργάτη**, η εταιρεία προωθεί **τιμή πελάτη** (με περιθώριο), δημιουργούνται δύο συμβάσεις (Α πελάτης↔εταιρεία, Β εταιρεία↔συνεργάτης). Αναλυτικά στο [flows/suppliers.md](suppliers.md).

```mermaid
sequenceDiagram
  autonumber
  actor St as Στέλεχος
  actor Su as Συνεργάτης
  actor Cu as Διαχειριστής (πελάτης)
  participant RFQ as ServiceRequest (RFQ)
  participant WO as WorkOrder
  St->>RFQ: createRfq (από βλάβη ή ετήσιο πρόγραμμα) → προσκλήσεις σε συνεργάτες (email)
  Su->>RFQ: submitOffer (καθαρό, ΦΠΑ, γραμμές, εγγύηση, νωρίτερη ημερομηνία) ή declineRfq
  St->>RFQ: forwardOffer → τιμή πελάτη = τιμή συνεργάτη × (1 + περιθώριο)
  RFQ->>WO: WorkOrder PENDING_CUSTOMER + Σύμβαση Α (πρότυπο Markdown, έκδοση)
  Cu->>WO: respondWorkOrder αποδοχή / απόρριψη
  WO->>Su: ανάθεση + Σύμβαση Β
  Su->>WO: supplierAcceptWorkOrder → scheduleWorkOrder (ημερομηνία)
  Su->>WO: startWorkOrder → completeWorkOrder (φωτογραφίες, σημειώσεις)
  Cu->>WO: confirmWorkOrder (παραλαβή) — ή σιωπηρή παραλαβή από το cron μετά τις εργάσιμες της ρύθμισης
  WO-->>St: τιμολόγηση: τιμολόγιο συνεργάτη (PURDOC) · τιμολόγιο πελάτη (SALDOC) — Φάση SoftOne
```

```mermaid
stateDiagram-v2
  state RFQ {
    [*] --> OPEN
    OPEN --> OFFERED: προσφορά
    OFFERED --> FORWARDED: προώθηση στον πελάτη
    FORWARDED --> ACCEPTED
    FORWARDED --> DECLINED
    OPEN --> EXPIRED: προθεσμία χωρίς προσφορές (cron)
    OPEN --> CANCELLED
  }
  state WorkOrder {
    [*] --> PENDING_CUSTOMER
    PENDING_CUSTOMER --> ACCEPTED
    PENDING_CUSTOMER --> DECLINED
    ACCEPTED --> SCHEDULED
    SCHEDULED --> IN_PROGRESS
    IN_PROGRESS --> COMPLETED
    COMPLETED --> CONFIRMED: παραλαβή / σιωπηρή
    COMPLETED --> DISPUTED
    DISPUTED --> CONFIRMED
    ACCEPTED --> CANCELLED
  }
```

## 8. Ετήσιο πρόγραμμα συντηρήσεων και στοιχεία διαχείρισης

```mermaid
flowchart TD
  MI["Στοιχεία διαχείρισης (ManagedItem)<br/>ανελκυστήρας · καυστήρας · πυρασφάλεια · ..."] --> RT["Τακτική εργασία (RecurringTask)<br/>συχνότητα · υπεύθυνος · συνεργάτης"]
  RT --> OC["Εμφανίσεις στο Ημερολόγιο (/staff/calendar)"]
  OC --> RM["Υπενθύμιση email Ν ημέρες πριν (cron 07:00)"]
  OC --> OP["openProgrammeOccurrence → βλάβη/ανάθεση ή RFQ στον συνεργάτη του προγράμματος"]
  OP --> LG["Καταγραφή συντήρησης (MaintenanceLog) + έγγραφο"]
  LG --> OB["Πίνακας υποχρεώσεων διαχειριζόμενων κτηρίων<br/>(/super-admin/managed-buildings: εκκρεμή · εκπρόθεσμα · ιστορικό)"]
```

## 9. Ανακοινώσεις

```mermaid
sequenceDiagram
  autonumber
  actor A as Στέλεχος / Διαχειριστής
  participant AN as Announcement
  participant T as Παραλήπτες
  participant SG as Signage (/signage)
  A->>AN: createAnnouncement (τίτλος, κείμενο, εικόνα, κοινό: όλοι · ιδιοκτήτες · ένοικοι · επιλεγμένοι, λήξη)
  AN->>T: email με πρότυπο Orithon + καμπανάκι
  AN->>SG: εμφάνιση στον πίνακα ανακοινώσεων του κτηρίου (TV board, auto-refresh SSE)
  AN-->>A: εμφανίζεται στο /building · /owner · /portal · Εκτυπωτικά «Ανακοίνωση για τον πίνακα»
```

## 10. Συνελεύσεις (ηλεκτρονικές)

```mermaid
sequenceDiagram
  autonumber
  actor M as Διαχειριστής / Στέλεχος
  participant AS as Assembly
  participant D as Daily (video)
  participant AI as AI πρακτικά
  actor P as Συμμετέχοντες
  M->>AS: createAssembly (τίτλος, ημερομηνία) → πρόσκληση email + Εκτυπωτικά «Πρόσκληση»
  AS->>D: ensureRoom (ένα δωμάτιο ανά κτήριο), tokens ανά συμμετέχοντα
  P->>D: συμμετοχή (καταγραφή παρουσίας/διάρκειας)
  M->>AS: endAssembly → status ENDED → TRANSCRIBING
  D-->>AS: απομαγνητοφώνηση (webhook, replay-protected)
  AS->>AI: generateMinutes → DRAFT_READY (θέματα, αποφάσεις, εκκρεμότητες)
  M->>AS: επεξεργασία → approveAndSendMinutes → APPROVED → SENT (email σε όλους)
  Note over AS: Κόστος λεπτών: μετρημένη χρέωση στο πορτοφόλι του πελάτη (metered + προπληρωμένα λεπτά)
```

```mermaid
stateDiagram-v2
  [*] --> SCHEDULED
  SCHEDULED --> LIVE
  LIVE --> ENDED
  ENDED --> TRANSCRIBING
  TRANSCRIBING --> DRAFT_READY
  DRAFT_READY --> APPROVED
  APPROVED --> SENT
  SCHEDULED --> CANCELLED
  SENT --> [*]
```

## 11. Συνεργάτες και προμηθευτές

```mermaid
flowchart LR
  subgraph OR["Μητρώο Orithon (εταιρεία)"]
    S1["Συνεργάτης (Supplier)<br/>υπηρεσίες με τιμές · προϊόντα · ωράρια · περιοχές · ομάδα (COLLABORATOR χρήστες)"]
  end
  subgraph PV["Ιδιωτικά μητρώα πελατών"]
    S2["Οι προμηθευτές μου (ανά πελάτη, αόρατοι στους άλλους)"]
  end
  CAT["Κατάλογος υπηρεσιών (45 βασικές · 11 κατηγορίες)"] --> S1
  S1 --> RK["Κατάταξη (βαθμολογία · απόκριση · ολοκληρώσεις)"]
  RK --> RFQ["Προσκλήσεις σε RFQ"]
  INQ["Εκδήλωση ενδιαφέροντος συνεργάτη (δημόσια φόρμα, GDPR)"] --> S1
  S2 --> AS["Απευθείας ανάθεση από τον διαχειριστή"]
```

## 12. Πακέτα υπηρεσιών, τιμολόγηση και πορτοφόλια

```mermaid
flowchart TD
  SV["Υπηρεσίες (Service) · Πακέτα χρεώσεων (metered plans)"] --> PS["PropertyService: τι έχει επιλέξει κάθε ακίνητο"]
  PS --> INV["ServiceInvoice ανά μήνα (period YYYY-MM)"]
  INV --> V["Viva (λογαριασμός εταιρείας)<br/>createVivaOrder → πληρωμή → επαλήθευση"]
  V --> PAID["INVOICE PAID · απόδειξη email"]
  PS --> W["Πορτοφόλι πελάτη (Wallet)"]
  CR["Cron 1η μήνα: runMonthlyAllowance"] --> W
  W --> MT["Μετρημένη χρήση (recordMeteredUsage): λεπτά συνέλευσης, AI, κ.λπ."]
  MT --> LB{"Χαμηλό υπόλοιπο;"}
  LB -- ναι --> NT["Ειδοποίηση + προπληρωμή (addPrepaidMinutes)"]
  AIC["AI Κόστη / Tokens (πραγματικό κόστος × markup)"] --> W
```

```mermaid
sequenceDiagram
  autonumber
  actor M as Διαχειριστής
  participant PK as Ρυθμίσεις → Πακέτα
  participant V as Viva (εταιρεία)
  participant DB as Βάση
  M->>PK: επιλογή υπηρεσιών → setPropertyService
  PK->>DB: ServiceInvoice PENDING (μήνας)
  M->>V: πληρωμή
  V-->>PK: callback → επαλήθευση getVivaTransaction
  PK->>DB: INVOICE PAID · PropertyService ενεργό
```

## 13. Αρχεία και έγγραφα

```mermaid
flowchart LR
  U["Μεταφόρτωση (παραστατικά, φωτογραφίες, πιστοποιητικά, πρακτικά)"] --> R["Μετατροπή εικόνων σε WebP ≤1920px"]
  R --> C["Bunny CDN (private paths ανά κτήριο)"]
  C --> F["BuildingFile με κατηγορία · ορατότητα (δημόσια κατηγορίες → ένοικοι)"]
  F --> P["/portal/files · /owner · κέντρο ελέγχου κτηρίου"]
  E["Απόδειξη εξόδου"] --> F
  E --> S["Σύνδεσμος στο ειδοποιητήριο (οθόνη)"]
```

## 14. Εκτυπωτικά

```mermaid
flowchart LR
  H["/print (hub): κτήριο · περίοδος · φόρμα ανά έντυπο"] --> D["/print/[doc]?building&month&..."]
  D --> L["Loaders (read-only): κτήριο, μονάδες, περίοδος, κατανομές, συνελεύσεις, ανακοινώσεις"]
  L --> S["buildUnitStatement (ίδια μηχανή με τα ειδοποιητήρια οθόνης)"]
  S --> A4["Φύλλο Α4 με brand, meta, υπογραφή, αριθμό εντύπου"]
  A4 --> O["Εκτύπωση · Αποθήκευση PDF · email"]
  subgraph DOCS["9 έντυπα"]
    N["Ειδοποιητήριο (ανά διαμέρισμα)"]:::d
    SU["Συγκεντρωτική"]:::d
    EX["Ανάλυση εξόδων"]:::d
    PY["Κατάσταση πληρωμών"]:::d
    RC["Απόδειξη είσπραξης"]:::d
    PR["Πρόταση δαπάνης"]:::d
    IN["Πρόσκληση ΓΣ"]:::d
    MI["Πρακτικά"]:::d
    AN["Ανακοίνωση πίνακα"]:::d
  end
  D --> DOCS
  classDef d fill:#f1efe6,stroke:#333
```

## 15. Δημόσιο site, CMS και GDPR

```mermaid
flowchart TD
  CMS["CMS (Super Admin): Αρχική (ενότητες drag&drop) · Σελίδες · Τιμές · FAQ · Άρθρα · Συγγραφείς · Media · Μεταφράσεις (AI) · SEO · Ρυθμίσεις site"] --> SITE["Δημόσιο site el / en (next-intl, sitemap, robots, JSON-LD)"]
  SITE --> CF["Φόρμα επικοινωνίας → ContactMessage (συναίνεση, IP, ώρα)"]
  SITE --> DM["Αίτημα demo → DemoRequest (συναίνεση)"]
  SITE --> NL["Newsletter → double opt-in"]
  CF & DM & NL --> REG["Μητρώο συναινέσεων (/super-admin/cms/newsletter): εξαγωγή CSV, διαγραφή, οριστική διαγραφή"]
  SITE --> CK["Consent mode (cookies) → GA / GTM / Pixel μόνο μετά από συναίνεση"]
```

```mermaid
sequenceDiagram
  autonumber
  actor V as Επισκέπτης
  participant F as Φόρμα newsletter
  participant DB as NewsletterSubscriber
  participant E as Email
  V->>F: email + αποδοχή κειμένου συναίνεσης (έκδοση)
  F->>DB: PENDING (token, IP, ώρα, κείμενο συναίνεσης)
  F->>E: email επιβεβαίωσης με σύνδεσμο
  V->>DB: /confirm?token → CONFIRMED
  V->>DB: /unsubscribe?token (one-click σε κάθε email) → UNSUBSCRIBED (κρατείται ίχνος)
  Note over DB: «Οριστική διαγραφή» από τον Super Admin σβήνει τα δεδομένα (δικαίωμα διαγραφής)
```

## 16. Ειδοποιήσεις, email και realtime

```mermaid
flowchart LR
  EV["Γεγονός (βλάβη, προσφορά, κοινόχρηστα, ανακοίνωση, συνέλευση, cron)"] --> NT["Notification (καμπανάκι) ανά χρήστη"]
  EV --> EM["lib/email-template renderEmail: λογότυπο & στοιχεία εταιρείας (Ρυθμίσεις → Brand/Εταιρία)"]
  EM --> MG["Mailgun"]
  EM -.->|"μη-production: EMAIL_REDIRECT_TO"| RD["μία διεύθυνση δοκιμών"]
  EV --> BUS["In-process bus → /api/realtime (SSE)"]
  BUS --> UI["AutoRefresh: signage · κέντρο κτηρίου · portal · owner · καμπανάκι"]
```

## 17. Αυτόματες εργασίες (cron μέσα στην εφαρμογή)

```mermaid
flowchart TD
  ST["Εκκίνηση server (instrumentation.ts)"] --> SC["Scheduler: έλεγχος κάθε 5′ (production ή CRON_IN_PROCESS=true)"]
  SC --> D1["Καθημερινά μετά τις 07:00 (Athens)"]
  SC --> M1["1η κάθε μήνα μετά τις 06:00"]
  D1 --> J1["work-orders: σιωπηρή παραλαβή · υπενθύμιση διαχειριστή μία μέρα πριν · λήξη RFQ χωρίς προσφορές"]
  D1 --> J2["maintenance-reminders: email Ν ημέρες πριν από τακτική συντήρηση"]
  M1 --> J3["monthly-allowance: πίστωση πορτοφολιών"]
  J1 & J2 & J3 --> LOG["CronRun (ιστορικό) → Ρυθμίσεις → Αυτόματες εργασίες («Εκτέλεση τώρα»)"]
  EXT["/api/cron/* με x-cron-secret (προαιρετικός εξωτερικός trigger)"] --> J1 & J2 & J3
```

## 18. SoftOne ERP (Φάση Α/Β — προς συμφωνία)

Η διασύνδεση περιγράφεται στην [Προδιαγραφή διασύνδεσης Orithon ↔ SoftOne](../../softone/integration-spec.md) (ενότητα 5α: διαγράμματα ροών). Συνοπτικά:

```mermaid
flowchart LR
  C["Πελάτες"] -->|CUSTOMER| S1[("SoftOne")]
  S["Συνεργάτες"] -->|SUPPLIER| S1
  B["Κτήρια"] -->|PRJC| S1
  K["Κατάλογος υπηρεσιών / προϊόντα"] -->|SERVICE / ITEM| S1
  W["Σύμβαση έργου"] -->|"CNTR A + CNTR B (back-to-back)"| S1
  P["Πακέτο διαχείρισης"] -->|"CNTR περιοδική (μηνιαία)"| S1
  I["Τιμολόγια (Φάση Β)"] -->|SALDOC / PURDOC| S1
  S1 -->|"υπόλοιπα · παραστατικά (Φάση Β)"| O["Orithon"]
```

---

*Πίνακας αντιστοίχισης λειτουργίας → κώδικα:* §1 `auth.ts`, `lib/rbac/*`, `lib/impersonation.ts` · §2 `lib/ai/*`, `app/actions/building-onboarding.ts` · §3 `app/actions/{customers,properties,buildings,unit-occupants}.ts` · §4 `app/actions/building-expenses.ts`, `app/actions/koinochrista.ts`, `lib/building/statement.ts`, `lib/payments/koinochrista-pay.ts` · §5 `lib/heating-readings.ts` · §6 `app/actions/maintenance-requests.ts`, `lib/maintenance.ts` · §7 `app/actions/rfq.ts`, `lib/rfq*.ts`, `lib/contracts.ts` · §8 `app/actions/{recurring-tasks,maintenance-program,managed-items}.ts` · §9 `app/actions/announcements.ts` · §10 `app/actions/assemblies.ts`, `lib/daily.ts` · §11 `app/actions/suppliers.ts`, `lib/supplier-ranking.ts` · §12 `app/actions/property-package.ts`, `lib/wallet/*`, `lib/viva.ts` · §13 `app/actions/building-files.ts`, `lib/bunnycdn.ts` · §14 `lib/print/*` · §15 `lib/cms/*`, `lib/newsletter.ts` · §16 `lib/notify.ts`, `lib/email-template.ts`, `lib/realtime/*` · §17 `lib/cron/*` · §18 `lib/softone/*`.
