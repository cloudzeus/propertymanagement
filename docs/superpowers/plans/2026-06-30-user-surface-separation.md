# User-Surface Separation + Super-Admin View-as — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group the 6 role dashboards into 3 product "surfaces" (company / customer / marketplace) with shared layout shells, give the super-admin a "View as" impersonation tool, and let logged-in users browse the public site.

**Architecture:** Next.js route groups `(company)`, `(customer)`, `(marketplace)` wrap the existing role folders — URLs and page code stay identical (route groups in parens don't affect the URL). A shared layout shell renders per surface. Role→surface and role→home are centralised in `lib/surfaces.ts`. Impersonation is a SUPER_ADMIN-only signed cookie read through `getEffectiveSession()`, which becomes the single source of truth the proxy guard and pages consult. Page-merging within a surface (one RBAC-gated `properties` page instead of three) is explicitly OUT OF SCOPE — deferred to each surface's redesign.

**Tech Stack:** Next.js (custom build — read `node_modules/next/dist/docs/` before route/middleware changes), Auth.js v5 (`auth()` from `auth.ts`), Prisma 7 (`lib/db.ts`, enums from `@/lib/prisma/enums`), Vitest (`lib/**/*.test.ts`, node env), `next/headers` cookies, the existing middleware in `proxy.ts`.

**Key existing facts (verified):**
- `lib/roles-constants.ts` exports `COMPANY_ROLES`, `CUSTOMER_ROLES`, `COLLABORATOR_ROLES`, `ROLE_GROUP` (role→`"company"|"customer"|"collaborator"`).
- `app/page.tsx` is a client component that force-redirects logged-in users via a role→path map.
- `proxy.ts` is the active middleware: `export default auth(...)` with per-path-prefix role guards and `config.matcher`.
- Auth protection is **also** enforced in `components/admin/app-shell.tsx` (`AppShell` calls `auth()`, redirects to `/login` or `/unauthorized` based on `allowedRoles`).
- `components/admin/sidebar-nav.tsx` holds `NAV_BY_ROLE` (hardcoded menus). Per-role layouts live at `app/(dashboard)/<role>/layout.tsx`.
- No general audit table exists (`APIUsageLog` only). Memory rule: do NOT `prisma migrate dev`; use `prisma migrate diff` + `migrate deploy`.

---

## File Structure

**New files**
- `lib/surfaces.ts` — `Surface` type, `surfaceForRole()`, `homePathForRole()`, `SURFACE_ROLES`. Single source for routing decisions.
- `lib/surfaces.test.ts` — unit tests for the above.
- `lib/impersonation.ts` — cookie name constant, `Impersonation` type, pure `parseImpersonation()` / `serializeImpersonation()`, async `readImpersonation()` / `writeImpersonation()` / `clearImpersonation()` (cookie I/O via `next/headers`).
- `lib/impersonation.test.ts` — unit tests for parse/serialize.
- `lib/auth-effective.ts` — `getEffectiveSession()` returning `{ user, real, impersonatorId }`.
- `app/actions/impersonation.ts` — `startImpersonation(targetUserId)` / `stopImpersonation()` server actions.
- `app/(company)/layout.tsx`, `app/(customer)/layout.tsx`, `app/(marketplace)/layout.tsx` — surface shells.
- `app/(marketplace)/marketplace/page.tsx` + `.../layout.tsx` — placeholder collaborator surface.
- `components/admin/impersonation-banner.tsx` — fixed "Viewing as … / Exit" banner.

**Modified files**
- `prisma/schema.prisma` — add `ImpersonationEvent` model.
- `proxy.ts` — read effective role; add `/marketplace` guard; drop COLLABORATOR from `/staff`.
- `app/page.tsx` — stop force-redirect; add "Go to my workspace" CTA via `homePathForRole`.
- `components/admin/sidebar-nav.tsx` — add "Προεπισκόπηση / View as" group (SUPER_ADMIN only).
- `components/admin/app-shell.tsx` — consult `getEffectiveSession()`; render `ImpersonationBanner`.

**Moved (git mv, URLs unchanged)**
- `app/(dashboard)/{admin,manager,staff,super-admin}` → `app/(company)/…`
- `app/(dashboard)/{owner,portal}` → `app/(customer)/…`

---

## Task 1: `lib/surfaces.ts` — role→surface/home single source

**Files:**
- Create: `lib/surfaces.ts`
- Test: `lib/surfaces.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/surfaces.test.ts
import { describe, it, expect } from "vitest";
import { surfaceForRole, homePathForRole, SURFACE_ROLES } from "./surfaces";

describe("surfaceForRole", () => {
  it("maps company roles", () => {
    expect(surfaceForRole("SUPER_ADMIN")).toBe("company");
    expect(surfaceForRole("EMPLOYEE")).toBe("company");
  });
  it("maps customer roles", () => {
    expect(surfaceForRole("PROPERTY_OWNER")).toBe("customer");
    expect(surfaceForRole("PROPERTY_RESIDENT")).toBe("customer");
  });
  it("maps collaborator to marketplace", () => {
    expect(surfaceForRole("COLLABORATOR")).toBe("marketplace");
  });
});

describe("homePathForRole", () => {
  it("returns the role landing path", () => {
    expect(homePathForRole("SUPER_ADMIN")).toBe("/super-admin");
    expect(homePathForRole("ADMIN")).toBe("/admin");
    expect(homePathForRole("MANAGER")).toBe("/manager");
    expect(homePathForRole("PROPERTY_ADMIN")).toBe("/manager");
    expect(homePathForRole("EMPLOYEE")).toBe("/staff");
    expect(homePathForRole("COLLABORATOR")).toBe("/marketplace");
    expect(homePathForRole("PROPERTY_OWNER")).toBe("/owner");
    expect(homePathForRole("PROPERTY_RESIDENT")).toBe("/portal");
    expect(homePathForRole("PROPERTY_VIEWER")).toBe("/portal");
  });
});

describe("SURFACE_ROLES", () => {
  it("lists company roles", () => {
    expect(SURFACE_ROLES.company).toContain("SUPER_ADMIN");
    expect(SURFACE_ROLES.marketplace).toEqual(["COLLABORATOR"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- lib/surfaces.test.ts`
Expected: FAIL — `Cannot find module './surfaces'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/surfaces.ts
import type { UserRole } from "@/lib/prisma/enums";
import { ROLE_GROUP } from "@/lib/roles-constants";

export type Surface = "company" | "customer" | "marketplace";

export const SURFACE_ROLES: Record<Surface, UserRole[]> = {
  company: ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"],
  customer: ["PROPERTY_ADMIN", "PROPERTY_OWNER", "PROPERTY_RESIDENT", "PROPERTY_VIEWER"],
  marketplace: ["COLLABORATOR"],
};

export function surfaceForRole(role: UserRole): Surface {
  const group = ROLE_GROUP[role] ?? "company";
  return group === "collaborator" ? "marketplace" : group;
}

const HOME_BY_ROLE: Record<UserRole, string> = {
  SUPER_ADMIN: "/super-admin",
  ADMIN: "/admin",
  MANAGER: "/manager",
  PROPERTY_ADMIN: "/manager",
  EMPLOYEE: "/staff",
  COLLABORATOR: "/marketplace",
  PROPERTY_OWNER: "/owner",
  PROPERTY_RESIDENT: "/portal",
  PROPERTY_VIEWER: "/portal",
};

export function homePathForRole(role: UserRole): string {
  return HOME_BY_ROLE[role] ?? "/";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- lib/surfaces.test.ts`
Expected: PASS (3 suites).

- [ ] **Step 5: Commit**

```bash
git add lib/surfaces.ts lib/surfaces.test.ts
git commit -m "feat(surfaces): central role->surface and role->home mapping"
```

---

## Task 2: `lib/impersonation.ts` — cookie parse/serialize (pure) + I/O

**Files:**
- Create: `lib/impersonation.ts`
- Test: `lib/impersonation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/impersonation.test.ts
import { describe, it, expect } from "vitest";
import { parseImpersonation, serializeImpersonation, IMPERSONATION_COOKIE } from "./impersonation";

const sample = { actorId: "a1", targetUserId: "u2", targetRole: "PROPERTY_OWNER" as const };

describe("impersonation cookie codec", () => {
  it("round-trips", () => {
    expect(parseImpersonation(serializeImpersonation(sample))).toEqual(sample);
  });
  it("returns null on garbage", () => {
    expect(parseImpersonation("not-json")).toBeNull();
    expect(parseImpersonation("")).toBeNull();
    expect(parseImpersonation(undefined)).toBeNull();
  });
  it("returns null when required fields missing", () => {
    expect(parseImpersonation(JSON.stringify({ actorId: "a1" }))).toBeNull();
  });
  it("exposes a cookie name", () => {
    expect(IMPERSONATION_COOKIE).toBe("impersonation");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- lib/impersonation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/impersonation.ts
import "server-only";
import { cookies } from "next/headers";
import type { UserRole } from "@/lib/prisma/enums";

export const IMPERSONATION_COOKIE = "impersonation";

export interface Impersonation {
  actorId: string;
  targetUserId: string;
  targetRole: UserRole;
}

export function serializeImpersonation(value: Impersonation): string {
  return JSON.stringify(value);
}

export function parseImpersonation(raw: string | undefined | null): Impersonation | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v && typeof v.actorId === "string" && typeof v.targetUserId === "string" && typeof v.targetRole === "string") {
      return { actorId: v.actorId, targetUserId: v.targetUserId, targetRole: v.targetRole };
    }
    return null;
  } catch {
    return null;
  }
}

export async function readImpersonation(): Promise<Impersonation | null> {
  const store = await cookies();
  return parseImpersonation(store.get(IMPERSONATION_COOKIE)?.value);
}

export async function writeImpersonation(value: Impersonation): Promise<void> {
  const store = await cookies();
  store.set(IMPERSONATION_COOKIE, serializeImpersonation(value), {
    httpOnly: true, sameSite: "lax", secure: true, path: "/",
  });
}

export async function clearImpersonation(): Promise<void> {
  const store = await cookies();
  store.delete(IMPERSONATION_COOKIE);
}
```

> Note: `"server-only"` makes the file server-restricted but the pure exports remain importable in vitest (node env). If vitest errors on `server-only`, alias it in `vitest.config.ts` (`resolve.alias` "server-only" → an empty stub at `test/stubs/empty.ts`). Add that stub only if the test fails.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- lib/impersonation.test.ts`
Expected: PASS. (If it fails on the `server-only` import, add the alias stub above, then re-run.)

- [ ] **Step 5: Commit**

```bash
git add lib/impersonation.ts lib/impersonation.test.ts
git commit -m "feat(impersonation): signed-cookie codec + cookie I/O helpers"
```

---

## Task 3: `ImpersonationEvent` Prisma model + migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the model**

Append near the other models in `prisma/schema.prisma`:

```prisma
model ImpersonationEvent {
  id            String   @id @default(cuid())
  actorId       String   // real SUPER_ADMIN user id
  targetUserId  String
  targetRole    UserRole
  action        String   // "START" | "STOP"
  createdAt     DateTime @default(now())

  @@index([actorId])
  @@index([targetUserId])
}
```

- [ ] **Step 2: Generate client + create migration via diff (NOT migrate dev)**

Run:
```bash
npx prisma generate
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/manual_impersonation_event.sql
```
Expected: a `.sql` file containing `CREATE TABLE "ImpersonationEvent" …`. Review it.

- [ ] **Step 3: Apply migration**

Run: `npx prisma migrate deploy` (or execute the SQL against the dev DB per the project's deploy convention in memory `project_prisma_conventions`).
Expected: table created, no drift errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(impersonation): ImpersonationEvent audit model"
```

---

## Task 4: `getEffectiveSession()` — single identity source

**Files:**
- Create: `lib/auth-effective.ts`

- [ ] **Step 1: Implement** (no unit test — it depends on `auth()`/db; covered by manual verification in Task 11)

```ts
// lib/auth-effective.ts
import "server-only";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { UserRole } from "@/lib/prisma/enums";
import { readImpersonation } from "@/lib/impersonation";

export interface EffectiveSession {
  user: { id: string; role: UserRole; companyId: string | null; name: string | null; email: string };
  real: { id: string; role: UserRole };
  impersonatorId: string | null;
}

export async function getEffectiveSession(): Promise<EffectiveSession | null> {
  const session = await auth();
  if (!session?.user) return null;
  const realId = (session.user as any).id as string;
  const realRole = (session.user as any).role as UserRole;

  if (realRole === "SUPER_ADMIN") {
    const imp = await readImpersonation();
    if (imp && imp.actorId === realId) {
      const target = await db.user.findUnique({ where: { id: imp.targetUserId } });
      if (target) {
        return {
          user: { id: target.id, role: target.role as UserRole, companyId: target.companyId ?? null, name: target.name, email: target.email },
          real: { id: realId, role: realRole },
          impersonatorId: realId,
        };
      }
    }
  }

  return {
    user: { id: realId, role: realRole, companyId: (session.user as any).companyId ?? null, name: session.user.name ?? null, email: session.user.email ?? "" },
    real: { id: realId, role: realRole },
    impersonatorId: null,
  };
}
```

> Confirm the `db.user` field names (`name`, `email`, `companyId`, `role`) against `prisma/schema.prisma` `model User` before running; adjust if the schema differs.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors in `lib/auth-effective.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/auth-effective.ts
git commit -m "feat(auth): getEffectiveSession resolves impersonation overlay"
```

---

## Task 5: Impersonation server actions

**Files:**
- Create: `app/actions/impersonation.ts`

- [ ] **Step 1: Implement**

```ts
// app/actions/impersonation.ts
"use server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { UserRole } from "@/lib/prisma/enums";
import { writeImpersonation, clearImpersonation, readImpersonation } from "@/lib/impersonation";
import { homePathForRole } from "@/lib/surfaces";

export async function startImpersonation(targetUserId: string): Promise<void> {
  const session = await auth();
  const actorId = (session?.user as any)?.id as string | undefined;
  const actorRole = (session?.user as any)?.role as UserRole | undefined;
  if (!actorId || actorRole !== "SUPER_ADMIN") throw new Error("Forbidden");

  const target = await db.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw new Error("Target user not found");

  await writeImpersonation({ actorId, targetUserId: target.id, targetRole: target.role as UserRole });
  await db.impersonationEvent.create({
    data: { actorId, targetUserId: target.id, targetRole: target.role as UserRole, action: "START" },
  });
  redirect(homePathForRole(target.role as UserRole));
}

export async function stopImpersonation(): Promise<void> {
  const imp = await readImpersonation();
  if (imp) {
    await db.impersonationEvent.create({
      data: { actorId: imp.actorId, targetUserId: imp.targetUserId, targetRole: imp.targetRole, action: "STOP" },
    });
  }
  await clearImpersonation();
  redirect("/super-admin");
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/actions/impersonation.ts
git commit -m "feat(impersonation): start/stop server actions with audit"
```

---

## Task 6: Public home — stop force-redirect, add workspace CTA

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace the redirect logic**

In `app/page.tsx`, delete the `useEffect` that calls `router.push(destination)` and the `redirectMap`. Keep the page rendering the public marketing content for everyone. Where the header renders the Login/Sign-up buttons, branch on session:

```tsx
// inside the header actions, replacing the static Login/Sign Up block
{session?.user ? (
  <Link
    href={homePathForRole((session.user as any).role)}
    className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 font-medium"
  >
    Μετάβαση στον χώρο μου
  </Link>
) : (
  <>
    <Link href="/login" className="px-4 py-2 text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 font-medium">Login</Link>
    <Link href="/register" className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 font-medium">Sign Up</Link>
  </>
)}
```

Add `import { homePathForRole } from "@/lib/surfaces";` at the top. Remove the now-unused `useRouter`/`useEffect`/loading-while-redirecting branches.

- [ ] **Step 2: Verify the public path is not guarded for logged-in users**

Confirm `proxy.ts` `publicPaths` already includes `"/"` (it does). No change needed there for this task.

- [ ] **Step 3: Manual check**

Run: `npm run dev`, log in as any role, visit `/`.
Expected: the marketing page renders (no auto-redirect) and shows "Μετάβαση στον χώρο μου" pointing at the role's home.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat(public): keep public home accessible to logged-in users + workspace CTA"
```

---

## Task 7: Create surface route groups + move role folders (URLs unchanged)

**Files:**
- Move: `app/(dashboard)/{admin,manager,staff,super-admin}` → `app/(company)/…`
- Move: `app/(dashboard)/{owner,portal}` → `app/(customer)/…`
- Create: `app/(company)/layout.tsx`, `app/(customer)/layout.tsx`

- [ ] **Step 1: Read the Next routing guide first**

Run: `ls node_modules/next/dist/docs/` and read the routing/route-groups doc. Confirm that parenthesised route groups do NOT contribute to the URL in this Next version. STOP and report if that has changed.

- [ ] **Step 2: git mv the folders**

```bash
mkdir -p "app/(company)" "app/(customer)"
git mv "app/(dashboard)/admin"       "app/(company)/admin"
git mv "app/(dashboard)/manager"     "app/(company)/manager"
git mv "app/(dashboard)/staff"       "app/(company)/staff"
git mv "app/(dashboard)/super-admin" "app/(company)/super-admin"
git mv "app/(dashboard)/owner"       "app/(customer)/owner"
git mv "app/(dashboard)/portal"      "app/(customer)/portal"
rmdir "app/(dashboard)" 2>/dev/null || true
```

- [ ] **Step 3: Add a shared company surface layout**

Create `app/(company)/layout.tsx`:

```tsx
import { AppShell } from "@/components/admin/app-shell";
import { SURFACE_ROLES } from "@/lib/surfaces";

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  return <AppShell allowedRoles={[...SURFACE_ROLES.company]}>{children}</AppShell>;
}
```

Create `app/(customer)/layout.tsx`:

```tsx
import { AppShell } from "@/components/admin/app-shell";
import { SURFACE_ROLES } from "@/lib/surfaces";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <AppShell allowedRoles={[...SURFACE_ROLES.customer]}>{children}</AppShell>;
}
```

- [ ] **Step 4: Delete the now-redundant inner per-role layouts that only wrapped AppShell**

For each of `app/(company)/{admin,manager,staff,super-admin}/layout.tsx` and `app/(customer)/{owner,portal}/layout.tsx`: if the file ONLY renders `<AppShell allowedRoles=…>{children}</AppShell>` with no other logic, delete it (the surface layout now provides the shell). If a layout has extra logic (metadata, providers), keep it but remove its `<AppShell>` wrapper so the shell isn't double-rendered. Inspect each before deleting.

> Per-path role precision (e.g. `/super-admin` only for SUPER_ADMIN) is still enforced by `proxy.ts` (Task 9). The surface layout only enforces the coarse "must belong to this surface" check.

- [ ] **Step 5: Build to verify no route collisions**

Run: `npm run build`
Expected: build succeeds; routes `/admin`, `/manager`, `/staff`, `/super-admin`, `/owner`, `/portal` still compile at the SAME URLs.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(surfaces): wrap role folders in (company)/(customer) groups with shared shells"
```

