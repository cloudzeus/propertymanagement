# Spec: Ενέργειες εργασιών — πλήρη μενού ενεργειών σε βλάβες, RFQ και συμβάσεις έργου

**Date:** 2026-10-21
**Status:** Approved (brainstorming)
**Υπο-έργο:** 1 από 5 του προγράμματος «λιγότερες σελίδες, πλουσιότερα μενού» (βλ. §0)
**Builds on:** Κέντρο εργασιών (`lib/work/*`, `app/(company)/admin/work/*`), DataTable (`components/ui/data-table.tsx`), βλάβες (`app/actions/maintenance-requests.ts`, `components/maintenance/*`), RFQ/συμβάσεις (`app/actions/rfq.ts`, `lib/rfq.ts`, `lib/rfq-shared.ts`), dynamic RBAC (`lib/rbac/*`), wiki (`docs/wiki/pages`, `lib/help/coverage.test.ts`).

## 0. Πρόγραμμα και σειρά

Αίτημα χρήστη: «οι διαχειριστές, managers, υπάλληλοι να έχουν πολλές επιλογές στα dropdown menus σε πολλαπλές λειτουργίες και πολύ πιο εύκολο navigation — να μην χρειάζεται να πηγαινοέρχονται σε 100 σελίδες για να ολοκληρώσουν μια εργασία».

Ο χρήστης επέλεξε και τους τρεις μηχανισμούς (ενέργειες ανά γραμμή, κουμπί «Ενέργειες» + ⌘K, υπομενού sidebar) και τέσσερις ροές. Το πρόγραμμα σπάει σε πέντε υπο-έργα, το καθένα με δικό του spec/plan, με αυτή τη σειρά:

| # | Υπο-έργο | Κατάσταση |
|---|---|---|
| 1 | **Ενέργειες εργασιών** (αυτό το spec): πλήρη μενού ενεργειών σε Κέντρο εργασιών / Βλάβες / Συμβάσεις / RFQ, κουμπί «Ενέργειες» στη βλάβη, νέα σελίδα σύμβασης | Εγκρίθηκε |
| 2 | Command palette ⌘K / Ctrl+K (μετάβαση σε κτήριο/βλάβη/πελάτη/σελίδα, ενέργειες) | Επόμενο |
| 3 | Σελίδα κτηρίου για ADMIN/MANAGER (πλήρης, scope ανά MANAGER) + ροή έξοδο → έκδοση κοινοχρήστων → εκτυπωτικά → ανακοίνωση από ένα κουμπί «Ενέργειες» | Αποφασίστηκε «ναι, πλήρης» |
| 4 | Αλυσίδα πελάτης → ακίνητο → κτήριο → μονάδες → ένοικοι με ενέργειες ανά γραμμή | Επόμενο |
| 5 | Υπομενού/flyouts στο sidebar | Τελευταίο |

Αποφάσεις προϊόντος που ισχύουν σε όλο το πρόγραμμα (απαντήσεις χρήστη 2026-10-21):
- Το προσωπικό (SUPER_ADMIN/ADMIN/MANAGER) **μπορεί να αποδέχεται προσφορά και να επιβεβαιώνει παραλαβή έργου εκ μέρους του πελάτη**, με υποχρεωτική σημείωση (ποιος/πώς συμφώνησε) που καταγράφεται στο ιστορικό.
- **Ραντεβού σε κάθε βλάβη**, όχι μόνο στις «περιορισμένης πρόσβασης».
- Στη σελίδα βλάβης η παλιά κάρτα «Ενέργειες» αφαιρείται· όλα πάνε στο κουμπί «Ενέργειες».
- Νέα σελίδα λεπτομέρειας σύμβασης `/admin/work-orders/[id]`.

## 1. Σημερινή κατάσταση (ΠΡΙΝ)

Καταγραφή από τον κώδικα (2026-10-21):

- **Από λίστα** γίνονται μόνο δύο πράγματα: αλλαγή κατάστασης βλάβης και ανάθεση σε υπάλληλο (Κέντρο εργασιών, kanban στα homes). Η λίστα `/admin/maintenance` έχει μόνο «Προβολή». Η λίστα `/admin/work-orders` έχει μόνο «Άνοιγμα βλάβης». Το `/staff/rfq` έχει Αποστολή ξανά / Προσθήκη συνεργατών / Ακύρωση.
- **Μόνο μέσα στη σελίδα βλάβης** `/admin/maintenance/[id]`: ανάθεση σε συνεργάτη (+ προτιμώμενος), εκτίμηση διάρκειας, δήλωση slots, κλείσιμο/διαγραφή slot, σχόλιο προς ένοικο / εσωτερικό, αξιολόγηση συνεργάτη, προώθηση προσφοράς στον πελάτη, προγραμματισμός σύμβασης.
- **Ραντεβού** εμφανίζεται μόνο αν `restrictedAccess`. Για τις υπόλοιπες βλάβες δεν υπάρχει UI ραντεβού (μόνο η κατάσταση «Προγραμματισμένη»).
- **Δεν υπάρχει σελίδα σύμβασης**: μόνο `/admin/work-orders/[id]/contract/[side]` (προβολή συμβολαίου). Οι γραμμές συμβάσεων στο Κέντρο εργασιών οδηγούν στη βλάβη.
- **Εκ μέρους πελάτη**: ο server (`respondWorkOrder`, `confirmWorkOrder`) ήδη επιτρέπει SA/ADMIN/MANAGER, αλλά χωρίς σημείωση και χωρίς κανένα κουμπί στο admin UI.
- Τυπική ροή «νέα βλάβη → ανάθεση συνεργάτη → ραντεβού»: λίστα → σελίδα βλάβης → select συνεργάτη → κουμπί → scroll → εκτίμηση → slot → πίσω στη λίστα. Ροή «βλάβη → RFQ → προσφορά → σύμβαση → παραλαβή»: σελίδα βλάβης (RFQ) → ειδοποίηση → σελίδα βλάβης (προώθηση) → portal πελάτη → marketplace συνεργάτη → σελίδα βλάβης (προγραμματισμός) → portal πελάτη (παραλαβή). Το προσωπικό δεν μπορεί να κλείσει τη ροή χωρίς τον πελάτη, ακόμη κι αν ο πελάτης συμφώνησε τηλεφωνικά.

