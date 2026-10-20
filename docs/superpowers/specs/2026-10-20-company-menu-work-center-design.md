# Spec: Λογικό μενού company surface + Κέντρο εργασιών (ADMIN / MANAGER / EMPLOYEE)

**Date:** 2026-10-20
**Status:** Approved (brainstorming)
**Builds on:** dynamic RBAC (`lib/rbac/*`), role homes (`components/dashboard/homes/*`), fault mechanism (`app/actions/maintenance-requests.ts`), RFQ/work orders (`lib/rfq.ts`), managed-items obligations (`lib/dashboard/managed-buildings.ts`), per-page wiki (`lib/help/*`, `docs/wiki/pages`).

## Σκοπός

Παράπονο πελάτη: «η διαχείριση του ADMIN είναι χαοτική, χωρίς λογική σειρά» και «δεν υπάρχει για διαχειριστή, managers και υπαλλήλους ένα κεντρικό dashboard για το σύνολο των εργασιών».

1. **Μενού με λογική ροή εργασίας**, ίδια σταθερή σειρά ομάδων για SUPER_ADMIN/ADMIN/MANAGER/EMPLOYEE (ο καθένας βλέπει το υποσύνολό του), δευτερεύουσες ομάδες κλειστές by default, σωστή «Αρχική» ανά ρόλο.
2. **Κέντρο εργασιών** `/admin/work`: όλες οι εκκρεμότητες της εταιρείας σε μία σελίδα (βλάβες/αιτήματα με SLA, συμβάσεις έργου, αιτήματα προσφοράς, πρόγραμμα συντηρήσεων, ραντεβού, μετρητής tickets υποστήριξης), με φίλτρα, KPI, ανάθεση/αλλαγή κατάστασης βλαβών και προβολή «Οι εργασίες μου».

## Αποφάσεις (locked)

| Θέμα | Απόφαση |
|---|---|
| URLs / keys | Κανένα URL και κανένα RBAC module key δεν αλλάζει. Αλλάζουν μόνο ομάδες, σειρά, labels, εικονίδια. Νέο module `work` (`/admin/work`, view-only). |
| Σειρά ομάδων | Επισκόπηση → Πελάτες & Ακίνητα → Εργασίες → Συνεργάτες → Επικοινωνία → Οικονομικά → Ρυθμίσεις → SoftOne → Ιστότοπος (CMS) → Βοήθεια. Ρυθμίσεις/SoftOne/CMS κλειστές by default. |
| Δικαιώματα | Τα υπάρχοντα δικαιώματα ADMIN δεν αλλάζουν (ο ADMIN κρατά CMS/SoftOne). Νέα defaults: `work:view` σε SUPER_ADMIN/ADMIN/MANAGER/EMPLOYEE, `dashboard:view` στον EMPLOYEE. Backfill μέσω `prisma/seed-rbac.ts` (idempotent, μία εκτέλεση τοπικά = παραγωγή). |
| Κέντρο εργασιών | Νέα σελίδα `/admin/work` (ίδιο URL για τους 4 ρόλους), **DataTable** (όχι kanban), 4 KPI κάρτες, φίλτρα στο URL. |
| Πηγές | Βλάβες/αιτήματα, συμβάσεις έργου + RFQ, πρόγραμμα συντηρήσεων + ραντεβού, tickets υποστήριξης (μόνο μετρητής + σύνδεσμος, χωρίς remote status fetch). |
| Δεδομένα | View-model layer `lib/work/*`, **χωρίς νέο Prisma μοντέλο**, χωρίς migration. Όλα από server components με `requirePermission`. |
| Ενέργειες | Inline μόνο για βλάβες (ανάθεση, αλλαγή κατάστασης) μέσω των ΥΠΑΡΧΟΝΤΩΝ `assignRequest` / `changeRequestStatus`. WO/RFQ/πρόγραμμα → link στη σελίδα λεπτομέρειας. |
| Realtime | Επέκταση SSE bus με εταιρικό κανάλι (`scope=company`, staff only). |
| AI | Read tool `listPendingWork` πάνω στο `lib/work`. |
| Παραγωγή | Το τοπικό DATABASE_URL είναι η παραγωγή: καμία test εγγραφή, καμία inline ενέργεια σε πραγματικές βλάβες κατά την επαλήθευση. Δεν υπάρχει χρήστης EMPLOYEE στη DB και δεν θα δημιουργηθεί· ο EMPLOYEE επαληθεύεται με unit tests. |

