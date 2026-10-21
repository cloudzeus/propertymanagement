# PWA Φάση 2 — Web Push για το καμπανάκι ειδοποιήσεων (σχεδιασμός)

**Ημερομηνία:** 2026-10-21 · **Κατάσταση:** σχέδιο με σταθερό εύρος (παραδόθηκε από τη συνεδρία PWA Φάσης 1, spec `2026-10-21-pwa-design.md` §1) · **Φάση:** 2 από 2

## 1. Στόχος

Όποιος έχει εγκαταστήσει την εφαρμογή (ή απλώς τη χρησιμοποιεί σε browser που υποστηρίζει Web Push) και ενεργοποιήσει τον διακόπτη «Ειδοποιήσεις στο κινητό» στο καμπανάκι, λαμβάνει push στη συσκευή του **κάθε φορά που δημιουργείται γραμμή `Notification` για αυτόν** — βλάβες, προσφορές, αναθέσεις, ραντεβού, demo. Το push είναι συμπλήρωμα του καμπανακιού (polling 60") και του e-mail, όχι αντικατάσταση: αν λείπει, αποτύχει ή ο χρήστης το αρνηθεί, τίποτα άλλο δεν αλλάζει.

**Σήμερα:** `Notification` γράφεται σε τρία σημεία — `lib/notify.ts notifyUsers`, `lib/maintenance-requests.ts notifyStakeholders`, `lib/demo-booking.ts` — όλα με `db.notification.createMany`. Δεν υπάρχει κοινό helper, ούτε push.

## 2. Αποφάσεις

| Ερώτηση | Απόφαση |
|---|---|
| Βιβλιοθήκη | `web-push` 3.6 (VAPID). Κλειδιά σε env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto). Παραγωγή με `npx web-push generate-vapid-keys`. Χωρίς κλειδιά → το push είναι απενεργοποιημένο σιωπηλά (ο διακόπτης δείχνει «μη διαθέσιμο»). |
| Αποθήκευση συνδρομών | Μοντέλο Prisma `PushSubscription` (id, userId → User cascade, endpoint @unique, p256dh, auth, userAgent?, createdAt, lastUsedAt?). Μία γραμμή ανά συσκευή/browser. |
| Ποιος χρήστης | Ο **effective** χρήστης (`getEffectiveSession`). Εξαίρεση: όταν ο super-admin κάνει View-as (impersonation), η εγγραφή **απορρίπτεται** — η συσκευή είναι του super-admin, όχι του στόχου, και θα του έστελνε ξένες ειδοποιήσεις. |
| Ίδια συσκευή, άλλος λογαριασμός | Το endpoint είναι unique· `upsert` κατά endpoint ξαναδένει τη συνδρομή στον χρήστη που είναι συνδεδεμένος τώρα. Έτσι μια κοινόχρηστη συσκευή δεν λαμβάνει ποτέ ειδοποιήσεις του προηγούμενου χρήστη (απομόνωση δεδομένων). |
| Πού στέλνεται | Σε ένα σημείο: νέο helper `lib/notifications.ts createNotifications(rows)` που κάνει το `createMany` **και** fire-and-forget push. Τα τρία σημερινά σημεία το καλούν. Κανένα άλλο `db.notification.create*` στον κώδικα. |
| Σφάλματα αποστολής | 404/410 (Gone) → διαγραφή της συνδρομής. Άλλα σφάλματα → `console.warn`, η συνδρομή μένει. Το `sendPushToUser` **δεν πετάει ποτέ** εξαίρεση στον καλούντα (ίδιο μοτίβο με `publishBuildingEvent`). |
| Payload | JSON `{ title, body?, href, tag }` ≤ ~2 KB (το body κόβεται στους 200 χαρακτήρες). `tag` = `href` ώστε πολλαπλά push για το ίδιο αντικείμενο να αντικαθιστούν το ένα το άλλο. TTL 24h. |
| SW | `public/sw.js`: handlers `push` (showNotification με icon/badge `/icons/icon-192.png`, `data.href`) και `notificationclick` (κλείσιμο, focus υπάρχοντος παραθύρου ίδιου origin + `navigate(href)`, αλλιώς `openWindow(href)`). `VERSION` → `v2`. |
| UI | Υποσέλιδο στο panel του καμπανακιού: διακόπτης «Ειδοποιήσεις στο κινητό». Καταστάσεις: `unsupported` (κρυφός), `unconfigured` (χωρίς δημόσιο κλειδί· κρυφός), `ios-install` (iPhone χωρίς εγκατάσταση: οδηγία), `denied` (απορρίφθηκε στον browser: κείμενο), `off`, `on`. Η απόφαση είναι καθαρή συνάρτηση `decidePushState` στο `lib/push/client-state.ts`. |
| iOS | Push μόνο σε εγκατεστημένη εφαρμογή (iOS 16.4+). Σε Safari χωρίς εγκατάσταση δείχνουμε «Προσθέστε την εφαρμογή στην αρχική οθόνη για ειδοποιήσεις» (δείτε §9 του οδηγού). |
| Παραγωγή | Migration μόνο με `migrate diff` + `migrate deploy` **μετά από ρητή έγκριση** (η τοπική βάση είναι η παραγωγική). Env στο Coolify: τα τρία VAPID. |

