# Dynamic RBAC — Design Spec

**Date:** 2026-07-06
**Status:** Approved (design)
**Author:** brainstorming session

## Πρόβλημα

Το RBAC σήμερα είναι στατικό/hardcoded:

- `ROLE_PERMISSIONS` στο `lib/roles.ts` υπάρχει αλλά **δεν επιβάλλεται πουθενά** (`hasPermission()` έχει 0 usages).
- Ο πραγματικός έλεγχος πρόσβασης γίνεται σε 2 σημεία: (α) **surface-level** στα layouts (`AppShell allowedRoles` → `SURFACE_ROLES`), (β) το **μενού** είναι hardcoded ανά ρόλο (`NAV_BY_ROLE` στο `components/admin/sidebar-nav.tsx`).
- Η σελίδα `/super-admin/roles` είναι **μόνο προβολή** (hardcoded πίνακας).
- Υπάρχει ήδη μοντέλο `MenuConfig` (Prisma) που **δεν είναι συνδεδεμένο**.

Ο super admin πρέπει να μπορεί να διαχειρίζεται **δυναμικά** ποιες λειτουργίες, προβολές και στοιχεία μενού είναι διαθέσιμα ανά ρόλο — για όλες τις υπάρχουσες αλλά και **μελλοντικές** λειτουργίες.

## Αποφάσεις (από brainstorming)

1. **Μοντέλο:** Πλήρες custom roles — οι 9 υπάρχοντες παραμένουν ως αμετάβλητοι *system roles*, με δυνατότητα δημιουργίας νέων *custom roles* από πάνω.
2. **Enforcement:** Μενού **+** πραγματικοί server guards (routes & server actions).
3. **Registry:** Code-defined κεντρικό registry (source of truth), με auto-seed στη ΒΔ.
4. **Granularity:** CRUD ανά module (`view` / `create` / `edit` / `delete`).

## Αρχιτεκτονική

### 1. Συνύπαρξη custom roles με το `UserRole` enum

Το enum `UserRole` και οι έλεγχοι `role === "SUPER_ADMIN"` **δεν αλλάζουν**.

- Κάθε ρόλος (system ή custom) έχει ένα **`baseRole`** = έναν από τους 9 enums. Το baseRole ορίζει:
  - το **surface** (company / customer / marketplace) μέσω του υπάρχοντος `surfaceForRole()`,
  - την κληρονομούμενη hardcoded συμπεριφορά.
- Ένας **custom role** = `baseRole` + δικό του **permission set** που παρακάμπτει τα defaults του baseRole.
- Το `User.role` (enum) **παραμένει** και κρατιέται συγχρονισμένο με το `baseRole` του assigned ρόλου → όλος ο υπάρχων κώδικας δουλεύει αμετάβλητος.
- Νέο `User.roleId` (FK → `Role`) ορίζει ποιος συγκεκριμένος ρόλος (system/custom) ισχύει και δίνει το permission set.

Αποτέλεσμα: View-as/impersonation, surface guards, και κάθε `role ===` έλεγχος συνεχίζουν να λειτουργούν· ο πίνακας δικαιωμάτων γίνεται δυναμικός.

### 2. Registry (source of truth στον κώδικα)

Νέο `lib/rbac/registry.ts`:

```ts
export type RbacAction = "view" | "create" | "edit" | "delete";

export interface RbacModule {
  key: string;              // σταθερό, μοναδικό, π.χ. "announcements"
  label: string;            // ελληνικό label για το UI
  surface: Surface;         // company | customer | marketplace
  menu?: { href: string; icon: string; group?: string }; // αν εμφανίζεται στο μενού
  actions: RbacAction[];    // ποιες CRUD ενέργειες υποστηρίζει
}

export const RBAC_MODULES: readonly RbacModule[] = [ /* … */ ] as const;
```

- Permission key = `"<moduleKey>:<action>"` (π.χ. `"announcements:create"`).
- Το registry ορίζει **default permission sets ανά system role** (μεταφορά της σημερινής λογικής από `NAV_BY_ROLE` + `ROLE_PERMISSIONS`).
- **Νέα λειτουργία = 1 entry** στο registry· εμφανίζεται αυτόματα στον πίνακα δικαιωμάτων και (αν έχει `menu`) στο sidebar.

#### Αρχικό inventory modules (από το σημερινό sidebar)

Company surface: `dashboard`, `reports`, `onboarding`, `customers`, `properties`, `units`, `users`, `residents`, `roles`, `services`, `api-costs`, `billing`, `maintenance`, `announcements`, `calendar`, `integrations`, `settings-company`, `settings-brand`, `settings`, `cms-landing`, `cms-seo`, `cms-settings`, `cms-pages`, `cms-pricing`, `cms-faq`, `cms-articles`, `cms-authors`, `cms-media`, `cms-translations`, `view-as`.

Customer surface: `dashboard`, `properties`, `units`, `income`, `requests`, `maintenance`, `announcements`.

Marketplace surface: `dashboard`, `tasks`, `maintenance`.

(Η ακριβής αντιστοίχιση label/href/icon/actions ολοκληρώνεται στη φάση υλοποίησης· το inventory εδώ ορίζει το εύρος.)

### 3. Μοντέλο δεδομένων (Prisma)

