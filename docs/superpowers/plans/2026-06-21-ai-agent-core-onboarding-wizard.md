# Reusable AI Agent Core + Building Onboarding Wizard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A reusable DeepSeek streaming + tool-calling layer (server `runAgentStream` + client `useAiChat`), and a split-screen building-onboarding wizard as its first consumer that creates a building shell via one human-triggered server action.

**Architecture:** Plain `fetch` SSE to DeepSeek (no Vercel AI SDK), mirroring the existing `lib/ai.ts`. A pure SSE parser is unit-tested in isolation; the server relays a normalized SSE stream; a domain-agnostic client hook accumulates tokens + tool-call args and fires `onToolCall`. The wizard supplies a Zod tool + system prompt; the AI never writes — a server action does, re-validating with the same Zod schema.

**Tech Stack:** Next.js 16.2 (Route Handlers, server actions, App Router), DeepSeek (OpenAI-compatible REST), Zod v4 (`z.toJSONSchema`), Vitest, React, Tailwind.

**Spec:** [docs/superpowers/specs/2026-06-21-ai-agent-core-onboarding-wizard-design.md](../specs/2026-06-21-ai-agent-core-onboarding-wizard-design.md)

**Project conventions:** DB client `import { db } from "@/lib/db"`. Prisma enums from `@/lib/prisma/enums`. Existing DeepSeek call + cost logging live in `lib/ai.ts` (`logAPIUsage` from `lib/api-costs.ts`, `env` from `lib/env.ts`). Existing creation actions: `createProperty` (`app/actions/properties.ts`), `createBuilding`/`createUnit` + private `companyOfProperty`/`requireSuperAdmin` (`app/actions/buildings.ts`).

---

## File Structure

- **Create** `lib/ai/sse.ts` (+ test) — pure SSE parser `parseAgentSse` and the upstream-delta normalizer.
- **Create** `lib/ai/agent.ts` (+ test for the pure request-body builder) — `runAgentStream`.
- **Create** `lib/ai/agents/building-onboarding.ts` — Zod tool + system prompt + JSON schema.
- **Create** `lib/ai/agents/index.ts` — `agentKey → { system, tools }` registry.
- **Create** `app/api/ai/agent/route.ts` — POST SSE endpoint.
- **Create** `hooks/useAiChat.ts` — client chat hook.
- **Create** `app/actions/building-onboarding.ts` (+ test for the pure payload builder) — `createBuildingFromOnboarding`.
- **Create** `app/(dashboard)/super-admin/customers/[customerId]/onboarding/page.tsx` + `OnboardingWizard.tsx` — split-screen UI.
- **Modify** the CustomerTree to add an «AI onboarding» entry.

---

## Task 1: Pure SSE parser (`lib/ai/sse.ts`)

**Files:**
- Create: `lib/ai/sse.ts`
- Test: `lib/ai/sse.test.ts`

- [ ] **Step 1: Write the failing test** — create `lib/ai/sse.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseAgentSse, type SseState } from "./sse";

const fresh = (): SseState => ({ buffer: "" });

describe("parseAgentSse", () => {
  it("parses a token event", () => {
    const { events } = parseAgentSse('event: token\ndata: {"delta":"Γεια"}\n\n', fresh());
    expect(events).toEqual([{ type: "token", delta: "Γεια" }]);
  });

  it("parses a tool event with id + name + argsDelta", () => {
    const { events } = parseAgentSse('event: tool\ndata: {"id":"c1","name":"t","argsDelta":"{\\"a\\":"}\n\n', fresh());
    expect(events).toEqual([{ type: "tool", id: "c1", name: "t", argsDelta: '{"a":' }]);
  });

  it("buffers a partial line across chunks", () => {
    const s1 = parseAgentSse('event: token\ndata: {"delta":"a"', fresh());
    expect(s1.events).toEqual([]);
    const s2 = parseAgentSse('}\n\n', s1.state);
    expect(s2.events).toEqual([{ type: "token", delta: "a" }]);
  });

  it("emits done and tolerates blank/malformed lines", () => {
    const { events } = parseAgentSse('event: done\ndata: {}\n\n: comment\n\n', fresh());
    expect(events).toEqual([{ type: "done" }]);
  });

  it("emits error events", () => {
    const { events } = parseAgentSse('event: error\ndata: {"message":"boom"}\n\n', fresh());
    expect(events).toEqual([{ type: "error", message: "boom" }]);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run lib/ai/sse.test.ts`