## 2. Στόχος (ΜΕΤΑ)

Κάθε επόμενο βήμα μιας βλάβης, ενός RFQ ή μιας σύμβασης είναι **ένα κλικ μακριά από όπου κι αν βλέπεις το αντικείμενο**: από τη γραμμή της λίστας (⋯ μενού), από το κουμπί «Ενέργειες» της σελίδας λεπτομέρειας, ή από τα batch actions. Ένα και μόνο μοντέλο ενεργειών αποφασίζει τι εμφανίζεται· οι ίδιοι διάλογοι ανοίγουν παντού· ο server παραμένει ο φρουρός.

Ροή «νέα βλάβη → συνεργάτης → ραντεβού» ΜΕΤΑ: Κέντρο εργασιών → ⋯ → «Ανάθεση σε συνεργάτη…» → ⋯ → «Ραντεβού…» (ημερομηνία/ώρα/διάρκεια) → τέλος. Μηδέν αλλαγές σελίδας.
Ροή «RFQ → προσφορά → σύμβαση → παραλαβή» ΜΕΤΑ: ⋯ «Αίτημα προσφοράς…» → (προσφορά συνεργάτη) → ⋯ «Προώθηση προσφοράς…» → ⋯ «Αποδοχή εκ μέρους πελάτη…» (αν συμφώνησε τηλεφωνικά) → ⋯ «Προγραμματισμός έργου…» → (ολοκλήρωση συνεργάτη) → ⋯ «Παραλαβή εκ μέρους πελάτη…». Όλα από το Κέντρο εργασιών.

## 3. Αποφάσεις (locked)

| Θέμα | Απόφαση |
|---|---|
| Προσέγγιση | **Β — κοινό μοντέλο ενεργειών**: καθαρός resolver `lib/work/actions.ts` + ένας οικοδεσπότης διαλόγων `components/work/WorkActionHost.tsx` + hook `useWorkActions`. Καμία λίστα δεν ορίζει δικές της ενέργειες βλάβης/RFQ/σύμβασης. |
| Φρουρός | Οι server actions παραμένουν η μόνη αλήθεια δικαιωμάτων. Ο resolver απλώς κρύβει ό,τι ο server θα απέρριπτε (κατάσταση × ρόλος × RBAC). |
| Νέες server actions | Μόνο τρεις: `scheduleRequest` (άμεσο ραντεβού), `loadWorkActionContext` (read), και επέκταση `respondWorkOrder`/`confirmWorkOrder` με υποχρεωτική σημείωση «εκ μέρους πελάτη» για προσωπικό που δεν είναι decider. Όλα τα άλλα ξαναχρησιμοποιούν τις υπάρχουσες actions. |
| Ραντεβού | Διαθέσιμο σε κάθε ανοιχτή βλάβη. Δύο τρόποι στον ίδιο διάλογο: άμεσος ορισμός (ημερομηνία, ώρα, διάρκεια) ή δήλωση slots (ο υπάρχων μηχανισμός). Η ένδειξη «περιορισμένη πρόσβαση» παραμένει ως πληροφορία. |
| Δεδομένα λιστών | Το `WorkItem` και το `FaultListItem` αποκτούν `flags` (ανοιχτό RFQ, προσφορές προς προώθηση, ενεργή σύμβαση + κατάστασή της, υπάρχει ραντεβού) μέσα από τα ΥΠΑΡΧΟΝΤΑ queries (επιπλέον `select`), όχι νέα queries ανά γραμμή. Τα βαριά δεδομένα διαλόγων φορτώνονται όταν ανοίγει ο διάλογος. |
| Σελίδα βλάβης | Κουμπί «Ενέργειες» στην κεφαλίδα (ίδιο μενού). Η κάρτα «Ενέργειες» (κουμπιά κατάστασης + 2 selects ανάθεσης) **αφαιρείται**. Η κάρτα ραντεβού κρατά τη λίστα slots/ραντεβού με κλείσιμο/διαγραφή. Το RfqPanel κρατά τις λίστες (RFQ, προσκλήσεις, προσφορές, συμβάσεις) και τα κουμπιά του ανοίγουν τους ίδιους διαλόγους (όχι inline φόρμες). |
| Νέα σελίδα | `/admin/work-orders/[id]` (RBAC `work-orders:view`). Οι γραμμές συμβάσεων στο Κέντρο εργασιών και στη λίστα συμβάσεων οδηγούν εκεί. Νέο άρθρο wiki. |
| Κινητό | Στις κάρτες του DataTable: έως 2 «primary» pills + «Ενέργειες» που ανοίγει bottom sheet με όλο το μενού (ομαδοποιημένο). Ίδιο sheet για το κουμπί «Ενέργειες» των σελίδων λεπτομέρειας σε phone. |
| DataTable | `RowAction` αποκτά `section?` και `primary?`. Το desktop dropdown βάζει διαχωριστικό μεταξύ ενοτήτων. Τίποτα άλλο δεν αλλάζει για τις υπόλοιπες 15 λίστες. |
| URLs / RBAC keys | Κανένα υπάρχον URL ή module key δεν αλλάζει. Κανένα νέο δικαίωμα: το `work-orders:view` καλύπτει τη νέα σελίδα. Καμία migration. |
| Εκτός | ⌘K, σελίδα κτηρίου ADMIN/MANAGER, sidebar υπομενού, μενού στις κάρτες kanban των homes, μαζικά email, αλλαγή κανόνων φρουρών (π.χ. EMPLOYEE αλλάζει κατάσταση με μόνο `maintenance:view` — παραμένει όπως είναι, καταγράφεται ως follow-up). |
| Παραγωγή | Το τοπικό DATABASE_URL είναι η παραγωγή: η επαλήθευση στον browser ανοίγει μενού/διαλόγους και τους ακυρώνει. Καμία υποβολή. Όλες οι γραφές επαληθεύονται με unit tests (mocked db). |

