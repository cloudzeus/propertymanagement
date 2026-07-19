# Per-Property Viva Setup + Secrets Crypto — Design (sub-project 1+2)

**Date:** 2026-07-19 · **Status:** Approved by user

## Goal

Let SUPER_ADMIN / ADMIN (any property) and MANAGER (their assigned property) register/correct a
property's **own** Viva credentials, so κοινόχρηστα quick-pay routes residents' money to the
property's Viva account. Foundation: a secrets crypto helper. Plus a menu cleanup: owners/residents
have **no wallet** (the manager buys AI/API units for the property).

This is sub-project 1+2 of a four-part program (1 crypto → 2 per-property Viva → 3 provider Viva → 4
package selection + payment). 3 and 4 follow as separate spec/plan cycles.

## Decisions (user-approved)

1. Build order 1→2→3→4, staged.
2. Setup lives as a new **«Ρυθμίσεις»** section in the manager shell (`/building/[id]`), and — so
   staff can also configure — the same component on the super-admin property page
   (`/super-admin/properties/[id]`).
3. Roles: per-property Viva creds editable by SUPER_ADMIN, ADMIN, MANAGER-with-access.
4. Owners/residents get no wallet.

## Architecture

### 1. Secrets crypto — `lib/crypto/secrets.ts`

AES-256-GCM. Key from new env `SECRETS_ENCRYPTION_KEY` (32 bytes, base64). `encryptSecret(plain):
string` → base64 `iv.tag.ciphertext`; `decryptSecret(enc): string`. Throws clearly when the key is
missing/short (fails loudly at setup time, never silently stores plaintext). `maskSecret(enc):
string` → «••••1234» (last 4 of the decrypted value, for display). vitest round-trip + tamper
(auth-tag) test with a test key.

### 2. Access + action — `lib/property-access.ts` (helper) + `app/actions/property-viva.ts`

- `canManagePropertyViva(userId, propertyId)`: true for SUPER_ADMIN/ADMIN; for PROPERTY_ADMIN, true
  when a `ManagementAssignment` links them to the property (direct) or a building under it. Reuses
  the same assignment logic as `managerBuildingIds`. Others false.
- `savePropertyViva(propertyId, input)` (server action): guard `canManagePropertyViva`; input
  `{ vivaEnabled: boolean, vivaMerchantId: string|null, vivaSourceCode: string|null, apiKey?: string|null }`.
  `apiKey` present & non-empty → `vivaApiKeyEnc = encryptSecret(apiKey)`; empty string → clear;
  undefined → leave unchanged. Persist to `Property`. NEVER return the decrypted key; return
  `{ vivaEnabled, vivaMerchantId, vivaSourceCode, apiKeyMask, hasApiKey }`. `revalidatePath` the
  property + `/building/[buildingsOfProperty]`.
- `getPropertyVivaForEdit(propertyId)`: guard; returns the same masked shape (never the plaintext).

### 3. Wire the quick-pay stubs to per-property creds — `lib/payments/koinochrista-pay.ts` + `lib/viva.ts`

Replace the throwing `createPropertyVivaOrder`/`getPropertyVivaTransaction` stubs with real calls
that use the property's decrypted credentials (`vivaMerchantId` + `decryptSecret(vivaApiKeyEnc)` +
`vivaSourceCode`) against Viva's documented endpoints. Keep the in-code note that the exact Viva
auth (merchantId/apiKey Basic vs Smart-Checkout OAuth) and endpoint shapes must be **sandbox-verified
before enabling**; the per-property `vivaEnabled` gate + master `VIVA_KOINOCHRISTA_ENABLED` keep it
inert until then. No provider-global fallback (unchanged safety posture).

### 4. UI — `components/property/PropertyVivaSetup.tsx` (client)

Form: «Ενεργό» toggle, Merchant ID, Source Code, API Key (password field showing the current mask
«••••1234» + «Αλλαγή» to enter a new one; empty submit keeps the existing key). Save → `savePropertyViva`.
Inline validation + success/error toast. Reads via `getPropertyVivaForEdit`. Clear helper text that
enabling requires sandbox-verified Viva + the master switch (surface a read-only status line).
Placed in:
- Manager shell: new section «Ρυθμίσεις» (`?s=settings`) — a `SettingsSection` rendering
  `<PropertyVivaSetup propertyId=…/>` (later also packages). Section visible only when the viewer
  can manage the property (manager always can for their own).
- Super-admin property page `/super-admin/properties/[id]`: a «Viva πληρωμές» card with the same
  component.

### 5. Menu cleanup — no wallet for owners/residents

`lib/rbac/registry.ts`: remove `customer-wallet` from `PROPERTY_OWNER` and `PROPERTY_RESIDENT`
`DEFAULT_PERMISSIONS` (keep for `PROPERTY_ADMIN` — the manager buys AI/API units for the property).
Run `prisma/reconcile-rbac.ts` to sync system-role rows. The `/portal/wallet` page + `customer-wallet`
module stay (manager keeps it); only the owner/resident grants are removed.

## Isolation & safety

- Secrets encrypted at rest (`vivaApiKeyEnc`); decrypted key never leaves the server, never returned
  to any client (mask only).
- Action guarded by role + property assignment; manager can only touch their own property.
- Quick-pay remains gated (per-property `vivaEnabled` + master switch) and only routes to the
  property's account — misrouting still structurally impossible.

## Testing / verification

- vitest: `encryptSecret`/`decryptSecret` round-trip + tamper; `maskSecret`.
- Guard: manager without assignment → `savePropertyViva` throws Forbidden; owner/resident → Forbidden.
- Env: `SECRETS_ENCRYPTION_KEY` documented (Coolify); generate with `openssl rand -base64 32`.
- tsc/build; dev smoke — manager shell shows «Ρυθμίσεις» with the Viva form (manager); owner/resident
  sidebar no longer shows «Πορτοφόλι» after reconcile. Final review (crypto correctness, no plaintext
  leak, guard) + push. Provider Viva (3) + packages (4) are separate.