---

## 1. Σημερινή κατάσταση (καταγραφή από τα πραγματικά δικαιώματα της DB)

| Ρόλος | Στοιχεία | Ομάδες (σημερινή σειρά) |
|---|---|---|
| ADMIN | 42 | Κεντρικό(2) → Διαχείριση(9) → Οικονομικά(6) → Εργασίες(6) → Ρυθμίσεις(6) → SoftOne(4) → CMS(11) → Βοήθεια |
| MANAGER | 13 | Κεντρικό(1) → Διαχείριση(5) → Εργασίες(6) → Βοήθεια |
| EMPLOYEE | 8 | Διαχείριση(3) → Εργασίες(4) → Βοήθεια |

Προβλήματα:
1. «Dashboard» των ADMIN/MANAGER δείχνει `/super-admin` (platform home, χωρίς guard) αντί `/admin`, `/manager`. Ο EMPLOYEE δεν έχει καθόλου Dashboard.
2. «Διαχείριση» μπερδεύει 9 ανόμοια στοιχεία (πελάτες, ακίνητα, χρήστες, συνεργάτες, AI wizard).
3. Οικονομικά πριν από Εργασίες· Ανακοινώσεις μέσα στις Εργασίες.
4. Ρυθμίσεις + SoftOne + CMS = 21 στοιχεία για ADMIN, όλα ανοιχτά.
5. Labels: «Συντηρήσεις» (= βλάβες), «Ενοικιαστές» (= ένοικοι και ιδιοκτήτες), «Ρυθμίσεις» μέσα στην ομάδα «Ρυθμίσεις».
6. Σπασμένα links στα homes: AdminHome → `/admin/calendar`, `/admin/reports`· ManagerHome → `/manager/units`, `/manager/maintenance`, `/manager/announcements`· StaffHome → `/staff/tasks`, `/staff/maintenance`.

---

## 2. Μενού

### 2.1 Registry (`lib/rbac/registry.ts`)

Νέο export `MENU_GROUPS: readonly MenuGroupDef[]` — η **μοναδική** πηγή για id, label, icon (string, react-icons/ri *Line), color και `defaultOpen`, με τη σειρά εμφάνισης. Περιλαμβάνει και τις ομάδες customer/marketplace (core, properties, assets, services, operations-customer, business, tasks, help) ώστε το `GROUP_META` του sidebar να καταργηθεί.

Company groups, με τη σειρά:

| id | label | icon | color | defaultOpen | modules (σειρά) |
|---|---|---|---|---|---|
| overview | Επισκόπηση | RiDashboardLine | #0078D4 | true | dashboard («Αρχική»), work («Κέντρο εργασιών»), reports |
| customers | Πελάτες & Ακίνητα | RiCommunityLine | #8764B8 | true | customers, properties, units, residents («Ένοικοι & ιδιοκτήτες»), managed-buildings, managed-items, onboarding |
| operations | Εργασίες | RiToolsLine | #CA5D00 | true | maintenance («Βλάβες & αιτήματα»), report, work-orders, maintenance-program («Ετήσιο πρόγραμμα»), calendar |
| suppliers | Συνεργάτες | RiTeamLine | #038387 | true | suppliers |
| communication | Επικοινωνία | RiNotification2Line | #0F6CBD | true | announcements |
| financials | Οικονομικά | RiMoneyEuroCircleLine | #107C10 | true | billing, metered-plans, customer-wallets, company-wallet, services, api-costs |
| settings | Ρυθμίσεις | RiSettingsLine | #5C5C5C | **false** | settings («Γενικές ρυθμίσεις»), settings-company, settings-brand, settings-payments, settings-contracts, integrations, users, roles, view-as, ai-tools |
| softone | SoftOne | RiExchangeLine | #0F6CBD | **false** | softone-connection, softone-structure, softone-params, softone-sync |
| cms | Ιστότοπος (CMS) | RiLayoutLine | #8764b8 | **false** | cms-* (11, υπάρχουσα σειρά) |
| help | Βοήθεια | RiQuestionLine | #038387 | true | help |