Expected: FAIL ("parseAgentSse is not a function").

- [ ] **Step 3: Implement** — create `lib/ai/sse.ts`:

```ts
export type AgentEvent =
  | { type: "token"; delta: string }
  | { type: "tool"; id: string; name?: string; argsDelta: string }
  | { type: "done" }
  | { type: "error"; message: string };

export type SseState = { buffer: string };

/** Incremental SSE parser for the normalized agent stream. Accumulates a buffer
 *  across chunks; emits one AgentEvent per complete `event:/data:` block. Blank
 *  lines, comments (`:`), and malformed JSON are tolerated (skipped). */
export function parseAgentSse(chunk: string, state: SseState): { events: AgentEvent[]; state: SseState } {
  const buffer = state.buffer + chunk;
  const blocks = buffer.split("\n\n");
  const rest = blocks.pop() ?? ""; // last piece may be incomplete
  const events: AgentEvent[] = [];

  for (const block of blocks) {
    let ev: string | null = null;
    let dataRaw = "";
    for (const line of block.split("\n")) {
      if (line.startsWith(":")) continue;
      if (line.startsWith("event:")) ev = line.slice(6).trim();
      else if (line.startsWith("data:")) dataRaw += line.slice(5).trim();
    }
    if (!ev) continue;
    let data: any = {};
    if (dataRaw) { try { data = JSON.parse(dataRaw); } catch { continue; } }
    if (ev === "token") events.push({ type: "token", delta: String(data.delta ?? "") });
    else if (ev === "tool") events.push({ type: "tool", id: String(data.id ?? ""), name: data.name, argsDelta: String(data.argsDelta ?? "") });
    else if (ev === "done") events.push({ type: "done" });
    else if (ev === "error") events.push({ type: "error", message: String(data.message ?? "error") });
  }
  return { events, state: { buffer: rest } };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/ai/sse.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/sse.ts lib/ai/sse.test.ts
git commit -m "feat(ai): pure incremental SSE parser for agent stream"
```

---

## Task 2: Agent definitions + registry (`lib/ai/agents/`)

**Files:**
- Create: `lib/ai/agents/building-onboarding.ts`
- Create: `lib/ai/agents/index.ts`
- Test: `lib/ai/agents/building-onboarding.test.ts`

- [ ] **Step 1: Write the failing test** — create `lib/ai/agents/building-onboarding.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { onboardingSchema } from "./building-onboarding";

describe("onboardingSchema", () => {
  it("accepts a partial object (all fields optional)", () => {
    expect(onboardingSchema.safeParse({ managerName: "Γιάννης" }).success).toBe(true);
    expect(onboardingSchema.safeParse({}).success).toBe(true);
  });

  it("rejects a non-positive apartment count", () => {
    expect(onboardingSchema.safeParse({ totalApartments: 0 }).success).toBe(false);
    expect(onboardingSchema.safeParse({ totalApartments: -3 }).success).toBe(false);
  });

  it("rejects an unknown heating type", () => {
    expect(onboardingSchema.safeParse({ heatingType: "SOLAR" }).success).toBe(false);
  });

  it("accepts a valid heating type", () => {
    expect(onboardingSchema.safeParse({ heatingType: "AUTONOMOUS_METERS" }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run lib/ai/agents/building-onboarding.test.ts`
Expected: FAIL ("Cannot find module './building-onboarding'").

- [ ] **Step 3: Implement the agent** — create `lib/ai/agents/building-onboarding.ts`:

