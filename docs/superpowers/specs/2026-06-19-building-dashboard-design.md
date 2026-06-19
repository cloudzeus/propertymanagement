# Spec: Building Control-Center Dashboard

**Date:** 2026-06-19
**Status:** Approved (sketch 003 winner: refined.html — in app shell + 2-row wrapping tabs)

## Σκοπός
Πλούσια σελίδα «κέντρο ελέγχου» ανά κτήριο, μέσα στο υπάρχον `AppShell` (ένα global
sidebar + header). Building hero με KPIs και **2-row wrapping tabs** (όχι 2ο κάθετο μενού,
όχι horizontal scroll). Πραγματικά `react-icons/ri` (linear). Θέμα ίδιο με την κεντρική
εφαρμογή (Geist, μπλε primary #0078D4).

## Route
`app/(dashboard)/super-admin/buildings/[id]/page.tsx` → server component μέσα στο `AppShell`,
φορτώνει building + όλα τα σχετικά, render client `BuildingDashboard`. Από το δέντρο/λίστα,
το building row action «Διαχείριση» οδηγεί εδώ.

## Tabs (modules)
Επισκόπηση · Μονάδες · Ένοικοι · Διαχειριστές · **Αρχεία** · **Ημερολόγιο** · **Επαφές** ·
**Εγκαταστάσεις** · **Κοινόχρηστα** · **Πληρωμές** · Συντήρηση · Ανακοινώσεις.

Υπάρχουσες λειτουργίες (Μονάδες/Ένοικοι/Διαχειριστές/Χιλιοστά/Συντήρηση/Ανακοινώσεις)
επαναχρησιμοποιούν ό,τι ήδη υπάρχει (BuildingsTree units, managers, millesimes, maintenance).

## Νέα μοντέλα (Prisma)
Όλα με `buildingId → Building (onDelete: Cascade)`, `companyId` για scoping, indexes.

- **BuildingFile** — `category` (PLANS|PHOTOS|DOCUMENTS|CERTIFICATES|OTHER), `name`,
  `cdnPath`, `url`, `mimeType`, `sizeBytes`, `uploadedById?`, `createdAt`. Αποθήκευση στο
  BunnyCDN φάκελο του κτηρίου (`properties/{pid}/buildings/{bid}/<category>/`).
- **InfraPoint** (σημεία πρόσβασης/εγκαταστάσεις) — `name`, `type`
  (ELECTRICITY|OTE|ROOF|ANTENNA|BOILER|PUMP|FIRE|OTHER), `floorLabel`, `location`,
  `locked` (bool), `accessNotes` (ποιος έχει πρόσβαση), `keyHolder`, `photoUrl?`, `notes?`.
- **Contact** — `name`, `category` (π.χ. Ανελκυστήρας/Υδραυλικός/Έκτακτη ανάγκη/Συνεργείο),
  `phone?`, `email?`, `notes?`.
- **RecurringTask** — `title`, `frequency` (WEEKLY|MONTHLY|QUARTERLY|SEMIANNual|ANNUAL|CUSTOM),
  `nextDueDate`, `lastDoneDate?`, `contactId?` (ανάδοχος), `notes?`, `active`.
- **BuildingExpense** — `month` (YYYY-MM), `category`, `amount` (Decimal), `description?`,
  `receiptFileId?` (→ BuildingFile). 
- **UnitPayment** — `unitId → Unit`, `month`, `amount` (Decimal),
  `status` (PAID|PENDING|OVERDUE), `paidAt?`, `notes?`.

## Server actions (νέα αρχεία)
- `building-files.ts` — listFiles(buildingId, category?), uploadFile (μέσω BunnyCDN), deleteFile.
- `infra-points.ts` — list/create/update/delete + photo upload.
- `contacts.ts` — list/create/update/delete.
- `recurring-tasks.ts` — list/create/update/markDone/delete.
- `building-finance.ts` — expenses (list/create/delete), payments (list/upsert status).

Auth: ίδιο pattern (`requireSuperAdmin`/staff) όπως τα υπόλοιπα building actions.

## UI
`BuildingDashboard` client component:
- Building hero (avatar, breadcrumb είναι στο header, τίτλος, μετα-στοιχεία, status) + KPI strip.
- 2-row wrapping tab bar (pills, `react-icons/ri`, badges).
- Ένα panel ανά tab. Νέα panels: Files (κατηγορίες + upload dropzone + grid), Infra (cards),
  Contacts (table), Calendar (recurring tasks list + month view), Κοινόχρηστα (KPIs + expenses
  table), Πληρωμές (per-unit table). Υπάρχοντα: ενσωμάτωση/embed.
- Reuse `components/ui/data-table.tsx`, `modal.tsx`, theme variables, `react-icons/ri`.

## Φάσεις υλοποίησης
1. **Foundation** — schema (όλα τα μοντέλα) + migration· route + `BuildingDashboard` shell
   (hero + KPIs + wrapping tabs) + Overview· building «Διαχείριση» → νέα σελίδα.
2. **Αρχεία** — BuildingFile + actions + BunnyCDN upload/list/delete + Files panel.
3. **Εγκαταστάσεις + Επαφές** — InfraPoint, Contact + actions + panels.
4. **Ημερολόγιο** — RecurringTask + actions + panel.
5. **Οικονομικά** — BuildingExpense + UnitPayment + actions + Κοινόχρηστα/Πληρωμές panels.
6. **Ενσωμάτωση υπαρχόντων** — Μονάδες/Ένοικοι/Διαχειριστές/Χιλιοστά/Συντήρηση/Ανακοινώσεις
   tabs να δείχνουν υπάρχουσα λειτουργικότητα.

## Εκτός scope (τώρα)
- Πραγματικές πληρωμές μέσω Viva (μόνο καταχώρηση κατάστασης).
- Έκδοση/υπολογισμός κοινοχρήστων αυτόματα (μόνο καταγραφή δαπανών/αποδείξεων).
- Δικαιώματα ανά module για residents (αργότερα).