```prisma
model Role {
  id          String   @id @default(cuid())
  key         String   @unique          // "SUPER_ADMIN" για system, slug για custom
  label       String
  baseRole    UserRole                   // surface anchor + hardcoded behavior
  surface     String                     // παραγόμενο από baseRole, αποθηκευμένο για query
  isSystem    Boolean  @default(false)
  createdById String?
  createdBy   User?    @relation("roleCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
  permissions RolePermission[]
  users       User[]   @relation("userRole")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model RolePermission {
  id        String @id @default(cuid())
  roleId    String
  role      Role   @relation(fields: [roleId], references: [id], onDelete: Cascade)
  moduleKey String
  action    String                        // view | create | edit | delete
  @@unique([roleId, moduleKey, action])   // ύπαρξη γραμμής = allowed
  @@index([roleId])
}

// User (προσθήκη)
model User {
  // … υπάρχοντα πεδία, incl. role UserRole (παραμένει = baseRole)
  roleId String?
  role_  Role?  @relation("userRole", fields: [roleId], references: [id], onDelete: SetNull)
}
```

- **Ύπαρξη `RolePermission` γραμμής = allowed** (απουσία = denied).
- Το υπάρχον `MenuConfig` **αποσύρεται** (δεν είναι συνδεδεμένο· το μενού πλέον παράγεται από registry + permissions).
- Migration: `prisma migrate diff` + `deploy` (κατά τις project conventions — όχι `migrate dev`).

### 4. Auto-seed / sync

Idempotent script `prisma/seed-rbac.ts` (τρέχει στο deploy):

- Εξασφαλίζει **9 system `Role` rows** (`isSystem=true`, `key=baseRole=enum`).
- Περνάει τα **registry defaults** ως `RolePermission` γραμμές για τους system roles **μόνο αν λείπουν** (δεν πατάει χειροκίνητες αλλαγές του super admin).
- Νέα modules στο registry → οι system roles παίρνουν αυτόματα τα default permissions τους.
- **Backfill:** υπάρχοντες users παίρνουν `roleId` = το system Role row που αντιστοιχεί στο `user.role`.

### 5. Enforcement

`lib/rbac/permissions.ts`:

```ts
getRolePermissions(roleId: string): Promise<Set<string>>   // "module:action", cached ανά request
can(perms: Set<string>, moduleKey: string, action: RbacAction): boolean
```

- **Resolution:** από το effective session → `user.roleId` → permission set. Fallback: αν `roleId` null, χρησιμοποίησε το system role του `user.role`.
- **Server guard:** `requirePermission(moduleKey, action)` για server components & server actions → redirect (`deniedRedirectPath`) ή 403 αν λείπει.
- **UI helper:** `can(...)` για conditional rendering κουμπιών/στοιχείων.
- **Μενού:** το sidebar παράγεται δυναμικά από τα registry modules με `view` permission για το surface του χρήστη — αντικαθιστά το hardcoded `NAV_BY_ROLE`. Ο server περνά την λίστα επιτρεπτών modules στο `SidebarNav`.
- Οι υπάρχοντες surface guards παραμένουν ως πρώτο, χονδρικό επίπεδο· τα per-module guards προστίθενται από πάνω.

### 6. UI Super Admin

Η `/super-admin/roles` γίνεται **editable**:

- **Matrix:** ρόλοι (στήλες) × modules (γραμμές), με checkboxes ανά CRUD action.
- **Create/edit/delete custom roles:** επιλογή `baseRole` (κλειδώνει το surface), label, permission set.
- **System roles:** επεξεργάσιμα permissions, **μη διαγράψιμα**.
- **`SUPER_ADMIN` κλειδωμένος σε all-on** (ασφάλεια — να μην κλειδωθεί έξω ο διαχειριστής).
- **Ανάθεση ρόλου σε χρήστη:** dropdown στο user management (system + custom roles, φιλτραρισμένα ανά surface). Η ανάθεση ενημερώνει `roleId` **και** συγχρονίζει το `user.role` enum = `baseRole`.
- Server actions για persist· επαναφορά system role στα defaults ("Reset to defaults").

## Δομικές μονάδες

| Unit | Ρόλος | Εξαρτήσεις |
|------|-------|-----------|
| `lib/rbac/registry.ts` | Ορισμός modules/actions/defaults | `lib/surfaces` |
| `lib/rbac/permissions.ts` | Resolution + `can()` + guards | registry, db, auth-effective |
| `prisma` (`Role`, `RolePermission`, `User.roleId`) | Persistence | — |
| `prisma/seed-rbac.ts` | Auto-seed/sync + backfill | registry, db |
| Δυναμικό sidebar | Μενού από permissions | registry, permissions |
| `/super-admin/roles` (editable) + actions | Διαχείριση | registry, permissions, db |
| User role assignment | Ανάθεση ρόλου | permissions, db |

## Φάσεις υλοποίησης (ενδεικτικά)

1. Registry + defaults (`lib/rbac/registry.ts`).
2. Prisma schema (`Role`, `RolePermission`, `User.roleId`) + migration + seed/backfill.
3. Resolution & guards (`lib/rbac/permissions.ts`), σύνδεση στα surface layouts.
4. Δυναμικό μενού (αντικατάσταση `NAV_BY_ROLE`).
5. Super-admin editor (matrix, CRUD custom roles, reset) + user assignment.
6. Σταδιακή σύνδεση per-route/per-action guards στα υπάρχοντα routes.

## Εκτός εμβέλειας (YAGNI)

- Per-customer / per-company permission overrides (δεν επιλέχθηκε).
- DB-defined permissions/modules (το registry μένει code-defined).
- Field-level permissions.

## Ρίσκα

- **Lockout:** ο `SUPER_ADMIN` κλειδωμένος all-on το αποτρέπει.
- **role/roleId drift:** η ανάθεση ρόλου πρέπει πάντα να συγχρονίζει και τα δύο· ένα σημείο αλήθειας (server action).
- **Ξεχασμένα guards:** νέα routes χωρίς `requirePermission` = σιωπηλά ανοιχτά. Mitigation: σταδιακή σύνδεση + convention doc.
