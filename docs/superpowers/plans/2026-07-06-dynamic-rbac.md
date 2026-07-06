# Dynamic RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the super admin a dynamic, editable RBAC system — CRUD-level permission toggles per role (incl. custom roles) across all current and future modules, enforced in both the menu and server guards.

**Architecture:** A code-defined registry of modules/actions is the source of truth. System roles (the 9 existing enums) and super-admin-created custom roles both carry a `baseRole` that anchors surface + legacy `role ===` behavior. Permissions live in `Role` / `RolePermission` tables, auto-seeded from the registry. Enforcement resolves the effective session's `roleId` → permission set, used by a dynamic sidebar and `requirePermission` server guards.

**Tech Stack:** Next.js 16.2 (server components + server actions), Prisma 7 / PostgreSQL (custom client in `lib/prisma`), Auth.js v5, Vitest, TypeScript.

---

## Key conventions (read before starting)

- **Enums:** import from `@/lib/prisma/enums` (e.g. `import { UserRole } from "@/lib/prisma/enums"`). Never redeclare.
- **DB client:** `import { db } from "@/lib/db"`.
- **Effective session:** `import { getEffectiveSession } from "@/lib/auth-effective"` (respects impersonation).
- **Surface helpers:** `import { surfaceForRole, type Surface } from "@/lib/surfaces"`.
- **Migrations:** DO NOT run `prisma migrate dev`. Generate SQL with:
  `npx prisma migrate diff --from-config-datasource prisma.config.ts --to-schema prisma/schema.prisma --script > prisma/migrations/<timestamp>_dynamic_rbac/migration.sql`
  then `npx prisma migrate deploy`. Regenerate client: `npx prisma generate`.
- **Tests:** Vitest. Run a single file: `npx vitest run lib/rbac/registry.test.ts`. Co-locate `*.test.ts` next to source.
- **Seed scripts run with:** `npx tsx --env-file=.env prisma/seed-rbac.ts`.

## File structure

| File | Responsibility |
|------|----------------|
| `lib/rbac/registry.ts` | Module/action definitions + per-system-role default permission keys |
| `lib/rbac/types.ts` | Shared types (`RbacAction`, `RbacModule`, permission-key helpers) |
| `lib/rbac/registry.test.ts` | Registry invariants (unique keys, valid surfaces/actions) |
| `lib/rbac/permissions.ts` | Permission resolution, `can()`, `requirePermission()` guard, menu builder |
| `lib/rbac/permissions.test.ts` | Pure-logic tests (`can`, `defaultPermissionsFor`, `buildMenu`) |
| `prisma/schema.prisma` | `Role`, `RolePermission` models + `User.roleId` |
| `prisma/seed-rbac.ts` | Idempotent seed/sync of system roles + defaults + user backfill |
| `app/(company)/super-admin/roles/page.tsx` | Editable matrix UI (replaces read-only page) |
| `app/(company)/super-admin/roles/role-editor.tsx` | Client matrix/editor component |
| `app/actions/rbac.ts` | Server actions: save permissions, create/edit/delete custom role, assign role to user |
| `components/admin/app-shell.tsx` | Pass resolved menu + permission set to sidebar |
| `components/admin/sidebar-nav.tsx` | Render menu from passed items instead of `NAV_BY_ROLE` |

---

## Task 1: RBAC types + registry

**Files:**
- Create: `lib/rbac/types.ts`
- Create: `lib/rbac/registry.ts`
- Test: `lib/rbac/registry.test.ts`

- [ ] **Step 1: Create the types module**

`lib/rbac/types.ts`:
```ts
import type { Surface } from "@/lib/surfaces";
import type { UserRole } from "@/lib/prisma/enums";

export const RBAC_ACTIONS = ["view", "create", "edit", "delete"] as const;
export type RbacAction = (typeof RBAC_ACTIONS)[number];

export interface RbacModule {
  key: string;                 // stable, unique, e.g. "announcements"
  label: string;               // Greek UI label
  surface: Surface;            // company | customer | marketplace
  menu?: { href: string; icon: string; group?: string };
  actions: RbacAction[];       // which CRUD actions this module supports
}

/** Permission key format: "<moduleKey>:<action>" */
export function permKey(moduleKey: string, action: RbacAction): string {
  return `${moduleKey}:${action}`;
}

/** Default permission keys granted to each system role (baseRole). */
export type RoleDefaults = Partial<Record<UserRole, string[]>>;
```

- [ ] **Step 2: Write the failing registry test**

