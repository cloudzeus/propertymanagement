# PgBouncer μπροστά από την παραγωγική PostgreSQL

Connection pooling για το Orithon SaaS. Σχεδιασμός και αιτιολόγηση: [`docs/superpowers/specs/2026-10-23-pgbouncer-design.md`](../../docs/superpowers/specs/2026-10-23-pgbouncer-design.md).

```
Coolify app ── DATABASE_URL (:6432) ──▶ pgbouncer (DB VM, Tailscale IP) ──▶ postgres :5432
            ── DIRECT_URL   (:5432) ───────────────────────────────────────▶ postgres :5432
                (μόνο prisma migrate deploy / seeds)
```

| Αρχείο | Τι είναι |
|---|---|
| `docker-compose.yml` | Η υπηρεσία `pgbouncer` (εικόνα `edoburu/pgbouncer:v1.26.1-p0`), ρυθμίσεις ως env με προεπιλογές. |
| `pgbouncer.env.example` | Πρότυπο για το `.env` του VM (host, db, user, password, IP ακρόασης). |
| `pgbouncer.ini.example` | Αναφορά: το ini που παράγεται στον container. Δεν mount-άρεται. |
| `.gitignore` | Κρατά `.env` και `userlist.txt` εκτός git. |

Στην εφαρμογή: `lib/db.ts` (pooled URL, όρια pool), `lib/db-url.ts` (λογική), `prisma.config.ts` (DIRECT_URL), `app/api/health/db/route.ts`, `scripts/db-pool-check.mjs`.

---

## Α. Στο VM της βάσης (μία φορά)

Προϋποθέσεις: Docker + Compose plugin, η Postgres ήδη δημοσιεύει τη `:5432` στο Tailscale IP του VM (σήμερα `100.70.50.43`).

1. **Αντιγραφή του φακέλου** στο VM, π.χ. `/opt/pgbouncer`:
   ```bash
   scp -r infra/pgbouncer/ user@100.70.50.43:/opt/pgbouncer/
   ```
2. **`.env`**:
   ```bash
   cd /opt/pgbouncer && cp pgbouncer.env.example .env && chmod 600 .env && nano .env
   ```
   Συμπληρώστε `DB_USER`/`DB_PASSWORD` (τα ίδια με το σημερινό `DATABASE_URL`), ελέγξτε `DB_HOST`, `DB_NAME`, `PGBOUNCER_BIND`.
3. **`pg_hba.conf`**: η Postgres πρέπει να δέχεται συνδέσεις από τον container. Ο container βγαίνει από το Docker bridge (`172.16.0.0/12`) προς το Tailscale IP του host. Αν η Postgres τρέχει κι αυτή σε container με published port, η σύνδεση φαίνεται συνήθως από το gateway του bridge. Βεβαιωθείτε ότι υπάρχει γραμμή τύπου:
   ```
   host  propertymanagement  <DB_USER>  172.16.0.0/12  scram-sha-256
   ```
   και κάντε `SELECT pg_reload_conf();` (ή restart του postgres container). Αν η Postgres είναι σε container, το `pg_hba.conf` βρίσκεται στο data volume της.
4. **Εκκίνηση**:
   ```bash
   docker compose up -d && docker compose logs -f pgbouncer
   ```
   Στο log πρέπει να δείτε `Wrote authentication credentials for '<DB_USER>'` και `process up: PgBouncer 1.26.x`.
5. **Έλεγχος από το VM** (ο client `psql` υπάρχει μέσα στον container):
   ```bash
   docker exec -it pgbouncer psql -h 127.0.0.1 -p 6432 -U "$DB_USER" -d propertymanagement -c "select current_user, inet_server_port(), version();"
   ```
   Αν ζητήσει κωδικό, είναι ο `DB_PASSWORD`. Πρέπει να επιστρέψει `inet_server_port = 5432` (η θύρα του backend, η σύνδεση πέρασε).
