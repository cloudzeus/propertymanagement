# Γενικές Συνελεύσεις (General Assemblies) — Design Spec

**Date:** 2026-06-20
**Status:** Approved design, pending implementation plan
**Author:** brainstorming session

## 1. Σκοπός

Νέο module που επιτρέπει σε κάθε διαχειριστή (MANAGER/ADMIN/SUPER_ADMIN) να **συγκαλεί γενικές συνελεύσεις** ανά κτίριο, με συμμετοχή διαχειριστή + ιδιοκτητών μέσω βιντεοκλήσης (Daily). Κάθε συνέλευση:

- καταχωρείται στο calendar και οι ιδιοκτήτες ενημερώνονται με link,
- ηχογραφείται (audio-only),
- αποδελτιώνεται αυτόματα σε **Πρακτικά (MOM)** μέσω transcription (Deepgram via Daily) + σύνοψης (DeepSeek),
- ο διαχειριστής διορθώνει/εγκρίνει και αποστέλλει το MOM σε όλους τους ιδιοκτήτες (συμμετείχαν ή όχι),
- κάθε κόστος εργαλείου καταγράφεται **ανά πελάτη και κτίριο** για χρέωση/reporting.

## 2. Αποφάσεις (από brainstorming)

| Θέμα | Απόφαση |
|---|---|
| Speech-to-text | **Daily built-in transcription** (Deepgram). |
| Γλώσσα STT | **`language: "el"`, `model: "nova-3"`** (Nova-2 ΔΕΝ έχει ελληνικά). Fallback: Deepgram Whisper Cloud. Ρυθμιζόμενο μέσω setting, όχι hard-coded. |
| Room lifecycle | **Μόνιμο (persistent) Daily room ανά κτίριο**, επαναχρησιμοποιείται. |
| Join flow | **In-app authenticated embed** — server-issued short-lived Daily meeting token· το email περιέχει link προς δική μας σελίδα, όχι σκέτο Daily URL. |
| MOM ροή | **Auto-draft μετά το τέλος** (DeepSeek), χειροκίνητη διόρθωση + έγκριση + αποστολή. |
| Μορφή MOM | **Email (HTML) μόνο** (όπως τα announcements). |
| Event delivery | **Webhooks** από Daily (όχι polling). |
| Χρέωση | Καταγραφή **participant-minutes + DeepSeek tokens + Deepgram/Daily λεπτά + Mailgun emails**, ανά πελάτη/κτίριο. |

## 3. Data model (Prisma)

### Νέα models

```prisma
enum AssemblyStatus {
  SCHEDULED
  LIVE
  ENDED
  TRANSCRIBING
  DRAFT_READY
  APPROVED
  SENT
  CANCELLED
}

model Assembly {
  id              String          @id @default(cuid())
  buildingId      String
  building        Building        @relation(fields: [buildingId], references: [id], onDelete: Cascade)
  title           String
  scheduledAt     DateTime
  status          AssemblyStatus  @default(SCHEDULED)
  dailyRoomName   String
  dailySessionId  String?         // τρέχον session/meeting id για webhook matching
  recordingUrl    String?         // audio-only recording link (Daily)
  transcriptRaw   String?         @db.Text   // raw transcript (Deepgram via Daily)
  minutesDraft    String?         @db.Text   // DeepSeek-generated HTML draft
  minutesFinal    String?         @db.Text   // approved HTML (μετά χειροκίνητη διόρθωση)
  approvedAt      DateTime?
  sentAt          DateTime?
  createdById     String
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  participants    AssemblyParticipant[]

  @@index([buildingId])
  @@index([status])
}

model AssemblyParticipant {
  id              String    @id @default(cuid())
  assemblyId      String
  assembly        Assembly  @relation(fields: [assemblyId], references: [id], onDelete: Cascade)
  userId          String?   // ο ιδιοκτήτης (αν ταυτοποιημένος)
  unitId          String?   // ποια ιδιοκτησία εκπροσωπεί
  displayName     String
  joinedAt        DateTime?
  leftAt          DateTime?
  durationSeconds Int       @default(0)   // αθροιστικά από join/leave events
  invitedSentAt   DateTime?               // πρόσκληση/calendar στάλθηκε
  momSentAt       DateTime?               // του στάλθηκε το MOM

  @@index([assemblyId])
  @@index([userId])
}
```

### Επεκτάσεις υπαρχόντων models

- `Building` + `dailyRoomName String?` — lazy-created μόνιμο room (cache).
- `APIUsageLog` + nullable granularity για cost tracking ανά πελάτη/κτίριο/συνέλευση:
  ```prisma
  buildingId  String?   // → Building
  customerId  String?   // → Customer (ο πελάτης-ιδιοκτήτης του κτιρίου)
  assemblyId  String?   // → Assembly
  ```
  (+ αντίστοιχα `@@index`). Τα υπάρχοντα dashboards κόστους συνεχίζουν να δουλεύουν· τα νέα πεδία προσθέτουν granularity.
- `APICostConfig` rows: προσθήκη `daily` (per_minute) και `deepgram` (per_minute). Τα `deepseek` / `mailgun` υπάρχουν ήδη.

## 4. Server actions — `app/actions/assemblies.ts`

Ίδιο pattern με `app/actions/announcements.ts` (`requireStaff` guard).

- `createAssembly(buildingId, title, scheduledAt)`
  - lazy `ensureRoom(building)` → set `Building.dailyRoomName` αν λείπει,
  - εγγραφή `Assembly` (SCHEDULED),
  - calendar event (ICS, όπως announcements),
  - email πρόσκλησης σε όλους τους owners του κτιρίου με link → δική μας σελίδα συνέλευσης· set `invitedSentAt`.
