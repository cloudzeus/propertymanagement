# Συνεργάτες: προσκλήσεις RFQ με link, επαφές με πρόσβαση, ηλεκτρονική αποδοχή σύμβασης

Ημερομηνία: 2026-10-20 · Κατάσταση: εγκεκριμένο σχέδιο (οι 4 επιλογές κλειδώθηκαν με τον χρήστη)

## 1. Στόχος

Οι ρόλοι εταιρείας (SUPER_ADMIN, ADMIN, MANAGER, EMPLOYEE) στέλνουν αιτήματα προσφοράς
(RFQ) σε συνεργάτες του μητρώου Orithon με branded email που περιέχει ένα υπογεγραμμένο,
μοναδικό link. Ο συνεργάτης μπαίνει από το link (με login αν έχει λογαριασμό, αλλιώς
ορίζει κωδικό), υποβάλλει προσφορά, και όταν του ανατεθεί η δουλειά αποδέχεται
ηλεκτρονικά τη σύμβαση Β με καταγραφή ονόματος/ώρας/IP. Η εταιρεία δημιουργεί επαφές
συνεργατών (όνομα, θέση, τηλέφωνο, κινητό, email) με προαιρετική πρόσβαση στο
/marketplace, χωρίς ποτέ να στέλνεται κωδικός με email.

Η ροή RFQ → προσφορά → προώθηση → WorkOrder → σύμβαση **υπάρχει** (Φ2, commit dd68964)
και επεκτείνεται· δεν ξαναγράφεται.

## 2. Αποφάσεις που κλειδώθηκαν

| # | Ερώτημα | Απόφαση |
|---|---------|---------|
| 1 | Είσοδος MANAGER/EMPLOYEE (δεν έχουν σελίδα βλάβης στο company surface) | Νέα σελίδα **/staff/rfq** για όλους τους 4 ρόλους· το RfqPanel της βλάβης (/admin/maintenance/[id]) μένει για SUPER_ADMIN/ADMIN |
| 2 | Συνεργάτης με λογαριασμό πατά το link | **Login με callbackUrl** (προσυμπληρωμένο email), όχι magic sign-in |
| 3 | Μοντέλο επαφών | **Νέο `SupplierContact`** με προαιρετικό `userId` → COLLABORATOR User· backfill των υπαρχόντων Users σε επαφές |
| 4 | PDF σύμβασης | **Εκτύπωση browser** (υπάρχον «Εκτύπωση / PDF»), βελτιωμένο print CSS, χωρίς νέα εξάρτηση |

Πρόσθετες παραδοχές:
- «ή RFQ» στο αίτημα του χρήστη = ενέργειες πάνω σε υπάρχον RFQ (προσθήκη συνεργατών,
  ξανα-αποστολή). Δεν δημιουργείται RFQ χωρίς βλάβη (YAGNI· το `ServiceRequest`
  απαιτεί κτήριο και όλα τα RFQ σήμερα ξεκινούν από `MaintenanceRequest`).
- Ένα email = ένας User (project_customer_role_hierarchy). Email που ανήκει σε
  λογαριασμό μη-COLLABORATOR ρόλου ή σε COLLABORATOR άλλου supplier **δεν** αποκτά
  πρόσβαση· η δημιουργία επαφής-με-πρόσβαση επιστρέφει ρητό μήνυμα.
- Μόνο συνεργάτες του μητρώου εταιρείας (`customerId = null`, `isPlatform = false`)
  δέχονται προσκλήσεις/λογαριασμούς (υπάρχων κανόνας `requireTeamEdit`).

## 3. Δεδομένα (Prisma)

### 3.1 `SupplierContact` (νέο)
```
id, supplierId → Supplier (Cascade)
name            String
position        String?      // θέση/ρόλος στην επιχείρηση
phone, mobile   String?
email           String?      // lowercase· απαιτείται για πρόσβαση
isPrimary       Boolean @default(false)   // ο υπεύθυνος· δέχεται RFQ by default
receivesRfq     Boolean @default(true)    // παραλήπτης email προσκλήσεων
active          Boolean @default(true)
notes           String? @db.Text
userId          String? @unique → User (SetNull)  // λογαριασμός COLLABORATOR
createdById     String?
createdAt / updatedAt
@@index([supplierId]) @@index([email])
```
Backfill στη migration: για κάθε `User` με `role='COLLABORATOR'` και `supplierId`
δημιουργείται επαφή (name/email/phone/mobile, `isPrimary = isSupplierAdmin`,
`userId`). Το `Supplier.contactName/Phone/Email` μένει ως έχει (ERP-aligned πεδίο)
και χρησιμοποιείται μόνο ως fallback παραλήπτη.

