# Provider Viva Config Implementation Plan (sub-project 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** SUPER_ADMIN/ADMIN configure the provider's Viva account (collects payments from app users) in an encrypted `AppSettings` store, DB-first with env fallback; a super-admin settings page.

**Architecture:** Additive `AppSettings` columns (migrate-diff flow) + `lib/payments/provider-viva.ts` resolver (DB→env→null) + refactor `lib/viva.ts` provider calls to take config + `app/actions/provider-viva.ts` (SUPER_ADMIN/ADMIN, encrypted, masked) + `components/settings/ProviderVivaSettings.tsx` on `/super-admin/settings/payments`.

**Spec:** `docs/superpowers/specs/2026-07-19-provider-viva-config-design.md`

Conventions: branch `main`; stage only touched files; trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Ignore pre-existing failures (auth.ts, otp.ts, prisma.config.ts, seed.ts, costs routes, ForgotPasswordForm, landing-types.test).

Facts: `lib/crypto/secrets.ts` (encryptSecret/decryptSecret/maskSecret). `lib/app-settings.ts` `getAppSettings()` reads the singleton. `AppSettings` id="singleton". `app/actions/brand.ts` shows `requireSuperAdmin` (auth + role). `lib/viva.ts` exports getAccessToken/createVivaOrder/vivaUrls (env-reading) + createVivaOrderWith/getVivaTransactionWith (explicit creds — per-property). Wallet: `app/api/wallet/topup/{route,callback}.ts`. Migration flow (project): `npx prisma migrate diff --from-config-datasource prisma.config.ts --to-schema prisma/schema.prisma --script`. Do NOT `prisma migrate dev`.

---

### Task 1: Schema + migration (additive, nullable)

**Files:** `prisma/schema.prisma`; new `prisma/migrations/<ts>_provider_viva/migration.sql`.

- [ ] **Step 1:** Add to `model AppSettings`:
```prisma
  providerVivaEnabled        Boolean  @default(false)
  providerVivaClientId       String?
  providerVivaClientSecretEnc String?
  providerVivaMerchantId     String?
  providerVivaApiKeyEnc      String?
  providerVivaSourceCode     String?
```
- [ ] **Step 2:** Generate the migration SQL: `mkdir -p prisma/migrations/20260719_provider_viva && npx prisma migrate diff --from-config-datasource prisma.config.ts --to-schema prisma/schema.prisma --script > prisma/migrations/20260719_provider_viva/migration.sql`. **Read the SQL** — it must be only `ALTER TABLE ... ADD COLUMN` (nullable / boolean default false), no drops. If it contains anything destructive, STOP and report.
- [ ] **Step 3:** Apply: `npx prisma migrate deploy` (against the .env DATABASE_URL). Regenerate client: `npx prisma generate`. Report the applied SQL.
- [ ] **Step 4:** `npx tsc --noEmit 2>&1 | grep -i "appsettings\|providerViva"` empty. Commit `feat(db): provider Viva config columns on AppSettings`.

---

### Task 2: Config resolver + lib/viva refactor

**Files:** Create `lib/payments/provider-viva.ts`; modify `lib/viva.ts`; modify `app/api/wallet/topup/{route,callback}.ts`.

