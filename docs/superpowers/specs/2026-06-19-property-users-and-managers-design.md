# Spec: Χρήστες ιδιοκτησίας/κτηρίου — ιδιοκτήτες, ένοικοι, διαχειριστές (Property Admin)

**Date:** 2026-06-19
**Status:** Approved (brainstorming)

## Σκοπός

1. Ένας χρήστης (με email = username + password) μπορεί να είναι **ιδιοκτήτης σε πολλές
   μονάδες** και ταυτόχρονα **ένοικος σε άλλες**.
2. Κατά την ανάθεση ιδιοκτήτη/ενοίκου, καθώς γράφεις email/όνομα να **γεμίζει λίστα
   υπαρχόντων χρηστών** ώστε να επιλέγεις υπάρχοντα· αλλιώς να δημιουργείς νέο.
3. Δυνατότητα να ορίσεις χρήστη ως **διαχειριστή (PROPERTY_ADMIN)** μιας ιδιοκτησίας ή
   ενός κτηρίου, με ελεγχόμενα δικαιώματα διαχείρισης **μόνο σε εκείνο το scope**.

## Υπάρχουσα κατάσταση

- `Unit.ownerId` / `Unit.residentId → User` (relations `ownedUnits` / `residentUnits`):
  **ήδη** υποστηρίζει πολλαπλή ιδιοκτησία/ενοικίαση ανά χρήστη. Δεν αλλάζει.
- `email @unique` + `passwordHash`: το email είναι ήδη username. Δεν αλλάζει.
- `components/ui/user-combo.tsx` (`UserCombo`) + `searchUsers` (employees.ts): υπάρχει
  autocomplete χρηστών — θα επαναχρησιμοποιηθεί.
- `createOccupant` (unit-occupants.ts): **πάντα δημιουργεί νέο χρήστη** και απορρίπτει
  υπάρχον email — αυτό είναι το πρόβλημα που λύνουμε.
- Ρόλος `PROPERTY_ADMIN` υπάρχει στο `UserRole` enum.

## Μοντέλο δεδομένων

### Νέος πίνακας `ManagementAssignment`

```prisma
model ManagementAssignment {
  id          String    @id @default(cuid())

  userId      String
  user        User      @relation("managementAssignments", fields: [userId], references: [id], onDelete: Cascade)

  // Ακριβώς ένα από τα δύο είναι συμπληρωμένο (property-level ή building-level).
  propertyId  String?
  property    Property? @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  buildingId  String?
  building    Building? @relation(fields: [buildingId], references: [id], onDelete: Cascade)

  role        UserRole  @default(PROPERTY_ADMIN) // ανά-scope ρόλος (επεκτάσιμο)

  createdAt   DateTime  @default(now())

  @@unique([userId, propertyId, buildingId])
  @@index([propertyId])
  @@index([buildingId])
  @@index([userId])
}
```

- **Ανά scope** ανάθεση: ο χρήστης γίνεται PROPERTY_ADMIN μόνο για τη συγκεκριμένη
  ιδιοκτησία/κτήριο. Ο global `User.role` ΔΕΝ αλλάζει (μένει PROPERTY_OWNER/RESIDENT).
- Πολλαπλοί διαχειριστές ανά scope επιτρέπονται· ένας χρήστης σε πολλά scope.
- Νέα relations στα `User`, `Property`, `Building` (back-relations).
- Migration: `npx prisma migrate dev` με όνομα `add_management_assignment`.

## Server actions

### `app/actions/unit-occupants.ts`

Νέο/ενημερωμένο action που υποστηρίζει και υπάρχοντα και νέο χρήστη:

```ts
export async function assignOccupant(
  unitId: string,
  role: "OWNER" | "RESIDENT",
  target: { userId: string } | { newUser: { name: string; email: string; password: string } }
): Promise<{ occupant: Occupant } | { error: string }>
```

- `{ userId }`: συνδέει υπάρχοντα χρήστη (set `ownerId`/`residentId`). Δεν αλλάζει τον
  global ρόλο του.
- `{ newUser }`: λογική του υπάρχοντος `createOccupant` (δημιουργία PROPERTY_OWNER/RESIDENT
  + σύνδεση). Διατηρεί τους ελέγχους (email μοναδικό, password ≥ 6).
- `clearOccupant`: μένει ως έχει.

### `app/actions/managers.ts` (νέο αρχείο)