### 3.2 `SupplierInviteLink` (νέο)
```
id
tokenHash       String @unique         // sha256(token), το token δεν αποθηκεύεται
kind            SupplierInviteKind      // RFQ_INVITE | CONTACT_ACTIVATION
supplierId      → Supplier (Cascade)
email           String                  // ο παραλήπτης· το link δένεται σε αυτό
rfqInvitationId String? → RfqInvitation (Cascade)
contactId       String? → SupplierContact (Cascade)
expiresAt       DateTime                // 14 ημέρες
sentAt          DateTime @default(now())
sentCount       Int @default(1)
openedAt        DateTime?
usedAt          DateTime?               // activation ολοκληρώθηκε (μία φορά)
revokedAt       DateTime?               // ξανα-αποστολή ακυρώνει τα προηγούμενα
createdById     String?
@@index([rfqInvitationId]) @@index([contactId]) @@index([supplierId, email])
```

### 3.3 Επεκτάσεις
- `RfqInvitation`: `status` παίρνει και `EXPIRED` (όταν το RFQ λήξει χωρίς απάντηση
  από το cron ή η προθεσμία περάσει)· `lastEmailAt DateTime?`, `emailCount Int @default(0)`.
- `WorkOrder`: `supplierAcceptedIp String?`, `supplierAcceptedUa String?`,
  `supplierAcceptedName String?` (ονοματεπώνυμο υπογράφοντα όπως το πληκτρολόγησε).
- `User` ↔ `SupplierContact` σχέση 1-1 (`contact SupplierContact?`).

Migration: `20261020150000_supplier_invites_contacts` με `migrate diff` + `deploy`
(ποτέ `migrate dev`). Το DB είναι παραγωγή· η migration είναι additive.

## 4. Token & link

- `lib/supplier-invites.ts` (server-only): `issueInviteLink({kind, supplierId, email,
  rfqInvitationId?, contactId?, createdById})` → `{ url, linkId }`. Token = 32 bytes
  `crypto.randomBytes` σε base64url· αποθηκεύεται μόνο `sha256`. Πριν την έκδοση
  ακυρώνονται (`revokedAt`) τα ενεργά links ίδιου kind/στόχου/email.
- URL: `${siteUrl}/invite/${token}`. Προστίθεται `/invite` στα `authPublicPaths` του
  `proxy.ts` (public, χωρίς locale).
- `resolveInviteLink(token)` → `{ status: "invalid" | "expired" | "revoked" | "used" | "ok", link, supplier, target }`.
  Σημειώνει `openedAt` στην πρώτη επίσκεψη και, για RFQ_INVITE, `RfqInvitation.viewedAt`.
- Rate limit: `lib/ai/rate-limit`-style in-memory limiter ανά IP στο `/invite`
  (π.χ. 20 αιτήματα / 10 λεπτά) και ανά token στο activation (5 / 10 λεπτά).
- Activation είναι μίας χρήσης (`usedAt`)· ένα RFQ link για υπάρχοντα λογαριασμό
  μπορεί να ξανανοιχτεί μέχρι τη λήξη (απλώς κάνει redirect στο login).

## 5. Άξονας 1 — Αποστολή RFQ με email + link

### 5.1 RBAC
Νέο module `rfq` («Αιτήματα προσφοράς», surface company, menu href `/staff/rfq`,
icon `RiMailSendLine`, group `operations`, actions CRUD). Προεπιλογές: CRUD σε
SUPER_ADMIN/ADMIN/MANAGER/EMPLOYEE. Μόνο αυτές οι γραμμές αλλάζουν στο `registry.ts`
(η παράλληλη συνεδρία αναδιοργανώνει το μενού· οι αλλαγές μας είναι προσθετικές).
`prisma/seed-rbac.ts` backfill τρέχει τοπικά (= παραγωγή).