```ts
import { z } from "zod";

export const HEATING_TYPES = ["CENTRAL", "AUTONOMOUS_HOURS", "AUTONOMOUS_METERS", "GAS"] as const;
export type HeatingType = (typeof HEATING_TYPES)[number];

export const onboardingSchema = z.object({
  address: z.string().min(1).optional(),
  totalApartments: z.number().int().positive().optional(),
  heatingType: z.enum(HEATING_TYPES).optional(),
  managerName: z.string().min(1).optional(),
});

export type OnboardingData = z.infer<typeof onboardingSchema>;

const SYSTEM = `Είσαι έμπειρος βοηθός διαχείρισης πολυκατοικιών. Μιλάς άπταιστα ελληνικά,
φιλικά και σύντομα. Σκοπός σου: να συλλέξεις 4 στοιχεία για μια νέα πολυκατοικία —
διεύθυνση, αριθμό διαμερισμάτων, τύπο θέρμανσης, και όνομα διαχειριστή.
Μην ακολουθείς άκαμπτη σειρά ερωτήσεων: αν ο χρήστης δώσει πολλά μαζί, εξάγαγέ τα όλα
σε μία κλήση εργαλείου. Κάλεσε το εργαλείο updateBuildingOnboardingData κάθε φορά που
μαθαίνεις ή διορθώνεις τιμές. Ο τύπος θέρμανσης είναι ένα από:
CENTRAL (κεντρική), AUTONOMOUS_HOURS (αυτονομία με ωρομετρητές),
AUTONOMOUS_METERS (αυτονομία με θερμιδομετρητές), GAS (φυσικό αέριο).
Όταν συμπληρωθούν και τα 4, πες στον χρήστη να ελέγξει τη φόρμα δεξιά και να πατήσει «Δημιουργία».`;

/** JSON Schema for the tool parameters, derived from the Zod schema (Zod v4). */
export const onboardingToolParameters = z.toJSONSchema(onboardingSchema);

export const buildingOnboardingAgent = {
  system: SYSTEM,
  tools: [
    {
      name: "updateBuildingOnboardingData",
      description: "Ενημέρωσε τα στοιχεία onboarding της πολυκατοικίας με όσες τιμές γνωρίζεις.",
      parameters: onboardingToolParameters,
    },
  ],
};
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/ai/agents/building-onboarding.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the registry** — create `lib/ai/agents/index.ts`:

```ts
import { buildingOnboardingAgent } from "./building-onboarding";

export type AgentTool = { name: string; description: string; parameters: object };
export type AgentDefinition = { system: string; tools: AgentTool[] };

const REGISTRY: Record<string, AgentDefinition> = {
  "building-onboarding": buildingOnboardingAgent,
};

export function getAgent(key: string): AgentDefinition | null {
  return REGISTRY[key] ?? null;
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "lib/ai/agents"`
Expected: NO matches. (If `z.toJSONSchema` is missing, the installed Zod is <3.23/4 — verify `zod` is v4 in package.json; it is. Use `z.toJSONSchema(schema)`.)

- [ ] **Step 7: Commit**

```bash
git add lib/ai/agents
git commit -m "feat(ai): building-onboarding agent definition + registry"
```

---

## Task 3: Server agent stream (`lib/ai/agent.ts`)

**Files:**
- Create: `lib/ai/agent.ts`
- Test: `lib/ai/agent.test.ts`

- [ ] **Step 1: Write the failing test for the pure body builder** — create `lib/ai/agent.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildRequestBody } from "./agent";