## 4. Μοντέλο ενεργειών (`lib/work/actions.ts`, pure, client-safe)

### 4.1 Υποκείμενο (subject)

```ts
export type FaultFlags = {
  openRfqId: string | null;          // RFQ σε OPEN/OFFERED
  offersToForward: number;           // SUBMITTED προσφορές σε ανοιχτά RFQ
  liveWo: { id: string; status: string } | null; // νεότερη σύμβαση με status ∉ {DECLINED, CANCELLED}
  hasAppointment: boolean;           // ≥1 MaintenanceAppointment
};
export type WorkSubject =
  | { kind: "fault"; id: string; status: string; handledBy: "COMPANY" | "PROPERTY_ADMIN"; assigneeId: string | null; supplierId: string | null; flags: FaultFlags }
  | { kind: "work-order"; id: string; status: string; faultId: string | null }
  | { kind: "rfq"; id: string; status: string; faultId: string | null; offersToForward: number; hasLiveWorkOrder: boolean };
```

Μετατροπείς (pure, με tests): `subjectFromWorkItem(item)` (fault / work-order / rfq → subject, programme / appointment → `null`), `subjectFromFaultListItem`, `subjectFromWorkOrderDTO`, `subjectFromRfqInvitationRow`, `subjectFromFaultDetail`.

### 4.2 Viewer

`lib/work/scope.ts` επεκτείνεται: `workActionViewer(role, userId, perms: Set<string>): WorkActionViewer`

| Ικανότητα | Κανόνας (καθρεφτίζει τον server) |
|---|---|
| `canManage` | ρόλος company (SA/ADMIN/MANAGER/EMPLOYEE) → αλλαγή κατάστασης, ραντεβού, σχόλιο |
| `canAssign` | SA/ADMIN/MANAGER → ανάθεση υπαλλήλου/συνεργάτη, προγραμματισμός σύμβασης, αξιολόγηση |
| `canRfqCreate` | company ∧ `rfq:create` |
| `canRfqEdit` | company ∧ `rfq:edit` → ακύρωση RFQ |
| `canForward` | SA/ADMIN/MANAGER ∧ `suppliers:edit` |
| `canOnBehalf` | SA/ADMIN/MANAGER → αποδοχή/απόρριψη και παραλαβή/αμφισβήτηση εκ μέρους πελάτη |

Ο `WorkViewer` του Κέντρου εργασιών γίνεται υπερσύνολο (κρατά τα υπάρχοντα πεδία). Η σελίδα φορτώνει τα perms μία φορά (`getEffectivePermissions`) και τα περνά.

### 4.3 Ενέργεια

```ts
export type WorkActionSection = "status" | "assign" | "schedule" | "offers" | "communicate" | "navigate";
export type WorkDialog = "assign-employee" | "assign-supplier" | "appointment" | "status-note" | "create-rfq" | "add-rfq-suppliers" | "forward-offer" | "cancel-rfq" | "wo-respond" | "wo-schedule" | "wo-confirm" | "comment" | "rate-supplier";
export type WorkAction =
  | { key: string; label: string; icon: string; section: WorkActionSection; kind: "status"; status: FaultStatus; primary?: boolean; danger?: boolean }  // άμεση μετάβαση
  | { key: string; label: string; icon: string; section: WorkActionSection; kind: "dialog"; dialog: WorkDialog; primary?: boolean; danger?: boolean }
  | { key: string; label: string; icon: string; section: WorkActionSection; kind: "link"; href: string };
export function resolveWorkActions(subject: WorkSubject, viewer: WorkActionViewer, ctx: { where: "list" | "detail" }): WorkAction[];
```

Σειρά ενοτήτων στο μενού: Κατάσταση → Ανάθεση → Προγραμματισμός → Προσφορές & σύμβαση → Επικοινωνία → Μετάβαση. Εικονίδια: react-icons/ri `*Line` ως string (όπως το `lib/quick-actions.ts`).

### 4.4 Πίνακας κανόνων — βλάβη

`closed` = status ∈ {COMPLETED, CANCELLED}.