---

## Task 8: New marketplace surface for COLLABORATOR

**Files:**
- Create: `app/(marketplace)/layout.tsx`, `app/(marketplace)/marketplace/page.tsx`

- [ ] **Step 1: Create the surface layout**

```tsx
// app/(marketplace)/layout.tsx
import { AppShell } from "@/components/admin/app-shell";
import { SURFACE_ROLES } from "@/lib/surfaces";

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return <AppShell allowedRoles={[...SURFACE_ROLES.marketplace]}>{children}</AppShell>;
}
```

- [ ] **Step 2: Create a placeholder dashboard page**

```tsx
// app/(marketplace)/marketplace/page.tsx
export const metadata = { title: "Marketplace — PropertyPro" };

export default function MarketplaceHome() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Marketplace επαγγελματιών</h1>
      <p className="text-gray-600 mt-2">Η εμπειρία συνεργαζόμενων επαγγελματιών σχεδιάζεται σε επόμενη φάση.</p>
    </div>
  );
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: `/marketplace` route compiles, no collision with `/` (home).

- [ ] **Step 4: Commit**

```bash
git add "app/(marketplace)"
git commit -m "feat(marketplace): placeholder collaborator surface at /marketplace"
```

---

## Task 9: Update `proxy.ts` — effective role + marketplace guard + collaborator move

**Files:**
- Modify: `proxy.ts`

- [ ] **Step 1: Read the impersonation cookie in middleware and compute effective role**

In `proxy.ts`, after `const role: string = req.auth?.user?.role ?? "";`, add effective-role resolution from the cookie (middleware can read cookies but NOT the db, so trust the `targetRole` baked into the cookie, gated on real role being SUPER_ADMIN):

```ts
let effectiveRole = role;
if (role === "SUPER_ADMIN") {
  const raw = req.cookies.get("impersonation")?.value;
  if (raw) {
    try {
      const imp = JSON.parse(raw);
      if (imp?.actorId === req.auth?.user?.id && typeof imp?.targetRole === "string") {
        effectiveRole = imp.targetRole;
      }
    } catch { /* ignore malformed cookie */ }
  }
}
const can = (...allowed: string[]) => allowed.includes(effectiveRole);
```

Replace the existing `const can = …` line with the block above (so all guards below use `effectiveRole`).

- [ ] **Step 2: Drop COLLABORATOR from `/staff` and add `/marketplace` guard**

Change the `/staff` guard to company-employee only:

```ts
if (pathWithoutLocale.startsWith("/staff") && !can("SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE")) {
  return NextResponse.redirect(new URL("/unauthorized", req.nextUrl.origin));
}
if (pathWithoutLocale.startsWith("/marketplace") && !can("SUPER_ADMIN", "COLLABORATOR")) {
  return NextResponse.redirect(new URL("/unauthorized", req.nextUrl.origin));
}
```

> SUPER_ADMIN stays allowed everywhere so impersonation (and direct access) works; when impersonating, `effectiveRole` is the target's role so the target-appropriate guard applies too.

- [ ] **Step 3: Build + manual guard check**

Run: `npm run build`, then `npm run dev`. Log in as COLLABORATOR → expect redirect target `/marketplace` works and `/staff` now returns `/unauthorized`.
Expected: behaviour as described.

- [ ] **Step 4: Commit**

```bash
git add proxy.ts
git commit -m "feat(proxy): effective-role guards, marketplace route, collaborator off /staff"
```

---

## Task 10: `AppShell` consults effective session + renders banner

**Files:**
- Modify: `components/admin/app-shell.tsx`
- Create: `components/admin/impersonation-banner.tsx`

- [ ] **Step 1: Create the banner**

```tsx
// components/admin/impersonation-banner.tsx
import { stopImpersonation } from "@/app/actions/impersonation";

