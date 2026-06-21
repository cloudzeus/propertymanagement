# Spec: Reusable AI Agent Core + Building Onboarding Wizard

**Date:** 2026-06-21
**Status:** Approved (brainstorming)
**Supersedes:** the parked guide [2026-06-21-ai-building-onboarding-wizard-GUIDE.md](2026-06-21-ai-building-onboarding-wizard-GUIDE.md). Same intent, but **no Vercel AI SDK** — built on the project's existing plain-`fetch` DeepSeek pattern (`lib/ai.ts`) so it runs self-contained on Coolify, and factored as a **reusable core** (the AI part will be used elsewhere in the app).

## Σκοπός

1. A thin, reusable AI layer for DeepSeek with **streaming + tool-calling**: a server agent loop + a client chat hook, with cost tracking. Each consumer brings its own system prompt + Zod tools.
2. First consumer: a **split-screen building onboarding wizard** where a manager chats in Greek and a live form fills from tool calls; one explicit button creates the building shell (Customer→Property→Building→units) and hands off to the existing detail grids.

## Αρχές (locked decisions)

- **No Vercel AI SDK.** Plain `fetch` to `https://api.deepseek.com/v1/chat/completions` (OpenAI-compatible), `stream: true`, SSE relay. Matches existing `lib/ai.ts`.
- **Thin reusable core, not a framework.** Two building blocks (server `runAgentStream`, client `useAiChat`). No registry/sessions/persistence yet.
- **AI never writes.** Tool calls stream to the client; the consumer decides what to do (the wizard updates form state). All DB writes go through a human-triggered server action. Core is designed to *allow* future read-only server tools without rewrite.
- **Wizard builds the structural shell + smart defaults**, then hands off to the grids for τ.μ./όροφο/χιλιοστά. `heatingType` sets the heating distribution method.
- **Wizard starts from an existing customer** (entry from CustomerTree). Customer matching/ΑΦΜ is a future extension.

---

## 1. Reusable AI core — server (`lib/ai/agent.ts`)

```ts
export type AgentTool = { name: string; description: string; parameters: object }; // parameters = JSON Schema (from Zod)
export type AgentMessage = { role: "system" | "user" | "assistant" | "tool"; content: string; tool_call_id?: string };

/** Stream a DeepSeek chat completion as SSE. Relays assistant token deltas and
 *  tool-call deltas to the caller. Does NOT execute tools. Logs cost via logAPIUsage. */
export function runAgentStream(opts: {
  system: string;
  messages: AgentMessage[];
  tools?: AgentTool[];
  model?: string; // default "deepseek-chat"
}): ReadableStream<Uint8Array>;
```
- Builds the request body (`messages` with system prepended, `tools` mapped to OpenAI tool format `{ type: "function", function: {...} }`, `stream: true`).
- Reads the upstream SSE, re-emits a normalized SSE event stream to the client:
  - `event: token` `data: {"delta":"..."}` for assistant content deltas,
  - `event: tool` `data: {"name":"...","argsDelta":"..."}` for tool-call argument deltas (accumulated client-side),
  - `event: done` at `[DONE]`, `event: error` on upstream failure.
- On completion, calls `logAPIUsage({ apiName: "deepseek", endpoint: "/chat/completions", model, tokensUsed, status })` (token counts from the final `usage` chunk when present; `stream_options: { include_usage: true }` requested).
- Missing `DEEPSEEK_API_KEY` → a stream that emits a single `error` event with a clear message (mirrors `lib/ai.ts`).