| key | label | Ενότητα | Προϋπόθεση | Τι κάνει |
|---|---|---|---|---|
| `status:<S>` για κάθε S ∈ `STATUS_TRANSITIONS[status]` | `→ <STATUS_LABELS[S]>` | status | `canManage` | S ∈ {COMPLETED, ON_HOLD, CANCELLED} → διάλογος `status-note` (σημείωση προαιρετική, για CANCELLED υποχρεωτική)· αλλιώς άμεσα `changeRequestStatus(id, S)`. CANCELLED = danger. Η πρώτη μη-CANCELLED μετάβαση είναι `primary`. |
| `assign-employee` | «Ανάθεση σε υπάλληλο…» / «Αλλαγή υπαλλήλου…» (αν `assigneeId`) | assign | `canAssign` ∧ ¬closed | διάλογος: select υπαλλήλου + «Αφαίρεση ανάθεσης» → `assignRequest`. `primary` αν `!assigneeId ∧ handledBy=COMPANY`. |
| `assign-supplier` | «Ανάθεση σε συνεργάτη…» / «Αλλαγή συνεργάτη…» | assign | `canAssign` ∧ ¬closed | διάλογος: ταξινομημένοι συνεργάτες + checkbox «προτιμώμενος» + «Αφαίρεση» → `assignRequestSupplier` (+ `setPreferredSupplier`). |
| `appointment` | «Ραντεβού…» | schedule | `canManage` ∧ ¬closed | διάλογος §6.3 → `scheduleRequest` ή `offerSlots`/`bookSlot`/`removeSlot`/`setRequestEstimate`. |
| `create-rfq` | «Αίτημα προσφοράς σε συνεργάτες…» | offers | `canRfqCreate` ∧ ¬closed ∧ `!flags.openRfqId` ∧ (`!flags.liveWo` ∨ `liveWo.status=CONFIRMED`) | διάλογος: picker συνεργατών, προθεσμία, αυτοψία, σημείωση → `createRfq`. |
| `add-rfq-suppliers` | «Προσθήκη συνεργατών στο αίτημα…» | offers | `canRfqCreate` ∧ `flags.openRfqId` | διάλογος: picker (εξαιρεί προσκεκλημένους) → `addRfqSuppliers`. |
| `forward-offer` | «Προώθηση προσφοράς στον πελάτη…» | offers | `canForward` ∧ `flags.offersToForward > 0` ∧ `!flags.liveWo` | διάλογος: επιλογή προσφοράς (αν >1), καλύπτεται/περιθώριο/τιμή/μήνυμα → `forwardOffer`. `primary`. |
| `wo-respond` | «Αποδοχή / απόρριψη εκ μέρους πελάτη…» | offers | `canOnBehalf` ∧ `liveWo.status=PENDING_CUSTOMER` | διάλογος §6.5 → `respondWorkOrder(woId, accept, reason, { onBehalfNote })`. |
| `wo-schedule` | «Προγραμματισμός έργου…» | schedule | `canAssign` ∧ `liveWo.status ∈ {ACCEPTED, SCHEDULED}` | διάλογος datetime → `scheduleWorkOrder`. |
| `wo-confirm` | «Παραλαβή έργου εκ μέρους πελάτη…» | offers | `canOnBehalf` ∧ `liveWo.status=COMPLETED` | διάλογος §6.5 → `confirmWorkOrder(woId, ok, note, { onBehalfNote })`. |
| `comment` | «Μήνυμα / σημείωση…» | communicate | `canManage` | διάλογος: textarea + «Εσωτερικό σχόλιο» → `addRequestComment`. |
| `rate-supplier` | «Αξιολόγηση συνεργάτη…» | communicate | `canAssign` ∧ status=COMPLETED ∧ `supplierId` | διάλογος αστέρια + σχόλιο → `rateSupplier`. |
| `view` | «Προβολή βλάβης» | navigate | `where = "list"` | link `/admin/maintenance/<id>` |
| `view-wo` | «Σύμβαση έργου <αρ.>» | navigate | `flags.liveWo` | link `/admin/work-orders/<liveWo.id>` |

### 4.5 Πίνακας κανόνων — σύμβαση έργου

| key | label | Ενότητα | Προϋπόθεση |
|---|---|---|---|
| `wo-respond` | «Αποδοχή / απόρριψη εκ μέρους πελάτη…» | offers | `canOnBehalf` ∧ status=PENDING_CUSTOMER (primary) |
| `wo-schedule` | «Προγραμματισμός…» / «Αλλαγή ραντεβού…» | schedule | `canAssign` ∧ status ∈ {ACCEPTED, SCHEDULED} (primary) |
| `wo-confirm` | «Παραλαβή εκ μέρους πελάτη…» | offers | `canOnBehalf` ∧ status=COMPLETED (primary) |
| `view` | «Προβολή σύμβασης» | navigate | where=list → `/admin/work-orders/<id>` |
| `contract-customer` / `contract-supplier` | «Σύμβαση Α (πελάτης)» / «Σύμβαση Β (συνεργάτης)» | navigate | πάντα |
| `view-fault` | «Άνοιγμα βλάβης» | navigate | `faultId` |

### 4.6 Πίνακας κανόνων — RFQ (γραμμή = αίτημα ή πρόσκληση)