`lib/rbac/registry.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { RBAC_MODULES, DEFAULT_PERMISSIONS } from "./registry";
import { RBAC_ACTIONS, permKey } from "./types";

describe("RBAC registry", () => {
  it("has unique module keys", () => {
    const keys = RBAC_MODULES.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("uses only valid actions", () => {
    for (const m of RBAC_MODULES)
      for (const a of m.actions) expect(RBAC_ACTIONS).toContain(a);
  });
  it("uses only valid surfaces", () => {
    const surfaces = new Set(["company", "customer", "marketplace"]);
    for (const m of RBAC_MODULES) expect(surfaces.has(m.surface)).toBe(true);
  });
  it("default permission keys reference real module:action pairs", () => {
    const valid = new Set(
      RBAC_MODULES.flatMap((m) => m.actions.map((a) => permKey(m.key, a))),
    );
    for (const keys of Object.values(DEFAULT_PERMISSIONS))
      for (const k of keys ?? []) expect(valid.has(k)).toBe(true);
  });
  it("SUPER_ADMIN default includes every permission", () => {
    const all = RBAC_MODULES.flatMap((m) => m.actions.map((a) => permKey(m.key, a)));
    expect(new Set(DEFAULT_PERMISSIONS.SUPER_ADMIN)).toEqual(new Set(all));
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run lib/rbac/registry.test.ts`
Expected: FAIL — cannot import `./registry`.

- [ ] **Step 4: Write the registry**

`lib/rbac/registry.ts`. Define `RBAC_MODULES` for all modules in the design inventory, and `DEFAULT_PERMISSIONS` mirroring today's `NAV_BY_ROLE` visibility. Full CRUD (`["view","create","edit","delete"]`) for data modules; `["view"]` for pure views (dashboard, reports, view-as).