- `getAssemblyToken(assemblyId)` — server-side Daily meeting token (short-lived, σωστό `user_name`, `exp` = scheduledAt + παράθυρο). Μόνο για ταυτοποιημένο owner/manager του κτιρίου. Δημιουργεί/ενημερώνει `AssemblyParticipant`.
- `generateMinutes(assemblyId)` — DeepSeek: `transcriptRaw` → HTML πρακτικά → `minutesDraft`, status DRAFT_READY. Καταγραφή tokens.
- `approveAndSendMinutes(assemblyId, finalHtml)` — set `minutesFinal`, APPROVED → email HTML σε όλους τους owners → SENT, `sentAt` + `momSentAt` ανά παραλήπτη.
- `getAssemblyCost(assemblyId)` + per-customer/per-building rollups (group-by στο `APIUsageLog`).

## 5. Daily REST client — `lib/daily.ts`

Στυλ αντίστοιχο με το standard `lib/softone.ts`. `DAILY_API_KEY` Bearer.

- `ensureRoom(building)` — get-or-create persistent room, audio-only recording config.
- `createMeetingToken({ room, userName, exp, isOwner })`.
- Domain/room config για audio-only recording + Deepgram transcription (`DEEP_GRAM_API_KEY`, `model: nova-3`, `language: el`, ρυθμιζόμενο).

ENV vars (μόνο στο Coolify, `.env` gitignored):
```
DAILY_API_KEY=
DEEP_GRAM_API_KEY=
```

## 6. Webhook — `app/api/webhooks/daily/route.ts`

Next.js Route Handler. Verify signature **πριν** το parse (raw body first). Switch σε event type:

| Daily event | Ενέργεια |
|---|---|
| `meeting.started` | status → LIVE, set `dailySessionId`. |
| `participant.joined` / `participant.left` | ενημέρωση/άθροιση `AssemblyParticipant.durationSeconds`, `joinedAt`/`leftAt`. |
| `meeting.ended` | status → ENDED· auto-trigger transcription/recording fetch (status → TRANSCRIBING). |
| `recording.ready-to-download` | set `recordingUrl`. |
| `batch-processor.job-finished` (transcription) | set `transcriptRaw`· **auto** `generateMinutes` → DRAFT_READY. |

Replay protection + signature verification ακολουθώντας το webhook pattern (raw bytes, timing-safe compare).

## 7. Cost tracking (κεντρικός πυλώνας)

Κάθε κλήση εργαλείου γράφει στο `APIUsageLog` με πλήρες context (`companyId`, `customerId`, `buildingId`, `assemblyId`, `userId`).

| Εργαλείο | apiName | costModel | units |
|---|---|---|---|
| Daily βίντεο | `daily` | per_minute | Σ(participant-minutes) από join/leave |
| Deepgram transcription | `deepgram` | per_minute | λεπτά διάρκειας (audio) |
| DeepSeek πρακτικά | `deepseek` | per_token | input+output tokens (από API response) |
| Mailgun προσκλήσεις+MOM | `mailgun` | per_email | πλήθος email |

Τιμές μονάδας από `APICostConfig` (configurable SUPER_ADMIN) → αλλαγή τιμολόγησης χωρίς αλλαγή κώδικα. Reporting: breakdown ανά συνέλευση (UI card) + rollups ανά πελάτη/κτίριο.

## 8. UI — components & σελίδες

Pattern από υπάρχοντα panels (`AnnouncementsPanel.tsx`, `ManagersPanel.tsx`, `UnitsPanel.tsx`) και `components/ui/data-table.tsx`, `components/ui/rich-text.tsx`.

- **`AssembliesPanel.tsx`** (building dashboard) — DataTable (τίτλος, ημ/νία, status badge, #συμμετεχόντων, κόστος) + «Νέα Συνέλευση» modal (τίτλος + ημ/ώρα).
- **Σελίδα συνέλευσης** `app/(dashboard)/super-admin/buildings/[id]/assemblies/[assemblyId]/page.tsx` (server component):
  - **Πριν/κατά:** Daily embed (`@daily-co/daily-react`: `DailyProvider` + tiles + live transcription panel), audio-only, server-issued token· κουμπί «Λήξη» (manager).
  - **Μετά:** rich-text editor με το DeepSeek draft → «Έγκριση & Αποστολή».
  - **Cost breakdown card:** σύνολο + ανά εργαλείο, participants & λεπτά.
- **Owner view:** ταυτοποιημένη σελίδα join (ίδιο component, owner token).

## 9. Future / Out of scope (ΟΧΙ τώρα)

Σχεδιαστικά hooks ώστε να μπουν αργότερα χωρίς refactor:

- **Ενεργοποίηση module + μηνιαία χρέωση** → μέσω υπάρχοντος `Service` (`ServicePricingModel` RECURRING/monthly) + `PropertyService` per-customer activation + `ServiceInvoice`. Καμία νέα υποδομή — flag ενεργοποίησης.
- **Προαγορά πακέτου λεπτών** → μελλοντικό `AssemblyMinuteBalance` (customerId, purchasedMinutes, consumedMinutes) ή πεδίο στο `PropertyService`. Τα **consumed minutes μετριούνται ήδη** ανά customer (participant-minutes στο `APIUsageLog`) — το σημερινό tracking γίνεται το θεμέλιο του μελλοντικού metering.

## 10. Σημειώσεις ασφαλείας

- `DAILY_API_KEY` / `DEEP_GRAM_API_KEY` μόνο στο Coolify env· rotate τα keys που εμφανίστηκαν στο chat.
- Meeting tokens short-lived, server-issued, scoped ανά κτίριο/ρόλο.
- Webhook signature verification πριν το parse.