Τα server actions του RFQ (`createRfq`, `addRfqSuppliers`, `resendRfqInvitation`,
`cancelRfq`) ελέγχουν `rfq:create`/`rfq:edit` και ρόλο στους 4 COMPANY_ROLES αντί
για `suppliers:edit` + STAFF.

### 5.2 Επιλογή συνεργατών — `SupplierPicker`
Client component (`components/suppliers/SupplierPicker.tsx`) με λίστα υποψηφίων και
φίλτρα: αναζήτηση ονόματος, κατηγορία (MaintenanceCategory· προεπιλογή η κατηγορία
της βλάβης), μέγιστη απόσταση (5/10/25/50 km/όλα), ελάχιστη βαθμολογία (3/4/4.5/όλα),
«μόνο με λογαριασμό». Κάθε γραμμή: όνομα, κατηγορίες, απόσταση, ★ βαθμολογία (n),
ένδειξη «προτιμώμενος»/«έχει δουλέψει εδώ»/«24/7», παραλήπτης email (primary επαφή ή
Supplier.email· κόκκινο αν δεν υπάρχει email), checkbox. Τα δεδομένα έρχονται από
`lib/rfq-candidates.ts` → `listRfqCandidates(maintenanceRequestId)` που επαναχρησιμοποιεί
`rankSuppliers` και επιστρέφει `RfqCandidateDTO[]` (ταξινομημένα κατά score).
Χρησιμοποιείται από το RfqPanel (αντικαθιστά τη λίστα checkbox) και το /staff/rfq.

### 5.3 Αποστολή
`createRfq` (επέκταση): μετά τη δημιουργία του ServiceRequest+RfqInvitation:
1. Για κάθε supplier υπολογίζει παραλήπτες: ενεργοί COLLABORATOR users του supplier ∪
   ενεργές επαφές με `receivesRfq && email` ∪ `Supplier.email` ∪ `Supplier.contactEmail`,
   χωρίς διπλά (lowercase).
2. Για κάθε παραλήπτη εκδίδει `SupplierInviteLink(RFQ_INVITE)` και στέλνει το branded
   email `rfqInvitationEmail` (lib/email-template `renderEmail`: eyebrow «Αίτημα
   προσφοράς», τίτλος βλάβης, κτήριο/περιοχή (όχι πλήρης διεύθυνση — αποκαλύπτεται
   μετά το login), προθεσμία, «ζητείται αυτοψία», CTA «Δείτε το αίτημα & προσφορά»,
   afterCta «Το link ισχύει 14 ημέρες και είναι προσωπικό»).
3. In-app notification στους υπάρχοντες users (όπως σήμερα) με href `/marketplace/rfq/[id]`.
4. `RfqInvitation.lastEmailAt/emailCount` ενημερώνονται. Αν ο supplier δεν έχει
   κανέναν παραλήπτη, η πρόσκληση δημιουργείται και η γραμμή δείχνει «χωρίς email».

`resendRfqInvitation(invitationId)`: ακυρώνει τα ενεργά links της πρόσκλησης, εκδίδει
νέα, ξαναστέλνει· `emailCount++`. `addRfqSuppliers(rfqId, supplierIds)`: νέες
προσκλήσεις σε ανοιχτό RFQ (OPEN/OFFERED) με την ίδια αποστολή.

### 5.4 Κατάσταση ανά πρόσκληση (derived, `lib/rfq-shared.ts → invitationState`)
| state | κανόνας |
|---|---|
| ΕΛΗΞΕ | invitation.status EXPIRED, ή RFQ EXPIRED/CANCELLED, ή deadline πέρασε χωρίς OFFERED/DECLINED |
| ΑΠΟΡΡΙΦΘΗΚΕ | status DECLINED |
| ΠΡΟΣΦΟΡΑ | status OFFERED |
| ΑΝΟΙΧΤΗΚΕ | viewedAt ≠ null |
| ΣΤΑΛΘΗΚΕ | emailCount > 0 |
| ΧΩΡΙΣ EMAIL | emailCount = 0 και κανένας παραλήπτης |