6. **Admin console**:
   ```bash
   docker exec -it pgbouncer psql -h 127.0.0.1 -p 6432 -U "$DB_USER" -d pgbouncer -c "SHOW POOLS;" -c "SHOW CONFIG;"
   ```
   Επιβεβαιώστε `pool_mode = transaction`, `auth_type = scram-sha-256`, `default_pool_size = 20`.
7. **Firewall**: η `:6432` ακούει μόνο στο Tailscale IP (από το `PGBOUNCER_BIND`). Δεν χρειάζεται άνοιγμα στο δημόσιο firewall. Επιβεβαίωση: `ss -ltnp | grep 6432` δείχνει μόνο το `100.70.50.43:6432`.

### Αν η Postgres τρέχει σε compose στο ίδιο VM

Εναλλακτικά του `DB_HOST=<Tailscale IP>`, μπορείτε να βάλετε τον pgbouncer **στο ίδιο compose** με την Postgres (αντιγράψτε το service block) και `DB_HOST=<όνομα του postgres service>`. Τότε η κίνηση μένει στο εσωτερικό Docker network και το `pg_hba` χρειάζεται το subnet εκείνου του network. Το υπόλοιπο μένει ίδιο.

---

## Β. Τοπική ανάπτυξη (πρώτη δοκιμή, πριν το Coolify)

Το τοπικό `.env` δείχνει στην ίδια (παραγωγική) βάση, άρα είναι το ασφαλέστερο μέρος να δοκιμαστεί η νέα διαδρομή πρώτα.

1. Στο `.env` της εφαρμογής:
   ```
   DATABASE_URL=postgres://<user>:<pw>@100.70.50.43:6432/propertymanagement?schema=public
   DIRECT_URL=postgres://<user>:<pw>@100.70.50.43:5432/propertymanagement?schema=public
   ```
2. Έλεγχος και των δύο URL + admin console (μόνο SELECT/SHOW):
   ```bash
   node --env-file=.env scripts/db-pool-check.mjs
   ```
   Αναμενόμενο: `DATABASE_URL → PgBouncer`, και τα δύο «connected», `SHOW POOLS` με τη βάση `propertymanagement`, `RESULT: OK`.
3. `npm run dev` → στο terminal μία γραμμή `[db] via PgBouncer postgres://<user>:***@100.70.50.43:6432/... (pool max 10)`.
4. Ως SUPER_ADMIN: `http://localhost:3000/api/health/db` → `{"ok":true,"viaPooler":true,...}`.
5. Περιηγηθείτε σε σελίδες με transactions (π.χ. αποθήκευση μιας ρύθμισης χωρίς ειδοποιήσεις). Τίποτα δεν πρέπει να αλλάξει σε συμπεριφορά.

---

## Γ. Στο Coolify (εφαρμογή `property.dgsmart.gr`)

Στο Environment Variables της εφαρμογής:

| Μεταβλητή | Τιμή | Buildtime |
|---|---|---|
| `DATABASE_URL` | ίδιο με σήμερα, **μόνο η θύρα `5432` → `6432`** | ✅ (όπως σήμερα· το build δεν αγγίζει τη βάση) |
| `DIRECT_URL` | το **σημερινό** `DATABASE_URL` με `:5432` | — |
| `DB_POOL_MAX` | `10` (προαιρετικό) | — |
| `HEALTH_TOKEN` | τυχαίο, π.χ. `openssl rand -hex 32` (προαιρετικό) | — |

Μετά: **Redeploy**. Στο boot log:

```
[prisma]  … migrate deploy … No pending migrations     ← από DIRECT_URL
[db] via PgBouncer postgres://<user>:***@100.70.50.43:6432/propertymanagement?schema=public (pool max 10)
```

Έλεγχος από οπουδήποτε:

```bash
curl -s -H "x-health-token: $HEALTH_TOKEN" https://property.dgsmart.gr/api/health/db | jq
```

Πρέπει να δείξει `"viaPooler": true`, `"serverPort": 5432`, `"applicationName": "orithon-web"`.