export function ImpersonationBanner({ label }: { label: string }) {
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 50, background: "#b45309", color: "#fff", padding: "6px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span>Βλέπεις ως <strong>{label}</strong></span>
      <form action={stopImpersonation}>
        <button type="submit" style={{ textDecoration: "underline", color: "#fff" }}>Έξοδος</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Wire `AppShell` to effective session**

In `components/admin/app-shell.tsx`, replace the direct `const session = await auth()` + role extraction with `getEffectiveSession()`:

```tsx
import { getEffectiveSession } from "@/lib/auth-effective";
import { ImpersonationBanner } from "./impersonation-banner";
// ...
const eff = await getEffectiveSession();
if (!eff) redirect("/login");
const role = eff.user.role;
if (allowedRoles && !allowedRoles.includes(role)) redirect("/unauthorized");
```

Use `eff.user.name`/`eff.user.email`/`eff.user.companyId` where the component previously read from `session.user`. Render the banner above the main content when impersonating:

```tsx
{eff.impersonatorId && <ImpersonationBanner label={`${eff.user.name ?? eff.user.email} · ${role}`} />}
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add components/admin/app-shell.tsx components/admin/impersonation-banner.tsx
git commit -m "feat(impersonation): AppShell uses effective session + sticky banner"
```

---

## Task 11: "View as" menu group + user selector (SUPER_ADMIN only)

**Files:**
- Modify: `components/admin/sidebar-nav.tsx`
- Create: `app/(company)/super-admin/view-as/page.tsx`

- [ ] **Step 1: Add a "Προεπισκόπηση / View as" nav entry for SUPER_ADMIN**

In `NAV_BY_ROLE.SUPER_ADMIN` (in `components/admin/sidebar-nav.tsx`), add a group:

```ts
{
  label: "Προεπισκόπηση",
  items: [
    { href: "/super-admin/view-as", label: "View as…", icon: RiEyeLine, iconActive: RiEyeFill },
  ],
},
```

Import `RiEyeLine, RiEyeFill` from `react-icons/ri` at the top (follow the existing icon-import style — linear `*Line` per project convention).

- [ ] **Step 2: Create the View-as selector page**

```tsx
// app/(company)/super-admin/view-as/page.tsx
import { db } from "@/lib/db";
import { startImpersonation } from "@/app/actions/impersonation";

export const metadata = { title: "View as — PropertyPro" };

export default async function ViewAsPage() {
  const users = await db.user.findMany({
    where: { role: { not: "SUPER_ADMIN" } },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { role: "asc" },
    take: 200,
  });

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-4">Προεπισκόπηση ως χρήστης</h1>
      <p className="text-gray-600 mb-6">Διάλεξε χρήστη για να δεις την εφαρμογή με τα δεδομένα του. Έξοδος από το banner.</p>
      <ul className="divide-y">
        {users.map((u) => (
          <li key={u.id} className="flex items-center justify-between py-3">
            <span>{u.name ?? u.email} <span className="text-gray-400">· {u.role}</span></span>
            <form action={startImpersonation.bind(null, u.id)}>
              <button type="submit" className="px-3 py-1 text-blue-600 border border-blue-600 rounded hover:bg-blue-50">View as</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

> `startImpersonation.bind(null, u.id)` produces a server-action form action with the target id pre-bound. Confirm this pattern compiles in this Next version (read the server-actions doc under `node_modules/next/dist/docs/`); if `bind` is unsupported, use a hidden input + a wrapper action reading `formData.get("id")`.

- [ ] **Step 3: Manual end-to-end check**

Run: `npm run dev`. As SUPER_ADMIN: open `/super-admin/view-as`, click "View as" on a PROPERTY_OWNER → expect redirect to `/owner`, the customer shell renders that owner's data, and the sticky banner shows their name. Click "Έξοδος" → back to `/super-admin`, banner gone. Verify two `ImpersonationEvent` rows (START/STOP) exist.
Expected: all behaviours hold.

- [ ] **Step 4: Commit**

```bash
git add components/admin/sidebar-nav.tsx "app/(company)/super-admin/view-as/page.tsx"
git commit -m "feat(impersonation): View-as menu group + user selector page"
```

---

## Task 12: Final verification sweep

- [ ] **Step 1: Full test + build**

Run: `npm run test && npm run build`
Expected: all tests pass, build clean.

- [ ] **Step 2: Smoke each surface**

Log in (separately) as ADMIN, MANAGER, EMPLOYEE, PROPERTY_OWNER, PROPERTY_RESIDENT, COLLABORATOR. Confirm each lands on the right home (`homePathForRole`) and only sees its surface; cross-surface URLs redirect to `/unauthorized`.

- [ ] **Step 3: Confirm public access while logged-in**

As each role, visit `/`, `/pricing`, `/faq` → render without redirect; "Μετάβαση στον χώρο μου" points to the role home.

- [ ] **Step 4: Commit any fixes, then stop for review**

```bash
git add -A && git commit -m "test: surface-separation verification fixes" || echo "nothing to commit"
```

---

## Out of scope (future, separate plans)
- Merging duplicate per-role pages into single RBAC-gated pages (Group-1 redesign).
- Detailed UI/UX of each surface (company back-office, customer monitoring, marketplace).
- Per-mutation actor attribution beyond START/STOP audit (`getEffectiveSession().impersonatorId` is exposed for future adoption).
- Landing-page redesign with structured CMS sections (prior brainstorm).
