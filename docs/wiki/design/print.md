# Εκτυπωτικά (print system)

Έντυπα Α4 από διαχειριστή προς ιδιοκτήτες/ενοίκους, με ζωντανά δεδομένα και κοινό brand.

## Δομή

| Τι | Πού |
|---|---|
| Hub (επιλογή κτηρίου/περιόδου, φόρμες ανά έντυπο) | `app/print/page.tsx` + `app/print/PrintHub.tsx` (client: selects, GET forms σε νέα καρτέλα) |
| Route εντύπου | `app/print/[doc]/page.tsx` — `?building=…&month=YYYY-MM&…`, `force-dynamic` |
| Στυλ Α4 | `app/print/print.css` (`.pdoc` φύλλο, `.pt` πίνακες, `@page A4 10mm/12mm`, ένα φύλλο = μία σελίδα) |
| Κοινό φύλλο | `components/print/PrintShell.tsx` (`PrintSheet`: header brand, τίτλος, meta strip, footer · `Signatures`) |
| Έγγραφα | `components/print/docs/{Notice,Summary,Expenses,Payments,Receipt,Proposal,Invitation,Minutes,Announcement}.tsx` |
| Δεδομένα | `lib/print/data.ts` (`loadPrintBuilding`, `loadPeriod` → per-unit `buildUnitStatement`, `loadPriorDues`, assemblies, announcements, work orders) |
| Brand έκδοσης | `lib/print/brand.ts` (`getEmailBrand` + Company ΑΦΜ/ΔΟΥ/IBAN μόνο όταν το brand δεν είναι το Orithon fallback) |
| Πρόσβαση | `lib/print/access.ts` — staff/manager: όλα· occupant: `notice` (μόνο δικές του μονάδες), `invitation`, `minutes`, `announcement` |
| Κατάλογος | `lib/print/registry.ts` (`DOCS`: τίτλος, hint, ομάδα, εικονίδιο, `needsMonth`) |
| Μορφοποίηση | `lib/print/format.ts` (ευρώ, χιλιοστά, ημερομηνίες Athens, ολογράφως) · `lib/print/html.ts` (unwrap HTML πρακτικών/ανακοινώσεων) |

## Κανόνες

- Τα ποσά περνούν **μόνο** από `lib/building/statement.ts` (`buildUnitStatement`, role `BOTH`) — ίδια μηχανή με τα ειδοποιητήρια της εφαρμογής.
- Περίοδος = `issuedMonth ?? month`, status `CONFIRMED|ISSUED` (όπως `occupant-data.ts`). Προθεσμία default: τέλος του μήνα έκδοσης (`?due=`).
- Αριθμοί εντύπων: ΕΚ (ειδοποιητήριο), ΣΚ, ΑΕ, ΚΠ, ΑΠ (απόδειξη `ΑΠ-YYYYMM-<διαμ>-Ι|Ε`), ΠΔ, ΠΣ, ΠΡ, ΑΝ.
- Η σελίδα `/print` είναι εκτός app shell· ο root `.print-page` εξαιρείται από τον καθολικό κανόνα `.print-area` του `globals.css`.
- Χωρίς εγγραφές στη βάση — όλα read-only. Η ανακοίνωση/πρόταση/πρόσκληση δέχονται και ad-hoc κείμενο από τη φόρμα.
- Νέο έντυπο: πρόσθεσε key στο `registry.ts`, component στο `docs/`, case στο `[doc]/page.tsx`, φόρμα στο hub.

## PDF από script

`scratchpad/pdf.mjs` (Playwright + minted session): `page.emulateMedia({media:"print"})` → `page.pdf({format:"A4", preferCSSPageSize:true, margin 10/14mm, footerTemplate με αριθμό σελίδας})`.