| key | label | Ενότητα | Προϋπόθεση |
|---|---|---|---|
| `add-rfq-suppliers` | «Προσθήκη συνεργατών…» | offers | `canRfqCreate` ∧ status ∈ {OPEN, OFFERED} |
| `forward-offer` | «Προώθηση προσφοράς στον πελάτη…» | offers | `canForward` ∧ offersToForward>0 ∧ ¬hasLiveWorkOrder (primary) |
| `cancel-rfq` | «Ακύρωση αιτήματος» | offers | `canRfqEdit` ∧ status ∈ {OPEN, OFFERED} (danger, διάλογος επιβεβαίωσης — όχι `confirm()`) |
| `view-fault` | «Άνοιγμα βλάβης» | navigate | `faultId` ∧ ο viewer έχει `maintenance:view` |

Το `/staff/rfq` κρατά επιπλέον τη δική του ενέργεια ανά πρόσκληση «Αποστολή ξανά» (`resendRfqInvitation`), γιατί είναι ιδιότητα της πρόσκλησης, όχι του RFQ.

### 4.7 Batch (μόνο γραμμές βλάβης, Κέντρο εργασιών + Βλάβες)

«Ανάθεση σε υπάλληλο…», «Ανάθεση σε συνεργάτη…» (`canAssign`), «→ Σε αξιολόγηση» (`canManage`, εφαρμόζεται μόνο σε όσες είναι OPEN). Το αποτέλεσμα αναφέρει «Ν ενημερώθηκαν · Μ παραλείφθηκαν (λόγος)». Μικτές επιλογές (με RFQ/σύμβαση) → τα batch δρουν μόνο στις βλάβες και το λένε.

## 5. Δεδομένα

### 5.1 Flags στις λίστες

- `lib/work/queries.ts` (βλάβες): επιπλέον `select` → `supplierId`, `serviceRequests: { where: { status: { in: ["OPEN","OFFERED"] } }, select: { id: true, offers: { where: { status: "SUBMITTED" }, select: { id: true } } } }`, `workOrders: { where: { status: { notIn: ["DECLINED","CANCELLED"] } }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true } }`, `_count: { select: { appointments: true } }`. Για RFQ: `offers: { where: { status: "SUBMITTED" }, select: { id: true } }` και `workOrders: { where: { status: { notIn: [...] } }, select: { id: true } }`.
- `lib/work/normalize.ts`: `FaultRow`/`RfqRow` με τα προαιρετικά πεδία· `faultFlags(row): FaultFlags` (pure, tested)· `WorkItem.flags?: FaultFlags` και `WorkItem.rfq?: { offersToForward; hasLiveWorkOrder }`. Το `href` της σύμβασης γίνεται `/admin/work-orders/<id>`.
- `app/(company)/admin/maintenance/page.tsx`: ίδιο `include`· `FaultListItem` αποκτά `assigneeId`, `supplierId`, `flags`.
- `/staff/rfq`: το `RfqInvitationRowDTO` έχει ήδη τις προσφορές· προστίθεται `hasLiveWorkOrder` στο `listRfqInvitationRows`.

### 5.2 Context διαλόγων (`app/actions/work-actions.ts`)

```ts
export async function loadWorkActionContext(subject: { kind: "fault" | "work-order" | "rfq"; id: string }): Promise<WorkActionContext | { error: string }>
```

Φρουρός: συνδεδεμένος χρήστης company ρόλου· `maintenance:view` για βλάβη, `work-orders:view` για σύμβαση, `rfq:view` για RFQ· ο MANAGER με account-managed πελάτες παίρνει `{ error }` για κτήριο εκτός scope (ίδιος κανόνας με `customerIdsForScope`). Επιστρέφει ό,τι χρειάζονται οι διάλογοι, φορτωμένο με τις υπάρχουσες συναρτήσεις (`loadRfqPanel`, `listRfqCandidates`, `describeRank`, `listAssignableEmployees`):

```ts
type WorkActionContext = {
  fault: { id; title; status; handledBy; assigneeId; supplierId; buildingId; categoryId; categoryName; restrictedAccess; estimatedMinutes; managerPresence;
           slots: SlotDTO[]; appointments: AppointmentDTO[] } | null;
  employees: { id; name }[];                       // μόνο αν canAssign
  suppliers: { id; name }[]; preferredSupplierId;  // ταξινομημένοι (describeRank), μόνο αν canAssign
  picker: RfqPickerData;                           // μόνο αν canRfqCreate
  rfqs: RfqDTO[]; workOrders: WorkOrderDTO[]; defaults: { markupPct; warrantyMonths };
  mySide: "COMPANY";
};
```

Για `work-order`/`rfq` χωρίς βλάβη: `fault: null`, μόνο οι συμβάσεις/RFQ.

### 5.3 Νέες / αλλαγμένες server actions

| Action | Αρχείο | Κανόνες |
|---|---|---|
| `scheduleRequest(id, isoStart, durationMinutes?)` | `maintenance-requests.ts` | `canManageRequest`· ¬closed· start στο μέλλον· duration = παράμετρος ∨ `estimatedMinutes` ∨ 60, στρογγυλοποίηση στα 30′. Συναλλαγή: `MaintenanceAppointment` (COMPANY-side, χωρίς slot), `scheduledDate`, status → SCHEDULED αν το επιτρέπει το `STATUS_TRANSITIONS` (αλλιώς μένει), status event «Ραντεβού <ημ/νία>». `notifyStakeholders` (exclude actor). |
| `respondWorkOrder(woId, accept, reason?, opts?: { onBehalfNote?: string })` | `rfq.ts` | Αν ο actor είναι προσωπικό και **όχι** decider: `onBehalfNote` υποχρεωτικό (≥ 5 χαρακτήρες), αλλιώς `{ error }`. Καταγραφή: status event (ή comment αν δεν υπάρχει βλάβη) «Αποδοχή/Απόρριψη εκ μέρους πελάτη από <όνομα>: <note>», εσωτερικό comment στη βλάβη. Ο decider καλεί όπως σήμερα (χωρίς note). Το `customerAcceptedById` παραμένει ο actor (ο φάκελος λέει ποιος πάτησε). |
| `confirmWorkOrder(woId, confirm, note?, opts?: { onBehalfNote?: string })` | `rfq.ts` | Ίδιος κανόνας. Στην αμφισβήτηση το `note` (τι δεν έγινε σωστά) παραμένει υποχρεωτικό ΚΑΙ το `onBehalfNote`. |
| `loadWorkActionContext` | `work-actions.ts` | §5.2 |

