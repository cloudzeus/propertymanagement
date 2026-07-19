# Provider Viva Config — Design (sub-project 3)

**Date:** 2026-07-19 · **Status:** Approved by user ("ναι σε όλα όπως θέλεις")

## Goal

Let SUPER_ADMIN / ADMIN configure the **provider's own** Viva account (the one that collects
payments from the application's paying users — wallet top-ups today, service/package invoices in
sub-project 4). Move the provider Viva config from env-only into an admin-editable, encrypted store,
with env as a fallback so nothing breaks.

## Decisions

- Provider Viva config on the `AppSettings` singleton (encrypted api key via the sub-project-1
  crypto helper). Editable by SUPER_ADMIN/ADMIN only.
- The provider Viva client reads DB config first, falls back to the existing `VIVA_*` env — no
  behavior change until an admin saves DB config.

## Architecture

### 1. Schema — `AppSettings` provider Viva fields (migration)

Add to `AppSettings`: `providerVivaEnabled Boolean @default(false)`, `providerVivaMerchantId String?`,
`providerVivaApiKeyEnc String?`, `providerVivaSourceCode String?`, `providerVivaClientId String?`,
`providerVivaClientSecretEnc String?` (Smart Checkout OAuth pair, encrypted). Apply via the project's
migrate-diff flow: `npx prisma migrate diff --from-config-datasource prisma.config.ts --to-schema
prisma/schema.prisma --script > prisma/migrations/<ts>_provider_viva/migration.sql` then
`prisma migrate deploy` (per project conventions — NOT `migrate dev`). Regenerate the client.

### 2. Config resolver — `lib/payments/provider-viva.ts`

`getProviderVivaConfig()`: read the `AppSettings` singleton; if `providerVivaEnabled` and creds
present, return `{ source:"db", clientId, clientSecret:decrypt(...), merchantId, apiKey:decrypt(...),
sourceCode }`; else fall back to env (`VIVA_CLIENT_ID`/`VIVA_CLIENT_SECRET`/`VIVA_SOURCE_CODE`/
`VIVA_MERCHANT_ID`/`VIVA_API_KEY`) as `{ source:"env", ... }`; null when neither is configured.
`isProviderVivaConfigured(): boolean`.

### 3. lib/viva.ts — accept provider config

Refactor `getAccessToken`/`createVivaOrder` (and the wallet callback's handshake) to take the
resolved provider config instead of reading env directly — `getAccessToken(cfg)`,
`createVivaOrder(cfg, input)`. Keep thin env-reading wrappers (`createVivaOrderFromEnv`) ONLY if
needed for backward-compat; prefer routing all provider calls through `getProviderVivaConfig()`.
Update `app/api/wallet/topup/{route,callback}.ts` to resolve config via `getProviderVivaConfig()`
(env fallback preserves current behavior). Do NOT touch the per-property κοινόχρηστα path (that
stays on the property's own creds).

### 4. Action + UI

- `app/actions/provider-viva.ts`: `getProviderVivaForEdit()` / `saveProviderViva(input)` — guarded
  SUPER_ADMIN/ADMIN only (reuse an existing staff guard or role check); encrypt `apiKey` +
  `clientSecret`; return the masked view (`apiKeyMask`, `clientSecretMask`, `hasApiKey`,
  `hasClientSecret`, plus the non-secret fields + `source`). Never return plaintext.
- `components/settings/ProviderVivaSettings.tsx`: form (Ενεργό, Client ID, Client Secret [masked],
  Merchant ID, API Key [masked], Source Code) + a read-only «Πηγή: DB/ENV» status line. Mounted on a
  new super-admin settings page `/super-admin/settings/payments` (add to the super-admin settings
  nav / registry as `settings-payments`, granted to SUPER_ADMIN/ADMIN).

## Isolation & safety

Secrets encrypted at rest (crypto helper); decrypted values never returned to client (mask only);
action SUPER_ADMIN/ADMIN-only. Provider config is company-wide (single-tenant). No change to the
per-property κοινόχρηστα routing. Wallet flow behavior unchanged until DB config is saved.

## Testing / verification

- `getProviderVivaConfig` prefers DB when enabled, else env, else null (unit test with mocked
  settings / env).
- Guard: non-staff → `saveProviderViva` Forbidden.
- Migration diff empty after apply; `prisma migrate deploy` clean; client regenerated.
- tsc/build; super-admin settings page shows the form; wallet top-up still works via env fallback.
- Security review; push. Sub-project 4 (packages + payment) next.