### 5.5 Σελίδα /staff/rfq
`app/(company)/staff/rfq/page.tsx` (`requirePermission("rfq","view")`) + client
`RfqInvitationsClient`. DataTable (storageKey `staff-rfq`), μία γραμμή ανά πρόσκληση:
συνεργάτης, βλάβη (link στο /admin/maintenance/[id] μόνο για ADMIN+, αλλιώς τίτλος),
κτήριο, κατάσταση (chip), στάλθηκε/ανοίχτηκε/απάντησε, προθεσμία, προσφορά (ποσό αν
υπάρχει). Row actions: «Αποστολή ξανά» (όταν ΣΤΑΛΘΗΚΕ/ΑΝΟΙΧΤΗΚΕ/ΧΩΡΙΣ EMAIL και RFQ
ανοιχτό), «Προσθήκη συνεργατών» (ανοίγει SupplierPicker για το RFQ), «Ακύρωση RFQ».
Toolbar: «Νέο αίτημα προσφοράς» → modal: επιλογή ανοιχτής βλάβης (searchable select
από `listOpenFaultsForRfq`: OPEN/ACKNOWLEDGED/ASSIGNED χωρίς ενεργό WorkOrder) →
SupplierPicker → προθεσμία/αυτοψία/σημείωση → αποστολή. Expand row: παραλήπτες
(email, στάλθηκε, ανοίχτηκε) από τα links.

### 5.6 RfqPanel βλάβης
Η `NewRfqForm` χρησιμοποιεί το SupplierPicker. Κάθε invitation chip αποκτά
«ξανά» (resend) και tooltip με παραλήπτες. Το RfqPanel εμφανίζεται για όποιον έχει
`rfq:view` (σήμερα: μόνο SUPER_ADMIN/ADMIN φτάνουν στη σελίδα).

## 6. Σελίδα /invite/[token]

`app/(auth)/invite/[token]/page.tsx` (server) + `ActivateForm` (client).
Λογική `resolveInviteLink`:
1. invalid/expired/revoked → κάρτα «Ο σύνδεσμος δεν ισχύει» με οδηγία «ζητήστε νέα
   πρόσκληση από την εταιρεία διαχείρισης» (χωρίς αποκάλυψη στοιχείων).
2. Το email του link αντιστοιχεί σε User:
   - COLLABORATOR του ίδιου supplier με `passwordHash` → `redirect(/login?email=…&callbackUrl=…)`.
     Το `LoginForm` διαβάζει `?email=` για προσυμπλήρωση (μικρή προσθήκη).
   - COLLABORATOR του ίδιου supplier **χωρίς** κωδικό (επαφή που δημιουργήθηκε χωρίς
     κωδικό) → φόρμα ορισμού κωδικού (activation).
   - Οποιοσδήποτε άλλος ρόλος ή άλλος supplier → κάρτα «Το email ανήκει σε υπάρχοντα
     λογαριασμό άλλου τύπου — επικοινωνήστε με την εταιρεία» (δεν προχωρά).
3. Κανένας User → φόρμα activation: ονοματεπώνυμο (προσυμπληρωμένο από την επαφή),
   κωδικός ×2 (≥ 8 χαρακτήρες), checkbox όρων. Server action `activateInvite(token,
   {name, password})`: ξαναελέγχει το link, δημιουργεί User (COLLABORATOR, roleId του
   system role, `supplierId`, `isSupplierAdmin` = `contact.isPrimary` ή true αν είναι ο
   πρώτος user του supplier), δένει/δημιουργεί την επαφή (`userId`), `usedAt = now`,
   μετά `signIn("credentials", { email, password, redirectTo })` → `/marketplace/rfq/[id]`
   για RFQ_INVITE, `/marketplace` (ή `/marketplace/onboarding` αν admin χωρίς onboarding)
   για CONTACT_ACTIVATION.
callbackUrl για RFQ_INVITE = `/marketplace/rfq/${rfqId}`.

## 7. Άξονας 2 — Επαφές συνεργατών με πρόσβαση