Το portal του πελάτη (`OfferCard`) δεν αλλάζει (καλεί χωρίς `opts`).

## 6. UI

### 6.1 DataTable (`components/ui/data-table.tsx`)

- `RowAction<T>` += `section?: string`, `primary?: boolean`.
- Νέο `components/ui/action-menu.tsx`: `groupActions(actions)` (pure: διατηρεί τη σειρά πρώτης εμφάνισης κάθε section) και `<ActionMenuList actions onPick>` (ομάδες με διαχωριστικό 1px, danger κόκκινο, εικονίδιο + label). Το desktop dropdown του DataTable και το `<ActionsButton>` το χρησιμοποιούν.
- Νέο `components/ui/action-sheet.tsx`: bottom sheet (portal, backdrop, Esc, κλείσιμο με swipe-down όχι απαραίτητο) με τίτλο και `<ActionMenuList>`. Ύψος ≤ 80vh, scroll.
- Phone cards: pills = `primary` ενέργειες (έως 2) + «Ενέργειες (N)» που ανοίγει το sheet. Αν δεν υπάρχουν primary, οι 2 πρώτες. Λίστες που δεν ορίζουν `primary` (οι υπόλοιπες 15) συμπεριφέρονται όπως σήμερα όταν έχουν ≤ 3 ενέργειες, αλλιώς 2 pills + «Ενέργειες».

### 6.2 `useWorkActions` + `WorkActionHost` (`components/work/`)

```ts
const wa = useWorkActions({ viewer, where: "list" | "detail", onDone?: (msg) => void });
wa.rowActions(subject): RowAction<T>[]     // resolver → RowAction (status: direct με callAction· dialog: wa.open· link: router.push)
wa.batchActions(viewer): BatchAction<T>[]  // §4.7 (μόνο αν where="list")
wa.open(dialog, subject)
<wa.Host />                                // ένα ανά σελίδα· Modal σε desktop, full-height σε phone
<ActionsButton subject viewer wa />        // κουμπί «Ενέργειες» (κεφαλίδες σελίδων)· phone → ActionSheet
```

Ο Host κρατά `{ dialog, subject, ctx, loading, error }`. Στο άνοιγμα: `loadWorkActionContext` → skeleton → διάλογος. Μετά από επιτυχία: κλείσιμο, μήνυμα «ok» (υπάρχον μοτίβο `message` του WorkCenterClient, κοινό component `components/work/ActionToast.tsx`), `router.refresh()`. Σφάλμα: μένει μέσα στον διάλογο. Κάθε κλήση περνά από `callAction` (`lib/work/client-actions.ts`).

### 6.3 Διάλογοι (`components/work/dialogs/*.tsx`), ένας ανά `WorkDialog`

- **AssignEmployee**: select (ctx.employees), προεπιλογή ο τρέχων, «Ανάθεση» / «Αφαίρεση ανάθεσης».
- **AssignSupplier**: select ταξινομημένων (ctx.suppliers, hint ταξινόμησης όπως σήμερα), checkbox «Ορισμός ως προτιμώμενου για το κτήριο (κατηγορία)», «Ανάθεση» / «Αφαίρεση». Εμφανίζει το badge «Καλύπτεται από τη σύμβαση / Εκτός σύμβασης».
- **Appointment** (δύο καρτέλες): «Ορισμός ραντεβού» (ημερομηνία, ώρα σε βήμα 30′, διάρκεια λεπτά προσυμπληρωμένη από εκτίμηση, checkbox «παρουσία διαχειριστή» → `setRequestEstimate` + `scheduleRequest`) και «Διαθεσιμότητα (slots)» (λίστα ανοιχτών slots με «Κλείσιμο ραντεβού» για την άλλη πλευρά / διαγραφή για τα δικά μας, προσθήκη slot → `offerSlots`). Ένδειξη «Περιορισμένη πρόσβαση» αν ισχύει. Λίστα υπαρχόντων ραντεβού.
- **StatusNote**: τίτλος «→ <κατάσταση>», σημείωση (υποχρεωτική για Ακυρώθηκε), κουμπί.
- **CreateRfq**: `RfqSupplierPicker` (ctx.picker), προθεσμία, αυτοψία, σημείωση → `createRfq`· αποτέλεσμα `sentMessage` (υπάρχον).
- **AddRfqSuppliers**: picker με `excludeIds` τους προσκεκλημένους → `addRfqSuppliers`.
- **ForwardOffer**: αν >1 SUBMITTED προσφορές, λίστα επιλογής (όνομα, ποσό, rating)· μετά η υπάρχουσα φόρμα (καλύπτεται, περιθώριο, τιμή, μήνυμα, προεπισκόπηση με ΦΠΑ) → `forwardOffer`.
- **CancelRfq**: επιβεβαίωση με τίτλο αιτήματος → `cancelRfq`.
- **WoRespond**: περίληψη σύμβασης (αρ., συνεργάτης, τιμή πελάτη + ΦΠΑ, ισχύει έως), επιλογή «Αποδοχή» / «Απόρριψη» (+ λόγος), πεδίο **«Πώς συμφώνησε ο πελάτης;»** (υποχρεωτικό, placeholder «π.χ. τηλεφωνικά με κ. Παπαδόπουλο 21/10 12:30»), προειδοποίηση ότι η ενέργεια καταγράφεται στο όνομά σου.
- **WoSchedule**: datetime-local → `scheduleWorkOrder`.
- **WoConfirm**: περίληψη ολοκλήρωσης (σημείωση + media συνεργάτη), «Παραλαβή» / «Αμφισβήτηση» (+ τι δεν έγινε σωστά), πεδίο «Πώς το επιβεβαίωσε ο πελάτης;» (υποχρεωτικό).
- **Comment**: textarea, checkbox «Εσωτερικό σχόλιο (δεν το βλέπει ο ένοικος)» → `addRequestComment`.
- **RateSupplier**: αστέρια 1–5 + σχόλιο → `rateSupplier`.

