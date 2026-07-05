# Συντηρήσεις (Maintenance Scheduling) — Design Spec

**Date:** 2026-07-05
**Status:** Approved (brainstorming)
**Stack:** Next.js 16.2 (server components + server actions), Prisma 7/PostgreSQL, Tailwind 4.1, shadcn/ui, react-icons/ri, Mailgun (`lib/mailgun.ts`), Bunny CDN (via `BuildingFile`).

## Πρόβλημα

Προγραμματισμένη/προληπτική συντήρηση κτηρίων (π.χ. συντήρηση ανελκιστήρα κάθε 3 μήνες) με:
- Επαναλαμβανόμενη περίοδο + υπενθύμιση X ημέρες πριν (email).
- Διαφορετικό παραλήπτη ειδοποίησης ανάλογα με το αν η ιδιοκτησία είναι **managed από την εταιρία** και αν η συγκεκριμένη συντήρηση είναι **εντός του πακέτου υπηρεσιών**.
- Καταχώριση **πιστοποιητικού εγγράφου** μετά την ολοκλήρωση + **ιστορικό** συντηρήσεων.

## Υπάρχον σχετικό codebase

- `RecurringTask` (building-level: `frequency`, `nextDueDate`, `lastDoneDate`, `vendor`, `notes`, `active`) + `CalendarPanel` (recurrence UI) + `app/actions/recurring-tasks.ts` (create/update/markDone/delete). **Επεκτείνεται** — γίνεται το maintenance schedule.
- `MaintenanceRequest` — reactive/ad-hoc βλάβη. **Εκτός scope** (διαφορετική περίπτωση).
- `ManagementAssignment` — καθορίζει αν κτήριο/property είναι managed & από ποιον.
- `BuildingFile` (+ `BuildingFileCategory` enum) — αρχεία σε Bunny CDN.
- `lib/mailgun.ts` — `sendNotificationEmail`, attachments.
- **Λείπει:** cron/reminder, ιστορικό ολοκληρώσεων, λογική managed/πακέτο, surface διαχειριστή.

## Αποφάσεις

1. **Επέκταση `RecurringTask`** αντί για νέο ξεχωριστό μοντέλο (το ημερολόγιο & actions υπάρχουν ήδη).
2. Το «εντός πακέτου» = **ρητό ανά-record flag** `inServicePackage` (όχι παραγόμενο από `PropertyService`).
3. Reminder μέσω **Coolify daily cron** → idempotent protected route.
4. Νέο `MaintenanceLog` για ιστορικό/πιστοποιητικά· `cost` προαιρετικό· document **προαιρετικό** (μπαίνει και αργότερα).
5. Ανάθεση σε συνεργάτη/υπάλληλο = **μελλοντική φάση** (extension point μόνο, δεν υλοποιείται τώρα).

## Μοντέλο δεδομένων

### `RecurringTask` (επέκταση)

```prisma
+ kind               MaintenanceKind @default(GENERAL)
+ inServicePackage   Boolean  @default(false)
+ reminderDaysBefore Int      @default(7)
+ reminderSentAt     DateTime?          // idempotency για τον cron· μηδενίζεται στην ολοκλήρωση
+ logs               MaintenanceLog[]
```

`enum MaintenanceKind { GENERAL ELEVATOR BOILER FIRE_SAFETY HVAC ELECTRICAL PLUMBING OTHER }`

### `MaintenanceLog` (νέο)

```prisma
model MaintenanceLog {
  id               String        @id @default(cuid())
  recurringTaskId  String
  recurringTask    RecurringTask @relation(fields: [recurringTaskId], references: [id], onDelete: Cascade)
  buildingId       String
  building         Building      @relation(fields: [buildingId], references: [id], onDelete: Cascade)
  performedAt      DateTime
  performedById    String?
  performedBy      User?         @relation(fields: [performedById], references: [id], onDelete: SetNull)
  cost             Decimal?      @db.Decimal(10, 2)
  notes            String?
  documentFileId   String?
  documentFile     BuildingFile? @relation(fields: [documentFileId], references: [id], onDelete: SetNull)
  createdAt        DateTime      @default(now())
  @@index([recurringTaskId])
  @@index([buildingId])
}
```

### `BuildingFileCategory`
Προσθήκη τιμής `MAINTENANCE`.