## 3. Αρχιτεκτονική

```
bell panel footer ──▶ <PushToggle/> (client)
   ├─ reads: serviceWorker/PushManager/Notification support, Notification.permission,
   │         registration.pushManager.getSubscription(), isIOS, standalone, NEXT_PUBLIC_VAPID_PUBLIC_KEY
   ├─ decidePushState(input) ──▶ "unsupported" | "unconfigured" | "ios-install" | "denied" | "off" | "on"
   ├─ on: Notification.requestPermission() → pushManager.subscribe({userVisibleOnly, applicationServerKey})
   │      → server action subscribePush({endpoint, keys:{p256dh,auth}}, userAgent)   [upsert by endpoint]
   └─ off: subscription.unsubscribe() → unsubscribePush(endpoint)                     [deleteMany userId+endpoint]

any mutation ──▶ createNotifications(rows)   (lib/notifications.ts)
   ├─ db.notification.createMany({ data: rows })
   └─ void sendPushToUsers(rows)             (lib/push/send.ts, fire-and-forget)
          ├─ isPushConfigured()? else return
          ├─ db.pushSubscription.findMany({ userId in … })
          ├─ webpush.sendNotification(sub, JSON payload, { TTL: 86400 })  per subscription (allSettled)
          ├─ 404/410 → db.pushSubscription.deleteMany({ endpoint })
          └─ ok → lastUsedAt = now (best effort)

public/sw.js
   push              → event.data.json() (fallback: text ως title) → registration.showNotification(title, {body, icon, badge, tag, data:{href}, renotify})
   notificationclick → notification.close(); clients.matchAll({type:"window", includeUncontrolled:true})
                       → πρώτο client ίδιου origin: focus() + navigate(href) αν υπάρχει· αλλιώς clients.openWindow(href)
```

### 3.1 Prisma

```prisma
model PushSubscription {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation("userPushSubscriptions", fields: [userId], references: [id], onDelete: Cascade)
  endpoint   String    @unique
  p256dh     String
  auth       String
  userAgent  String?
  createdAt  DateTime  @default(now())
  lastUsedAt DateTime?

  @@index([userId])
}
```
`User.pushSubscriptions PushSubscription[] @relation("userPushSubscriptions")`. Migration `prisma/migrations/20261021180000_push_subscriptions/migration.sql` από `migrate diff`.

### 3.2 Server (`lib/push/send.ts`, `app/actions/push.ts`, `lib/notifications.ts`)