describe("buildRequestBody", () => {
  it("prepends the system message and maps tools to OpenAI function format", () => {
    const body = buildRequestBody({
      system: "sys",
      messages: [{ role: "user", content: "hi" }],
      tools: [{ name: "t", description: "d", parameters: { type: "object", properties: {} } }],
      model: "deepseek-chat",
    });
    expect(body.model).toBe("deepseek-chat");
    expect(body.stream).toBe(true);
    expect(body.messages[0]).toEqual({ role: "system", content: "sys" });
    expect(body.messages[1]).toEqual({ role: "user", content: "hi" });
    expect(body.tools![0]).toEqual({ type: "function", function: { name: "t", description: "d", parameters: { type: "object", properties: {} } } });
  });

  it("omits tools when none provided", () => {
    const body = buildRequestBody({ system: "s", messages: [], model: "deepseek-chat" });
    expect(body.tools).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run lib/ai/agent.test.ts`
Expected: FAIL ("buildRequestBody is not a function").

- [ ] **Step 3: Implement** — create `lib/ai/agent.ts`. The pure `buildRequestBody` is tested; `runAgentStream` does the network relay (not unit-tested):

```ts
import { env } from "@/lib/env";
import { logAPIUsage } from "@/lib/api-costs";
import type { AgentTool } from "@/lib/ai/agents";

export type AgentMessage = { role: "system" | "user" | "assistant" | "tool"; content: string; tool_call_id?: string };

const ENDPOINT = "https://api.deepseek.com/v1/chat/completions";

export function buildRequestBody(opts: { system: string; messages: AgentMessage[]; tools?: AgentTool[]; model: string }) {
  const messages = [{ role: "system" as const, content: opts.system }, ...opts.messages];
  const body: Record<string, unknown> = {
    model: opts.model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
  };
  if (opts.tools && opts.tools.length) {
    body.tools = opts.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
  }
  return body as { model: string; messages: AgentMessage[]; stream: boolean; tools?: unknown[] };
}

const enc = new TextEncoder();
const sse = (event: string, data: unknown) => enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

/** Stream a DeepSeek completion as a normalized SSE stream (token/tool/done/error).
 *  Does not execute tools. Logs cost on completion. */
export function runAgentStream(opts: { system: string; messages: AgentMessage[]; tools?: AgentTool[]; model?: string }): ReadableStream<Uint8Array> {
  const model = opts.model ?? "deepseek-chat";
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      if (!env.DEEPSEEK_API_KEY) {
        controller.enqueue(sse("error", { message: "Το κλειδί DeepSeek δεν έχει ρυθμιστεί." }));
        controller.enqueue(sse("done", {}));
        controller.close();
        return;
      }
      let tokensUsed = 0;
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
          body: JSON.stringify(buildRequestBody({ system: opts.system, messages: opts.messages, tools: opts.tools, model })),
        });
        if (!res.ok || !res.body) {
          controller.enqueue(sse("error", { message: `DeepSeek error ${res.status}` }));
          await logAPIUsage({ apiName: "deepseek", endpoint: "/chat/completions", model, status: "FAILED", errorMessage: `HTTP ${res.status}` });
          controller.enqueue(sse("done", {}));
          controller.close();
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith("data:")) continue;
            const payload = t.slice(5).trim();
            if (payload === "[DONE]") continue;
            let json: any;
            try { json = JSON.parse(payload); } catch { continue; }
            if (json.usage?.total_tokens) tokensUsed = json.usage.total_tokens;
            const choice = json.choices?.[0];
            const delta = choice?.delta;
            if (delta?.content) controller.enqueue(sse("token", { delta: delta.content }));
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                controller.enqueue(sse("tool", { id: tc.id ?? `idx-${tc.index ?? 0}`, name: tc.function?.name, argsDelta: tc.function?.arguments ?? "" }));
              }
            }
          }
        }
        await logAPIUsage({ apiName: "deepseek", endpoint: "/chat/completions", model, tokensUsed, status: "SUCCESS" });
        controller.enqueue(sse("done", {}));
        controller.close();
      } catch (e) {
        controller.enqueue(sse("error", { message: e instanceof Error ? e.message : "Άγνωστο σφάλμα" }));
        controller.enqueue(sse("done", {}));
        controller.close();
      }
    },
  });
}
```
Note: confirm the exact `logAPIUsage` argument shape by reading `lib/api-costs.ts` (it takes `{ apiName, endpoint, model, tokensUsed?, status, errorMessage? }`). Match field names exactly; adjust if they differ.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/ai/agent.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep "lib/ai/agent"`
Expected: NO matches.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/agent.ts lib/ai/agent.test.ts
git commit -m "feat(ai): DeepSeek streaming agent loop with cost logging"
```

---

## Task 4: API route (`app/api/ai/agent/route.ts`)

**Files:**
- Create: `app/api/ai/agent/route.ts`

- [ ] **Step 1: Read an existing route for the auth pattern.** Look at a route under `app/api/super-admin` or `app/api/admin` to copy how the session/role is checked in a Route Handler (the `auth()` import from `@/auth`).

- [ ] **Step 2: Implement** — create `app/api/ai/agent/route.ts`:

```ts
import { auth } from "@/auth";
import { getAgent } from "@/lib/ai/agents";
import { runAgentStream, type AgentMessage } from "@/lib/ai/agent";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  let body: { agentKey?: string; messages?: AgentMessage[] };
  try { body = await request.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
  const agent = body.agentKey ? getAgent(body.agentKey) : null;
  if (!agent) return new Response("Unknown agent", { status: 400 });
  const messages = Array.isArray(body.messages) ? body.messages : [];

  const stream = runAgentStream({ system: agent.system, messages, tools: agent.tools });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep "api/ai/agent"`
Expected: NO matches.

- [ ] **Step 4: Commit**

```bash
git add app/api/ai/agent/route.ts
git commit -m "feat(ai): /api/ai/agent SSE route handler"
```

---

## Task 5: Client chat hook (`hooks/useAiChat.ts`)

**Files:**
- Create: `hooks/useAiChat.ts`

- [ ] **Step 1: Check the hooks directory convention.** Run `ls hooks 2>/dev/null || ls lib/hooks 2>/dev/null`. Place the file where other hooks live (create `hooks/` if none — match imports used elsewhere, e.g. `@/hooks/...`). Adjust the path in later tasks to match.

- [ ] **Step 2: Implement** — create `hooks/useAiChat.ts`:

```ts
"use client";

import { useCallback, useRef, useState } from "react";
import { parseAgentSse, type SseState } from "@/lib/ai/sse";

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

let _id = 0;
const nextId = () => `m${++_id}`;

export function useAiChat(opts: { endpoint?: string; agentKey: string; onToolCall?: (name: string, args: unknown) => void }) {
  const endpoint = opts.endpoint ?? "/api/ai/agent";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toolArgs = useRef<Map<string, { name?: string; args: string }>>(new Map());

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setError(null);
    const userMsg: ChatMessage = { id: nextId(), role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setIsStreaming(true);

    const assistantId = nextId();
    setMessages((m) => [...m, { id: assistantId, role: "assistant", content: "" }]);
    toolArgs.current.clear();

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentKey: opts.agentKey, messages: history.map((m) => ({ role: m.role, content: m.content })) }),
      });
      if (!res.ok || !res.body) { setError(`Σφάλμα ${res.status}`); setIsStreaming(false); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let state: SseState = { buffer: "" };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const { events, state: next } = parseAgentSse(decoder.decode(value, { stream: true }), state);
        state = next;
        for (const ev of events) {
          if (ev.type === "token") {
            setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, content: x.content + ev.delta } : x)));
          } else if (ev.type === "tool") {
            const cur = toolArgs.current.get(ev.id) ?? { name: undefined, args: "" };
            const merged = { name: ev.name ?? cur.name, args: cur.args + ev.argsDelta };
            toolArgs.current.set(ev.id, merged);
            try {
              const parsed = JSON.parse(merged.args);
              if (merged.name) opts.onToolCall?.(merged.name, parsed);
            } catch { /* args still incomplete */ }
          } else if (ev.type === "error") {
            setError(ev.message);
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Σφάλμα σύνδεσης");
    } finally {
      setIsStreaming(false);
    }
  }, [endpoint, input, isStreaming, messages, opts]);

  return { messages, input, setInput, send, isStreaming, error };
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "useAiChat"`
Expected: NO matches.

- [ ] **Step 4: Commit**

```bash
git add hooks/useAiChat.ts
git commit -m "feat(ai): reusable useAiChat client hook (SSE + tool calls)"
```

---

## Task 6: Onboarding write action (`app/actions/building-onboarding.ts`)

**Files:**
- Create: `app/actions/building-onboarding.ts`
- Test: `app/actions/building-onboarding.test.ts`

- [ ] **Step 1: Read the creation code** — read `app/actions/properties.ts` (`createProperty`, `managingCompanyId`) and `app/actions/buildings.ts` (`createBuilding`, `createUnit`, `companyOfProperty`, `requireSuperAdmin`, `BuildingInput`, `UnitInput`) to learn exact field names and the company resolution. The onboarding action must create: a Property under the customer, a Building (address + elevator/boiler hints), and N numbered Units — reusing these helpers or matching their `db.*.create` shapes inside one flow.

- [ ] **Step 2: Write the failing test for the pure payload builder** — create `app/actions/building-onboarding.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildOnboardingPayload } from "./building-onboarding";

