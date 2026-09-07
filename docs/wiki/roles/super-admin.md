# Εγχειρίδιο Super Admin

Ο Super Admin έχει πλήρη πρόσβαση: ρυθμίζει την εταιρεία, τους ρόλους και τα δικαιώματα, το
δημόσιο site (CMS), τις πληρωμές και τις ενσωματώσεις. Για την καθημερινή λειτουργία ισχύει το
εγχειρίδιο των στελεχών.

## 1. Ρυθμίσεις — το κέντρο

![Ρυθμίσεις](https://propertymanagement.b-cdn.net/docs/manual/sa-settings-hub--desktop.webp)

«Ρυθμίσεις» στο μενού συγκεντρώνει όλες τις οθόνες ρύθμισης σε ομάδες (Εταιρεία & εμφάνιση, Λειτουργία, Πληρωμές & ενσωματώσεις, Δημόσιο site). Βλέπετε μόνο όσες επιτρέπει ο ρόλος σας.

## 2. Πρώτη εγκατάσταση — με τη σειρά

![Εταιρία](https://propertymanagement.b-cdn.net/docs/manual/sa-settings-company--desktop.webp)

1. **Εταιρία** (Ρυθμίσεις → Εταιρία): επωνυμία, ΑΦΜ, στοιχεία επικοινωνίας, τμήματα και θέσεις. Το τηλέφωνο/email εμφανίζονται στη «Βοήθεια» των χρηστών και στο footer των emails.

![Brand & εμφάνιση](https://propertymanagement.b-cdn.net/docs/manual/sa-settings-brand--desktop.webp)

2. **Brand & εμφάνιση**: λογότυπα (οριζόντιο και τετράγωνο, light/dark) και χρώματα. Το οριζόντιο λογότυπο μπαίνει στο μενού και στα emails.

![Ρόλοι & δικαιώματα](https://propertymanagement.b-cdn.net/docs/manual/sa-roles--desktop.webp)

3. **Ρόλοι**: ελέγξτε τα δικαιώματα ανά ρόλο (προβολή / δημιουργία / επεξεργασία / διαγραφή ανά module). Νέα modules προστίθενται αυτόματα στο deploy.

![Πληρωμές Viva](https://propertymanagement.b-cdn.net/docs/manual/sa-settings-payments--desktop.webp)

4. **Πληρωμές (Viva)**: ο λογαριασμός της εταιρείας για εισπράξεις από πελάτες (Client ID/Secret, Merchant ID, API key, Source code). Τα μυστικά αποθηκεύονται κρυπτογραφημένα.

![Υπηρεσίες](https://propertymanagement.b-cdn.net/docs/manual/sa-services--desktop.webp)

5. **Υπηρεσίες** & **Πακέτα Χρεώσεων**: τι πουλάτε και πώς χρεώνεται.
6. **Συντηρήσεις → Ρυθμίσεις**: κατηγορίες βλαβών, SLA, κανόνες κάλυψης.
7. **Συνεργάτες → Κατάλογος υπηρεσιών**: τι «ανοίγετε» στους συνεργάτες.

![Προσφορές & συμβάσεις](https://propertymanagement.b-cdn.net/docs/manual/sa-settings-contracts--desktop.webp)

8. **Ρυθμίσεις → Προσφορές & συμβάσεις**: προεπιλεγμένο περιθώριο %, μήνες εγγύησης, ημέρες σιωπηρής παραλαβής, και τα δύο **πρότυπα σύμβασης έργου** (Α πελάτης↔εταιρεία, Β εταιρεία↔συνεργάτης) σε Markdown με μεταβλητές `{{…}}` (η λίστα των μεταβλητών φαίνεται κάτω από κάθε πρότυπο). Κάθε αποθήκευση = νέα έκδοση· οι ήδη αποδεκτές συμβάσεις δεν αλλάζουν.

![CMS](https://propertymanagement.b-cdn.net/docs/manual/sa-cms-landing--desktop.webp)

9. **CMS**: αρχική (ενότητες με drag & drop, ελληνικά/αγγλικά, «Δημιουργία SEO με AI»), τιμές, FAQ, δημόσιες σελίδες, άρθρα, συγγραφείς, media, μεταφράσεις.

![Άρθρα](https://propertymanagement.b-cdn.net/docs/manual/sa-cms-articles--desktop.webp)

![Media](https://propertymanagement.b-cdn.net/docs/manual/sa-cms-media--desktop.webp)

![Newsletter & συναινέσεις](https://propertymanagement.b-cdn.net/docs/manual/sa-cms-newsletter--desktop.webp)

10. **CMS → Newsletter & συναινέσεις**: μητρώο GDPR. Newsletter με double opt-in (η διεύθυνση ενεργοποιείται μόνο μετά τον σύνδεσμο επιβεβαίωσης), αποθηκευμένο το ακριβές κείμενο συναίνεσης + έκδοση + IP/ώρα, one-click διαγραφή από κάθε email. Ίδιο μητρώο για τη φόρμα επικοινωνίας και τα demo. «Διαγραφή από τη λίστα» κρατά το ίχνος· «Οριστική διαγραφή» σβήνει τα δεδομένα (δικαίωμα διαγραφής). Εξαγωγή CSV. Το κείμενο συναίνεσης του newsletter αλλάζει από CMS → Δημόσιες σελίδες → Νέα.

## 3. Χρήστες & ρόλοι

![Χρήστες](https://propertymanagement.b-cdn.net/docs/manual/sa-users--desktop.webp)

- «Χρήστες»: όλοι οι λογαριασμοί. Ο ρόλος καθορίζει την επιφάνεια: εταιρεία (/super-admin, /admin, /staff), πελάτης (/building, /owner, /portal), συνεργάτης (/marketplace).

![Νέος χρήστης](https://propertymanagement.b-cdn.net/docs/manual/sa-users-modal--desktop.webp)

- «Νέος χρήστης»: όνομα, email, ρόλος, αρχικός κωδικός, πελάτης/εταιρεία. Ο χρήστης λαμβάνει email καλωσορίσματος.
- «Ρόλοι»: πίνακας module × ενέργεια. Μπορείτε να φτιάξετε προσαρμοσμένους ρόλους πάνω σε έναν βασικό.
- Ένας χρήστης πελάτη μπορεί να είναι ταυτόχρονα ιδιοκτήτης και ένοικος· κρατά τον ανώτερο ρόλο.

## 4. Απομόνωση δεδομένων

Κάθε πελάτης βλέπει μόνο τα δικά του κτήρια, ενοίκους και προμηθευτές. Οι ιδιωτικές λίστες προμηθευτών δεν φαίνονται ούτε στην εταιρεία. Ελέγξτε τη συμπεριφορά με «View as» πριν δώσετε πρόσβαση σε νέο πελάτη.

## 5. Deploy & συντήρηση

- Παραγωγή: Coolify (Docker, Node 24). Μεταβλητές μόνο στο Coolify.
- Σε κάθε deploy: `prisma migrate deploy` και `npx tsx prisma/seed-rbac.ts`.
- **Cron (Coolify scheduled tasks, καθημερινά, header `x-cron-secret: $CRON_SECRET`):** `/api/cron/maintenance-reminders` (υπενθυμίσεις συντηρήσεων), `/api/cron/monthly-allowance`, `/api/cron/work-orders` (σιωπηρή παραλαβή συμβάσεων έργου, υπενθύμιση διαχειριστή, λήξη RFQ χωρίς προσφορές).
- **Emails:** όλα τα εξερχόμενα (κωδικοί, ειδοποιήσεις, ανακοινώσεις, κοινόχρηστα, demo, newsletter, αιτήματα σε προμηθευτές) περνούν από το ίδιο πρότυπο (`lib/email-template.ts`) με το λογότυπο και τα στοιχεία της εταιρείας από Ρυθμίσεις → Εταιρία/Brand (fallback: Orithon). Σε μη-production περιβάλλον η `EMAIL_REDIRECT_TO` στέλνει τα πάντα σε μία διεύθυνση.
- Ορίστε `NEXT_PUBLIC_SITE_URL` για σωστά sitemap/SEO και σωστούς συνδέσμους στα emails.
- Κλειδιά τρίτων: DeepSeek (AI), MapTiler (geocoding), Bunny CDN (αρχεία), Viva (πληρωμές), Daily (συνελεύσεις), Mailgun (email).

## 6. Παρακολούθηση

![Αναφορές](https://propertymanagement.b-cdn.net/docs/manual/sa-reports--desktop.webp)

- «Αναφορές» και «AI Κόστη / Tokens» για χρήση και κόστος.
- «Ενσωματώσεις» για SoftOne και άλλες συνδέσεις.
- Το «Προεπισκόπηση ρόλων» δείχνει τι βλέπει κάθε ρόλος χωρίς να αλλάξετε λογαριασμό.