```ts
import type { RbacModule, RoleDefaults } from "./types";
import { permKey } from "./types";

const CRUD = ["view", "create", "edit", "delete"] as const;
const VIEW = ["view"] as const;

export const RBAC_MODULES: readonly RbacModule[] = [
  // ── Company surface ──
  { key: "dashboard", label: "Dashboard", surface: "company", menu: { href: "/super-admin", icon: "RiDashboardLine", group: "core" }, actions: [...VIEW] },
  { key: "reports", label: "Αναφορές", surface: "company", menu: { href: "/super-admin/reports", icon: "RiBarChartLine", group: "core" }, actions: [...VIEW] },
  { key: "onboarding", label: "Νέα πολυκατοικία (AI)", surface: "company", menu: { href: "/super-admin/onboarding", icon: "RiRobot2Line", group: "management" }, actions: [...CRUD] },
  { key: "customers", label: "Πελάτες", surface: "company", menu: { href: "/super-admin/customers", icon: "RiContactsLine", group: "management" }, actions: [...CRUD] },
  { key: "properties", label: "Ιδιοκτησίες", surface: "company", menu: { href: "/super-admin/properties", icon: "RiCommunityLine", group: "management" }, actions: [...CRUD] },
  { key: "units", label: "Μονάδες", surface: "company", menu: { href: "/super-admin/units", icon: "RiHome3Line", group: "management" }, actions: [...CRUD] },
  { key: "users", label: "Χρήστες", surface: "company", menu: { href: "/super-admin/users", icon: "RiGroupLine", group: "management" }, actions: [...CRUD] },
  { key: "residents", label: "Ενοικιαστές", surface: "company", menu: { href: "/admin/residents", icon: "RiUserLine", group: "management" }, actions: [...CRUD] },
  { key: "roles", label: "Ρόλοι", surface: "company", menu: { href: "/super-admin/roles", icon: "RiShieldUserLine", group: "management" }, actions: [...CRUD] },
  { key: "services", label: "Υπηρεσίες", surface: "company", menu: { href: "/super-admin/services", icon: "RiServiceLine", group: "financials" }, actions: [...CRUD] },
  { key: "api-costs", label: "Κόστη API", surface: "company", menu: { href: "/super-admin/settings/costs", icon: "RiMoneyDollarCircleLine", group: "financials" }, actions: [...VIEW] },
  { key: "billing", label: "Τιμολόγηση", surface: "company", menu: { href: "/super-admin/billing", icon: "RiFileListLine", group: "financials" }, actions: [...CRUD] },
  { key: "maintenance", label: "Συντηρήσεις", surface: "company", menu: { href: "/admin/maintenance", icon: "RiToolsLine", group: "operations" }, actions: [...CRUD] },
  { key: "announcements", label: "Ανακοινώσεις", surface: "company", menu: { href: "/admin/announcements", icon: "RiNotification2Line", group: "operations" }, actions: [...CRUD] },
  { key: "calendar", label: "Ημερολόγιο", surface: "company", menu: { href: "/admin/calendar", icon: "RiCalendarLine", group: "operations" }, actions: [...CRUD] },
  { key: "integrations", label: "Ενσωματώσεις", surface: "company", menu: { href: "/super-admin/integrations", icon: "RiLinksLine", group: "settings" }, actions: [...CRUD] },
  { key: "settings-company", label: "Εταιρία", surface: "company", menu: { href: "/super-admin/settings/company", icon: "RiBuildingLine", group: "settings" }, actions: [...CRUD] },
  { key: "settings-brand", label: "Brand", surface: "company", menu: { href: "/super-admin/settings/brand", icon: "RiPaletteLine", group: "settings" }, actions: [...CRUD] },
  { key: "settings", label: "Ρυθμίσεις", surface: "company", menu: { href: "/super-admin/settings", icon: "RiSettingsLine", group: "settings" }, actions: [...CRUD] },
  { key: "cms-landing", label: "CMS: Αρχική", surface: "company", menu: { href: "/super-admin/cms/landing", icon: "RiLayoutLine", group: "cms" }, actions: [...CRUD] },
  { key: "cms-seo", label: "CMS: SEO", surface: "company", menu: { href: "/super-admin/cms/seo", icon: "RiSearchEyeLine", group: "cms" }, actions: [...CRUD] },
  { key: "cms-settings", label: "CMS: Ρυθμίσεις", surface: "company", menu: { href: "/super-admin/cms/settings", icon: "RiSettings3Line", group: "cms" }, actions: [...CRUD] },
  { key: "cms-pages", label: "CMS: Σελίδες", surface: "company", menu: { href: "/super-admin/cms/pages", icon: "RiPagesLine", group: "cms" }, actions: [...CRUD] },
  { key: "cms-pricing", label: "CMS: Τιμές", surface: "company", menu: { href: "/super-admin/cms/pricing", icon: "RiPriceTag3Line", group: "cms" }, actions: [...CRUD] },
  { key: "cms-faq", label: "CMS: FAQ", surface: "company", menu: { href: "/super-admin/cms/faq", icon: "RiQuestionLine", group: "cms" }, actions: [...CRUD] },
  { key: "cms-articles", label: "CMS: Άρθρα", surface: "company", menu: { href: "/super-admin/cms/articles", icon: "RiArticleLine", group: "cms" }, actions: [...CRUD] },
  { key: "cms-authors", label: "CMS: Συγγραφείς", surface: "company", menu: { href: "/super-admin/cms/authors", icon: "RiUserStarLine", group: "cms" }, actions: [...CRUD] },
  { key: "cms-media", label: "CMS: Media", surface: "company", menu: { href: "/super-admin/cms/media", icon: "RiImage2Line", group: "cms" }, actions: [...CRUD] },
  { key: "cms-translations", label: "CMS: Μεταφράσεις", surface: "company", menu: { href: "/super-admin/cms/translations", icon: "RiTranslate2", group: "cms" }, actions: [...CRUD] },
  { key: "view-as", label: "View as…", surface: "company", menu: { href: "/super-admin/view-as", icon: "RiEyeLine", group: "preview" }, actions: [...VIEW] },
  // ── Customer surface ──
  { key: "customer-dashboard", label: "Dashboard", surface: "customer", menu: { href: "/building", icon: "RiDashboardLine", group: "core" }, actions: [...VIEW] },
  { key: "customer-properties", label: "Ακίνητά μου", surface: "customer", menu: { href: "/manager/properties", icon: "RiBuildingLine", group: "properties" }, actions: [...CRUD] },
  { key: "customer-units", label: "Μονάδες", surface: "customer", menu: { href: "/manager/units", icon: "RiHome3Line", group: "properties" }, actions: [...CRUD] },
  { key: "customer-income", label: "Έσοδα", surface: "customer", menu: { href: "/owner/income", icon: "RiMoneyDollarCircleLine", group: "assets" }, actions: [...VIEW] },
  { key: "customer-requests", label: "Αιτήσεις", surface: "customer", menu: { href: "/portal/requests", icon: "RiToolsLine", group: "services" }, actions: [...CRUD] },
  { key: "customer-maintenance", label: "Συντηρήσεις", surface: "customer", menu: { href: "/portal/maintenance", icon: "RiToolsLine", group: "operations" }, actions: [...CRUD] },
  { key: "customer-announcements", label: "Ανακοινώσεις", surface: "customer", menu: { href: "/portal/announcements", icon: "RiNotification2Line", group: "operations" }, actions: [...VIEW] },
  // ── Marketplace surface ──
  { key: "mkt-dashboard", label: "Dashboard", surface: "marketplace", menu: { href: "/staff", icon: "RiDashboardLine", group: "core" }, actions: [...VIEW] },
  { key: "mkt-tasks", label: "Assigned", surface: "marketplace", menu: { href: "/staff/tasks", icon: "RiFileListLine", group: "tasks" }, actions: [...CRUD] },
  { key: "mkt-maintenance", label: "Συντηρήσεις", surface: "marketplace", menu: { href: "/staff/maintenance", icon: "RiToolsLine", group: "tasks" }, actions: [...CRUD] },
] as const;

const all = (): string[] => RBAC_MODULES.flatMap((m) => m.actions.map((a) => permKey(m.key, a)));
const view = (...keys: string[]): string[] => keys.map((k) => permKey(k, "view"));
const crud = (...keys: string[]): string[] =>
  keys.flatMap((k) => (["view", "create", "edit", "delete"] as const).map((a) => permKey(k, a)));

// Mirror today's NAV_BY_ROLE visibility. `view` = read-only surfacing; `crud` = full manage.
export const DEFAULT_PERMISSIONS: RoleDefaults = {
  SUPER_ADMIN: all(),
  ADMIN: [
    ...view("dashboard", "reports"),
    ...crud("properties", "units", "users", "residents", "maintenance", "announcements", "calendar"),
    ...view("api-costs"), ...crud("settings"),
  ],
  MANAGER: [
    ...view("dashboard"),
    ...crud("properties", "units", "maintenance", "announcements"),
  ],
  EMPLOYEE: [
    ...view("mkt-dashboard"), ...crud("mkt-tasks", "mkt-maintenance"),
  ],
  PROPERTY_ADMIN: [
    ...view("customer-dashboard"),
    ...crud("customer-properties", "customer-units", "customer-maintenance"),
    ...view("customer-announcements"),
  ],
  PROPERTY_OWNER: [
    ...view("customer-dashboard", "customer-income"), ...crud("customer-units"),
  ],
  PROPERTY_RESIDENT: [
    ...view("customer-dashboard"), ...crud("customer-requests"), ...view("customer-announcements"),
  ],
  PROPERTY_VIEWER: [
    ...view("customer-dashboard", "customer-announcements"),
  ],
  COLLABORATOR: [
    ...view("mkt-dashboard"), ...crud("mkt-tasks", "mkt-maintenance"),
  ],
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run lib/rbac/registry.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/rbac/types.ts lib/rbac/registry.ts lib/rbac/registry.test.ts
git commit -m "feat(rbac): code-defined module registry + per-role defaults"
```