describe("buildOnboardingPayload", () => {
  it("creates N numbered units", () => {
    const p = buildOnboardingPayload({ address: "Ακαδημίας 12", totalApartments: 3, heatingType: "CENTRAL", managerName: "Γ" });
    expect(p.units.map((u) => u.unitNumber)).toEqual(["1", "2", "3"]);
  });

  it("flags METERED heating override only for AUTONOMOUS_METERS", () => {
    expect(buildOnboardingPayload({ address: "a", totalApartments: 1, heatingType: "AUTONOMOUS_METERS", managerName: "x" }).meteredHeating).toBe(true);
    expect(buildOnboardingPayload({ address: "a", totalApartments: 1, heatingType: "CENTRAL", managerName: "x" }).meteredHeating).toBe(false);
  });

  it("carries the building name/address", () => {
    const p = buildOnboardingPayload({ address: "Ακαδημίας 12", totalApartments: 2, heatingType: "GAS", managerName: "Γ" });
    expect(p.building.address).toBe("Ακαδημίας 12");
  });
});
```

- [ ] **Step 3: Run to verify fail**

Run: `npx vitest run app/actions/building-onboarding.test.ts`
Expected: FAIL ("buildOnboardingPayload is not a function").

- [ ] **Step 4: Implement** — create `app/actions/building-onboarding.ts`. The pure `buildOnboardingPayload` is tested; the action wires it to Prisma (match the real helpers from Step 1):

```ts
"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { onboardingSchema, type HeatingType } from "@/lib/ai/agents/building-onboarding";
import { requireSuperAdmin, managingCompanyId } from "@/app/actions/_shared"; // adjust import to wherever these live; see Step 1