- [ ] **Step 1:** `lib/payments/provider-viva.ts`:
```ts
import { getAppSettings } from "@/lib/app-settings";
import { decryptSecret } from "@/lib/crypto/secrets";

export type ProviderVivaConfig = {
  source: "db" | "env";
  clientId: string; clientSecret: string;
  merchantId: string | null; apiKey: string | null; sourceCode: string | null;
};

export async function getProviderVivaConfig(): Promise<ProviderVivaConfig | null> {
  const s = await getAppSettings();
  if (s?.providerVivaEnabled && s.providerVivaClientId && s.providerVivaClientSecretEnc) {
    return {
      source: "db",
      clientId: s.providerVivaClientId,
      clientSecret: decryptSecret(s.providerVivaClientSecretEnc),
      merchantId: s.providerVivaMerchantId ?? null,
      apiKey: s.providerVivaApiKeyEnc ? decryptSecret(s.providerVivaApiKeyEnc) : null,
      sourceCode: s.providerVivaSourceCode ?? null,
    };
  }
  const clientId = process.env.VIVA_CLIENT_ID, clientSecret = process.env.VIVA_CLIENT_SECRET;
  if (clientId && clientSecret) {
    return { source: "env", clientId, clientSecret,
      merchantId: process.env.VIVA_MERCHANT_ID ?? null, apiKey: process.env.VIVA_API_KEY ?? null,
      sourceCode: process.env.VIVA_SOURCE_CODE ?? null };
  }
  return null;
}

export async function isProviderVivaConfigured(): Promise<boolean> {
  return (await getProviderVivaConfig()) !== null;
}
```
- [ ] **Step 2:** `lib/viva.ts`: add `getAccessTokenFor(cfg: {clientId,clientSecret})` and `createVivaOrderFor(cfg: ProviderVivaConfig, input)` (uses cfg.clientId/secret for OAuth, cfg.sourceCode). Keep the existing env-based `getAccessToken`/`createVivaOrder` as thin wrappers that resolve `getProviderVivaConfig()` then delegate (so callers keep working) OR update callers directly — pick the smaller diff. Do NOT change `createVivaOrderWith`/`getVivaTransactionWith` (per-property).
- [ ] **Step 3:** `app/api/wallet/topup/route.ts`: resolve `const cfg = await getProviderVivaConfig(); if (!cfg) return 502; ... createVivaOrderFor(cfg, ...)`. Callback GET handshake: use cfg.merchantId/apiKey when source db, else env (keep behavior). Behavior unchanged when no DB config.
- [ ] **Step 4:** `npx tsc --noEmit 2>&1 | grep -E "provider-viva|lib/viva|wallet/topup"` empty; `npm run build`. Commit `feat(pay): provider Viva config resolver (DB-first, env fallback)`.

---

### Task 3: Action + settings UI

**Files:** Create `app/actions/provider-viva.ts`; Create `components/settings/ProviderVivaSettings.tsx`; Create `app/(company)/super-admin/settings/payments/page.tsx`; modify `lib/rbac/registry.ts` (+ reconcile).

- [ ] **Step 1:** `app/actions/provider-viva.ts` ("use server"): `requireStaff()` = auth + role in [SUPER_ADMIN, ADMIN] else Forbidden. `getProviderVivaForEdit()` → masked view `{ providerVivaEnabled, providerVivaClientId, providerVivaMerchantId, providerVivaSourceCode, apiKeyMask, clientSecretMask, hasApiKey, hasClientSecret, source }` (source from getProviderVivaConfig). `saveProviderViva(input)` → encrypt apiKey/clientSecret when provided (undefined keeps, empty clears), upsert AppSettings singleton, revalidate `/super-admin/settings/payments`. Never return plaintext.
- [ ] **Step 2:** `ProviderVivaSettings.tsx` (client): form (Ενεργό switch, Client ID, Client Secret [password + mask + Αλλαγή], Merchant ID, API Key [password + mask + Αλλαγή], Source Code) + status «Πηγή: DB/ENV». Orithon tokens, Ri Line icons, no secret logged.
- [ ] **Step 3:** Page `/super-admin/settings/payments` (server): guard SUPER_ADMIN/ADMIN (mirror other super-admin settings pages), render `<ProviderVivaSettings/>`. Registry: add module `{ key: "settings-payments", label: "Πληρωμές (Viva)", surface: "company", menu: { href: "/super-admin/settings/payments", icon: "RiBankCardLine", group: "settings" }, actions:[...CRUD] }`, grant to SUPER_ADMIN + ADMIN in DEFAULT_PERMISSIONS. Run `npx tsx --env-file=.env prisma/reconcile-rbac.ts` (twice; report).
- [ ] **Step 4:** `npx tsc --noEmit` filtered empty; `npm run build`; `npx vitest run`. Commit `feat(pay): provider Viva settings UI (super-admin/admin)`.

---

### Task 4: Verify + review + ship

- [ ] vitest/tsc/build green modulo documented.
- [ ] Dev smoke: `/super-admin/settings/payments` renders the form; wallet top-up path still resolves via env fallback (no DB config) — `getProviderVivaConfig()` returns source "env" when env set, null otherwise.
- [ ] Security review agent: secrets encrypted, never returned to client (mask only), action SUPER_ADMIN/ADMIN-only, DB-first/env-fallback correct, per-property κοινόχρηστα path untouched, migration additive.
- [ ] Update memory; push. Then sub-project 4.
