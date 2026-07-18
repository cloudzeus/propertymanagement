# Real-time Auto-Refresh (SSE) — Design

**Date:** 2026-07-18 · **Status:** Approved by user

## Goal

Every building-scoped mutation (payment, expense, announcement, maintenance, etc.) pushes an event
so the signage screen and every other open surface of that building re-renders automatically —
server components stay the rendering model (`router.refresh()` re-fetches RSC payload).

## Approach (user-approved)

SSE + in-process event bus (option A). No Redis/WebSocket; the deploy is a single Node instance
(Coolify → `next start`). If the app ever scales horizontally, the bus needs a Redis adapter —
recorded as a known limit.

## Architecture

1. **`lib/realtime/bus.ts`** — `globalThis`-cached `EventEmitter` (survives dev HMR), API:
   `publishBuildingEvent(buildingId, type)` and `subscribeBuilding(buildingId, listener)` →
   unsubscribe fn. Event types: `payment | expense | announcement | maintenance | calendar |
   assembly | file | contact | koinochrista | unit`. Max listeners raised (100+ screens).
2. **Publishers** — one `publishBuildingEvent` call in each mutating server action that already
   twin-revalidates `/building/${id}`: koinochrista (mark-paid → `payment`, issuance → `koinochrista`),
   building-expenses (`expense`), announcements (`announcement`), maintenance-requests +
   maintenance-logs (`maintenance`), recurring-tasks (`calendar`), assemblies (`assembly`),
   building-files (`file`), contacts (`contact`), unit/occupant mutations (`unit`). Fire-and-forget
   after the DB write succeeds.
3. **`GET /api/realtime?building=<id>`** — SSE route handler (nodejs runtime, `dynamic = "force-dynamic"`):
   resolves `getEffectiveSession`, authorizes the building (staff → any; PROPERTY_ADMIN/VIEWER →
   ManagementAssignment; OWNER/RESIDENT → own/occupied unit in the building) — 403 otherwise.
   Streams `data: {"type":…}` frames; 25 s heartbeat comments keep proxies from idling out;
   cleans up the subscription on `request.signal` abort.
4. **`components/realtime/AutoRefresh.tsx`** — small client component `{ buildingId }`:
   `EventSource` to the route, debounces events 2 s → `startTransition(router.refresh())`.
   EventSource auto-reconnects. Mounted in:
   - `SignageBoard` (its 60 s polling interval becomes a 5 min fallback),
   - `BuildingManagerShell`,
   - `/portal` dashboard and `/owner` dashboard (server pages render `<AutoRefresh>` per
     building of the user — owner/resident may span multiple buildings → one element per id,
     capped at 5).
5. **Security:** subscription is read-notification only (no payload beyond the event type), and
   the route's access check reuses the same scoping rules as the surfaces; no cross-building
   event delivery.

## Error handling

- SSE connection failures → EventSource retries automatically; screens still have the polling
  fallback (signage 5 min) and manual navigation elsewhere.
- Publish failures never break the action (try/catch around emit — emit is sync/in-memory anyway).

## Testing / verification

- vitest for the bus (publish → subscriber fires, unsubscribe stops delivery, cross-building
  isolation).
- `tsc --noEmit`, `next build`, dev smoke: `curl -N /api/realtime?building=X` unauthenticated →
  401/redirect; authorized stream emits heartbeats; mutation triggers a data frame.

## Known limits

Single-instance only (in-process bus). External webhooks (e.g. future Viva payment callbacks) can
call `publishBuildingEvent` from their route handlers to light up the same screens.