export type OnboardingInput = { address: string; totalApartments: number; heatingType: HeatingType; managerName: string };

/** Pure: turn validated onboarding data into the create payloads. */
export function buildOnboardingPayload(input: OnboardingInput) {
  const units = Array.from({ length: input.totalApartments }, (_, i) => ({ unitNumber: String(i + 1) }));
  return {
    building: { name: input.address, address: input.address },
    units,
    meteredHeating: input.heatingType === "AUTONOMOUS_METERS",
    managerName: input.managerName,
  };
}

export async function createBuildingFromOnboarding(customerId: string, raw: unknown): Promise<{ buildingId: string } | { error: string }> {
  await requireSuperAdmin();
  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.address || !parsed.data.totalApartments || !parsed.data.heatingType || !parsed.data.managerName) {
    return { error: "Συμπληρώστε όλα τα στοιχεία (διεύθυνση, διαμερίσματα, θέρμανση, διαχειριστή)." };
  }
  const input = parsed.data as OnboardingInput;
  const payload = buildOnboardingPayload(input);
  const companyId = await managingCompanyId();

  const buildingId = await db.$transaction(async (tx) => {
    const property = await tx.property.create({ data: { companyId, customerId, name: payload.building.address, address: payload.building.address } });
    const building = await tx.building.create({ data: { companyId, propertyId: property.id, name: payload.building.name, address: payload.building.address, technicalNotes: `Διαχειριστής: ${payload.managerName}` } });
    if (payload.units.length) {
      await tx.unit.createMany({ data: payload.units.map((u) => ({ buildingId: building.id, unitNumber: u.unitNumber })) });
    }
    if (payload.meteredHeating) {
      // Set heating category override to METERED_70_30 for this building, if a heating category exists.
      const heatingCat = await tx.expenseCategory.findFirst({ where: { defaultBasis: { in: ["HEATING_MILLESIMES", "METERED_70_30"] } }, select: { id: true, defaultTenantPct: true, defaultOwnerPct: true } });
      if (heatingCat) {
        await tx.buildingCategoryOverride.upsert({
          where: { buildingId_categoryId: { buildingId: building.id, categoryId: heatingCat.id } },
          create: { buildingId: building.id, categoryId: heatingCat.id, distributionBasis: "METERED_70_30", tenantPct: heatingCat.defaultTenantPct, ownerPct: heatingCat.defaultOwnerPct },
          update: { distributionBasis: "METERED_70_30" },
        });
      }
    }
    return building.id;
  });

  revalidatePath(`/super-admin/customers/${customerId}`);
  return { buildingId };
}
```
IMPORTANT (Step 1 follow-through): replace the `@/app/actions/_shared` import with the real location of `requireSuperAdmin` + the company-id resolver. If `requireSuperAdmin`/`managingCompanyId` are NOT exported, either export them or inline the same logic (read the existing private definitions and replicate). Match `property`/`building`/`unit` create field names to the existing actions exactly (e.g. include `city/postalCode/country` defaults if the schema marks them required — check the Prisma model; the existing `createProperty` sets `country: "Greece"`).

- [ ] **Step 5: Run the pure test to verify pass**

Run: `npx vitest run app/actions/building-onboarding.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep "building-onboarding"`
Expected: NO matches.

- [ ] **Step 7: Commit**

```bash
git add app/actions/building-onboarding.ts app/actions/building-onboarding.test.ts
git commit -m "feat(onboarding): server action to create building shell from wizard data"
```

---

## Task 7: Wizard UI (split-screen page)

**Files:**
- Create: `app/(dashboard)/super-admin/customers/[customerId]/onboarding/page.tsx`
- Create: `app/(dashboard)/super-admin/customers/[customerId]/onboarding/OnboardingWizard.tsx`

- [ ] **Step 1: Read conventions** — read an existing client component under `app/(dashboard)/super-admin/customers/` and the building dashboard panels for styling/`useRouter` patterns. Confirm the params convention (Next 16 `params` is a Promise → await in the server page).

- [ ] **Step 2: Create the server page** `page.tsx` — verifies the customer exists, renders the client wizard:

```tsx
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { OnboardingWizard } from "./OnboardingWizard";

