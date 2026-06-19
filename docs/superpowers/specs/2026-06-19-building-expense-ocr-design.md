# Design: OCR Καταχώρηση Εξόδων Κτηρίου (Building Expense OCR)

Date: 2026-06-19
Status: Approved (pending spec review)

## Purpose

Allow SUPER_ADMIN / ADMIN / MANAGER users to upload a bill, expense, receipt,
invoice or tax document for a building. The system OCR-extracts the structured
data (supplier, ΑΦΜ, document number/date, net / VAT / total amounts, and — for
utility bills — meter readings), the user reviews and corrects it in a modal,
selects the expense **category from a managed catalog**, and registers it as a
`BuildingExpense`. Every AI call's cost is tracked.

Engines: **Google Gemini Vision** (document → JSON) + **DeepSeek**
(normalization / classification pass), mirroring the `cloudzeus/postgres-boilerplate`
OCR pattern but in a lean form (no templates / field-rules / supplier-matching /
SoftOne posting).

## Existing foundation (reused, not rebuilt)

- `lib/bunnycdn.ts` — BunnyCDN S3 upload (`uploadFile`, `buildingFolder`, `deleteFile`).
- `lib/api-costs.ts` — `logAPIUsage(...)` with cost configs already present for
  `gemini` (€0.00025/1K tok) and `deepseek` (€0.0002/1K tok). **Cost tracking
  requirement is satisfied by calling this.**
- `lib/env.ts` — `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `DEEPSEEK_API_URL` already wired.
- `BuildingFile`, `BuildingExpense` (already has `receiptFile` relation).
- `InfraPoint` (already has `ELECTRICITY` / `WATER` types) — meter readings link here.
- Server-action pattern: `app/actions/infra-points.ts`, `app/actions/building-files.ts`.

## Flow

1. **Upload** — drag-drop / file picker in the building page "Έξοδα" panel.
   Image (jpg/png/webp) or PDF. Uploaded to BunnyCDN under
   `<buildingFolder>/expenses/<timestamp>-<name>`; a `BuildingFile` row is created
   with new category `RECEIPT`.
2. **Extract** — `extractExpenseDocument` server action:
   - Image → best-effort `enhanceForOcr` (sharp) → `callGeminiVision` (OpenAI-compatible
     Gemini endpoint).
   - PDF → `callGeminiPdfNative` (Gemini `:generateContent` with inline `application/pdf`).
   - Model fallback chain `gemini-2.5-flash → gemini-2.0-flash → gemini-2.5-flash-lite`;
     auto-retry once with `gemini-2.5-pro` if > 2 required fields are missing.
   - **DeepSeek normalization pass** (`normalize.ts`): takes raw Gemini JSON + rawText,
     returns cleaned fields, a `suggestedCategoryCode` chosen from the live category
     list, and parsed meter data (consumption = current − previous when both present).
   - Each Gemini and DeepSeek call → `logAPIUsage({ apiName, model, tokensUsed, status })`.
   - Returns `{ fileId, fileUrl, extracted }`. **No `BuildingExpense` is written yet.**
3. **Review modal** — pre-filled form + file preview (image inline, PDF in `<iframe>`).
   User edits fields, picks **ExpenseCategory** from the catalog dropdown. If the
   chosen category has `utilityType !== NONE`, meter-reading fields are shown
   (pre-filled from OCR). Confidence badge shown per the OCR `ocrConfidence`.
4. **Register** — `createBuildingExpense` server action: creates `BuildingExpense`
   (`status = CONFIRMED`) linked to the `BuildingFile`, and a `MeterReading` row if
   meter data is present (linked to the matching `InfraPoint` when one exists).

## Engine — `lib/ocr/`

| File | Responsibility |
|------|----------------|
| `extract.ts` | `enhanceForOcr` (sharp, best-effort), `callGeminiVision`, `callGeminiPdfNative`, model fallback + auto-retry, `parseJsonLoose`. |
| `model-fallback.ts` | `buildModelChain(primary, fallbacks)`, `tryModels(chain, fn)` — ported from boilerplate. |
| `fetch-retry.ts` | `fetchWithRetry` with backoff on 429/503 — ported. |
| `normalize.ts` | DeepSeek pass: raw → `{ cleaned fields, suggestedCategoryCode, meter }`. |
| `prompt.ts` | Greek system prompt + zod schemas (`ExtractedDoc`, `MeterData`). Lists valid category codes so the model can classify. |
| `cost.ts` | thin wrapper around `logAPIUsage` for `gemini` / `deepseek` scopes. |

### Extracted schema (zod, `prompt.ts`)

```
ExtractedDoc {
  docType: 'invoice' | 'receipt' | 'utility' | 'tax' | 'other'
  supplierName, supplierVat, supplierDoy?            // strings|null
  documentNumber, documentDate (YYYY-MM-DD)
  netAmount, vatAmount, totalAmount                  // numbers|null
  suggestedCategoryCode                              // one of catalog codes|null
  meter?: MeterData
  confidence: number (0..1)
}
MeterData {
  meterType: 'POWER' | 'WATER' | 'GAS'
  meterNumber?, unit?  ('kWh' | 'm3')
  periodFrom?, periodTo? (YYYY-MM-DD)
  previousReading?, currentReading?, consumption?    // numbers
}
```

## Prisma changes

```prisma
enum ExpenseUtilityType { NONE POWER WATER GAS }
enum ExpenseStatus { DRAFT CONFIRMED }
enum MeterType { POWER WATER GAS }