Οι εγγραφές του company surface αναδιατάσσονται φυσικά στο αρχείο κατά ομάδα (keys ίδια). Τα «CMS:» / «SoftOne:» prefixes στα labels μένουν (ο πίνακας `/super-admin/roles` τα χρειάζεται). Η ομάδα `preview` καταργείται (το `view-as` μπαίνει στις Ρυθμίσεις).

Νέο module: `{ key: "work", label: "Κέντρο εργασιών", surface: "company", menu: { href: "/admin/work", icon: "RiTaskLine", group: "overview" }, actions: [view] }`.

Defaults: `work:view` προστίθεται σε ADMIN, MANAGER, EMPLOYEE (SUPER_ADMIN = all). EMPLOYEE αποκτά `dashboard:view`.

### 2.2 buildMenu (`lib/rbac/permissions-core.ts`)

- `MenuGroup` αποκτά `label`, `icon`, `color`, `defaultOpen` από `MENU_GROUPS`.
- Η σειρά ομάδων = σειρά στο `MENU_GROUPS`· άγνωστα group ids μπαίνουν στο τέλος με σειρά εμφάνισης (ασφάλεια για custom entries).
- `dashboard` (company) → `href = homePathForRole(role)` όταν δίνεται role, όπως ήδη το `customer-dashboard`.

### 2.3 Sidebar (`components/admin/sidebar-nav.tsx`)

- `GROUP_META` καταργείται· label/color/icon έρχονται από το `MenuGroup`. Το `ICONS` map συμπληρώνεται με τα νέα εικονίδια (RiTaskLine/Fill, RiCommunityLine ήδη, RiExchangeLine ήδη).
- Αρχική κατάσταση `openGroups`: `defaultOpen` ανά ομάδα. Η αποθηκευμένη επιλογή χρήστη (localStorage `dg-sidebar-groups`) εξακολουθεί να υπερισχύει. Τα νέα ids σημαίνουν καθαρό ξεκίνημα για τους υπάρχοντες χρήστες.
- Στο rail (collapsed) η ομάδα παραμένει ως είναι.

### 2.4 Homes & quick actions

- Σπασμένα links των homes διορθώνονται στα πραγματικά URLs (`/staff/calendar`, `/super-admin/reports`, `/super-admin/units`, `/admin/maintenance`, `/admin/announcements`, `/admin/work`).
- `lib/quick-actions.ts`: νέα ενέργεια `work` («Κέντρο εργασιών», `RiTaskLine`, `/admin/work`) στα dashboards και στις σελίδες βλαβών/συμβάσεων· `quickActionsTitle("/admin/work") = "Κέντρο εργασιών"`· picks για `/admin/work` = report, faults, workOrders, programme, calendar.

---

## 3. Κέντρο εργασιών — δεδομένα (`lib/work/*`)

### 3.1 Τύποι (`lib/work/types.ts`, client-safe)

```ts
export type WorkSource = "fault" | "work-order" | "rfq" | "programme" | "appointment";
export type WorkStage = "new" | "triage" | "scheduled" | "in-progress" | "waiting-customer" | "awaiting-confirmation" | "on-hold" | "overdue-programme";
export type WorkItem = {
  id: string;                 // "fault:<id>" | "wo:<id>" | "rfq:<id>" | "programme:<taskId>" | "appt:<id>"
  source: WorkSource; sourceId: string;
  title: string; subtitle: string | null;        // π.χ. WO-2026-0042 · κατηγορία
  buildingId: string; buildingName: string; customerName: string | null;
  stage: WorkStage; rawStatus: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT" | null;
  dueAt: string | null;       // ISO — fault: slaDueAt · WO: scheduledAt ?? validUntil · RFQ: deadlineAt · programme: nextDueDate · appt: startAt
  overdue: boolean;           // dueAt < now και stage μη τερματικό
  assigneeId: string | null; assigneeName: string | null;   // μόνο faults
  supplierName: string | null;
  handledBy: "COMPANY" | "PROPERTY_ADMIN" | null;            // faults
  href: string;               // σελίδα λεπτομέρειας
  updatedAt: string;
};
export const SOURCE_LABELS, STAGE_LABELS, STAGE_COLORS  // ελληνικά labels + χρώματα pills
```