---

## Task 2: Prisma schema — Role, RolePermission, User.roleId

**Files:**
- Modify: `prisma/schema.prisma` (add two models; extend `User`; drop `MenuConfig`)

- [ ] **Step 1: Remove the unused `MenuConfig` model**

Delete the `model MenuConfig { … }` block (around line 1251) and its `menuConfigs`/`menuConfigCreatedBy` relation fields on `Company` and `User` (search `MenuConfig` and `menuConfig` and remove all references).

- [ ] **Step 2: Add the `Role` and `RolePermission` models**

Append to `prisma/schema.prisma`:
```prisma
model Role {
  id          String   @id @default(cuid())
  key         String   @unique
  label       String
  baseRole    UserRole
  surface     String
  isSystem    Boolean  @default(false)
  createdById String?
  createdBy   User?    @relation("roleCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
  permissions RolePermission[]
  users       User[]   @relation("userRole")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([baseRole])
  @@index([surface])
}

model RolePermission {
  id        String @id @default(cuid())
  roleId    String
  role      Role   @relation(fields: [roleId], references: [id], onDelete: Cascade)
  moduleKey String
  action    String

  @@unique([roleId, moduleKey, action])
  @@index([roleId])
}
```

- [ ] **Step 3: Extend `User`**

In `model User`, add:
```prisma
  roleId          String?
  assignedRole    Role?    @relation("userRole", fields: [roleId], references: [id], onDelete: SetNull)
  createdRoles    Role[]   @relation("roleCreatedBy")
```

- [ ] **Step 4: Generate migration SQL and apply**

```bash
mkdir -p prisma/migrations/20260706_dynamic_rbac
npx prisma migrate diff --from-config-datasource prisma.config.ts --to-schema prisma/schema.prisma --script > prisma/migrations/20260706_dynamic_rbac/migration.sql
npx prisma migrate deploy
npx prisma generate
```
Expected: migration applies cleanly; `Role` / `RolePermission` tables created, `User.roleId` column added, `MenuConfig` dropped.

- [ ] **Step 5: Verify the client compiles**

Run: `npx tsc --noEmit`
Expected: no errors referencing `MenuConfig` (fix any leftover imports of the removed model).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/prisma
git commit -m "feat(rbac): Role + RolePermission models, User.roleId; drop MenuConfig"
```

---

## Task 3: Permission resolution, guard, and menu builder (pure logic)

**Files:**
- Create: `lib/rbac/permissions.ts`
- Test: `lib/rbac/permissions.test.ts`

- [ ] **Step 1: Write failing tests for the pure helpers**

`lib/rbac/permissions.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { can, defaultPermissionsFor, buildMenu } from "./permissions";

describe("can()", () => {
  const perms = new Set(["announcements:view", "announcements:create"]);
  it("true when key present", () => expect(can(perms, "announcements", "view")).toBe(true));
  it("false when key absent", () => expect(can(perms, "announcements", "delete")).toBe(false));
  it("false for unknown module", () => expect(can(perms, "nope", "view")).toBe(false));
});

describe("defaultPermissionsFor()", () => {
  it("returns SUPER_ADMIN full set as an array of keys", () => {
    const keys = defaultPermissionsFor("SUPER_ADMIN");
    expect(keys).toContain("announcements:delete");
    expect(keys.every((k) => k.includes(":"))).toBe(true);
  });
  it("PROPERTY_VIEWER cannot create announcements", () => {
    expect(defaultPermissionsFor("PROPERTY_VIEWER")).not.toContain("announcements:create");
  });
});