### Extension point (μελλοντικό — ΔΕΝ υλοποιείται τώρα)
`assignedCollaboratorId` / `assignedEmployeeId` στο `RecurringTask` για ανάθεση σε συνεργάτη/υπάλληλο σε επίπεδο διαχειριστή ή εταιρίας.

## Λογική ειδοποίησης

`managed` = υπάρχει `ManagementAssignment` (property ή building) για το κτήριο.

| Κατάσταση | Ποιος καταχωρεί | Ποιος ειδοποιείται (email) | Ημερολόγιο (in-app) |
|---|---|---|---|
| managed + `inServicePackage` | Υπάλληλοι εταιρίας | Assigned υπάλληλοι εταιρίας | Ίδιο task, company surface |
| managed + εκτός πακέτου | Διαχειριστής | Διαχειριστής (PROPERTY_ADMIN) | Ίδιο task, portal |
| μη managed | Διαχειριστής | Διαχειριστής | portal |

Το «ημερολόγιο» είναι το ίδιο `CalendarPanel` — το ίδιο task εμφανίζεται στο surface του κατάλληλου ρόλου· δεν υπάρχουν φυσικά ξεχωριστά ημερολόγια.

## Ροές

### Καταχώριση / επεξεργασία
Φόρμα (επεκτείνει `CalendarPanel` modal): τίτλος, `kind`, `frequency`, `nextDueDate`, `vendor`, `reminderDaysBefore`, `inServicePackage`. Ορατή σε company employees (super-admin/company surface) και σε PROPERTY_ADMIN (portal, μόνο δικά του κτήρια — έλεγχος `ManagementAssignment`).

### Cron υπενθύμισης — `GET /api/cron/maintenance-reminders`
- Protected με secret header (env `CRON_SECRET`). Coolify scheduled task, μία φορά/μέρα.
- Επιλέγει `active` tasks με `nextDueDate` set, όπου `nextDueDate - reminderDaysBefore ≤ today` και το `reminderSentAt` δεν καλύπτει τον τρέχοντα κύκλο (`reminderSentAt` null ή `< nextDueDate - reminderDaysBefore`).
- Καθορίζει παραλήπτες με τον πίνακα, στέλνει `sendNotificationEmail`, σετάρει `reminderSentAt = now`.
- Idempotent: δεύτερο τρέξιμο την ίδια μέρα δεν ξαναστέλνει.

### Ολοκλήρωση — αντικαθιστά/επεκτείνει `markTaskDone`
Modal «Ολοκλήρωση»: `performedAt`, `cost?`, `notes?`, upload πιστοποιητικού (προαιρετικό). Ενέργειες:
1. (αν doc) upload → `BuildingFile` category `MAINTENANCE`.
2. `MaintenanceLog` create.
3. `nextDueDate` → advance κατά ένα interval· `lastDoneDate = now`· `reminderSentAt = null`.

## UI Surfaces

### Company (`super-admin/buildings/[id]`)
- `CalendarPanel` form: + `kind` / `inServicePackage` / `reminderDaysBefore`.
- «Done» → completion modal.
- **Νέο tab «Συντηρήσεις»** με ιστορικό: `DataTable` (ημερομηνία, τύπος/τίτλος, ποιος, κόστος, link πιστοποιητικού), ταξινόμηση/φίλτρο ανά `kind`.

### Portal διαχειριστή (PROPERTY_ADMIN)
Λίστα/φόρμα συντηρήσεων + ιστορικό, μόνο για δικά του κτήρια. Server components + server actions με έλεγχο ownership.

### Server actions
- `app/actions/recurring-tasks.ts` — επέκταση για τα νέα πεδία.
- `app/actions/maintenance-logs.ts` (νέο) — `completeMaintenance`, `listMaintenanceHistory`.
- Κάθε action: `requireStaff` + ownership check για PROPERTY_ADMIN (data isolation — hard requirement· ο διαχειριστής βλέπει μόνο κτήρια από `ManagementAssignment`).

## Testing
- Unit: επιλογή παραληπτών ανά κατάσταση managed/πακέτο· `reminderSentAt` idempotency· advance `nextDueDate` στην ολοκλήρωση.
- Ownership: PROPERTY_ADMIN δεν βλέπει/επεξεργάζεται κτήρια εκτός των assignments του.

## Εκτός scope (μελλοντικά)
- Ανάθεση σε συνεργάτη/εταιρία (collaborator/employee) — extension point ήδη προβλέπεται.
- Integration με `MaintenanceRequest` (reactive) — παραμένει ξεχωριστό.