Αντιστοίχιση σταδίων:
- fault: OPEN→new, ACKNOWLEDGED→triage, SCHEDULED→scheduled, IN_PROGRESS→in-progress, ON_HOLD→on-hold (COMPLETED/CANCELLED εκτός).
- work-order: PENDING_CUSTOMER→waiting-customer, ACCEPTED→triage, SCHEDULED→scheduled, IN_PROGRESS→in-progress, COMPLETED→awaiting-confirmation, DISPUTED→on-hold (CONFIRMED/DECLINED/CANCELLED εκτός).
- rfq: OPEN→new (αναμένει προσφορές), OFFERED→triage (ήρθαν προσφορές, θέλει προώθηση)· FORWARDED→waiting-customer (λοιπά εκτός).
- programme (RecurringTask ενεργή, managed κτήριο, nextDueDate ≤ τώρα+30μ): overdue→overdue-programme, αλλιώς scheduled.
- appointment (CONFIRMED, startAt σε [τώρα−1μ, τώρα+14μ]): scheduled.

### 3.2 Normalizers (`lib/work/normalize.ts`, καθαρές)

`faultToWorkItem(row, now)`, `workOrderToWorkItem(row, now)`, `rfqToWorkItem(row, now)`, `programmeToWorkItem(task, now)`, `appointmentToWorkItem(row, now)`. Κάθε μία δέχεται ένα επιλεγμένο (select) σχήμα, όχι πλήρη Prisma τύπο, ώστε να τεστάρεται με απλά αντικείμενα.

### 3.3 KPI & φίλτρα (`lib/work/kpis.ts`, καθαρές)

- `computeKpis(items, now)` → `{ overdue, today, week, unassigned }` (today/week με βάση `dueAt` σε Europe/Athens ημέρα/εβδομάδα· unassigned = faults χωρίς assignee και χωρίς supplier, `handledBy=COMPANY`).
- `WorkFilters = { f?: "overdue"|"today"|"week"|"unassigned"; source?: WorkSource[]; stage?: WorkStage[]; building?: string; assignee?: string|"none"; priority?: string[]; mine?: boolean; from?: string; to?: string }`
- `parseFilters(searchParams)` / `serializeFilters(filters)` (URL ↔ state) και `applyFilters(items, filters, userId)`.

### 3.4 Φόρτωση (`lib/work/queries.ts`, server-only)

`loadWorkItems(scope: WorkScope): Promise<WorkItem[]>` με `WorkScope = { role, userId, customerIds: string[] | null }`:
- `customerIds` προκύπτει από `resolveWorkScope()`: MANAGER με `Customer.accountManagerId = userId` → τα ids του (όπως `/admin/maintenance` και το kanban)· αλλιώς null (όλα).
- 5 παράλληλα queries (Prisma `select`, `take` 500 το καθένα):
  1. `maintenanceRequest` status ∉ {COMPLETED, CANCELLED}
  2. `workOrder` status ∉ {CONFIRMED, DECLINED, CANCELLED}
  3. `serviceRequest` status ∈ {OPEN, OFFERED, FORWARDED}
  4. `recurringTask` active, `building.property.managed = true`, `nextDueDate ≤ now+30d`
  5. `maintenanceAppointment` status CONFIRMED, `startAt` ∈ [now−1d, now+14d], request μη τερματικό
  Όλα φιλτράρονται με `building.customerId in customerIds` όταν υπάρχει scope.
- Ο EMPLOYEE **δεν** περιορίζεται στο query· το «Οι εργασίες μου» είναι φίλτρο (`mine`) = assignee === userId ή (fault αδιάθετη με `handledBy=COMPANY`), default ON για EMPLOYEE, OFF για τους άλλους.
- `loadWorkSummary(scope)` → `computeKpis(await loadWorkItems(scope))` για τα homes.
- `countRecentSupportTickets(days=30)` → αριθμός `SupportTicket` (μόνο αν `TICKETING_URL` ρυθμισμένο), χωρίς remote fetch.

---

## 4. Κέντρο εργασιών — σελίδα

### 4.1 Route `app/(company)/admin/work/page.tsx` (server)

