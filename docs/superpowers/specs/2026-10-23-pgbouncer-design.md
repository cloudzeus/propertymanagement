# PgBouncer — connection pooling μπροστά από την παραγωγική PostgreSQL (σχεδιασμός)

**Ημερομηνία:** 2026-10-23 · **Κατάσταση:** εγκεκριμένο από τον χρήστη (3 ερωτήσεις + έγκριση σχεδίου την ίδια μέρα) · **Εύρος:** υποδομή + στρώμα σύνδεσης της εφαρμογής, χωρίς αλλαγή σχήματος

## 1. Στόχος

«Επειδή είναι SaaS θέλω PgBouncer.» Η Next.js εφαρμογή (Coolify, Dockerfile, Node 24), ο in-process cron (tick ανά 5') και τα SSE δεν πρέπει να εξαντλούν τις συνδέσεις της PostgreSQL όσο μεγαλώνουν οι πελάτες. Ένας PgBouncer σε **transaction mode** κάθεται μπροστά από τη βάση: η εφαρμογή κρατά όσες client συνδέσεις θέλει, η βάση βλέπει ένα σταθερό, μικρό σύνολο server συνδέσεων.

**Σήμερα:** `lib/db.ts` → `new PrismaPg({ connectionString: DATABASE_URL })` χωρίς `max`/timeouts (pg Pool default 10 ανά process). Ένα URL για όλα (εφαρμογή, `prisma migrate deploy` στο boot του container, seeds, τοπική ανάπτυξη). Η Postgres τρέχει σε **άλλο VM με Docker**, προσβάσιμη στο Tailscale IP `100.70.50.43:5432`. Το τοπικό `.env` δείχνει στην ίδια (παραγωγική) βάση.

## 2. Αποφάσεις

| Ερώτηση | Απόφαση |
|---|---|
| Πού τρέχει το PgBouncer | Container `pgbouncer` (εικόνα `edoburu/pgbouncer:v1.26.1-p0`, Alpine, ~15 MB) **στο VM της βάσης**, δίπλα στην Postgres, με `docker compose`. Ακούει **μόνο** στο Tailscale IP του VM, θύρα **6432**. Μιλάει στη βάση μέσω της ήδη δημοσιευμένης `:5432` του host (`DB_HOST` = Tailscale IP), άρα δεν χρειάζεται σύνδεση στο Docker network της Postgres. |
| Pool mode | **transaction**. Ο έλεγχος κώδικα (§5) δεν βρήκε session-level χρήση. |
| Ποιος περνά από τον pooler | Η εφαρμογή στο Coolify **και** η τοπική ανάπτυξη (ίδια διαδρομή με την παραγωγή, ώστε κάθε ασυμβατότητα να φανεί πρώτα στο dev). |
| Ποιος πάει απευθείας | `prisma migrate deploy` (advisory lock στο `_prisma_migrations`, τρέχει στο `CMD` του Dockerfile σε κάθε boot), `prisma db seed`, `migrate diff`. Μέσω `prisma.config.ts`. |
| Δύο URLs | `DATABASE_URL` → `:6432` (pooled, `lib/db.ts`). `DIRECT_URL` → `:5432` (`prisma.config.ts`). Αν λείπει το `DIRECT_URL` γίνεται fallback στο `DATABASE_URL` με **προειδοποίηση** στο log. |
| `?pgbouncer=true` | **Δεν χρειάζεται.** Το Prisma 7 με `@prisma/adapter-pg` στέλνει στο node-postgres queries **χωρίς `name`** (το `statementNameGenerator` είναι προαιρετικό και δεν δίνεται), άρα unnamed prepared statements, συμβατά με transaction mode. Το flag αφορούσε τον Rust engine. |
| Authentication | `auth_type = scram-sha-256`. Το `userlist.txt` **δεν** μπαίνει στο git: το γεννά το entrypoint της εικόνας από `DB_USER`/`DB_PASSWORD` του `.env` του VM (plaintext μέσα στον container, όπως απαιτεί το SCRAM προς τον client). |
| Μεγέθη (1 instance εφαρμογής) | App: `max=10`, `idleTimeoutMillis=30000`, `connectionTimeoutMillis=10000`, `application_name=orithon-web`. PgBouncer: `max_client_conn=500`, `default_pool_size=20`, `min_pool_size=2`, `reserve_pool_size=5`, `reserve_pool_timeout=3`, `max_db_connections=40`, `server_idle_timeout=300`, `server_lifetime=3600`, `idle_transaction_timeout=60`. Όλα ρυθμίζονται από env, βλ. §4. |
| Υγεία/επαλήθευση | `GET /api/health/db` (SUPER_ADMIN **real** role ή header `x-health-token` = `HEALTH_TOKEN`) + script `scripts/db-pool-check.mjs` (ελέγχει και τα δύο URLs, `SHOW POOLS`/`SHOW STATS` στον admin console). |
| Παραγωγή | Καμία αλλαγή στον server/βάση από τη συνεδρία. Ο χρήστης σηκώνει τον container και αλλάζει τα env του Coolify ακολουθώντας το `infra/pgbouncer/README.md`. |

## 3. Αρχιτεκτονική

```
 Coolify server (app)                           DB VM (Docker)  100.70.50.43
┌──────────────────────────┐                   ┌────────────────────────────────────┐
│ next start (1 process)   │  DATABASE_URL     │ pgbouncer :6432 (Tailscale IP only) │
│  lib/db.ts  pg Pool ≤10 ─┼──────────────────▶│  pool_mode=transaction             │
│  cron tick / SSE / RSC   │                   │  default_pool_size=20, max_db=40 ──┼──▶ postgres :5432
│                          │  DIRECT_URL       │                                    │        ▲
│ CMD: prisma migrate ─────┼───────────────────┼────────────────────────────────────┼────────┘
│      deploy (boot)       │                   └────────────────────────────────────┘
└──────────────────────────┘
 Τοπική ανάπτυξη: DATABASE_URL → :6432, DIRECT_URL → :5432 (ίδια διαδρομή).
```

- **Ένα `pg.Pool` ανά διεργασία**: το `lib/db.ts` κρατά τον client στο `globalThis` σε **όλα** τα περιβάλλοντα (όχι μόνο dev), ώστε δύο route bundles στην ίδια διεργασία να μη φτιάξουν δεύτερο Pool.
- **Transaction mode σημαίνει**: κάθε `BEGIN…COMMIT` του Prisma (`$transaction`, interactive ή array) μένει σε μία server σύνδεση· ανάμεσα σε queries εκτός transaction η server σύνδεση επιστρέφει στο pool. Session state (SET, temp tables, LISTEN, advisory locks ανά session, named prepared statements) **δεν** επιβιώνει ανάμεσα σε queries.
- **Realtime**: in-process `EventEmitter` + SSE (`/api/realtime`), **όχι** LISTEN/NOTIFY. Μία SSE σύνδεση δεν κρατά σύνδεση βάσης· κάνει 1–2 queries ελέγχου πρόσβασης στην αρχή και μετά μόνο μνήμη.
- **Cron**: `lib/cron/runner.ts` τρέχει jobs σειριακά με κανονικά Prisma queries· τα interactive transactions του Prisma έχουν default `timeout=5s`, άρα το `idle_transaction_timeout=60` του PgBouncer είναι δίχτυ ασφαλείας, όχι κανονική ροή.

## 4. Υποδομή — `infra/pgbouncer/`

| Αρχείο | Ρόλος |
|---|---|
| `docker-compose.yml` | Υπηρεσία `pgbouncer` (καρφωμένη εικόνα), `env_file: .env`, όλες οι ρυθμίσεις ως env με προεπιλογές (`${VAR:-default}`), `ports: "${PGBOUNCER_BIND}:6432:6432"`, healthcheck `pg_isready`, περιορισμός logs. |
| `pgbouncer.env.example` | Πρότυπο για το `.env` του VM: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (placeholder), `PGBOUNCER_BIND`, προαιρετικά overrides μεγεθών. Το όνομα **δεν** ξεκινά με `.env` επειδή το `.gitignore` της ρίζας αγνοεί `.env*`. |
| `pgbouncer.ini.example` | Αναφορά: το ini που παράγει το entrypoint από τα παραπάνω env, για να φαίνεται στο review τι ακριβώς τρέχει. Δεν mount-άρεται. |
| `README.md` | Βήματα (ελληνικά): στο VM (αντιγραφή φακέλου, `.env`, `pg_hba`, `up -d`, έλεγχος με `psql`), στο Coolify (δύο env, redeploy, έλεγχος logs/health), τοπικά (`.env`), επαλήθευση, παρακολούθηση (`SHOW POOLS`), rollback (ξανά `:5432`). |

Οι ρυθμίσεις μεγέθους και το γιατί:

| Ρύθμιση | Τιμή | Γιατί |
|---|---|---|
| `max_client_conn` | 500 | Χωρά 1 instance (10) + τοπική ανάπτυξη (10) + scripts + μελλοντικά instances· κόστος αμελητέο (sockets). |
| `default_pool_size` | 20 | Server συνδέσεις ανά (user, db). Η εφαρμογή σπάνια έχει >20 ταυτόχρονα ενεργά queries· η Postgres με default `max_connections=100` μένει με άνεση. |
| `min_pool_size` | 2 | Ζεστές συνδέσεις μετά από ηρεμία (πρώτο αίτημα το πρωί χωρίς handshake). |
| `reserve_pool_size` / `reserve_pool_timeout` | 5 / 3s | Αν όλες οι 20 είναι πιασμένες >3s, ανοίγουν έως 5 ακόμη αντί να περιμένει ο client. |
| `max_db_connections` | 40 | Σκληρό ταβάνι προς τη βάση (20+5 + περιθώριο για 2ο user/db), κάτω από `max_connections` μείον superuser reserve. |
| `server_idle_timeout` | 300s | Κλείνει server συνδέσεις που κάθονται άπραγες 5' (λιγότερη μνήμη στη βάση τη νύχτα). |
| `server_lifetime` | 3600s | Ανακύκλωση server συνδέσεων κάθε ώρα (μνήμη backend, αλλαγές `pg_hba`/ρόλων). |
| `idle_transaction_timeout` | 60s | Σκοτώνει client που άνοιξε `BEGIN` και ξεχάστηκε, ώστε να μην κρατά server σύνδεση για πάντα. |
| `ignore_startup_parameters` | `extra_float_digits` | Προεπιλογή της εικόνας· το node-postgres δεν στέλνει άλλα startup params. |
| App `max` | 10 (`DB_POOL_MAX`) | Το pg Pool default· ανά διεργασία. Μαζί με `connectionTimeoutMillis=10000` ένα κολλημένο pooler δίνει σφάλμα σε 10s αντί να κρεμάσει το request. |

## 5. Έλεγχος συμβατότητας με transaction mode (έγινε 2026-10-23)

| Έλεγχος | Αποτέλεσμα |
|---|---|
| `pg_advisory_*`, `LISTEN`, `NOTIFY`, `pg_notify` | Καμία χρήση σε `lib/`, `app/`, `scripts/`, `prisma/*.ts`. |
| `SET …`, `set_config`, `search_path`, `statement_timeout` | Καμία χρήση. Ο adapter δεν τρέχει `SET search_path`· το `?schema=public` του URL δεν στέλνεται ως startup param από το node-postgres. |
| Temp tables, cursors, `PREPARE`/`DEALLOCATE` | Καμία χρήση. |
| Named prepared statements | Ο `@prisma/adapter-pg` 7.8 δίνει `name` **μόνο** αν δοθεί `statementNameGenerator` (δεν δίνεται). Το PgBouncer ≥1.21 υποστηρίζει έτσι κι αλλιώς named statements σε transaction mode (`max_prepared_statements`, default 200). |
| `$transaction` | 24 αρχεία, 18 interactive. Ο adapter κάνει `BEGIN` → (`SET TRANSACTION ISOLATION LEVEL …` **μέσα** στο tx) → queries → `COMMIT` στην **ίδια** `PoolClient`. Συμβατό. |
| pgvector (`WikiChunk.embedding`) | Μόνο `<=>` queries και `::vector` casts (`lib/ai/assistant/retrieval.ts`, `indexer.ts`). Κανένα `SET hnsw.ef_search`/`ivfflat.probes`. Αν προστεθεί ποτέ, πρέπει να γίνει `SET LOCAL` μέσα σε `$transaction`. |
| PostGIS | Μόνο συναρτήσεις σε queries· χωρίς session state. |
| `prisma migrate deploy` | Χρησιμοποιεί advisory lock ανά σύνδεση → **πρέπει** να πάει από `DIRECT_URL`. Το `prisma.config.ts` το εγγυάται. |
| SSE `/api/realtime` | In-process bus· καμία σύνδεση βάσης κρατημένη ανοιχτή. |
| Cron | Σειριακά jobs, κανονικά queries· interactive tx ≤5s από το Prisma. |

Συμπέρασμα: **καμία αλλαγή εφαρμογής απαιτείται για συμβατότητα**· οι αλλαγές κώδικα αφορούν ρητά όρια pool, δύο URLs και εργαλεία επαλήθευσης.

## 6. Κώδικας

| Αρχείο | Αλλαγή |
|---|---|
| `lib/db-url.ts` (νέο) | Καθαρές συναρτήσεις, χωρίς I/O: `urlPort`, `isPoolerUrl` (θύρα 6432 ή `pgbouncer=true`), `resolveDbUrls(env)` → `{ pooled, direct, viaPooler, warnings }`, `poolConfigFromEnv(env)` → `{ max, idleTimeoutMillis, connectionTimeoutMillis, application_name }` με clamp 1–100, `redactUrl` για logs. **Vitest** `lib/db-url.test.ts`. |
| `lib/db.ts` | Χρησιμοποιεί τα παραπάνω· `PrismaPg({ connectionString, max, idleTimeoutMillis, connectionTimeoutMillis, application_name }, { onPoolError })`; μία γραμμή `console.info` στο boot («via PgBouncer»/«direct», redacted URL, pool max)· singleton στο `globalThis` σε όλα τα περιβάλλοντα. |
| `prisma.config.ts` | `datasource.url = DIRECT_URL ?? DATABASE_URL`· `console.warn` όταν το `DATABASE_URL` δείχνει pooler και λείπει `DIRECT_URL` (οι migrations θα πέρναγαν από τον pooler). |
| `app/api/health/db/route.ts` (νέο) | `GET`: `select pg_backend_pid(), inet_server_port(), current_setting('application_name'), current_user, current_database(), version()` + πλήθος server συνδέσεων της εφαρμογής από `pg_stat_activity`. Επιστρέφει `{ ok, viaPooler, url (redacted), backend, serverConnections, latencyMs, poolMax }`. 401 χωρίς SUPER_ADMIN real role ή σωστό `x-health-token`· 503 με γενικό μήνυμα σε σφάλμα βάσης. |
| `scripts/db-pool-check.mjs` (νέο) | `node --env-file=.env scripts/db-pool-check.mjs`: συνδέεται σε `DATABASE_URL` και `DIRECT_URL`, τυπώνει backend pid/θύρα/latency, και αν το `DATABASE_URL` είναι pooler, συνδέεται στη βάση `pgbouncer` (admin console) για `SHOW POOLS` + `SHOW STATS`. Μόνο SELECT/SHOW. Exit code ≠0 σε αποτυχία. |
| `.env.example` | `DATABASE_URL` (σχόλιο: :6432 μέσω PgBouncer), `DIRECT_URL` (:5432), `DB_POOL_MAX`, `HEALTH_TOKEN`. |
| `Dockerfile` | Μόνο σχόλιο: το `migrate deploy` του `CMD` χρησιμοποιεί `DIRECT_URL` μέσω `prisma.config.ts`. |

## 7. Env στο Coolify (εφαρμογή)

| Μεταβλητή | Τιμή | Σημείωση |
|---|---|---|
| `DATABASE_URL` | `postgres://<user>:<pw>@100.70.50.43:6432/propertymanagement?schema=public` | Αλλάζει μόνο η θύρα. Παραμένει «Available at Buildtime» (το build δεν αγγίζει τη βάση). |
| `DIRECT_URL` | `postgres://<user>:<pw>@100.70.50.43:5432/propertymanagement?schema=public` | Νέα. Runtime μόνο (το `CMD` τρέχει `migrate deploy`). |
| `DB_POOL_MAX` | `10` | Προαιρετική. |
| `HEALTH_TOKEN` | τυχαίο ≥32 χαρακτήρες | Προαιρετική· επιτρέπει `curl` στο `/api/health/db` χωρίς login. |

## 8. Επαλήθευση

1. **Τοπικά, πριν αλλάξει το Coolify:** ο χρήστης σηκώνει τον container στο VM, βάζει `:6432` στο τοπικό `DATABASE_URL` και `DIRECT_URL` στο `.env`, τρέχει `node --env-file=.env scripts/db-pool-check.mjs` (πρέπει να δείξει pooled+direct OK και `SHOW POOLS` με `pool_mode=transaction`), μετά `npm run dev` και πλοήγηση σε σελίδες με transactions (π.χ. αποθήκευση ρύθμισης χωρίς ειδοποιήσεις) + `/api/health/db` ως SUPER_ADMIN.
2. **Vitest:** `lib/db-url.test.ts` (επίλυση URL, warnings, clamps, redaction). `tsc`/`eslint` χωρίς νέα σφάλματα.
3. **Παραγωγή:** μετά το redeploy, `curl -H "x-health-token: …" https://property.dgsmart.gr/api/health/db` → `viaPooler: true`, και στο log boot «[db] via PgBouncer … (pool max 10)». Στο VM: `SHOW POOLS` δείχνει `cl_active`/`sv_active` να κινούνται.

## 9. Rollback

Στο Coolify: `DATABASE_URL` πίσω σε `:5432` και redeploy. Το `DIRECT_URL` μπορεί να μείνει. Ο container σβήνει με `docker compose down`. Καμία αλλαγή σχήματος, καμία migration.

## 10. Εκτός εύρους

- Δεύτερο instance εφαρμογής (θα απαιτήσει Redis για το realtime bus· το PgBouncer είναι ήδη έτοιμο).
- `auth_query`/`auth_user` με ξεχωριστό ρόλο `pgbouncer` στη βάση (θέλει SQL στην παραγωγή). Αν προστεθεί δεύτερος DB user, αρκεί δεύτερη γραμμή στο `userlist.txt` ή `DATABASE_URLS`.
- TLS ανάμεσα σε εφαρμογή και pooler: η κίνηση είναι μέσα στο Tailscale (WireGuard), όπως και σήμερα.
- Αλλαγή `max_connections` της Postgres.
- Προσθήκη των ίδιων ορίων στο `prisma/seed.ts` (legacy, χωρίς adapter).

## 11. Βήματα υλοποίησης

1. `lib/db-url.test.ts` → `lib/db-url.ts` (TDD).
2. `lib/db.ts`, `prisma.config.ts`, `.env.example`, σχόλιο Dockerfile.
3. `app/api/health/db/route.ts`, `scripts/db-pool-check.mjs`.
4. `infra/pgbouncer/{docker-compose.yml,pgbouncer.env.example,pgbouncer.ini.example,README.md}`.
5. Vitest + tsc + eslint· commit στο main· memory `project_pgbouncer.md`· hand-over note.