- `isPushConfigured()`: και τα τρία env παρόντα. `getWebPush()` ρυθμίζει `setVapidDetails` μία φορά (lazy, ώστε το build/test να μην απαιτεί κλειδιά).
- `buildPushPayload({title, body, href})` καθαρή: κόβει body στα 200, `tag = href`, επιστρέφει string JSON.
- `fanOut(subs, payload, send)` καθαρή: καλεί `send` ανά συνδρομή με `allSettled`, επιστρέφει `{ sent: string[], gone: string[] }` (endpoints) — 404/410 = gone.
- `sendPushToUsers(rows: {userId,title,body,href}[])`: ομαδοποιεί ανά χρήστη, φορτώνει συνδρομές, στέλνει, διαγράφει gone, ενημερώνει lastUsedAt. try/catch γύρω από όλα· ποτέ throw. `sendPushToUser(userId, payload)` = wrapper.
- `subscribePush(input)`: effective session· απορρίπτει impersonation· επικυρώνει (endpoint `https:` URL ≤ 2 KB, p256dh/auth base64url ≤ 512)· `upsert` κατά endpoint με `userId` του τρέχοντος χρήστη. Επιστρέφει `{ ok: true } | { ok: false, reason }`.
- `unsubscribePush(endpoint)`: `deleteMany({ endpoint, userId })`.
- `createNotifications(rows)`: `createMany` + `void sendPushToUsers(rows)`. Οι τρεις καλούντες το χρησιμοποιούν· η `notifyUsers` και η `notifyStakeholders` κρατούν τη δική τους λογική παραληπτών/e-mail.

### 3.3 Client (`lib/push/client-state.ts`, `components/pwa/PushToggle.tsx`)

- `decidePushState({ hasServiceWorker, hasPushManager, hasNotification, hasPublicKey, permission, subscribed, isIOS, standalone })`:
  - όχι SW/PushManager/Notification → `unsupported`
  - όχι δημόσιο κλειδί → `unconfigured`
  - iOS και όχι standalone → `ios-install`
  - permission `denied` → `denied`
  - subscribed → `on`, αλλιώς `off`
- `urlBase64ToUint8Array(key)` καθαρή (από τον οδηγό του Next).
- `PushToggle`: φορτώνει την κατάσταση με async effect (όχι setState συγχρονισμένα στο effect), δείχνει switch + κείμενο, χειρίζεται `busy` και σφάλμα («Δεν ήταν δυνατή η ενεργοποίηση»). `RiNotification3Line`/`RiSmartphoneLine`, μεγέθη `var(--fs-12|13)`.

### 3.4 Wiki

`docs/wiki/basics.md` §9: νέα παράγραφος «Ειδοποιήσεις στο κινητό» — πού είναι ο διακόπτης, τι ζητά ο browser, iPhone μόνο μετά την εγκατάσταση, πώς απενεργοποιείται, τι σημαίνει «Απορρίφθηκε» (ρυθμίσεις ιστότοπου). Το `lib/help/coverage.test.ts` μένει πράσινο (δεν προστίθεται σελίδα).

## 4. Σφάλματα και ακραίες περιπτώσεις

- Χωρίς VAPID στο env (τοπικά/πριν το Coolify): `isPushConfigured()` false → κανένα push, ο διακόπτης κρυφός. Το log γράφει μία φορά «push disabled».
- Συνδρομή ληγμένη (410) ή άγνωστη (404): διαγραφή από τη βάση — ο διακόπτης στην επόμενη επίσκεψη δείχνει `off` (το `getSubscription()` του browser ακολουθεί).
- Ο browser έχει συνδρομή αλλά η βάση όχι (π.χ. αλλαγή λογαριασμού, καθαρισμός): ο διακόπτης δείχνει `on` κατά τον browser· στο επόμενο «on» ή με re-sync στο mount στέλνουμε `subscribePush` ξανά (idempotent upsert). Υλοποίηση: στο mount, αν `subscribed`, καλούμε `subscribePush` σιωπηλά.
- Impersonation: `subscribePush` → `{ ok:false, reason:"impersonating" }`, UI «Μη διαθέσιμο κατά την προβολή ως άλλος χρήστης».
- Αποτυχία `requestPermission` ή `subscribe` (π.χ. Brave, offline): μήνυμα σφάλματος, κατάσταση `off`.
- Payload χωρίς JSON (δοκιμή από DevTools «Push»): ο SW δείχνει το κείμενο ως τίτλο.
- `notificationclick` χωρίς `href`: ανοίγει `/home`.
- Το push **δεν περιέχει** προσωπικά δεδομένα πέρα από τον τίτλο/σώμα της ειδοποίησης (ήδη ορατά στο καμπανάκι). Οι push services βλέπουν κρυπτογραφημένο payload.
- Dev (`/sw.js?dev=1` σε localhost): το push δουλεύει κανονικά (localhost = secure context).