1. `await requirePermission("work", "view")`.
2. `scope = await resolveWorkScope()`; παράλληλα: `loadWorkItems`, `countRecentSupportTickets`, λίστα υπαλλήλων (`db.user` με role ∈ {ADMIN, MANAGER, EMPLOYEE}, status ACTIVE — μόνο αν ο viewer έχει `maintenance:edit` και είναι SUPER_ADMIN/ADMIN/MANAGER, όπως ο κανόνας ανάθεσης), λίστα κτηρίων (id, name) από τα items.
3. Render `<WorkCenterClient items employees buildings viewer supportCount />` + `<AutoRefresh scope="company" />`.

Metadata title «Κέντρο εργασιών». Root `className="dash-page"` flex-column ώστε ο DataTable να γεμίζει τη σελίδα.

### 4.2 `WorkCenterClient` (client, `app/(company)/admin/work/WorkCenterClient.tsx`)

- **Header:** τίτλος, υπότιτλος με πλήθος, σύνδεσμος «Tickets υποστήριξης (N)» → `/staff/support` όταν N>0.
- **KPI κάρτες** (4, `KpiCard` από `components/dashboard/kit.tsx`): Εκπρόθεσμα, Σήμερα, Αυτή την εβδομάδα, Χωρίς ανάθεση. Κλικ = θέτει `?f=`. Η ενεργή κάρτα τονίζεται.
- **Φίλτρα** (`WorkFilterBar`): chips πηγής (5) και σταδίου (8), select κτήριο, select ανάθεση (όλοι / χωρίς / ανά υπάλληλο), select προτεραιότητα, εύρος ημερομηνιών (από/έως, `<input type="date">`), toggle «Οι εργασίες μου», κουμπί «Καθαρισμός». Όλα σε URL search params (`router.replace`), ώστε τα KPI των homes να κάνουν deep-link.
- **DataTable** (`clientSide`, `storageKey="work-center"`), στήλες: Τύπος (pill πηγής), Τίτλος (link `href`, υπότιτλος από κάτω), Κτήριο (+πελάτης), Στάδιο (pill), Προτεραιότητα, Προθεσμία (κόκκινο + «εκπρόθεσμο» όταν `overdue`), Ανάθεση (για faults και viewer.canAssign: inline `<select>` υπαλλήλων → `assignRequest`· αλλιώς κείμενο), Συνεργάτης, Ενημερώθηκε (default hidden).
- **Row actions:** «Προβολή»· για faults με `viewer.canManage`: «Αλλαγή κατάστασης → <κάθε επιτρεπτή μετάβαση από STATUS_TRANSITIONS>» (`changeRequestStatus`), «Ανάθεση σε…» (ADMIN/MANAGER/SUPER_ADMIN).
- **Batch:** «Ανάθεση επιλεγμένων» (μόνο faults στην επιλογή, ίδιος select σε modal-lite) και «Σε αξιολόγηση» (OPEN→ACKNOWLEDGED).
- **Expand:** περιγραφή/σημείωση + «Τελευταία ενημέρωση».
- Κινητό: ο DataTable ήδη γυρίζει σε κάρτες· τα φίλτρα τυλίγονται.
- Οι mutations καλούν τα υπάρχοντα server actions και μετά `router.refresh()`. Τα actions ήδη ελέγχουν δικαιώματα server-side.

### 4.3 Homes

Νέο server component `components/dashboard/WorkSummaryStrip.tsx` ({ scope }): 4 `KpiCard` με links `/admin/work?f=…` (+ `mine=1` για EMPLOYEE). Μπαίνει πρώτο σε `AdminHome`, `ManagerHome`, `StaffHome`. Το υπάρχον `MaintenanceKanbanSection` παραμένει.

### 4.4 Realtime

- `lib/realtime/bus.ts`: `publishCompanyEvent(type)` / `subscribeCompany(listener)` στο κανάλι `company`. `publishBuildingEvent` για `type ∈ {maintenance, calendar}` δημοσιεύει **και** στο company κανάλι (μία αλλαγή, όλα τα call sites καλύπτονται). Τα RFQ/WO actions (`app/actions/rfq.ts`) προσθέτουν `publishCompanyEvent("work")`.
- `app/api/realtime/route.ts`: `?scope=company` → μόνο STAFF, subscribe στο company κανάλι (το `building` param παραμένει ως έχει).
- `components/realtime/AutoRefresh.tsx`: props `{ buildingId?: string; scope?: "company" }`.

