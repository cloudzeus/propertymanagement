# Διαχωρισμός Surfaces ανά Τύπο Χρήστη + View-as (Super Admin)

**Ημερομηνία:** 2026-06-30
**Κατάσταση:** Approved (design)
**Scope:** Σκελετός διαχωρισμού — όχι το τελικό UI/UX κάθε surface, ούτε το redesign του landing.

## Πλαίσιο

Η εφαρμογή είναι SaaS διαχείρισης κτιρίων με τρεις ξεχωριστές ομάδες χρηστών που χρειάζονται **εντελώς διαφορετικό UI/UX**, συν ένα public website. Σήμερα υπάρχουν 6 ξεχωριστά route groups (`admin`, `manager`, `staff`, `owner`, `portal`, `super-admin`) με διπλογραφία κώδικα και το `app/page.tsx` κάνει force-redirect τους συνδεδεμένους μακριά από το public site.

Αυτή η φάση παραδίδει τον **διαχωρισμό/σκελετό**: ενοποίηση σε 3 product surfaces + public, RBAC routing, και «View as» impersonation για τον super admin. Το αναλυτικό UI κάθε surface σχεδιάζεται αργότερα, ξεχωριστά.

## Ομάδες χρηστών

| Ομάδα | Χαρακτήρας UI/UX |
|---|---|
| 1. Εταιρία (owners + υπάλληλοι) | Πλήρες, εξειδικευμένο back office — διαχειρίζεται τα πάντα. RBAC μέσα στην ομάδα. |
| 2. Πελάτες (το πιο σημαντικό) | Απλό αλλά πολύ έξυπνο & καλοσχεδιασμένο — παρακολούθηση ακινήτου. Ένα surface, role-aware. |
| 3. Επαγγελματίες (marketplace) | Λιτό — προσφορές υπηρεσιών (υδραυλικοί, ηλεκτρολόγοι…) προς τις άλλες ομάδες. |
| — Public website | Προώθηση εφαρμογής. Ορατό και στους συνδεδεμένους. (Redesign: μελλοντική φάση.) |

## Ενότητα 1 — Αρχιτεκτονική surfaces & routing

Ενοποίηση των 6 route groups σε **3 προϊόντα + public**, με βάση τον ρόλο (`UserRole`):

| Surface (route group) | Ρόλοι | Αντικαθιστά |
|---|---|---|
| `app/(company)` | SUPER_ADMIN · ADMIN · MANAGER · EMPLOYEE | admin, manager, staff, super-admin |
| `app/(customer)` | PROPERTY_ADMIN · PROPERTY_OWNER · PROPERTY_RESIDENT · PROPERTY_VIEWER | owner, portal |
| `app/(marketplace)` | COLLABORATOR | (νέο — σήμερα πέφτει στο staff) |
| `app/(public)` | όλοι / ανώνυμοι | σημερινό landing/legal/pricing |

**Routing μετά το login**: συνάρτηση `surfaceForRole(role)` → `/company` \| `/customer` \| `/marketplace`. Το middleware φρουρεί κάθε group· αν το effective role δεν ανήκει στο surface → redirect στο σωστό.

**Logged-in πρόσβαση στο public**: το `app/page.tsx` σταματά το force-redirect. Οι συνδεδεμένοι βλέπουν κανονικά το public site· εμφανίζεται CTA «Μετάβαση στον χώρο μου» → `surfaceForRole(role)`.

**Ομάδα 2 = ένα surface, role-aware**: διαχειριστής πολυκατοικίας βλέπει όλο το κτίριο, ιδιοκτήτης/ένοικος βλέπει το δικό του διαμέρισμα — ίδια γλώσσα/σχεδιασμός, διαφορετικό scope δεδομένων μέσω RBAC.

## Ενότητα 2 — «View as» impersonation (super admin)

Σκοπός: ο super admin να δοκιμάζει κάθε surface σαν πραγματικός χρήστης, με αληθινά δεδομένα.

**UX**
- Στο company surface, menu group «Προεπισκόπηση / View as» με:
  - γρήγορα links ανά surface (View as Customer / Marketplace), και
  - επιλογέα πραγματικού χρήστη (μπες στην εμπειρία του με τα δεδομένα του).
- Όταν ενεργό: σταθερό, μη-κλεινόμενο banner «Βλέπεις ως {όνομα · ρόλος} — Έξοδος». Το «Έξοδος» επαναφέρει.

**Τεχνική βάση (effective identity)**
- Cookie/session overlay `impersonation = { actorId, targetUserId, targetRole }`, set **μόνο** αν ο πραγματικός ρόλος είναι `SUPER_ADMIN`.
- `getEffectiveSession()` τυλίγει το `auth()`: effective identity = `impersonation ?? realSession`. Όλος ο κώδικας (middleware, RBAC, data fetching) διαβάζει από αυτήν.
- Server actions `startImpersonation(targetUserId)` / `stopImpersonation()`.
- Middleware & RBAC κρίνουν με βάση το effective role → ο super admin μεταφέρεται στο σωστό surface.

**Ασφάλεια**
- Μόνο SUPER_ADMIN ξεκινά impersonation· ο `actorId` καταγράφεται πάντα στο audit log.
- **Πλήρες test**: mutations επιτρέπονται· κάθε mutation κατά το impersonation καταγράφεται με τον πραγματικό actor (`actorId`) πέρα από το `targetUserId`.
- Banner refresh-safe (cookie-backed)· παραμένει όσο το overlay είναι ενεργό.

## Ενότητα 3 — Παραδοτέα φάσης (skeleton)

1. **Route groups**: `(company)`, `(customer)`, `(marketplace)`, `(public)` με ένα layout shell ανά group (sidebar/topbar placeholder, DG/Fluent standard). Μεταφορά υπαρχουσών σελίδων στα νέα groups. Παλιά paths → redirects στα νέα.
2. **RBAC core**: `surfaceForRole()`, `getEffectiveSession()`, middleware guard ανά surface.
3. **View-as**: cookie overlay, `startImpersonation/stopImpersonation`, banner component, menu group με user-selector.
4. **Public fix**: αφαίρεση force-redirect από `app/page.tsx` + CTA «Μετάβαση στον χώρο μου».

**Εκτός φάσης (μελλοντικά, ξεχωριστά):** αναλυτικό UI/UX κάθε surface· redesign landing (δομημένα CMS sections — βλ. προηγούμενη συζήτηση).

## Εκτίμηση / σημεία προσοχής

- Το consolidation αγγίζει πολλά αρχεία· τα redirects από παλιά paths προστατεύουν υπάρχοντα links/bookmarks.
- Το `getEffectiveSession()` πρέπει να γίνει το **single source of truth** — κάθε σημείο που σήμερα καλεί `auth()` απευθείας πρέπει να μεταπηδήσει σε αυτό, αλλιώς το impersonation θα είναι ασυνεπές.
- Συμβατότητα με υπάρχον `MenuConfig` (per-role menu) — ο επιλογέας/links του View-as ζουν στο company menu.