describe("buildMenu()", () => {
  it("includes only company modules the perms allow to view, grouped", () => {
    const perms = new Set(["dashboard:view", "customers:view"]);
    const menu = buildMenu("company", perms);
    const hrefs = menu.flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toContain("/super-admin");
    expect(hrefs).toContain("/super-admin/customers");
    expect(hrefs).not.toContain("/super-admin/users");
  });
  it("excludes modules from other surfaces", () => {
    const perms = new Set(["dashboard:view", "customer-dashboard:view"]);
    const menu = buildMenu("company", perms);
    const hrefs = menu.flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).not.toContain("/building");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/rbac/permissions.test.ts`
Expected: FAIL — cannot import `./permissions`.

- [ ] **Step 3: Implement the pure helpers**

`lib/rbac/permissions.ts` (pure part; the DB/guard part is added in Step 5):
```ts
import "server-only";
import { redirect } from "next/navigation";
import type { UserRole } from "@/lib/prisma/enums";
import type { Surface } from "@/lib/surfaces";
import { db } from "@/lib/db";
import { getEffectiveSession } from "@/lib/auth-effective";
import { RBAC_MODULES, DEFAULT_PERMISSIONS } from "./registry";
import { permKey, type RbacAction } from "./types";

export function can(perms: Set<string>, moduleKey: string, action: RbacAction): boolean {
  return perms.has(permKey(moduleKey, action));
}

export function defaultPermissionsFor(role: UserRole): string[] {
  return DEFAULT_PERMISSIONS[role] ?? [];
}

export interface MenuItem { label: string; href: string; icon: string; }
export interface MenuGroup { id: string; items: MenuItem[]; }

export function buildMenu(surface: Surface, perms: Set<string>): MenuGroup[] {
  const groups = new Map<string, MenuItem[]>();
  for (const m of RBAC_MODULES) {
    if (m.surface !== surface || !m.menu) continue;
    if (!perms.has(permKey(m.key, "view"))) continue;
    const gid = m.menu.group ?? "core";
    if (!groups.has(gid)) groups.set(gid, []);
    groups.get(gid)!.push({ label: m.label, href: m.menu.href, icon: m.menu.icon });
  }
  return [...groups.entries()].map(([id, items]) => ({ id, items }));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/rbac/permissions.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the DB resolution + guard (not unit-tested; integration-verified later)**

Append to `lib/rbac/permissions.ts`:
```ts
/** Resolve the effective session's allowed permission keys. */
export async function getEffectivePermissions(): Promise<{
  perms: Set<string>; surface: Surface; roleId: string | null; role: UserRole;
} | null> {
  const eff = await getEffectiveSession();
  if (!eff) return null;
  const role = eff.user.role;
  const { surfaceForRole } = await import("@/lib/surfaces");
  const surface = surfaceForRole(role);

  const roleId = (eff.user as { roleId?: string | null }).roleId ?? null;
  if (roleId) {
    const rows = await db.rolePermission.findMany({ where: { roleId }, select: { moduleKey: true, action: true } });
    return { perms: new Set(rows.map((r) => permKey(r.moduleKey, r.action as RbacAction))), surface, roleId, role };
  }
  // Fallback: system role row by key === enum, else registry defaults.
  const sysRole = await db.role.findUnique({ where: { key: role }, select: { id: true } });
  if (sysRole) {
    const rows = await db.rolePermission.findMany({ where: { roleId: sysRole.id }, select: { moduleKey: true, action: true } });
    return { perms: new Set(rows.map((r) => permKey(r.moduleKey, r.action as RbacAction))), surface, roleId: sysRole.id, role };
  }
  return { perms: new Set(defaultPermissionsFor(role)), surface, roleId: null, role };
}

/** Server guard: redirect to /unauthorized if the current user lacks the permission. */
export async function requirePermission(moduleKey: string, action: RbacAction): Promise<void> {
  const resolved = await getEffectivePermissions();
  if (!resolved) redirect("/login");
  if (!can(resolved.perms, moduleKey, action)) redirect("/unauthorized");
}
```
Note: `eff.user.roleId` is populated in Task 5 (session callback). Until then the fallback path runs — safe.

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit && npx vitest run lib/rbac/permissions.test.ts`
Expected: no type errors; tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/rbac/permissions.ts lib/rbac/permissions.test.ts
git commit -m "feat(rbac): permission resolution, requirePermission guard, menu builder"
```

---

## Task 4: Seed/sync script + user backfill

**Files:**
- Create: `prisma/seed-rbac.ts`

- [ ] **Step 1: Write the seed script**

`prisma/seed-rbac.ts`:
```ts
import { db } from "../lib/db";
import { USER_ROLES } from "../lib/roles-constants";
import { surfaceForRole } from "../lib/surfaces";
import { ROLE_LABELS } from "../lib/roles-constants";
import { defaultPermissionsFor } from "../lib/rbac/permissions";
import type { UserRole } from "../lib/prisma/enums";

async function main() {
  // 1. Ensure a system Role row per enum, with default permissions if none exist yet.
  for (const role of USER_ROLES as readonly UserRole[]) {
    const existing = await db.role.upsert({
      where: { key: role },
      update: {},
      create: {
        key: role,
        label: ROLE_LABELS[role] ?? role,
        baseRole: role,
        surface: surfaceForRole(role),
        isSystem: true,
      },
      include: { permissions: { select: { id: true } } },
    });

    if (existing.permissions.length === 0) {
      const keys = defaultPermissionsFor(role);
      await db.rolePermission.createMany({
        data: keys.map((k) => {
          const [moduleKey, action] = k.split(":");
          return { roleId: existing.id, moduleKey, action };
        }),
        skipDuplicates: true,
      });
      console.log(`seeded ${keys.length} perms for ${role}`);
    }
  }

  // 2. Backfill: users without roleId → their system role row.
  const sysRoles = await db.role.findMany({ where: { isSystem: true }, select: { id: true, key: true } });
  const byKey = new Map(sysRoles.map((r) => [r.key, r.id]));
  const users = await db.user.findMany({ where: { roleId: null }, select: { id: true, role: true } });
  for (const u of users) {
    const rid = byKey.get(u.role);
    if (rid) await db.user.update({ where: { id: u.id }, data: { roleId: rid } });
  }
  console.log(`backfilled ${users.length} users`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run the seed**

Run: `npx tsx --env-file=.env prisma/seed-rbac.ts`
Expected: logs "seeded N perms" per role and "backfilled N users". No error.

- [ ] **Step 3: Verify idempotency**

Run it a second time: `npx tsx --env-file=.env prisma/seed-rbac.ts`
Expected: no new perms seeded (all roles already have permissions), backfilled 0 users.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed-rbac.ts
git commit -m "feat(rbac): idempotent seed/sync of system roles + user backfill"
```

---

## Task 5: Expose roleId on the session

**Files:**
- Modify: `auth.ts` (or wherever the Auth.js `session`/`jwt` callbacks live)

- [ ] **Step 1: Locate the session callbacks**

Run: `grep -rn "callbacks\|session:\|jwt:" auth.ts lib/auth*.ts app/api/auth 2>/dev/null | head`
Identify where `role`, `companyId`, `customerId` are attached to `session.user`.

- [ ] **Step 2: Add `roleId` alongside the existing user fields**

In the `jwt` callback, when loading the user (same query that fetches `role`), also select `roleId` and copy it onto the token. In the `session` callback, copy `token.roleId` → `session.user.roleId`. Follow the exact pattern already used for `companyId`. Example (adapt to actual code):
```ts
// jwt callback, where user is loaded:
token.roleId = dbUser.roleId ?? null;
// session callback:
(session.user as any).roleId = token.roleId ?? null;
```

- [ ] **Step 3: Update the EffectiveSession type + resolver**

In `lib/auth-effective.ts`, add `roleId: string | null` to the `EffectiveSession.user` interface and populate it in both branches (impersonated target uses `target.roleId`; normal uses `(session.user as any).roleId`).

- [ ] **Step 4: Verify build + manual sign-in check**

Run: `npx tsc --noEmit`
Expected: no type errors. Then run `npm run dev`, sign in, and confirm no runtime error on a guarded page.

- [ ] **Step 5: Commit**

```bash
git add auth.ts lib/auth-effective.ts
git commit -m "feat(rbac): expose roleId on session and effective session"
```

---

## Task 6: Dynamic sidebar from permissions

**Files:**
- Modify: `components/admin/app-shell.tsx`
- Modify: `components/admin/sidebar-nav.tsx`

- [ ] **Step 1: Build the menu in AppShell and pass it down**

In `components/admin/app-shell.tsx`, after resolving `eff`, compute the menu:
```ts
import { getEffectivePermissions, buildMenu } from "@/lib/rbac/permissions";
// …inside AppShell, after the eff null-check:
const resolved = await getEffectivePermissions();
const menu = resolved ? buildMenu(resolved.surface, resolved.perms) : [];
```
Pass `menu={menu}` to `<SidebarNav … />`.

- [ ] **Step 2: Consume the menu in SidebarNav**

In `components/admin/sidebar-nav.tsx`:
- Add `menu: MenuGroup[]` to `Props` (import the `MenuGroup`/`MenuItem` types from `@/lib/rbac/permissions`).
- Build an icon lookup map from the react-icons already imported at the top of the file, keyed by the icon string name used in the registry (e.g. `{ RiDashboardLine, RiBarChartLine, … }`), plus a fallback icon.
- Add group metadata (label + color) map keyed by group id (`core`, `management`, `financials`, `settings`, `cms`, `preview`, `properties`, `people`, `operations`, `assets`, `services`, `tasks`).
- Replace `const navGroups = NAV_BY_ROLE[role] ?? …` with a transform of the passed `menu` into the existing `NavGroup[]` render shape, resolving each item's icon string via the lookup map and each group's label/color via the group map.
- Delete the `NAV_BY_ROLE` constant.

- [ ] **Step 3: Verify each surface renders its menu**

Run `npm run dev`. Sign in as a company user (or use View-as) and confirm the sidebar shows exactly the modules permitted. Repeat for a customer role and a collaborator via View-as.
Expected: menus match today's structure for default (unedited) roles.

- [ ] **Step 4: Commit**

```bash
git add components/admin/app-shell.tsx components/admin/sidebar-nav.tsx
git commit -m "feat(rbac): render sidebar dynamically from resolved permissions"
```

---

## Task 7: Server actions for role management

**Files:**
- Create: `app/actions/rbac.ts`

- [ ] **Step 1: Write the server actions**

`app/actions/rbac.ts`:
```ts
"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getEffectiveSession } from "@/lib/auth-effective";
import { surfaceForRole } from "@/lib/surfaces";
import { RBAC_MODULES } from "@/lib/rbac/registry";
import { RBAC_ACTIONS, type RbacAction } from "@/lib/rbac/types";
import type { UserRole } from "@/lib/prisma/enums";

async function assertSuperAdmin() {
  const eff = await getEffectiveSession();
  if (!eff || eff.real.role !== "SUPER_ADMIN") throw new Error("Forbidden");
}

function validKeys(): Set<string> {
  return new Set(RBAC_MODULES.flatMap((m) => m.actions.map((a) => `${m.key}:${a}`)));
}

/** Replace a role's full permission set. `keys` = ["module:action", …]. */
export async function saveRolePermissions(roleId: string, keys: string[]) {
  await assertSuperAdmin();
  const role = await db.role.findUnique({ where: { id: roleId }, select: { key: true } });
  if (!role) throw new Error("Role not found");
  if (role.key === "SUPER_ADMIN") throw new Error("SUPER_ADMIN is locked to full access");

  const valid = validKeys();
  const clean = [...new Set(keys)].filter((k) => valid.has(k));
  await db.$transaction([
    db.rolePermission.deleteMany({ where: { roleId } }),
    db.rolePermission.createMany({
      data: clean.map((k) => { const [moduleKey, action] = k.split(":"); return { roleId, moduleKey, action }; }),
    }),
  ]);
  revalidatePath("/super-admin/roles");
}

export async function createCustomRole(label: string, baseRole: UserRole, keys: string[]) {
  await assertSuperAdmin();
  const key = `custom-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
  const eff = await getEffectiveSession();
  const valid = validKeys();
  const clean = [...new Set(keys)].filter((k) => valid.has(k));
  const role = await db.role.create({
    data: {
      key, label, baseRole, surface: surfaceForRole(baseRole), isSystem: false,
      createdById: eff!.real.id,
      permissions: { create: clean.map((k) => { const [moduleKey, action] = k.split(":"); return { moduleKey, action }; }) },
    },
  });
  revalidatePath("/super-admin/roles");
  return role.id;
}

export async function deleteCustomRole(roleId: string) {
  await assertSuperAdmin();
  const role = await db.role.findUnique({ where: { id: roleId }, select: { isSystem: true, baseRole: true, _count: { select: { users: true } } } });
  if (!role) throw new Error("Role not found");
  if (role.isSystem) throw new Error("System roles cannot be deleted");
  // Reassign users to the system role matching baseRole before delete.
  const sys = await db.role.findUnique({ where: { key: role.baseRole }, select: { id: true } });
  await db.user.updateMany({ where: { roleId }, data: { roleId: sys?.id ?? null, role: role.baseRole } });
  await db.role.delete({ where: { id: roleId } });
  revalidatePath("/super-admin/roles");
}

/** Assign a role to a user, keeping the legacy `role` enum synced to baseRole. */
export async function assignUserRole(userId: string, roleId: string) {
  await assertSuperAdmin();
  const role = await db.role.findUnique({ where: { id: roleId }, select: { baseRole: true } });
  if (!role) throw new Error("Role not found");
  await db.user.update({ where: { id: userId }, data: { roleId, role: role.baseRole } });
  revalidatePath("/super-admin/users");
}

/** Reset a system role's permissions to registry defaults. */
export async function resetRoleToDefaults(roleId: string) {
  await assertSuperAdmin();
  const role = await db.role.findUnique({ where: { id: roleId }, select: { baseRole: true, key: true } });
  if (!role) throw new Error("Role not found");
  const { defaultPermissionsFor } = await import("@/lib/rbac/permissions");
  const keys = defaultPermissionsFor(role.baseRole);
  await db.$transaction([
    db.rolePermission.deleteMany({ where: { roleId } }),
    db.rolePermission.createMany({ data: keys.map((k) => { const [moduleKey, action] = k.split(":"); return { roleId, moduleKey, action }; }) }),
  ]);
  revalidatePath("/super-admin/roles");
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add app/actions/rbac.ts
git commit -m "feat(rbac): server actions for role permissions, custom roles, assignment"
```

---

## Task 8: Editable roles matrix UI

**Files:**
- Modify: `app/(company)/super-admin/roles/page.tsx` (server component: load data, guard)
- Create: `app/(company)/super-admin/roles/role-editor.tsx` (client component)

- [ ] **Step 1: Rewrite the page as a guarded server component**

`app/(company)/super-admin/roles/page.tsx`:
```tsx
import { requirePermission } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { RBAC_MODULES } from "@/lib/rbac/registry";
import { RoleEditor } from "./role-editor";

export const metadata = { title: "Ρόλοι — Super Admin" };

export default async function RolesPage() {
  await requirePermission("roles", "edit");
  const roles = await db.role.findMany({
    orderBy: [{ isSystem: "desc" }, { label: "asc" }],
    include: { permissions: { select: { moduleKey: true, action: true } }, _count: { select: { users: true } } },
  });
  const data = roles.map((r) => ({
    id: r.id, key: r.key, label: r.label, baseRole: r.baseRole, surface: r.surface,
    isSystem: r.isSystem, userCount: r._count.users,
    perms: r.permissions.map((p) => `${p.moduleKey}:${p.action}`),
  }));
  const modules = RBAC_MODULES.map((m) => ({ key: m.key, label: m.label, surface: m.surface, actions: m.actions }));
  return <RoleEditor roles={data} modules={modules} />;
}
```

- [ ] **Step 2: Build the client editor**

`app/(company)/super-admin/roles/role-editor.tsx` — a `"use client"` component that:
- Receives `roles` and `modules` props (shapes from Step 1).
- Lets the user pick a role (tabs/dropdown of system + custom roles).
- Renders modules grouped by surface; for the selected role, a checkbox per `action` the module supports.
- Disables all checkboxes when the selected role's `key === "SUPER_ADMIN"` (locked full access) with an explanatory note.
- "Αποθήκευση" button → calls `saveRolePermissions(roleId, checkedKeys)`; "Επαναφορά" → `resetRoleToDefaults(roleId)` (system roles only); "Νέος ρόλος" dialog → `createCustomRole(label, baseRole, keys)`; delete button on custom roles → `deleteCustomRole(roleId)` with confirm.
- Uses `useTransition` for pending state; imports actions from `@/app/actions/rbac`.
- Follows the existing page's inline-style visual language (cards, `var(--card)`, `var(--border)`, Fluent colors).

Keep the read-only overview table as a secondary section if desired, but the matrix is now interactive.

- [ ] **Step 3: Manual verification**

Run `npm run dev`, go to `/super-admin/roles`:
- Toggle a permission for MANAGER, save, reload → persists.
- Confirm SUPER_ADMIN checkboxes are disabled.
- Create a custom role (baseRole = ADMIN), assign perms, save → appears in list.
- Reset MANAGER to defaults → matches registry defaults.
- Delete the custom role → users (if any) revert to baseRole.

- [ ] **Step 4: Commit**

```bash
git add "app/(company)/super-admin/roles/page.tsx" "app/(company)/super-admin/roles/role-editor.tsx"
git commit -m "feat(rbac): editable roles matrix + custom role management UI"
```

---

## Task 9: Role assignment in user management + verification pass

**Files:**
- Modify: the super-admin users page/form (`app/(company)/super-admin/users/…`)

- [ ] **Step 1: Locate the users management UI**

Run: `ls "app/(company)/super-admin/users"` and open the edit form. Identify where `role` is currently set.

- [ ] **Step 2: Add a role selector backed by DB roles**

Load roles from DB (`db.role.findMany`) filtered to the user's surface where relevant, and render a dropdown (system + custom). On change, call `assignUserRole(userId, roleId)`. Remove/replace any direct `role` enum edit so `roleId` is the single source (the action keeps `role` synced).

- [ ] **Step 3: End-to-end verification**

- Assign a custom role to a test user.
- Sign in as (or View-as) that user → sidebar reflects the custom role's permissions.
- Attempt to visit a route whose module the role lacks `view` for → redirected to `/unauthorized` (requires that route to call `requirePermission`; see Task 10).

- [ ] **Step 4: Commit**

```bash
git add "app/(company)/super-admin/users"
git commit -m "feat(rbac): assign system/custom roles to users from user management"
```

---

## Task 10: Wire per-route guards (incremental)

**Files:**
- Modify: high-value route entry points (server components / server actions) across surfaces.

- [ ] **Step 1: Add guards to the sensitive company routes first**

At the top of each target page's server component, add `await requirePermission("<moduleKey>", "view")`; for mutating server actions add the matching `create`/`edit`/`delete` check. Start with: `customers`, `users`, `roles`, `billing`, `services`, `settings`, `integrations`.

Example (`app/(company)/super-admin/customers/page.tsx`):
```ts
import { requirePermission } from "@/lib/rbac/permissions";
// first line of the component body:
await requirePermission("customers", "view");
```

- [ ] **Step 2: Verify a denied role is blocked server-side**

With a custom role lacking `customers:view`, navigate directly to `/super-admin/customers` by URL.
Expected: redirect to `/unauthorized` (not just a hidden menu item).

- [ ] **Step 3: Record remaining routes as follow-up**

Add a checklist comment block at the bottom of `lib/rbac/registry.ts` listing modules whose routes still need `requirePermission` wiring, so the coverage gap is explicit (mitigation for the "forgotten guards" risk).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(rbac): enforce requirePermission on sensitive routes"
```

---

## Self-review notes

- **Spec coverage:** custom roles (Tasks 2,7,8), system roles immutable + SUPER_ADMIN locked (Tasks 7,8), registry code-defined (Task 1), auto-seed + backfill (Task 4), CRUD granularity (Task 1 actions), menu enforcement (Task 6), server-guard enforcement (Tasks 3,10), role assignment with role/roleId sync (Tasks 7,9), MenuConfig retired (Task 2). All covered.
- **Type consistency:** `permKey`, `RbacAction`, `defaultPermissionsFor`, `buildMenu`, `MenuGroup`/`MenuItem`, `getEffectivePermissions`, `requirePermission` used consistently across tasks.
- **Risk mitigations in-plan:** SUPER_ADMIN lock (Task 7/8), role/roleId single-source via actions (Task 7/9), forgotten-guard coverage list (Task 10 Step 3), idempotent seed (Task 4 Step 3).
```