### 7.1 Server actions (`app/actions/supplier-contacts.ts`)
Έλεγχος `requireContactsEdit(supplierId)`: μόνο company-registry row· επιτρέπεται σε
company ρόλο με `suppliers:edit` **ή** `rfq:edit` (ο EMPLOYEE έχει μόνο `suppliers:view`,
οπότε το `rfq:edit` του δίνει τις επαφές χωρίς να ανοίξει το πλήρες edit του μητρώου),
ή στον supplier admin του ίδιου supplier με `mkt-team:edit`.
- `saveSupplierContact(supplierId, id|null, input)` — input: name, position, phone,
  mobile, email, isPrimary, receivesRfq, active, notes, `access: "none" | "invite" | "password"`,
  `password?`, `isSupplierAdmin?`.
  - `invite`: απαιτεί email· έλεγχος «ένα email = ένας User» (βλ. §2)· αν δεν υπάρχει
    User → εκδίδεται CONTACT_ACTIVATION link + email `contactInvitationEmail`
    («Ο/Η {{company}} σάς έδωσε πρόσβαση στο περιβάλλον συνεργατών», CTA «Ορισμός
    κωδικού»). Αν υπάρχει COLLABORATOR του ίδιου supplier → απλώς δένεται (`userId`).
  - `password`: δημιουργεί User με `bcrypt.hash`, δεν επιστρέφει/εμφανίζει ποτέ τον
    κωδικό· η φόρμα τον ζητά μία φορά.
  - `isPrimary=true` ξε-primary-άρει τις άλλες επαφές· αν η επαφή έχει user, συγχρονίζει
    `isSupplierAdmin` (με το lock-out guard που υπάρχει).
- `deactivateSupplierContact(supplierId, id)` → `active=false` και, αν έχει user,
  `User.status = INACTIVE` (όχι διαγραφή — ιστορικό προσφορών/αποδοχών).
- `reactivateSupplierContact`, `resendContactInvite(supplierId, id)` (νέο link, παλιά
  ακυρώνονται), `removeSupplierContact` (μόνο επαφές χωρίς user).
Τα παλιά `createSupplierUser/updateSupplierUser/removeSupplierUser` παραμένουν για
συμβατότητα αλλά το UI δεν τα καλεί πια· `updateSupplierUser` ενημερώνει και την επαφή.

### 7.2 UI
- `components/suppliers/ContactsEditor.tsx` (client, DataTable clientSide, storageKey
  ανά surface): στήλες όνομα/θέση, τηλέφωνο, κινητό, email, πρόσβαση (chip: «Χωρίς» /
  «Πρόσκληση εστάλη {ημ.}» / «Ενεργή» / «Ανενεργή»), ρόλος (Υπεύθυνος/Διαχειριστής/
  Τεχνικός), RFQ (ναι/όχι). Row actions: Επεξεργασία, Αποστολή πρόσκλησης (ξανά),
  Απενεργοποίηση/Επανενεργοποίηση, Διαγραφή (μόνο χωρίς user). Modal φόρμας με
  radio «Πρόσβαση: Καμία / Πρόσκληση με link (προτείνεται) / Ορισμός κωδικού τώρα».
- Σελίδα supplier (`/super-admin/suppliers/[id]`): το `TeamEditor` αντικαθίσταται από
  `ContactsEditor` (τίτλος «Επαφές & πρόσβαση»).
- `/marketplace/team`: επίσης `ContactsEditor` (canEdit = supplier admin). Ο admin
  μπορεί να καλέσει συναδέλφους με link (ίδιος μηχανισμός).
- `loadSupplierFull` επιστρέφει `contacts: SupplierContactDTO[]` (με `user: {status,
  lastLoginAt, isSupplierAdmin, hasPassword}` και `pendingInvite: {sentAt, expiresAt}`).

## 8. Σύμβαση — ηλεκτρονική αποδοχή

- `supplierAcceptWorkOrder(woId, { signatoryName, agreed: true })`: απαιτεί admin του
  supplier (ως σήμερα), όνομα ≥ 3 χαρακτήρες, `agreed`. Καταγράφει
  `supplierAcceptedAt/ById/Ip/Ua/Name` (IP/UA από `headers()` όπως στο
  `respondWorkOrder`) και παγώνει το HTML με το νέο acceptance block.
- `lib/contracts.ts`: η γραμμή αποδοχής συνεργάτη γίνεται «**Αποδοχή Συνεργάτη:**
  {όνομα} ({email}) · {ημ/ώρα} · IP {ip}» και προστίθεται placeholder
  `{{supplier.signatory}}`. Η πελατική πλευρά μένει ως έχει.