### Route handler `app/api/ai/agent/route.ts`
```ts
POST { agentKey: string, messages: AgentMessage[] }
```
- Auth: session required (reuse the app's auth; super-admin/staff scope consistent with other admin APIs).
- Resolves `agentKey` → an agent definition (`{ system, tools }`) from a small registry `lib/ai/agents/index.ts`. Unknown key → 400.
- Returns `new Response(runAgentStream({ system, messages, tools }), { headers: { "Content-Type": "text/event-stream", ... } })`.

---

## 2. Reusable AI core — client (`hooks/useAiChat.ts`)

```ts
type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

export function useAiChat(opts: {
  endpoint?: string;      // default "/api/ai/agent"
  agentKey: string;
  onToolCall?: (name: string, args: unknown) => void; // fired when a tool call's args fully parse
}): {
  messages: ChatMessage[];
  input: string; setInput: (s: string) => void;
  send: () => Promise<void>;
  isStreaming: boolean;
  error: string | null;
};
```
- `send()` POSTs `{ agentKey, messages: [...] }`, reads the SSE body via `response.body!.getReader()` + a small SSE line parser, appends/updates the streaming assistant message token-by-token.
- Accumulates tool-call `argsDelta` per call id; when a call's accumulated JSON parses, fires `onToolCall(name, parsedArgs)`.
- Domain-agnostic: no building knowledge inside the hook.

The SSE parsing is factored into a pure, testable function `lib/ai/sse.ts`:
```ts
export function parseAgentSse(chunk: string, state: SseState): { events: AgentEvent[]; state: SseState };
```
`AgentEvent = { type: "token"; delta } | { type: "tool"; id; name?; argsDelta } | { type: "done" } | { type: "error"; message }`.

---

## 3. Onboarding wizard (first consumer)

### Agent definition `lib/ai/agents/building-onboarding.ts`
- Greek system prompt: acts as an expert building-administration onboarding assistant; extracts parameters through natural, non-sequential conversation; calls the tool whenever it learns values (parallel extraction in one call when possible).
- One tool, Zod-validated:
```ts
const onboardingSchema = z.object({
  address: z.string().optional(),
  totalApartments: z.number().int().positive().optional(),
  heatingType: z.enum(["CENTRAL", "AUTONOMOUS_HOURS", "AUTONOMOUS_METERS", "GAS"]).optional(),
  managerName: z.string().optional(),
});
```
Tool name `updateBuildingOnboardingData`. Registered under `agentKey: "building-onboarding"`. JSON Schema derived from the Zod schema (via `zod-to-json-schema` or a hand-written schema kept in sync — prefer a tiny dependency-free hand map if `zod-to-json-schema` isn't already a dep).

### Page `app/(dashboard)/super-admin/customers/[customerId]/onboarding/page.tsx`
- Split-screen: left chat (`useAiChat({ agentKey: "building-onboarding", onToolCall })`), right read-only form bound to local state.
- `onToolCall("updateBuildingOnboardingData", args)` → merge args into form state; changed fields flash amber.
- `heatingType` → derived label of the distribution method: `AUTONOMOUS_METERS → METERED_70_30`, others → `HEATING_MILLESIMES` (display only here).
- One button «Δημιουργία & συνέχεια στις λεπτομέρειες» → calls the server action, then `router.push` to the new building's detail page.

### Server action `app/actions/building-onboarding.ts`
```ts
export async function createBuildingFromOnboarding(customerId: string, data: {
  address: string; totalApartments: number; heatingType: HeatingTypeEnum; managerName: string;
}): Promise<{ buildingId: string } | { error: string }>;
```
- `requireSuperAdmin`. Validate with the same Zod schema (server-authoritative; never trusts the AI).
- Create (or reuse) a Property under the customer, then a Building (storing address + a heating hint), then `totalApartments` numbered Units.
- Set the heating expense category's building override basis when `heatingType === AUTONOMOUS_METERS` → `METERED_70_30` (via the existing `BuildingCategoryOverride` mechanism), else leave default.
- Return `{ buildingId }`. Read the existing customer→property→building→unit creation code to match field names/relations exactly during planning.

### Entry point
- A «AI onboarding» action in the customer's building dropdown / CustomerTree, linking to the onboarding page.

---

## 4. Errors, cost, testing

- **No API key / upstream error:** the stream emits an `error` event; the hook surfaces `error`; already-filled form fields persist.
- **Cost tracking:** every completion logs via `logAPIUsage` (existing). No new cost model.
- **Server authority:** `createBuildingFromOnboarding` re-validates with Zod and is the only write path.
- **Tests (pure units):**
  - `lib/ai/sse.ts` `parseAgentSse` — token deltas, multi-chunk tool-call arg accumulation, `[DONE]`, malformed line tolerance.
  - onboarding Zod schema — accepts partials, rejects bad totals/enums.
  - `createBuildingFromOnboarding` — correct unit count, correct heating override for `AUTONOMOUS_METERS`, Property reuse/creation. (DB-touching test only if a test DB exists; otherwise assert the computed write plan via a pure helper that builds the create payloads.)
  - The LLM itself is not tested end-to-end.

## 5. Out of scope (now)

- Conversation persistence / history.
- Customer matching / ΑΦΜ validation (future read-only server tool on the same core).
- Per-unit τ.μ./όροφο via chat (the grids do this better).
- Multi-agent registry beyond a simple key→definition map.
- Reusing the core in other features (this spec only ships the core + the wizard; other consumers come later).

## 6. ENV

Already present: `DEEPSEEK_API_KEY`, `DEEPSEEK_API_URL`. The agent uses `https://api.deepseek.com/v1/chat/completions` (consistent with existing `lib/ai.ts`).