Αν λείπει το `DIRECT_URL`, η εφαρμογή **δουλεύει** αλλά γράφει προειδοποίηση στο log και το `migrate deploy` του επόμενου boot θα περνούσε από τον pooler (κίνδυνος σε migration). Μην το αφήσετε έτσι.

---

## Δ. Παρακολούθηση

Από το VM (ή τοπικά με `scripts/db-pool-check.mjs`):

```sql
SHOW POOLS;    -- cl_active/cl_waiting = clients, sv_active/sv_idle = συνδέσεις προς Postgres, maxwait = δευτ. αναμονής
SHOW STATS;    -- total_query_count, avg_query_time (μs), avg_wait_time
SHOW CLIENTS;  -- ποιος είναι συνδεδεμένος (application_name "orithon-web")
```

Σήματα:

| Παρατήρηση | Σημασία / ενέργεια |
|---|---|
| `cl_waiting > 0` συχνά, `maxwait` > 1 s | Το pool προς τη βάση γεμίζει. Ανεβάστε `DEFAULT_POOL_SIZE` (και `MAX_DB_CONNECTIONS`) στο `.env`, `docker compose up -d`. |
| `sv_active` κολλημένο = `default_pool_size` με χαμηλό traffic | Κάποιος κρατά transactions ανοιχτά. Δείτε `SHOW SERVERS` και `pg_stat_activity` για `idle in transaction`. |
| Σφάλμα `no more connections allowed (max_client_conn)` | Ανεβάστε `MAX_CLIENT_CONN`. Απίθανο με 500. |
| Σφάλμα `prepared statement "…" does not exist` | Κάποιος client ονομάζει prepared statements. Η εφαρμογή δεν το κάνει (ο adapter δεν δίνει `name`). Ελέγξτε scripts/third-party clients. |
| Σφάλμα `SET … cannot be used in transaction pooling` | Νέος κώδικας έβαλε `SET` session. Μετατροπή σε `SET LOCAL` μέσα σε `$transaction`, ή εκτέλεση από `DIRECT_URL`. |

Δεύτερο instance εφαρμογής: κάθε instance φέρνει `DB_POOL_MAX` clients. Το `MAX_CLIENT_CONN=500` χωρά δεκάδες instances· το `DEFAULT_POOL_SIZE` είναι αυτό που μετράει προς τη βάση και δεν αλλάζει αυτόματα.

---

## Ε. Αναβάθμιση / rollback

- **Αλλαγή ρύθμισης**: επεξεργασία `.env` → `docker compose up -d` (ξαναδημιουργεί τον container· οι clients της εφαρμογής επανασυνδέονται μόνοι τους μέσα σε ~10 s χάρη στο `connectionTimeoutMillis`).
- **Νέα έκδοση εικόνας**: αλλάξτε το tag στο `docker-compose.yml` (δείτε [tags](https://hub.docker.com/r/edoburu/pgbouncer/tags)), `docker compose pull && docker compose up -d`.
- **Rollback**: στο Coolify `DATABASE_URL` πίσω σε `:5432`, Redeploy. Τοπικά το ίδιο στο `.env`. Μετά `docker compose down` στο VM. Καμία αλλαγή σχήματος δεν έγινε.

---

## ΣΤ. Τι ΔΕΝ περνά από τον pooler (και γιατί)

| Χρήση | URL | Λόγος |
|---|---|---|
| `prisma migrate deploy` (CMD του Dockerfile), `migrate diff`, `migrate status` | `DIRECT_URL` (μέσω `prisma.config.ts`) | advisory lock ανά σύνδεση |
| `prisma db seed` | `DIRECT_URL` | ίδιο config |
| Οτιδήποτε με `SET` session, `LISTEN/NOTIFY`, temp tables, cursors ανάμεσα σε queries | `DIRECT_URL` | session state δεν επιβιώνει σε transaction mode |
| Η εφαρμογή, cron, SSE, scripts που κάνουν κανονικά queries/transactions | `DATABASE_URL` | συμβατά |