- UI: στη σελίδα `/marketplace/work-orders/[id]/contract` προστίθεται, όταν
  `status=ACCEPTED && !supplierAcceptedAt`, κάρτα «Ηλεκτρονική αποδοχή» κάτω από το
  έγγραφο: ονοματεπώνυμο (προσυμπληρωμένο), checkbox «Διάβασα και αποδέχομαι τους
  όρους της σύμβασης {{number}}-B», κουμπί «Αποδοχή & υπογραφή». Η σελίδα του WO
  (`WorkOrderActions`) οδηγεί εκεί. Μη-admin βλέπει γιατί δεν μπορεί.
- Μετά την αποδοχή: in-app notification στην εταιρεία (υπάρχει) + branded email
  `contractSignedEmail` στους `companyStaffIds()` με CTA στη σύμβαση Β (/admin/work-orders/[id]/contract/supplier)
  και email επιβεβαίωσης στον υπογράφοντα με CTA στο αντίγραφό του.
- Print CSS: `ContractView` παίρνει `@page { margin: 18mm }`, κρύβει sidebar/κουμπιά,
  και αποκτά υποσέλιδο με αριθμό σύμβασης/έκδοση (ήδη στο acceptance block).

## 9. Email (όλα μέσω `renderEmail` + `lib/mailgun.ts`)
Νέο `lib/emails/supplier-invites.ts` με καθαρές συναρτήσεις που επιστρέφουν
`{subject, html, text}`: `rfqInvitationEmail`, `contactInvitationEmail`,
`contractSignedStaffEmail`, `contractSignedSupplierEmail`. Αποστολή με `sendEmail`
wrapper `sendBrandedEmail(to, {subject, html, text}, tags)` (νέο export στο mailgun.ts,
σέβεται `EMAIL_REDIRECT_TO`). Τοπικά: `EMAIL_REDIRECT_TO` υπάρχει· δεν δημιουργούνται
test rows στη βάση χωρίς έγκριση.

## 10. Wiki & βοήθεια
Νέα άρθρα: `staff-rfq.md` (route `/staff/rfq`, roles 4 εταιρείας). Ενημέρωση:
`super-admin-suppliers-detail.md` (ενότητα Επαφές & πρόσβαση), `marketplace-team.md`,
`marketplace-work-orders-detail-contract.md` (ηλεκτρονική αποδοχή),
`marketplace-rfq-detail.md`/`marketplace-rfq.md` (πρόσκληση με link),
`admin-maintenance-detail.md` (νέος picker με φίλτρα, ξανά-αποστολή). Το `/invite`
είναι κάτω από `(auth)` και εξαιρείται από το coverage test. Το `docs/wiki/flows/suppliers.md`
αποκτά παράγραφο για το link και την αποδοχή σύμβασης.

## 11. Δοκιμές
- Unit (vitest): `lib/supplier-invites.test.ts` (hash/expiry/revoke/one-use με mocked db),
  `lib/rfq-shared.test.ts` (`invitationState`), `lib/emails/supplier-invites.test.ts`
  (περιέχει link, δεν περιέχει κωδικό, text fallback), `lib/rfq-candidates.test.ts`
  (φίλτρα απόστασης/βαθμολογίας πάνω σε rankSuppliers), `lib/help/coverage.test.ts`.
- Browser στο http://localhost:3002 (dev-3002): /staff/rfq ως SUPER_ADMIN, picker
  φίλτρα, σελίδα supplier → Επαφές, /invite/{token} (invalid state), /marketplace/team
  και /marketplace/work-orders/[id]/contract (View-as). Χωρίς νέες εγγραφές στη βάση
  εκτός αν ο χρήστης εγκρίνει· αλλιώς dry-run των server actions μέσω vitest mocks.
- `npx tsc --noEmit` (γνωστά 2 σφάλματα σε app/api/super-admin/costs/*), `npm run lint`
  στα νέα αρχεία, `npm test`.

## 12. Εκτός πεδίου
Standalone RFQ χωρίς βλάβη· magic sign-in· server PDF· SMS· Φ3 χρηματοοικονομικά·
αλλαγές στο μενού/ομάδες του company surface (παράλληλη συνεδρία).