Όλοι: `Modal` (`components/ui/modal.tsx`) με `FormField/FieldInput/FieldSelect/FieldTextarea`, εικονίδια `react-icons/ri` `*Line`, μεγέθη `var(--fs-*)`, κουμπιά ≥ 36px σε phone, μηνύματα σφάλματος inline, κανένα `alert()`/`confirm()`/`prompt()`.

### 6.4 Λίστες

| Σελίδα | Αλλαγή |
|---|---|
| `/admin/work` (`WorkCenterClient`) | `getRowActions` = `wa.rowActions(subjectFromWorkItem(r))` για fault/wo/rfq· programme → «Προβολή», appointment → «Άνοιγμα βλάβης» + `appointment` διάλογος (μέσω της βλάβης της). Batch §4.7. Αφαιρείται το τοπικό modal ανάθεσης. Το `viewer` γίνεται `WorkActionViewer`. |
| `/admin/maintenance` (`MaintenanceListClient`) | ίδιο μενού + batch· `onAddNew` παραμένει «Δήλωση βλάβης». |
| `/admin/work-orders` (`WorkOrdersClient`) | μενού σύμβασης· ο αριθμός γίνεται link στη νέα σελίδα. |
| `/staff/rfq` (`RfqInvitationsClient`) | μενού RFQ + «Αποστολή ξανά». Το «Προσθήκη συνεργατών» και η «Ακύρωση» μεταφέρονται στους κοινούς διαλόγους (το τοπικό `AddSuppliersModal` καταργείται). |

### 6.5 Σελίδα βλάβης `/admin/maintenance/[id]`

- Νέο client wrapper `components/maintenance/FaultDetailClient.tsx` που κατέχει το `useWorkActions({ where: "detail" })` και αποδίδει `RequestDetail` + `RfqPanel`, περνώντας `wa`.
- `RequestDetail`: κεφαλίδα + `<ActionsButton>` δεξιά (primary κουμπί, με βελάκι). Η κάρτα «Ενέργειες» αφαιρείται. Η κάρτα «Αξιολόγηση συνεργάτη» αφαιρείται (διάλογος). Η κάρτα ραντεβού: εμφανίζεται αν υπάρχουν slots ή ραντεβού ή η βλάβη είναι ανοιχτή· κρατά λίστα ανοιχτών slots (κλείσιμο/διαγραφή) και ραντεβού· κουμπί «Ραντεβού…» ανοίγει τον διάλογο· τα inputs εκτίμησης/slot αφαιρούνται. Επικοινωνία και Ιστορικό μένουν ως έχουν (το inline textarea μηνύματος μένει, είναι η φυσική θέση συνομιλίας).
- `RfqPanel`: κρατά όλες τις λίστες· «Προσθήκη συνεργατών», «Ακύρωση», «Προώθηση στον πελάτη», «Ορισμός/Αλλαγή ραντεβού έργου», «Νέο αίτημα προσφοράς» γίνονται κουμπιά που καλούν `wa.open(...)`. Οι inline φόρμες (`NewRfqForm`, φόρμα προώθησης, datetime σύμβασης, picker προσθήκης) αφαιρούνται από εδώ και ζουν μόνο στους διαλόγους. Σε κάθε `WorkOrderRow` προστίθενται «Αποδοχή/απόρριψη εκ μέρους πελάτη…» και «Παραλαβή εκ μέρους πελάτη…» όταν ισχύουν.
- Το «Άνοιγμα βλάβης» στις ειδοποιήσεις/links δεν αλλάζει.

### 6.6 Νέα σελίδα `/admin/work-orders/[id]`

