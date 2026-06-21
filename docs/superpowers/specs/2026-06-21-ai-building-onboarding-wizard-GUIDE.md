# AI Building Onboarding Wizard — Source Guide (user-provided)

**Date:** 2026-06-21
**Status:** PARKED — separate feature, needs its own brainstorm → spec → plan cycle.
**Note:** This is the user's verbatim source guide. It collects only 4 fields; our existing
building model (millesimes sets, elevator params, distribution basis, exclusions, heating
readings) is far richer. A brainstorm must reconcile the wizard's simple capture with the
full initialization flow before planning. Provider = DeepSeek (project already uses DeepSeek +
Gemini, see [[project_external_apis]]).

---

## Architecture & Stack
- **Framework:** Next.js (App Router, Tailwind CSS, TypeScript).
- **Hosting:** Self-hosted on Coolify VPS.
- **AI Provider:** DeepSeek API (using `@ai-sdk/openai` provider inside Vercel AI SDK).
- **Model:** `deepseek-chat`
- **Base URL:** `https://api.deepseek.com/v1`

## UI/UX Requirement (Split Screen)
- **Left Side:** A clean chat interface using the `useChat` hook from Vercel AI SDK.
- **Right Side:** A read-only onboarding form with building initialization fields.
- **Dynamic Updates:** The form fields on the right update in real-time as the user provides
  information to the AI on the left, by listening to `toolCalls`.

## Data Fields to Collect (Building Context)
1. **Διεύθυνση (address):** Η οδός και ο αριθμός (π.χ. "Μιχαλακοπούλου 45").
2. **Αριθμός Διαμερισμάτων (totalApartments):** integer.
3. **Τύπος Θέρμανσης (heatingType):** Κεντρική | Αυτονομία ωρομετρητές | Αυτονομία θερμιδομετρητές | Φυσικό Αέριο.
4. **Όνομα Διαχειριστή (managerName).**

## AI Behavior & Tool Calling
- Acts as an expert building administrator / onboarding assistant in fluent Greek.
- Naturally extracts the 4 parameters through friendly conversation.
- Parallel tool calling via a tool `updateBuildingOnboardingData` (validated with Zod).
- No rigid sequential Q&A. E.g. "Είμαι ο Κώστας, η πολυκατοικία είναι στην Πατησίων 100 και
  έχουμε 12 διαμερίσματα με αυτόνομο φυσικό αέριο" → extract all values in one tool call.

## Implementation Workflow
1. API route `app/api/onboarding/route.ts` using `streamText` + DeepSeek for the Greek
   conversation context and tool execution.
2. Client page `app/onboarding/page.tsx` mapping live tool-call args to right-side form state.

## Open questions for the future brainstorm
- How does heatingType map onto our `defaultBasis` / `METERED_70_30` + `heatingMeterUnit`?
- Does the wizard create the Building + Units + millesimes (auto-by-area) in one shot, then
  hand off to the detailed grids? Where does it sit in navigation?
- Reconcile `totalApartments` with per-unit creation (numbers/floors/areas needed for millesimes).
- heatingType "θερμιδομετρητές" should pre-set heating category basis to METERED_70_30.
