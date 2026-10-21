# PWA — εγκατάσταση στο κινητό + offline κέλυφος (σχεδιασμός)

**Ημερομηνία:** 2026-10-21 · **Κατάσταση:** εγκεκριμένο σχέδιο (brainstorming με τον χρήστη) · **Φάση:** 1 από 2 (η Φάση 2 = Web Push, εκτός αυτού του spec)

## 1. Στόχος και όρια

**Τι θέλει ο χρήστης (δικά του λόγια):** «πρέπει να γίνει PWA».

**Αποτέλεσμα που ζητείται:**
- Η εφαρμογή (https://property.dgsmart.gr) να εγκαθίσταται στην αρχική οθόνη κινητού (Android/Chrome και iPhone/Safari) με δικό της εικονίδιο Orithon και να ανοίγει χωρίς το chrome του browser (standalone).
- Χωρίς δίκτυο να εμφανίζεται δική μας σελίδα «Χωρίς σύνδεση» αντί για το σφάλμα του browser.
- Οθόνες προτεραιότητας για κινητό: `/report`, `/admin/work`, `/portal`, `/owner`, `/building/[id]`.

**Σήμερα:** δεν υπάρχει manifest, service worker ούτε PWA metadata (έλεγχος: `app/manifest.*`, `public/manifest*`, `public/sw.js`, next-pwa/serwist/workbox στο package.json — τίποτα).

**Εκτός φάσης (Φάση 2, δική της συνεδρία):** Web Push για το καμπανάκι ειδοποιήσεων. Ο service worker αυτής της φάσης σχεδιάζεται ώστε η Φάση 2 να προσθέτει μόνο handlers `push` / `notificationclick`, χωρίς αλλαγή αρχιτεκτονικής. Απαιτούμενα Φάσης 2 (καταγραφή μόνο): πακέτο `web-push`, VAPID keys σε env (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`), μοντέλο Prisma `PushSubscription` (userId, endpoint unique, p256dh, auth, userAgent, createdAt) με `migrate diff` + `migrate deploy` μόνο με ρητή έγκριση, αποστολή push στο σημείο δημιουργίας `Notification`, διακόπτης «Ειδοποιήσεις στο κινητό» στο καμπανάκι.

## 2. Αποφάσεις (από το brainstorming)

| Ερώτηση | Απόφαση |
|---|---|
| Εύρος φάσης | Εγκατάσταση + offline κέλυφος. Push αργότερα. |
| Τι αποθηκεύει ο SW | Μόνο κέλυφος + static. Σελίδες/API/RSC ποτέ. |
| Τεχνική SW | Χειρόγραφο `public/sw.js`, χωρίς εξάρτηση (τα @serwist/next, next-pwa θέλουν webpack· το build είναι Turbopack). |
| start_url | Νέα διαδρομή `/home` → `homePathForRole` (το `/` είναι η δημόσια landing). |
| Install banner | Σε κινητό (≤767 px), μετά τη σύνδεση, σε όλα τα shells + `/report`, σιωπή 30 ημερών μετά το «Όχι τώρα». |
| Εικονίδια | Από το σύμβολο Orithon 272 px (`public/orithon/orithon-symbol-black.png`) σε κρεμ φόντο· δεν υπάρχει AppSettings εγγραφή/λογότυπο στη βάση. |

**Γιατί «μόνο κέλυφος»:** η εφαρμογή είναι multi-customer με αυστηρή απομόνωση δεδομένων. Μια cache σελίδων/API σε κοινόχρηστη συσκευή θα μπορούσε να δείξει δεδομένα του προηγούμενου χρήστη ή παλιές τιμές. Με cache μόνο για αμετάβλητα, μη-προσωπικά αρχεία (`/_next/static/*` hashed, εικονίδια, στατική σελίδα offline) ο κίνδυνος είναι μηδενικός.

## 3. Αρχιτεκτονική

```
browser ──GET /manifest.webmanifest──▶ app/manifest.ts (force-dynamic) ──▶ lib/pwa/manifest.ts buildManifest()
browser ──register('/sw.js')────────▶ public/sw.js  (static, Cache-Control: no-cache)
   SW install   : precache /offline + /icons/*
   SW activate  : σβήσιμο παλιών caches, clients.claim()
   SW fetch     : navigate → network, fallback /offline (δεν αποθηκεύει)
                  /_next/static|/icons → cache-first
                  λοιπά (API, RSC, SSE, CDN) → δεν παρεμβαίνει
AppShell / ReportLayout ──▶ <InstallBanner/> (client, phone only) ──▶ lib/pwa/install-banner.ts decideBanner()
RootLayout ──▶ <PwaRegistrar/> (client) + metadata.appleWebApp + viewport.themeColor
/home  (server) → redirect(homePathForRole) ή /login?callbackUrl=/home
/offline (static) → «Χωρίς σύνδεση» + «Δοκιμή ξανά»
```

### 3.1 Manifest — `app/manifest.ts` + `lib/pwa/manifest.ts`

- `app/manifest.ts`: Next 16 metadata file convention (`MetadataRoute.Manifest`), εξυπηρετείται στο `/manifest.webmanifest`, το `<link rel="manifest">` μπαίνει αυτόματα στο `<head>`. `export const dynamic = "force-dynamic"` — το build δεν έχει πρόσβαση στη βάση (memory project_deployment). Διαβάζει `getAppSettings()` και καλεί `buildManifest(settings)`.
- `lib/pwa/manifest.ts` — καθαρή συνάρτηση `buildManifest({ companyName, colorPrimary }): MetadataRoute.Manifest`:
  - `name`/`short_name`: `companyName` αν έχει οριστεί και δεν είναι το generic default «PropertyPro», αλλιώς «Orithon». `short_name` ≤ 12 χαρακτήρες (κόβεται).
  - `description`: «Διαχείριση πολυκατοικιών: κοινόχρηστα, βλάβες, ανακοινώσεις, ραντεβού.»
  - `id: "/home"`, `start_url: "/home"`, `scope: "/"`, `display: "standalone"`, `orientation: "portrait"`, `lang: "el"`, `dir: "ltr"`.
  - `background_color: "#F6F4EC"` (το `--bg-canvas`), `theme_color: "#F6F4EC"` (η γραμμή κατάστασης να «χάνεται» στο κρεμ canvas — όχι το `colorPrimary` που είναι σχεδόν μαύρο).
  - `icons`: `/icons/icon-192.png` (192, any), `/icons/icon-512.png` (512, any), `/icons/maskable-512.png` (512, maskable).
  - `shortcuts`: «Δήλωση βλάβης» → `/report` (εικονίδιο `/icons/icon-192.png`), «Αρχική» → `/home`. Το manifest ζητείται χωρίς cookies, άρα τα shortcuts είναι ουδέτερα ρόλου· η `/home` στέλνει καθέναν στη δική του αρχική.
- Root layout (`app/layout.tsx`): `metadata.applicationName = "Orithon"`, `metadata.appleWebApp = { capable: true, statusBarStyle: "default", title: "Orithon" }`, `export const viewport: Viewport = { themeColor: "#F6F4EC" }`. Το `metadata.manifest` δεν χρειάζεται (file convention).

### 3.2 Εικονίδια — `scripts/pwa-icons.mjs`

- Πηγή: `public/orithon/orithon-symbol-black.png` (272×272, μαύρο σε διάφανο).
- Παράγει με `sharp` (ήδη στο node_modules μέσω Next): `public/icons/icon-192.png`, `public/icons/icon-512.png` (σύμβολο στο 72% της πλευράς, κρεμ `#F6F4EC` φόντο), `public/icons/maskable-512.png` (σύμβολο στο 60% — safe zone maskable), `app/apple-icon.png` (180×180, 72%). Μέγιστη μεγέθυνση του συμβόλου ≈ ×1.35 (512×0.72=369 px από 272) — αποδεκτή για flat σύμβολο· όταν υπάρξει vector/hi-res λογότυπο, ξανατρέχει το script.
- Τα PNG γίνονται commit. Το script τρέχει χειροκίνητα: `node scripts/pwa-icons.mjs`.
- Το `app/apple-icon.png` εκπέμπει αυτόματα `<link rel="apple-touch-icon">` (Next file convention). Το υπάρχον `app/favicon.ico` μένει.

### 3.3 Δρομολόγηση — `/home`, `/offline`, proxy.ts, next.config.ts

- `app/home/page.tsx` (server): `getEffectiveSession()` → `redirect(homePathForRole(role))`, αλλιώς `redirect("/login?callbackUrl=/home")`. Χωρίς UI. Η proxy.ts ήδη στέλνει μη-συνδεδεμένους στο `/login?callbackUrl=<path>`, άρα δεν χρειάζεται αλλαγή γι' αυτήν τη διαδρομή. Στο wiki coverage test μπαίνει στο `REDIRECT_ONLY`.
- `app/offline/page.tsx` (χωρίς δικό του layout): η σελίδα είναι αυτόνομη, κάτω από το root layout (που διαβάζει AppSettings/SiteSettings από τη βάση — στο precache την ώρα του install το δίκτυο υπάρχει, άρα το HTML αποθηκεύεται πλήρες). `export const dynamic = "force-static"` ΔΕΝ γίνεται (το root layout είναι dynamic)· η σελίδα είναι απλά δυναμική και ο SW την αποθηκεύει μία φορά στο install (`cache: "reload"`) και την ανανεώνει σε κάθε νέα έκδοση SW. Περιεχόμενο: εικονίδιο `RiWifiOffLine`, «Χωρίς σύνδεση», «Ελέγξτε το δίκτυο και δοκιμάστε ξανά.», «Δοκιμή ξανά» ως απλός σύνδεσμος `href=""` (= η διεύθυνση που ζητήθηκε, χωρίς JS), link «Αρχική» → `/home`. Ελληνικά, `var(--fs-*)` **με literal fallbacks** σε κάθε token και χωρίς εξάρτηση από React/globals.css — η cached σελίδα μπορεί να αναφέρει chunks παλιότερου build. Ο SW την ξανα-αποθηκεύει (`cache: "reload"`) μία φορά ανά ζωή του, στην πρώτη επιτυχή πλοήγηση.
- `proxy.ts`: `/offline` προστίθεται στο `authPublicPaths` (δημόσιο, μη τοπικοποιημένο — αλλιώς μη-συνδεδεμένος → redirect στο login και ο SW θα αποθήκευε τη σελίδα login ως «offline»). Τα `/manifest.webmanifest`, `/sw.js`, `/icons/*.png`, `/apple-icon.png` περιέχουν τελεία και ήδη εξαιρούνται από τον matcher (`.*\\..*`).
- `next.config.ts`: `headers()` για `/sw.js` → `Cache-Control: no-cache, no-store, must-revalidate` και `Content-Type: application/javascript; charset=utf-8`, ώστε κάθε deploy να φτάνει στις συσκευές (η εγγραφή γίνεται και με `updateViaCache: "none"`).

### 3.4 Service worker — `public/sw.js`

Χειρόγραφο, ES2017 χωρίς imports, ~150 γραμμές, σχόλια στα ελληνικά. Σταθερές: `const VERSION = "v1"`, `const CACHE = "orithon-shell-" + VERSION`, `const PRECACHE = ["/offline", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png"]`, `const DEV = new URL(self.location.href).searchParams.get("dev") === "1"`.

Κανόνες (η λογική σε μία καθαρή συνάρτηση `routeFor(request, origin)` που επιστρέφει `"navigate" | "static" | "bypass"`, εκτεθειμένη ως `self.__pwa = { routeFor, VERSION, CACHE, PRECACHE }` για τα tests):
- Όχι GET ή άλλο origin → `bypass` (ο SW δεν καλεί `respondWith`).
- `request.mode === "navigate"` → `navigate`: `fetch(request)`· σε σφάλμα δικτύου → `caches.match("/offline")`· αν ούτε αυτό υπάρχει → `Response` 503 με απλό κείμενο. Η απάντηση σελίδας ΔΕΝ μπαίνει ποτέ σε cache. Η `/offline` η ίδια, όταν ζητηθεί online, περνά από δίκτυο κανονικά.
- Path που αρχίζει με `/_next/static/` ή `/icons/` ή είναι `/apple-icon.png` → `static`: cache-first (`caches.match` → αλλιώς `fetch` και `cache.put` αν `response.ok`). Σε `DEV` → `bypass` (τα dev chunks του Turbopack δεν είναι content-hashed· το HMR θα έσπαγε).
- Οτιδήποτε άλλο (`/api/*`, RSC `?_rsc=`, `/_next/image`, SSE `/api/realtime`, Bunny CDN, server actions POST) → `bypass`.
- `install`: `cache.addAll` του PRECACHE με `new Request(url, { cache: "reload" })`, `self.skipWaiting()`.
- `activate`: διαγραφή κάθε cache με όνομα `orithon-shell-*` ≠ `CACHE`, `self.clients.claim()`.
- `message`: `{ type: "SKIP_WAITING" }` → `self.skipWaiting()` (για μελλοντικό «Νέα έκδοση — ανανέωση»· δεν υλοποιείται UI τώρα).
- Σχόλιο-σημάδι: `// Φάση 2 (Web Push): εδώ μπαίνουν οι handlers 'push' και 'notificationclick'.`

### 3.5 Εγγραφή + install banner

- `components/pwa/PwaRegistrar.tsx` (client, `null` render): σε `useEffect`, αν `"serviceWorker" in navigator`, `navigator.serviceWorker.register(process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?dev=1", { scope: "/", updateViaCache: "none" })`, σφάλματα σιωπηλά (`console.warn`). Τοποθετείται στο `app/layout.tsx` μέσα στο `<body>` — κάθε σελίδα (και το login) εγγράφει τον SW, ώστε η offline σελίδα να δουλεύει παντού.
- `lib/pwa/install-banner.ts` — καθαρή λογική:
  - `type BannerState = "hidden" | "native" | "ios"`.
  - `decideBanner({ isPhone, standalone, installed, snoozedUntil, now, isIOS, hasNativePrompt }): BannerState` → `hidden` αν `!isPhone || standalone || installed || (snoozedUntil && snoozedUntil > now)`· `native` αν `hasNativePrompt`· `ios` αν `isIOS`· αλλιώς `hidden` (desktop Safari/Firefox κ.λπ. — χωρίς θόρυβο).
  - `isIOSUserAgent(ua)`: `/iPad|iPhone|iPod/` ή (Macintosh + touch, iPadOS 13+).
  - `SNOOZE_DAYS = 30`, keys localStorage: `orithon.pwa.snoozedUntil` (ISO), `orithon.pwa.installed` ("1"). Helpers `readState()` / `snooze(now)` / `markInstalled()` με try/catch (private mode).
- `components/pwa/InstallBanner.tsx` (client): `usePhone()` (lib/use-media-query), `matchMedia("(display-mode: standalone)")` ή `navigator.standalone` (iOS), ακούει `beforeinstallprompt` (κρατά το event, `preventDefault()`) και `appinstalled` (→ `markInstalled`, κρύβει). Render μόνο όταν `decideBanner() !== "hidden"`:
  - Κάρτα in-flow στην κορυφή του περιεχομένου (όχι `position: fixed` — τα κουμπιά Γρήγορες ενέργειες/Βοήθεια/Βοηθός είναι ήδη κάτω αριστερά/δεξιά): εικονίδιο `RiSmartphoneLine`, τίτλος «Προσθέστε το Orithon στην αρχική οθόνη», υπότιτλος μία γραμμή.
  - `native`: κουμπί «Εγκατάσταση» → `event.prompt()`· αν `outcome === "accepted"` → `markInstalled`, αλλιώς `snooze`. Κουμπί «Όχι τώρα» → `snooze`.
  - `ios`: κείμενο «Πατήστε Κοινή χρήση (`RiShareBoxLine`) και μετά «Προσθήκη στην αρχική οθόνη».» + «Εντάξει» → `snooze`.
  - Στυλ: inline tokens (`var(--card)`, `var(--border)`, `var(--radius)`, `var(--fs-13/14)`), touch targets ≥ 44 px, ελληνικά, εικονίδια μόνο react-icons/ri *Line.
- Τοποθέτηση: `components/admin/app-shell.tsx` ως πρώτο παιδί του `<main className="app-main">` (όλα τα surfaces) και `app/report/layout.tsx` ως πρώτο παιδί του `<main>`.

### 3.6 Wiki + βοήθεια

- `docs/wiki/basics.md`: η εισαγωγική φράση «Δεν χρειάζεται να εγκαταστήσετε τίποτα» → «Δεν χρειάζεται να εγκαταστήσετε τίποτα· αν θέλετε, προσθέστε την στην αρχική οθόνη του κινητού (ενότητα 9).» Νέα ενότητα «## 9. Εγκατάσταση στο κινητό (προαιρετικά)» με βήματα Android/Chrome («Εγκατάσταση» στο banner ή μενού ⋮ → «Προσθήκη στην αρχική οθόνη») και iPhone/Safari (Κοινή χρήση → «Προσθήκη στην αρχική οθόνη»), τι αλλάζει (ανοίγει σαν εφαρμογή, εικονίδιο Orithon, shortcuts με παρατεταμένο πάτημα), και «Χωρίς σύνδεση: βλέπετε μήνυμα «Χωρίς σύνδεση» — τα δεδομένα δεν αποθηκεύονται στη συσκευή». Η ενότητα «8. Έξοδος» μένει 8.
- `docs/wiki/pages/offline.md`: frontmatter `route: /offline`, `roles: []` (κενός πίνακας = όλοι οι ρόλοι, όπως το `report.md`), `surface: standalone`, `area: other`, σύντομο άρθρο.
- `lib/help/coverage.test.ts`: `REDIRECT_ONLY` += `/home`.

## 4. Σφάλματα και ακραίες περιπτώσεις

- **Private mode / αποκλεισμένο storage:** όλα τα `localStorage` σε try/catch· το banner απλώς ξαναεμφανίζεται.
- **Αποτυχία εγγραφής SW** (HTTP εκτός localhost, παλιός browser): σιωπηλό `console.warn`, η εφαρμογή δουλεύει ως πριν.
- **Install πριν ολοκληρωθεί το precache** (π.χ. 500 στο `/offline`): το `install` αποτυγχάνει και ο SW δεν ενεργοποιείται — σωστή συμπεριφορά (δεν μένει μισός). Το `/offline` δεν διαβάζει τίποτα πέρα από ό,τι διαβάζει το root layout.
- **Νέα έκδοση SW:** `skipWaiting` + `clients.claim` → η επόμενη πλοήγηση χρησιμοποιεί τον νέο. Το `activate` σβήνει την παλιά cache. Κάθε αλλαγή στο `PRECACHE` ή στους κανόνες απαιτεί bump του `VERSION`.
- **Αποσύνδεση χρήστη:** τίποτα προσωπικό δεν είναι σε cache, άρα δεν χρειάζεται καθάρισμα.
- **Impersonation (View-as):** το banner/SW δεν αλλάζουν τίποτα· `/home` χρησιμοποιεί `getEffectiveSession` (όπως το report layout).
- **Dev:** `/sw.js?dev=1` → μόνο navigate fallback + precache· το `/_next/static` δεν αποθηκεύεται. Για να ξεφορτωθεί ο SW από το localhost:3002 μετά τις δοκιμές: DevTools → Application → Unregister (καταγράφεται στο hand-over).
- **iOS:** δεν υπάρχει `beforeinstallprompt`· μόνο οδηγίες. Το `appleWebApp.capable` + `apple-icon.png` δίνουν σωστό εικονίδιο/τίτλο.

## 5. Tests (vitest, TDD)

- `lib/pwa/manifest.test.ts`: defaults (Orithon), custom companyName, short_name ≤ 12, start_url/id `/home`, 3 icons με σωστά purposes, 2 shortcuts, lang `el`, theme/background `#F6F4EC`.
- `lib/pwa/install-banner.test.ts`: πίνακας περιπτώσεων για `decideBanner` (desktop → hidden, standalone → hidden, snoozed → hidden, snooze ληγμένο → native/ios, iOS χωρίς prompt → ios, Android με prompt → native, Android χωρίς prompt → hidden, installed → hidden), `isIOSUserAgent`, `snooze` υπολογίζει +30 ημέρες.
- `lib/pwa/sw.test.ts`: φορτώνει `public/sw.js` με `node:vm` σε context με stub `self` (`addEventListener` που συλλέγει handlers, `skipWaiting`, `clients.claim`, `location`), stub `caches` (in-memory Map ανά cache name με `open/match/keys/delete`, `cache.addAll/put/match`), stub `fetch`/`Request`/`Response` (τα global του Node). Έλεγχοι: (a) `routeFor`: navigate/static/bypass για GET σελίδας, `/_next/static/x.js`, `/icons/icon-192.png`, `/api/notifications`, `?_rsc=` fetch, POST, cross-origin, `/apple-icon.png`· (b) `install` καλεί `addAll` με το PRECACHE· (c) navigate με fetch που απορρίπτει → επιστρέφει το cached `/offline`, και η επιτυχής navigate απάντηση ΔΕΝ μπαίνει σε cache· (d) static: 2η κλήση εξυπηρετείται από cache χωρίς fetch· (e) `DEV` → static γίνεται bypass· (f) `activate` σβήνει `orithon-shell-v0`, κρατά το τρέχον.
- `lib/help/coverage.test.ts` περνά με `/home` στο REDIRECT_ONLY και το άρθρο `offline.md`.

## 6. Επαλήθευση

1. `npx tsc --noEmit` (9 προϋπάρχοντα σφάλματα, 0 νέα), `npm run lint` (0 νέα στα αρχεία που αγγίζονται), `npm run test` (2 προϋπάρχοντα failing, 0 νέα).
2. Browser pane στο http://localhost:3002 (launch config `dev-3002`, ο χρήστης συνδέεται μόνος του): `/manifest.webmanifest` επιστρέφει JSON με τα παραπάνω· DevTools Application → Manifest χωρίς σφάλματα/warnings, Service Workers → activated· mobile viewport 375 px σε `/admin/work` και `/report` → banner ορατό, «Όχι τώρα» το κρύβει και μένει κρυφό μετά από reload· `/offline` σωστή εμφάνιση· με `/sw.js` ενεργό και το δίκτυο «offline» στα DevTools, πλοήγηση σε σελίδα → εμφανίζεται η `/offline`.
3. Παραγωγή (μετά το deploy από τον χρήστη): Chrome Android δείχνει «Εγκατάσταση εφαρμογής»· Lighthouse → «Installable».

## 7. Αρχεία

Νέα: `app/manifest.ts`, `lib/pwa/manifest.ts(+test)`, `lib/pwa/install-banner.ts(+test)`, `lib/pwa/sw.test.ts`, `public/sw.js`, `public/icons/{icon-192,icon-512,maskable-512}.png`, `app/apple-icon.png`, `scripts/pwa-icons.mjs`, `app/home/page.tsx`, `app/offline/page.tsx`, `components/pwa/{PwaRegistrar,InstallBanner}.tsx`, `app/offline/page.test.ts`, `docs/wiki/pages/offline.md`.
Αλλαγές: `app/layout.tsx` (metadata/viewport + PwaRegistrar), `components/admin/app-shell.tsx` (InstallBanner), `app/report/layout.tsx` (InstallBanner), `proxy.ts` (`/offline` δημόσιο), `next.config.ts` (headers για `/sw.js`), `docs/wiki/basics.md`, `lib/help/coverage.test.ts`.
Δεν αγγίζονται (παράλληλες συνεδρίες): `components/admin/sidebar-nav.tsx`, `lib/quick-actions.ts`, `lib/work/*`, settings geodata. Καμία αλλαγή στη βάση.