export default async function OnboardingPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  const customer = await db.customer.findUnique({ where: { id: customerId }, select: { id: true, name: true } });
  if (!customer) notFound();
  return <OnboardingWizard customerId={customer.id} customerName={customer.name} />;
}
```

- [ ] **Step 3: Create the client wizard** `OnboardingWizard.tsx` — split-screen chat + live form + single create button:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAiChat } from "@/hooks/useAiChat";
import { createBuildingFromOnboarding } from "@/app/actions/building-onboarding";
import { HEATING_TYPES, type HeatingType } from "@/lib/ai/agents/building-onboarding";

type Form = { address?: string; totalApartments?: number; heatingType?: HeatingType; managerName?: string };
const HEATING_LABEL: Record<HeatingType, string> = {
  CENTRAL: "Κεντρική", AUTONOMOUS_HOURS: "Αυτονομία (ωρομετρητές)", AUTONOMOUS_METERS: "Αυτονομία (θερμιδομετρητές)", GAS: "Φυσικό αέριο",
};

export function OnboardingWizard({ customerId, customerName }: { customerId: string; customerName: string }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>({});
  const [flash, setFlash] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const { messages, input, setInput, send, isStreaming, error } = useAiChat({
    agentKey: "building-onboarding",
    onToolCall: (name, args) => {
      if (name !== "updateBuildingOnboardingData") return;
      const a = args as Form;
      setForm((f) => ({ ...f, ...a }));
      const changed = Object.keys(a)[0];
      if (changed) { setFlash(changed); setTimeout(() => setFlash(null), 1200); }
    },
  });

  const complete = !!(form.address && form.totalApartments && form.heatingType && form.managerName);
  const method = form.heatingType === "AUTONOMOUS_METERS" ? "70/30 μετρητής" : "χιλιοστά θέρμανσης";

  function create() {
    setErr(null);
    startTransition(async () => {
      const res = await createBuildingFromOnboarding(customerId, form);
      if ("error" in res) { setErr(res.error); return; }
      router.push(`/super-admin/buildings/${res.buildingId}`);
    });
  }

  const cell = (key: keyof Form, label: string, value: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", background: flash === key ? "#fef3c7" : undefined }}>
      <span style={{ color: "#666" }}>{label}</span><b>{value || "—"}</b>
    </div>
  );

  return (
    <div style={{ display: "flex", gap: 16, height: "calc(100vh - 120px)" }}>
      {/* LEFT: chat */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", border: "1px solid var(--border)", borderRadius: 8 }}>
        <div style={{ padding: 12, borderBottom: "1px solid var(--border)", fontWeight: 600 }}>AI Onboarding — {customerName}</div>
        <div style={{ flex: 1, overflowY: "auto", padding: 12, fontSize: 14, lineHeight: 1.6 }}>
          {messages.length === 0 && <div style={{ color: "#888" }}>Πείτε μου για την πολυκατοικία: διεύθυνση, διαμερίσματα, θέρμανση, διαχειριστή.</div>}
          {messages.map((m) => (
            <div key={m.id} style={{ marginBottom: 10, textAlign: m.role === "user" ? "right" : "left" }}>
              <span style={{ display: "inline-block", padding: "6px 10px", borderRadius: 10, background: m.role === "user" ? "#eef2ff" : "#f4f4f6" }}>
                {m.content || (isStreaming ? "…" : "")}
              </span>
            </div>
          ))}
          {error && <div style={{ color: "#c00" }}>{error}</div>}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(); }} style={{ display: "flex", gap: 8, padding: 10, borderTop: "1px solid var(--border)" }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Γράψτε μήνυμα…" disabled={isStreaming} style={{ flex: 1 }} />
          <button type="submit" disabled={isStreaming || !input.trim()}>➤</button>
        </form>
      </div>

      {/* RIGHT: live form */}
      <div style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 8, padding: 16, background: "#fafafa" }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Στοιχεία κτηρίου <span style={{ fontSize: 11, color: "#16a34a" }}>● live</span></div>
        {cell("managerName", "Διαχειριστής", form.managerName ?? "")}
        {cell("address", "Διεύθυνση", form.address ?? "")}
        {cell("totalApartments", "Διαμερίσματα", form.totalApartments?.toString() ?? "")}
        {cell("heatingType", "Θέρμανση", form.heatingType ? HEATING_LABEL[form.heatingType] : "")}
        {form.heatingType && <div style={{ fontSize: 11, color: "#f59e0b", textAlign: "right" }}>→ μέθοδος: {method}</div>}
        {err && <div style={{ color: "#c00", marginTop: 10 }}>{err}</div>}
        <button onClick={create} disabled={!complete || pending} style={{ marginTop: 18, width: "100%" }}>
          {pending ? "Δημιουργία…" : "Δημιουργία & συνέχεια στις λεπτομέρειες →"}
        </button>
      </div>
    </div>
  );
}
```
Adapt styling to match the app's components (e.g. shadcn `Button`/`Input` if the siblings use them). Keep the logic identical.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit 2>&1 | grep -E "onboarding/page|OnboardingWizard"`
Expected: NO matches.
Run: `npm run lint 2>&1 | tail -20` — fix lint in the new files only.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/super-admin/customers/[customerId]/onboarding"
git commit -m "feat(onboarding): split-screen AI wizard page"
```

---

## Task 8: Entry point + manual smoke + final suite

**Files:**
- Modify: the CustomerTree component (find it)

- [ ] **Step 1: Find the CustomerTree and its building/customer action menu.**

Run: `grep -rln "CustomerTree" "app/(dashboard)/super-admin/customers"`
Read it to see how per-customer or per-building actions/links are rendered (it already has a building dropdown with «Υπολογισμός χιλιοστών» etc.).

- [ ] **Step 2: Add an «AI onboarding» link** at the customer level pointing to `/super-admin/customers/<customerId>/onboarding`. Match the existing menu/item pattern (icon from `react-icons/ri`, e.g. `RiRobot2Line`). If items are links use `<Link href=...>`; if they're onClick handlers use `router.push`.

- [ ] **Step 3: Manual smoke (requires `DEEPSEEK_API_KEY` in the dev env)**

Run: `npm run dev`
Open a customer → «AI onboarding». Type: «Είμαι ο Γιάννης, Ακαδημίας 12, 8 διαμερίσματα, αυτονομία με θερμιδομετρητές». Expect: assistant streams a reply; the right form fills (manager/address/8/θερμιδομετρητές) with amber flashes; method shows «70/30 μετρητής»; «Δημιουργία» creates the building and redirects to its detail page with 8 units and the heating override set. If no API key, the chat shows the key-missing error but the rest of the UI still renders.

- [ ] **Step 4: Full suite + typecheck**

Run: `npm test`
Expected: PASS — including the new `lib/ai/sse`, `lib/ai/agent`, `lib/ai/agents`, and `building-onboarding` suites.
Run: `npx tsc --noEmit 2>&1 | grep -E "lib/ai|useAiChat|onboarding|api/ai"`
Expected: NO matches.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/super-admin/customers"
git commit -m "feat(onboarding): AI onboarding entry point in CustomerTree"
```

---

## Notes for the implementer

- **No Vercel AI SDK / no new heavy deps.** Zod v4 is already installed and provides `z.toJSONSchema`. The only network client is `fetch`.
- **AI never writes.** Tool calls only mutate client form state; `createBuildingFromOnboarding` is the sole write path and re-validates with the same Zod schema.
- **Reusability:** `runAgentStream` + `useAiChat` + the registry are domain-agnostic. A future consumer adds an entry to `lib/ai/agents/` and calls `useAiChat({ agentKey })` — no core changes. A future read-only server tool would execute inside the route/consumer, not in the AI.
- **Streaming correctness:** the server normalizes DeepSeek's raw `data:` SSE into `event: token/tool/done/error`; the client's `parseAgentSse` consumes that normalized form. Keep the two in sync (both tested where pure).
- **Cost:** every completion logs via the existing `logAPIUsage`; no new cost model.
- **`logAPIUsage` shape:** verify field names against `lib/api-costs.ts` before finishing Task 3.