- Server page: `requirePermission("work-orders", "view")`, MANAGER scope όπως οι λίστες· `notFound()` αν δεν υπάρχει. Φορτώνει WO (`woInclude` + `customer.name` + `maintenanceRequest: { id, title, status }` + `offer: { amount, supplierRating }`) και τα status events της βλάβης που αναφέρουν τον αριθμό της σύμβασης.
- Περιεχόμενο: breadcrumb «Πίσω στις συμβάσεις», κεφαλίδα (αριθμός, πίλι κατάστασης, τίτλος, κτήριο, πελάτης, συνεργάτης, «καλύπτεται») + `<ActionsButton>`· πλέγμα Kv (τιμή συνεργάτη, τιμή πελάτη + ΦΠΑ, περιθώριο, εγγύηση, ισχύει έως, αποδοχή πελάτη, αποδοχή συνεργάτη, ραντεβού, παραλαβή)· περιγραφή/μήνυμα πελάτη· media ολοκλήρωσης· links «Σύμβαση Α», «Σύμβαση Β», «Άνοιγμα βλάβης»· «Ιστορικό» (events).
- Wiki: `docs/wiki/pages/admin-work-orders-detail.md` (route `/admin/work-orders/[id]`, related: admin-work-orders, admin-maintenance-detail, admin-work-orders-detail-contract-side).

### 6.7 Realtime

Οι υπάρχουσες actions ήδη δημοσιεύουν στο building και company κανάλι· `scheduleRequest` κάνει το ίδιο (`revalidateAll` + `publishCompanyEvent`). Οι λίστες έχουν `AutoRefresh`.

## 7. Δικαιώματα (σύνοψη ανά ρόλο)

| Ενέργεια | SA / ADMIN / MANAGER | EMPLOYEE |
|---|---|---|
| Αλλαγή κατάστασης, ραντεβού, μήνυμα | ✓ | ✓ (όπως σήμερα ο server) |
| Ανάθεση υπαλλήλου/συνεργάτη, προγραμματισμός έργου, αξιολόγηση | ✓ | ✗ |
| RFQ: δημιουργία / προσθήκη | ✓ (`rfq:create`) | ✓ (`rfq:create`, default CRUD) |
| RFQ: ακύρωση | ✓ (`rfq:edit`) | ✓ (`rfq:edit`) |
| Προώθηση προσφοράς | ✓ (`suppliers:edit`) | ✗ (view-only suppliers) |
| Εκ μέρους πελάτη (αποδοχή/παραλαβή) | ✓ με σημείωση | ✗ |
| Σελίδα σύμβασης | `work-orders:view` | `work-orders:view` (ADMIN/MANAGER default· EMPLOYEE αν του δοθεί) |

Ο MANAGER με account-managed πελάτες βλέπει/ενεργεί μόνο στα κτήρια των πελατών του (λίστες ήδη scoped· `loadWorkActionContext` και η σελίδα σύμβασης εφαρμόζουν τον ίδιο κανόνα).

## 8. Tests (Vitest, TDD)

| Αρχείο | Τι |
|---|---|
| `lib/work/actions.test.ts` | Πίνακας: για κάθε (kind, status, flags, viewer) → ακριβή `key[]` με τη σωστή σειρά ενοτήτων· primary/danger· `where` list/detail· EMPLOYEE χωρίς ανάθεση/προώθηση/εκ μέρους· `canForward` απαιτεί `suppliers:edit`. |
| `lib/work/subjects.test.ts` | Μετατροπείς subjects από WorkItem/FaultListItem/WorkOrderDTO/RfqInvitationRow. |
| `lib/work/normalize.test.ts` | `faultFlags` (ανοιχτό RFQ, SUBMITTED προσφορές, liveWo νεότερη, appointments count)· href σύμβασης. |
| `lib/work/scope.test.ts` | `workActionViewer` από ρόλο + perms. |
| `components/ui/action-menu.test.ts` | `groupActions` διατηρεί σειρά, χωρίς κενές ομάδες. |
| `app/actions/rfq.test.ts` | `respondWorkOrder`/`confirmWorkOrder`: προσωπικό χωρίς decider → χωρίς note `{ error }`· με note → ok + event/comment με το κείμενο· decider χωρίς note → ok όπως πριν. |
| `app/actions/maintenance-requests.test.ts` (νέο, ίδιο μοτίβο mock) | `scheduleRequest`: παρελθόν → error· closed → error· OPEN → SCHEDULED + appointment + event· IN_PROGRESS → appointment χωρίς αλλαγή κατάστασης· duration default από εκτίμηση. |
| `lib/help/coverage.test.ts` | περνά με το νέο άρθρο. |

## 9. Επαλήθευση (dev-3002, παραγωγική ΒΔ)

Μόνο ανάγνωση: SUPER_ADMIN — Κέντρο εργασιών ⋯ μενού σε βλάβη/σύμβαση/RFQ (desktop + phone 375px με sheet), Βλάβες, Συμβάσεις, /staff/rfq, σελίδα βλάβης με «Ενέργειες» και ανοιχτό διάλογο (ακύρωση), νέα σελίδα σύμβασης. View-as ADMIN και MANAGER: ίδια. Κανένα submit. Screenshots πριν/μετά στο scratchpad. Χωρίς νέα σφάλματα σε `npx tsc --noEmit`, `npm run lint`, `npm run test` (γνωστά προϋπάρχοντα: 9 tsc, ~339 eslint, 2 failing tests).

## 10. Follow-ups (εκτός αυτού του spec)

- Υπο-έργα 2–5 (§0).
- Οι server φρουροί βλάβης ελέγχουν ρόλους, όχι RBAC (`maintenance:edit`): ο EMPLOYEE αλλάζει κατάσταση με μόνο `view`. Να ευθυγραμμιστεί σε ξεχωριστό έργο.
- Μενού ⋯ στις κάρτες kanban των homes (ίδιο hook, μικρό).
- Μαζική αποστολή ειδοποιητηρίων με email (υπο-έργο 3).