model ExpenseCategory {
  id        String  @id @default(cuid())
  name      String
  code      String  @unique
  utilityType ExpenseUtilityType @default(NONE)
  active    Boolean @default(true)
  sortOrder Int     @default(0)
  expenses  BuildingExpense[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model MeterReading {
  id             String   @id @default(cuid())
  buildingId     String
  building       Building @relation(fields: [buildingId], references: [id], onDelete: Cascade)
  infraPointId   String?
  infraPoint     InfraPoint? @relation(fields: [infraPointId], references: [id], onDelete: SetNull)
  expenseId      String?
  expense        BuildingExpense? @relation(fields: [expenseId], references: [id], onDelete: SetNull)
  meterType      MeterType
  meterNumber    String?
  periodFrom     DateTime?
  periodTo       DateTime?
  previousReading Decimal? @db.Decimal(12,3)
  currentReading  Decimal? @db.Decimal(12,3)
  consumption     Decimal? @db.Decimal(12,3)
  unit           String?
  createdAt      DateTime @default(now())
  @@index([buildingId])
  @@index([infraPointId])
}

// BuildingExpense — additive changes (keep existing fields incl. legacy `category String?`)
model BuildingExpense {
  // ...existing...
  categoryId     String?
  categoryRef    ExpenseCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  supplierName   String?
  supplierVat    String?
  documentNumber String?
  documentDate   DateTime?
  netAmount      Decimal? @db.Decimal(10,2)
  vatAmount      Decimal? @db.Decimal(10,2)
  status         ExpenseStatus @default(CONFIRMED)
  ocrRaw         Json?
  ocrConfidence  Float?
  meterReadings  MeterReading[]
  @@index([categoryId])
}

// BuildingFileCategory — add RECEIPT
enum BuildingFileCategory { PLANS PHOTOS DOCUMENTS CERTIFICATES RECEIPT OTHER }
```

Migration is additive (no destructive change to existing `BuildingExpense` rows;
`amount` continues to hold the total). `InfraPoint` gets a back-relation
`meterReadings MeterReading[]`.

### Seed — default categories

ΔΕΗ/Ρεύμα (POWER), Νερό/ΕΥΔΑΠ-ΕΥΑΘ (WATER), Φυσικό αέριο (GAS), Ανελκυστήρας,
Καθαριότητα, Συντήρηση, Ασφάλεια, Κοινόχρηστα, Διαχείριση, Λοιπά (NONE).

## Server actions — `app/actions/building-expenses.ts`

- `extractExpenseDocument(buildingId, formData)` → `{ fileId, fileUrl, extracted }`.
- `createBuildingExpense(buildingId, input)` → creates expense (+ optional meter reading).
- `updateBuildingExpense(id, input)`, `deleteBuildingExpense(id)`.
- `listBuildingExpenses(buildingId)`.

`app/actions/expense-categories.ts`:
- `listExpenseCategories()`, `createExpenseCategory`, `updateExpenseCategory`,
  `deleteExpenseCategory` (soft-disable when referenced).

All actions authorize against company roles (SUPER_ADMIN/ADMIN/MANAGER) before mutating.

## UI

- `components/buildings/ExpensesPanel.tsx` — list of building expenses (DataTable:
  date, supplier, category, net/VAT/total, status, receipt link, edit/delete).
  Top "Καταχώρηση εξόδου (OCR)" button.
- `components/buildings/ExpenseOcrUpload.tsx` — dropzone modal → progress →
  review form. Uses native drag-drop + `<input type=file>` (no react-dropzone dep).
- `components/buildings/ExpenseReviewForm.tsx` — fields + file preview + category
  select + conditional meter-reading section + confidence badge.
- `app/(dashboard)/super-admin/settings/expense-categories/` — ExpenseCategory CRUD
  page (table + add/edit modal), following the `settings/costs` page pattern.
- Mount `ExpensesPanel` in `app/(dashboard)/super-admin/buildings/[id]`.

## Error handling

- Upload failure → toast, no DB write.
- OCR failure (all models in chain fail) → return partial/empty `extracted` with a
  flag so the review modal still opens for fully-manual entry. The file is already
  stored, so nothing is lost.
- DeepSeek normalization failure → fall back to raw Gemini JSON (degrade gracefully;
  still log the failed call cost/status).
- Invalid file type/size → reject client-side and server-side (max 15 MB; jpg/png/webp/pdf).
- Every external call wrapped so a thrown error still records `status:'FAILED'` usage.

## Testing

- `lib/ocr/__tests__/model-fallback.test.ts` — chain ordering, retry-on-error.
- `lib/ocr/__tests__/normalize.test.ts` — consumption math, category mapping, null-safety.
- `lib/ocr/__tests__/parse-json-loose.test.ts` — fenced/partial JSON recovery.
- Action-level: `createBuildingExpense` creates expense + meter reading atomically;
  role gate rejects unauthorized.

## New dependency

- `sharp` — best-effort image enhancement before Gemini vision. No pdfjs/pdf-to-img
  (PDFs handled natively by Gemini).

## Out of scope (future)

OCR templates, supplier auto-matching, SoftOne posting, batch upload, line-item
extraction, meter-reading charts, automatic millième-based allocation of the expense
to units.