```ts
export async function listManagers(scope: { propertyId: string } | { buildingId: string }): Promise<ManagerRow[]>
export async function addManager(scope: { propertyId: string } | { buildingId: string }, userId: string): Promise<{ ok: true } | { error: string }>
export async function removeManager(assignmentId: string): Promise<{ ok: true } | { error: string }>
```

- `addManager`: επιτρέπεται μόνο αν ο `userId` είναι ήδη owner/resident σε εκείνο το scope
  (ιδιοκτησία ή κτήριο). Δημιουργεί `ManagementAssignment` με `role = PROPERTY_ADMIN`.
- Auth: SUPER_ADMIN/ADMIN/MANAGER/PROPERTY_ADMIN (όπως τα υπόλοιπα).

### `app/actions/employees.ts` — `searchUsers`

- Επέκταση auth ώστε να επιτρέπεται και σε MANAGER/PROPERTY_ADMIN (όχι μόνο SUPER_ADMIN/ADMIN).
- Προαιρετικό φίλτρο `customerId` ώστε να επαναχρησιμοποιούνται τα πρόσωπα του ίδιου πελάτη.

## UI

### OccupantsModal (CustomerTree.tsx)

- Αντικατάσταση της φόρμας «μόνο δημιουργία» με δύο καταστάσεις:
  - **Επιλογή υπάρχοντος:** `UserCombo` (autocomplete email/όνομα) → «Σύνδεση».
  - **Νέος χρήστης:** toggle «Νέος» → πεδία όνομα/email/password → δημιουργία + σύνδεση.
- Καλεί `assignOccupant` με `{ userId }` ή `{ newUser }`.
- **Checkbox «Ένοικος ίδιος με τον ιδιοκτήτη»:** στο slot Ενοίκου. Όταν είναι
  τσεκαρισμένο, το πεδίο Ενοίκου κρύβεται/απενεργοποιείται και ως ένοικος ορίζεται
  **ο ίδιος χρήστης με τον ιδιοκτήτη** (`residentId = ownerId`). Διαθέσιμο μόνο όταν
  έχει οριστεί ιδιοκτήτης. Αν ο ιδιοκτήτης αλλάξει/αφαιρεθεί ενώ είναι τσεκαρισμένο,
  ο ένοικος ενημερώνεται/καθαρίζεται αντίστοιχα.

### Διαχειριστές

- **Building dropdown** ([CustomerTree.tsx](../../../app/(dashboard)/super-admin/customers/CustomerTree.tsx)): νέα ενέργεια
  «Διαχειριστές κτηρίου» → `ManagersModal` με scope κτηρίου.
- **Property level:** ενέργεια «Διαχειριστές ιδιοκτησίας» (στο property header /
  PropertyDetailClient ή στην κορυφή του δέντρου) → `ManagersModal` με scope ιδιοκτησίας.
- `ManagersModal`:
  - Λίστα τρεχόντων διαχειριστών (όνομα, email) + κουμπί αφαίρεσης (`removeManager`).
  - `UserCombo` περιορισμένο στους owners/residents **αυτού** του scope, για προσθήκη
    (`addManager`).

## Δικαιώματα (ελεγχόμενα)

- Permission helper, π.χ. `lib/roles.ts`:
  ```ts
  canManageProperty(userId, propertyId): Promise<boolean>
  canManageBuilding(userId, buildingId): Promise<boolean>
  ```
  Επιστρέφει `true` για company staff (SUPER_ADMIN/ADMIN/MANAGER) ή αν υπάρχει
  `ManagementAssignment` του χρήστη στο property/κτήριο (ή στο γονικό property του κτηρίου).
- **Πρώτο βήμα:** μοντέλο + actions + UI ανάθεσης + helper. Η ενσωμάτωση των ελέγχων στις
  επιμέρους σελίδες (μονάδες, ανακοινώσεις, έξοδα) γίνεται σταδιακά σε επόμενο βήμα.

## Δοκιμές

- `assignOccupant` με `{ userId }` συνδέει χωρίς να αλλάζει global ρόλο.
- `assignOccupant` με `{ newUser }` διατηρεί τους ελέγχους (διπλό email, μικρός κωδικός).
- `addManager` απορρίπτει χρήστη που δεν είναι owner/resident στο scope.
- `canManageBuilding` true μέσω property-level assignment του γονικού.

## Εκτός scope

- Πλήρης επιβολή των δικαιωμάτων σε όλες τις σελίδες (σταδιακά μετά).
- Αλλαγή του global μοντέλου ρόλων ή του auth flow.
- Διαχειριστές που δεν είναι owners/residents (π.χ. εξωτερικοί) — όχι τώρα.