## 5. Tests (vitest, TDD)

- `lib/push/send.test.ts`: `buildPushPayload` (κόψιμο body, tag), `fanOut` (410 → gone, 500 → ούτε sent ούτε gone, ok → sent), `sendPushToUsers` με mock `@/lib/db` + mock `web-push`: διαγράφει gone, ενημερώνει lastUsedAt, δεν πετάει όταν η db αποτύχει, δεν κάνει τίποτα χωρίς env.
- `app/actions/push.test.ts`: `subscribePush` upsert με userId του effective χρήστη, απόρριψη impersonation, απόρριψη άκυρου endpoint (`http:`), `unsubscribePush` scoped στον χρήστη.
- `lib/notifications.test.ts`: `createNotifications` καλεί `createMany` και `sendPushToUsers` με τις ίδιες γραμμές· ένα σφάλμα του push δεν σπάει τον καλούντα.
- `lib/notify.test.ts`, `lib/maintenance-requests` (αν υπάρχει test): προσαρμογή mocks στο νέο helper.
- `lib/pwa/sw.test.ts`: `push` με JSON → `showNotification(title, {body, icon, badge, tag, data.href})`· push χωρίς JSON → τίτλος το κείμενο· `notificationclick` με ανοιχτό client → `focus` + `navigate`, χωρίς client → `openWindow(href)`· `VERSION === "v2"`.
- `lib/push/client-state.test.ts`: πίνακας περιπτώσεων για `decidePushState`, `urlBase64ToUint8Array` γνωστή τιμή.
- `lib/help/coverage.test.ts` πράσινο.

## 6. Επαλήθευση

1. `npx tsc --noEmit` (0 νέα), `npm run lint` (0 νέα στα αρχεία που αγγίζονται), `npm run test` (0 νέα αποτυχίες).
2. Παραγωγή (ο χρήστης): μετά το `migrate deploy` και τα env στο Coolify, ενεργοποίηση του διακόπτη στο δικό του κινητό και λήψη push από πραγματική ειδοποίηση. **Δεν δημιουργούνται δοκιμαστικές ειδοποιήσεις στην παραγωγική βάση.**

## 7. Αρχεία

Νέα: `lib/push/send.ts(+test)`, `lib/push/client-state.ts(+test)`, `lib/notifications.ts(+test)`, `app/actions/push.ts(+test)`, `components/pwa/PushToggle.tsx`, `prisma/migrations/20261021180000_push_subscriptions/migration.sql`.
Αλλαγές: `prisma/schema.prisma` (+ `lib/prisma/*` generated), `package.json`/`package-lock.json` (web-push), `public/sw.js` (v2 + handlers), `lib/pwa/sw.test.ts`, `lib/notify.ts`, `lib/maintenance-requests.ts` (μόνο το createMany), `lib/demo-booking.ts` (μόνο το createMany), `components/maintenance/notifications-bell.tsx` (footer), `docs/wiki/basics.md`, `.env` (τοπικά, εκτός git).
Δεν αγγίζονται: sidebar, quick-actions, lib/work, suppliers/RFQ UI (παράλληλες συνεδρίες).
