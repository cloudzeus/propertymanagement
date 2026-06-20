# Συνελεύσεις — UI σε DataTable + Modal με row actions — Design Spec

**Date:** 2026-06-20
**Status:** Approved design, pending implementation plan
**Depends on:** the implemented "Γενικές Συνελεύσεις" feature (2026-06-20-genikes-syneleyseis).

## 1. Σκοπός / Πρόβλημα

Η λίστα συνελεύσεων (`AssembliesPanel`) πρέπει να ακολουθεί το πρότυπο των άλλων DataTable του app, με πλήρη πληροφορία (συμμετέχοντες, λεπτά), και η προβολή λεπτομερειών/μεταγραφής/πρακτικών να ανοίγει σε **Modal μέσα στο panel** — όχι σε ξεχωριστή σελίδα. Η τρέχουσα standalone σελίδα `assemblies/[assemblyId]/page.tsx` εμφανίζεται χωρίς το header/tabs του κτιρίου («εξαφανίζεται το header»). Επιπλέον, χρειάζονται per-row actions (επαναποστολή πρόσκλησης, προβολή/αποστολή/λήψη MOM).

## 2. Αποφάσεις (brainstorming)

| Θέμα | Απόφαση |
|---|---|
| Λίστα | Standard `DataTable` με πλήρεις στήλες. |
| Προβολή λεπτομερειών | **Modal** μέσα στο panel (header παραμένει). |
| Ζωντανή συνεδρία | **Και αυτή σε Modal/overlay** (video + live μεταγραφή + Λήξη). |
| Deep links (email) | Η σελίδα γίνεται redirect στο dashboard με `?tab=assemblies&open=<id>` ώστε να μένει το header. |
| Λήψη MOM | **Word (.doc)** — HTML→.doc, client-side, χωρίς εξαρτήσεις. |

## 3. Λίστα — DataTable

Στήλες (όλες sortable/searchable όπου έχει νόημα, όπως τα άλλα panels):
- **Τίτλος** (κλικ → άνοιγμα modal, ΟΧΙ πλοήγηση)
- **Ημερομηνία** (`toLocaleString("el-GR")`)
- **Κατάσταση** (badge)
- **Συμμετέχοντες** (πλήθος)
- **Λεπτά** (Σ `durationSeconds` → λεπτά)
- **Κόστος** (`€`)

`listAssemblies(buildingId)` εμπλουτίζεται με `totalMinutes: number` (sum durationSeconds, ⌈/60⌉ συνολικά ή ανά άτομα — βλ. §6).

## 4. Row actions (`getRowActions` του DataTable)

| Action | Διαθέσιμο όταν | Ενέργεια |
|---|---|---|
| **Προβολή** | πάντα | Ανοίγει `AssemblyDetailModal` |
| **Επαναποστολή πρόσκλησης** | status ∈ {SCHEDULED, LIVE} | `resendInvitations(id)` — ξαναστέλνει το invite σε όλους τους συμμετέχοντες (host → in-app link, guest → fresh Daily guest link) |
| **Προβολή MOM** | υπάρχει `minutesDraft`/`minutesFinal` | Ανοίγει το modal εστιασμένο στα Πρακτικά |
| **Αποστολή MOM** | υπάρχει `minutesDraft`/`minutesFinal` | `sendMinutes(id)` — (ξανα)στέλνει τα τρέχοντα πρακτικά σε όλους + θέτει `sentAt`/`momSentAt` |
| **Λήψη MOM** | υπάρχει `minutesDraft`/`minutesFinal` | Client-side: Blob `application/msword` από το HTML → download `.doc` |

## 5. AssemblyDetailModal (νέο client component)

Φορτώνει `getAssemblyDetail(assemblyId)` και δείχνει, σε ένα μεγάλο modal:
- **Header:** τίτλος + status badge + ημ/νία (πάντα ορατό).
- **Ζωντανή συνεδρία** (αν status ∈ {SCHEDULED, LIVE}): το `AssemblyRoom` embed (video, live μεταγραφή, manager controls «Έναρξη»/«Λήξη»).
- **Συμμετέχοντες:** πίνακας — όνομα/email, ρόλος (host/guest/owner), **λεπτά**, ώρα εισόδου, αν στάλθηκε MOM (`momSentAt`).
- **Πρωτότυπη Μεταγραφή:** read-only, collapsible (`transcriptRaw`).
- **Πρακτικά (MOM):** το `MinutesEditor` (διόρθωση/έγκριση/αποστολή) για status DRAFT_READY+.
- **Κόστος:** breakdown ανά εργαλείο (από `getAssemblyCost`).

Optional prop `focus?: "mom"` ώστε το «Προβολή MOM» να ανοίγει εστιασμένο στα πρακτικά (scroll/section).

## 6. Server actions

- **`getAssemblyDetail(assemblyId)`** (requireStaff) → πλήρες detail:
  `{ id, title, status, scheduledAt, buildingId, transcriptRaw, minutesDraft, minutesFinal, participants: [{ id, displayName, email, isHost, durationSeconds, joinedAt, momSentAt }], cost }` (cost από `getAssemblyCost`).
- **`listAssemblies`** → προσθήκη `totalMinutes` (Σ ⌈durationSeconds/60⌉ ανά συμμετέχοντα, όπως το billing helper `totalParticipantMinutes`).
- **`resendInvitations(assemblyId)`** (requireStaff) → για κάθε `AssemblyParticipant` με `email`: host (`isHost`) → in-app deep link· guest → fresh Daily guest token + raw link· `sendAnnouncementEmail` + ενημέρωση `invitedSentAt`.
- **`sendMinutes(assemblyId)`** (requireStaff) → στέλνει `minutesFinal ?? minutesDraft` σε όλους (owners + participant emails), θέτει `sentAt` + `momSentAt`, status → SENT (αν ήταν DRAFT_READY/APPROVED). Επαναχρησιμοποιεί τη λογική αποστολής του `approveAndSendMinutes` (εξαγωγή κοινού helper `emailMinutesToAll(assembly, html)`).

## 7. Deep links / header fix

- `app/(dashboard)/super-admin/buildings/[id]/assemblies/[assemblyId]/page.tsx` → **redirect** σε `/super-admin/buildings/[id]?tab=assemblies&open=[assemblyId]` (`redirect()` server component). Έτσι παλιά links + email links κρατούν το header.
- `BuildingDashboard`: διαβάζει `useSearchParams()` για `tab` + `open`· αρχικό `tab` = `?tab` αν δοθεί· περνά `initialOpenId` στο `AssembliesPanel`.
- `AssembliesPanel`: prop `initialOpenId?` → αν δοθεί, ανοίγει αυτόματα το `AssemblyDetailModal` για εκείνη τη συνέλευση.
- Τα invite/host emails (`createAssembly`, `createTestAssembly`, `resendInvitations`) δείχνουν στο dashboard deep link αντί στο `/assemblies/[id]`.

## 8. Επαναχρησιμοποίηση / αρχεία

- `AssemblyRoom.tsx` + `MinutesEditor.tsx`: μετακινούνται από `…/assemblies/[assemblyId]/` δίπλα στο `AssembliesPanel` (π.χ. `…/buildings/[id]/_assembly/`) και χρησιμοποιούνται μέσα στο modal.
- Νέο: `AssemblyDetailModal.tsx`.
- Το read-only transcript panel + cost card (που ήταν στο `page.tsx`) μεταφέρονται στο modal.

## 9. Out of scope

- PDF export (επιλέχθηκε .doc).
- Integrations-via-UI (super-admin config) — ξεχωριστό spec, μετά από αυτό.