### 4.5 AI assistant

`lib/ai/tools/read/pending-work.ts` → `listPendingWork` (kind read, roles company, `requiredPerm: "work:view"`, schema `{ source?, onlyMine?, overdueOnly?, limit? }`), χρησιμοποιεί `resolveWorkScope` με `ctx.user` + `loadWorkItems` + `applyFilters`, επιστρέφει έως 20 items (title, source, stage label, building, dueAt, href). Προστίθεται στο `TOOLS` και στο `TOOL_LABELS` («Εκκρεμείς εργασίες»).

---

## 5. Wiki

- Νέο `docs/wiki/pages/admin-work.md` (route `/admin/work`, roles SUPER_ADMIN/ADMIN/MANAGER/EMPLOYEE, area `core`): τι βλέπετε, KPI, φίλτρα, ανάθεση/κατάσταση, «Οι εργασίες μου», τι ΔΕΝ γίνεται εδώ (WO/RFQ/πρόγραμμα ανοίγουν στη σελίδα τους).
- `docs/wiki/basics.md`: ονόματα ομάδων («Επισκόπηση», «Εργασίες», «Βοήθεια»), σημείωση ότι Ρυθμίσεις/SoftOne/CMS ξεκινούν κλειστές.
- `docs/wiki/roles/staff.md`: §1 Καθημερινή ροή ξεκινά από «Κέντρο εργασιών»· «Συντηρήσεις» → «Βλάβες & αιτήματα»· «Ετήσιο πρόγραμμα συντηρήσεων» → «Ετήσιο πρόγραμμα».
- Άρθρα `admin-home`, `manager-home`, `staff-home`: η λωρίδα «Εκκρεμότητες» + related `admin-work`.
- Όπου άρθρο αναφέρει το στοιχείο μενού «Συντηρήσεις» ή «Ενοικιαστές» ή ομάδα «Κεντρικό»/«Διαχείριση» → νέα ονόματα (grep-driven).
- `lib/help/types.ts` AREA_LABELS: `core` → «Επισκόπηση & κέντρο εργασιών», `management` → «Πελάτες & ακίνητα» (ευθυγράμμιση λεκτικού, ids ίδια).

---

## 6. Έλεγχοι

- **Vitest:** `lib/rbac/permissions-core.test.ts` (σειρά ομάδων, defaultOpen, dashboard→home ανά ρόλο, κάθε company module ανήκει σε δηλωμένη ομάδα)· `lib/work/normalize.test.ts`, `lib/work/kpis.test.ts` (stage mapping, overdue, today/week, unassigned, applyFilters/mine, parse/serialize URL)· `lib/quick-actions.test.ts` επέκταση· `lib/ai/tools/registry.test.ts` (label sync)· `lib/help/coverage.test.ts` περνά με το νέο άρθρο.
- **tsc / lint:** `npx tsc --noEmit` χωρίς νέα σφάλματα (γνωστά προϋπάρχοντα: app/api/super-admin/costs/* κ.ά.)· `npm run lint` χωρίς νέα σφάλματα στα αρχεία που αγγίζω.
- **Browser (localhost:3002):** sidebar πριν/μετά για SUPER_ADMIN, ADMIN (View-as admin@orithon.gr), MANAGER (View-as astamos@i4ria.com)· `/admin/work` και για τους τρεις: KPI, φίλτρα, chips, expand, κινητό. Καμία ανάθεση/αλλαγή κατάστασης σε πραγματική βλάβη. EMPLOYEE: μόνο unit tests (δεν υπάρχει χρήστης).
- **RBAC backfill:** `npx tsx --env-file=.env prisma/seed-rbac.ts` μία φορά (προσθέτει `work:view` ×4 ρόλους, `dashboard:view` στον EMPLOYEE).

## 7. Εκτός scope

Kanban στο κέντρο εργασιών, inline ενέργειες σε WO/RFQ/πρόγραμμα, αφαίρεση CMS/SoftOne από τον ADMIN, αλλαγή URLs, νέο Prisma μοντέλο «Task», remote status των tickets υποστήριξης, μετανάστευση των localStorage προτιμήσεων του sidebar.
