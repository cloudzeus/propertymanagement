import { db } from "@/lib/db";

// Bilingual content transcribed from the approved design (Orithon Landing.dc.html).
// Run with: npx tsx --env-file=.env prisma/seed-landing.ts

const uid = () => crypto.randomUUID();

const HERO = {
  el: {
    eyebrow: "Διαχείριση κτηρίων & κοινοχρήστων",
    title: "Κάθε κτήριο,",
    titleAccent: "υπό έλεγχο.",
    subtitle:
      "Κοινόχρηστα, πληρωμές, συντήρηση και επικοινωνία ενοίκων — ένας καθαρός, σύγχρονος χώρος εργασίας που κρατά όλο το χαρτοφυλάκιο σε κίνηση.",
    primaryCta: { label: "Κλείσε demo", href: "#demo" },
    secondaryCta: { label: "Δες το overview", href: "/services" },
    imageUrl: "",
    videoUrl: "",
    trustText: "Εμπιστοσύνη από διαχειριστές σε 200+ κτήρια",
    propertyName: "Astra Residences", propertyAddress: "Λ. Κηφισίας 124", occupancy: "96%", occLabel: "πληρότητα",
    toastTitle: "Πληρωμή ελήφθη", toastSub: "Διαμ. 4Β · €84,50",
    liveBadge: "Ζωντανό χαρτοφυλάκιο", monthLabel: "Ιούνιος 2026", chartLabel: "Εισπράξεις vs. προϋπολογισμός",
    kpi1Label: "Εισπράχθηκαν", kpi1Value: "€184k", kpi2Label: "Ανοιχτά αιτήματα", kpi2Value: "12",
  },
  en: {
    eyebrow: "Property & common-area management",
    title: "Every building,",
    titleAccent: "under control.",
    subtitle:
      "Shared expenses, payments, maintenance and resident communication — one calm, modern workspace that keeps your whole portfolio moving.",
    primaryCta: { label: "Book a demo", href: "#demo" },
    secondaryCta: { label: "Watch overview", href: "/services" },
    imageUrl: "",
    videoUrl: "",
    trustText: "Trusted by managers across 200+ buildings",
    propertyName: "Astra Residences", propertyAddress: "Kifisias Ave 124", occupancy: "96%", occLabel: "occupied",
    toastTitle: "Payment received", toastSub: "Apt 4B · €84.50",
    liveBadge: "Live portfolio", monthLabel: "June 2026", chartLabel: "Collections vs. budget",
    kpi1Label: "Collected", kpi1Value: "€184k", kpi2Label: "Open tickets", kpi2Value: "12",
  },
};

const TRUST_NAMES = ["Meridian", "Halcyon", "Astor", "Lumen", "Veridia", "Solace", "Atrium", "Northwind"];
const LOGOS = {
  el: { heading: "Εμπιστοσύνη από διαχειριστές σε 200+ κτήρια", items: TRUST_NAMES.map((label) => ({ id: uid(), label })) },
  en: { heading: "Trusted by managers across 200+ buildings", items: TRUST_NAMES.map((label) => ({ id: uid(), label })) },
};

const STATS = {
  el: { items: [
    { id: uid(), value: "200+", label: "κτήρια" },
    { id: uid(), value: "98%", label: "έγκαιρες πληρωμές" },
    { id: uid(), value: "4ώρ", label: "μέσος χρόνος επίλυσης" },
    { id: uid(), value: "€12εκ", label: "εισπράξεις / έτος" },
  ] },
  en: { items: [
    { id: uid(), value: "200+", label: "buildings managed" },
    { id: uid(), value: "98%", label: "on-time payments" },
    { id: uid(), value: "4h", label: "avg. resolution time" },
    { id: uid(), value: "€12M", label: "collected per year" },
  ] },
};

const FEAT_ICONS = ["RiMoneyEuroCircleLine", "RiBankCardLine", "RiToolsLine", "RiChat3Line", "RiFileList3Line", "RiBarChartBoxLine"];
const FEATURES = {
  el: {
    kicker: "Μία πλατφόρμα",
    heading: "Ό,τι χρειάζεται ένα κτήριο, σε ένα σημείο.",
    subtitle: "Από την πρώτη έκδοση κοινοχρήστων μέχρι το τελευταίο κλεισμένο αίτημα — το Orithon κρατά όλη τη λειτουργία συγχρονισμένη.",
    imageTile: { imageUrl: "", title: "Τα κτήριά σου, οργανωμένα τέλεια", subtitle: "Κάθε διαμέρισμα, ιδιοκτήτης και μετρητής σε μία καρτέλα" },
    items: [
      { title: "Κοινόχρηστα & εκδόσεις", body: "Δημιουργία, επιμερισμός και έκδοση κοινοχρήστων αυτόματα — με χιλιοστά, εμβαδόν ή δικούς σου κανόνες." },
      { title: "Πληρωμές online", body: "Οι ένοικοι πληρώνουν με κάρτα ή τράπεζα σε ένα tap. Η συμφωνία γίνεται μόνη της." },
      { title: "Εργασίες & βλάβες", body: "Παρακολούθηση από την αναφορά ως την επίλυση, με πλήρες ιστορικό." },
      { title: "Επικοινωνία ενοίκων", body: "Ανακοινώσεις, ψηφοφορίες και μηνύματα — χωρίς τα ομαδικά chat." },
      { title: "Έγγραφα & αρχείο", body: "Συμβόλαια, τιμολόγια και πρακτικά, οργανωμένα ανά κτήριο." },
      { title: "Reporting & dashboards", body: "Ζωντανά οικονομικά και KPIs σε όλο το χαρτοφυλάκιο." },
    ].map((it, i) => ({ id: uid(), icon: FEAT_ICONS[i], ...it })),
  },
  en: {
    kicker: "One platform",
    heading: "Everything a building needs, in one place.",
    subtitle: "From the first issued charge to the last closed ticket — Orithon keeps the whole operation in sync.",
    imageTile: { imageUrl: "", title: "Your buildings, beautifully organised", subtitle: "Every unit, owner and meter in one record" },
    items: [
      { title: "Shared expenses & billing", body: "Build, split and issue common-area charges automatically — by share, area or custom rules." },
      { title: "Online payments", body: "Residents pay dues by card or bank in a tap. Reconciliation happens on its own." },
      { title: "Tasks & repairs", body: "Track issues from report to resolution and keep an auditable history." },
      { title: "Resident communication", body: "Announcements, polls and messages — without the group chats." },
      { title: "Documents & archive", body: "Contracts, invoices and minutes, organised per building." },
      { title: "Reporting & dashboards", body: "Live financials and KPIs across your whole portfolio." },
    ].map((it, i) => ({ id: uid(), icon: FEAT_ICONS[i], ...it })),
  },
};

const ROLES = {
  el: {
    kicker: "Για κάθε ρόλο",
    heading: "Φτιαγμένο για όλους στο κτήριο.",
    subtitle: "Μία πηγή αλήθειας, τρεις εμπειρίες στα μέτρα του καθενός.",
    roles: [
      { id: uid(), initial: "Δ", name: "Διαχειριστές", tag: "Εταιρείες διαχείρισης & facility", points: ["Έκδοση κοινοχρήστων & εισπράξεις", "Συντονισμός συνεργείων & προμηθευτών", "Reports σε όλο το χαρτοφυλάκιο", "Διαφάνεια προς ιδιοκτήτες"] },
      { id: uid(), initial: "Ε", name: "Ένοικοι", tag: "Ιδιοκτήτες & μισθωτές", points: ["Πληρωμή & προβολή υπολοίπων", "Αναφορά βλάβης σε δευτερόλεπτα", "Ανακοινώσεις & ψηφοφορίες", "Πρόσβαση σε έγγραφα κτηρίου"] },
      { id: uid(), initial: "Τ", name: "Τεχνικοί", tag: "Συνεργεία συντήρησης", points: ["Λήψη εντολών εργασίας", "Ενημέρωση κατάστασης από το πεδίο", "Καταγραφή υλικών, χρόνου & φωτό", "Κλείσιμο αιτημάτων με απόδειξη"] },
    ],
  },
  en: {
    kicker: "For every role",
    heading: "Built for everyone in the building.",
    subtitle: "One source of truth, three tailored experiences.",
    roles: [
      { id: uid(), initial: "M", name: "Managers", tag: "Property & facility companies", points: ["Issue charges & track collections", "Coordinate crews and vendors", "Portfolio-wide reporting", "Owner & board transparency"] },
      { id: uid(), initial: "R", name: "Residents", tag: "Owners & tenants", points: ["Pay dues and view balances", "Report issues in seconds", "Read announcements & vote", "Access building documents"] },
      { id: uid(), initial: "T", name: "Technicians", tag: "Maintenance crews", points: ["Receive assigned work orders", "Update status from the field", "Log parts, time and photos", "Close tickets with proof"] },
    ],
  },
};

const HOW = {
  el: {
    kicker: "Πώς δουλεύει",
    heading: "Ξεκίνα σε τρία βήματα.",
    subtitle: "Χωρίς migrations, χωρίς excel, χωρίς IT project.",
    steps: [
      { id: uid(), title: "Πρόσθεσε τα κτήρια", body: "Εισαγωγή διαμερισμάτων, ιδιοκτητών και μετρητών σε λεπτά — ή τα μεταφέρουμε εμείς." },
      { id: uid(), title: "Έκδοσε & εισέπραξε", body: "Αυτόματος επιμερισμός κοινοχρήστων και online πληρωμές. Η συμφωνία γίνεται αυτόματα." },
      { id: uid(), title: "Λειτούργησε", body: "Διαχειρίσου αιτήματα, συνεργεία, έγγραφα και reports από ένα ήρεμο dashboard." },
    ],
  },
  en: {
    kicker: "How it works",
    heading: "Live in three steps.",
    subtitle: "No migrations, no spreadsheets, no IT project.",
    steps: [
      { id: uid(), title: "Add your buildings", body: "Import units, owners and meters in minutes — or let us migrate them for you." },
      { id: uid(), title: "Issue & collect", body: "Auto-split common charges and get paid online. Reconciliation is automatic." },
      { id: uid(), title: "Run operations", body: "Track tickets, vendors, documents and reports from one calm dashboard." },
    ],
  },
};

// Cost calculator (handoff 04). Rates are € per apartment / month, VAT excluded.
// The numbers are identical in both dictionaries — the calculator never quotes
// a different price per language.
const CALC_RATES = {
  rates: { essential: 1.2, standard: 2.2, pro: 3.4 },
  minimums: { essential: 18, standard: 32, pro: 55 },
  addonRates: { payments: 0.35, technician: 0.45, accounting: 0.25 },
  annualMultiplier: 0.8,
};

const CALCULATOR = {
  el: {
    ...CALC_RATES,
    kicker: "Κοστολόγιο",
    heading: "Πόσο θα κοστίσει ανά διαμέρισμα;",
    lead: "Χρεώνουμε ανά διαμέρισμα, ανά μήνα. Βάλτε τα δικά σας νούμερα και δείτε το κόστος πριν μιλήσετε με πωλητή.",
    footnote: "Μόνο εκτίμηση. Χωρίς ΦΠΑ. Τελική προσφορά μετά από μια παρουσίαση 20 λεπτών.",
    primaryCta: { label: "Κλείσε demo", href: "/contact" },
    secondaryCta: { label: "Δείτε όλες τις τιμές", href: "/pricing" },
    planNames: { essential: "Essential", standard: "Standard", pro: "Pro" },
    planUnits: {
      essential: "χρεώσεις + πληρωμές",
      standard: "+ αιτήματα, αρχεία, επικοινωνία",
      pro: "+ API, αναφορές, SSO",
    },
    addonNames: {
      payments: "Ηλεκτρονικές πληρωμές",
      technician: "Εφαρμογή τεχνικού",
      accounting: "Λογιστική εξαγωγή",
    },
  },
  en: {
    ...CALC_RATES,
    kicker: "Cost calculator",
    heading: "What will it cost per apartment?",
    lead: "We charge per apartment, per month. Put your own numbers in and see the cost before you talk to anyone.",
    footnote: "Estimate only. VAT excluded. Final quote after a 20-minute walkthrough.",
    primaryCta: { label: "Book a demo", href: "/contact" },
    secondaryCta: { label: "See full pricing", href: "/pricing" },
    planNames: { essential: "Essential", standard: "Standard", pro: "Pro" },
    planUnits: {
      essential: "charges + payments",
      standard: "+ tickets, docs, comms",
      pro: "+ API, reporting, SSO",
    },
    addonNames: {
      payments: "Online payments",
      technician: "Technician app",
      accounting: "Accounting export",
    },
  },
};

const SHOWCASE = {
  el: {
    kicker: "Διαφανής λειτουργία",
    heading: "Δες κάθε κτήριο με μια ματιά.",
    subtitle: "Οικονομικά και λειτουργία σε πραγματικό χρόνο, πάνω από τα κτήρια που διαχειρίζεσαι.",
    imageUrl: "",
    stat1: { value: "€184k", label: "Εισπράξεις μήνα" },
    stat2: { value: "12", label: "Ανοιχτά αιτήματα" },
    points: [
      { id: uid(), title: "Dashboard χαρτοφυλακίου", body: "Εισπράξεις, υπόλοιπα και αιτήματα για όλα τα κτήρια." },
      { id: uid(), title: "Ανάλυση ανά κτήριο", body: "Άνοιξε οποιοδήποτε κτήριο για διαμερίσματα, χρεώσεις, ιστορικό." },
      { id: uid(), title: "Έτοιμα reports", body: "Οικονομικά για ιδιοκτήτες με ένα κλικ." },
    ],
    cta: { label: "Κλείσε demo", href: "#demo" },
  },
  en: {
    kicker: "Glass-clear operations",
    heading: "See every building at a glance.",
    subtitle: "Real-time financials and operations layered over the buildings you manage.",
    imageUrl: "",
    stat1: { value: "€184k", label: "Collected this month" },
    stat2: { value: "12", label: "Open tickets" },
    points: [
      { id: uid(), title: "Portfolio dashboard", body: "Collections, balances and tickets across all buildings." },
      { id: uid(), title: "Per-building drill-down", body: "Open any building for units, charges and history." },
      { id: uid(), title: "Exportable reports", body: "Owner-ready financials in one click." },
    ],
    cta: { label: "Book a demo", href: "#demo" },
  },
};

const TESTIMONIALS = {
  el: {
    heading: "",
    items: [{ id: uid(), quote: "Το Orithon αντικατέστησε τέσσερα εργαλεία και άπειρα τηλεφωνήματα. Οι εισπράξεις ανέβηκαν, τα παράπονα έπεσαν, και οι ιδιοκτήτες εμπιστεύονται επιτέλους τα νούμερα.", author: "Ελένη Μάρκου", role: "Διαχειρίστρια · 38 κτήρια" }],
  },
  en: {
    heading: "",
    items: [{ id: uid(), quote: "Orithon replaced four tools and a lot of phone calls. Collections are up, complaints are down, and owners finally trust the numbers.", author: "Eleni Markou", role: "Property manager · 38 buildings" }],
  },
};

const CTA = {
  el: {
    heading: "Σταμάτα να κυνηγάς τα κτήρια. Άρχισε να τα διαχειρίζεσαι.",
    body: "Δες το Orithon στο δικό σου χαρτοφυλάκιο σε μια παρουσίαση 20 λεπτών.",
    cta: { label: "Κλείσε demo", href: "#demo" },
    secondaryCta: { label: "Μίλα με πωλήσεις", href: "/contact" },
    imageUrl: "",
  },
  en: {
    heading: "Stop chasing buildings. Start running them.",
    body: "See Orithon on your own portfolio in a 20-minute walkthrough.",
    cta: { label: "Book a demo", href: "#demo" },
    secondaryCta: { label: "Talk to sales", href: "/contact" },
    imageUrl: "",
  },
};

// Handoff 02 §1 link set: Features · Calculator · Pricing · News · FAQ · Contact.
// The links measure ~544px, which is why the header hides them below 1080px —
// do not add more without raising that breakpoint.
const NAV = {
  el: {
    links: [
      { id: uid(), label: "Δυνατότητες", href: "/#features" },
      { id: uid(), label: "Κοστολόγιο", href: "/#calc" },
      { id: uid(), label: "Τιμές", href: "/pricing" },
      { id: uid(), label: "Νέα", href: "/blog" },
      { id: uid(), label: "FAQ", href: "/faq" },
      { id: uid(), label: "Επικοινωνία", href: "/contact" },
    ],
    loginLabel: "Σύνδεση", demoLabel: "Κλείσε demo", demoHref: "#demo", mineLabel: "Ο χώρος μου",
  },
  en: {
    links: [
      { id: uid(), label: "Features", href: "/#features" },
      { id: uid(), label: "Calculator", href: "/#calc" },
      { id: uid(), label: "Pricing", href: "/pricing" },
      { id: uid(), label: "News", href: "/blog" },
      { id: uid(), label: "FAQ", href: "/faq" },
      { id: uid(), label: "Contact", href: "/contact" },
    ],
    loginLabel: "Log in", demoLabel: "Book a demo", demoHref: "#demo", mineLabel: "My workspace",
  },
};

const FOOTER = {
  el: {
    tagline: "Σύγχρονη διαχείριση κοινοχρήστων, εργασιών και επικοινωνίας για κτήρια κατοικιών και επαγγελματικούς χώρους.",
    copyright: "© 2026 Orithon. Με επιφύλαξη παντός δικαιώματος.",
    columns: [
      { id: uid(), heading: "Προϊόν", links: [
        { label: "Τιμές", href: "/pricing" },
        { label: "Δυνατότητες", href: "/#features" },
        { label: "Κοστολόγιο", href: "/#calc" },
        { label: "Υπηρεσίες", href: "/services" },
      ] },
      { id: uid(), heading: "Εταιρία", links: [
        { label: "Νέα", href: "/blog" },
        { label: "Επικοινωνία", href: "/contact" },
      ] },
      { id: uid(), heading: "Πόροι", links: [
        { label: "Συχνές ερωτήσεις", href: "/faq" },
        { label: "Απόρρητο", href: "/privacy" },
        { label: "Όροι χρήσης", href: "/terms" },
        { label: "Πολιτική cookies", href: "/cookie-policy" },
      ] },
    ],
  },
  en: {
    tagline: "Modern management for shared expenses, tasks and communication across residential and commercial buildings.",
    copyright: "© 2026 Orithon. All rights reserved.",
    columns: [
      { id: uid(), heading: "Product", links: [
        { label: "Pricing", href: "/pricing" },
        { label: "Features", href: "/#features" },
        { label: "Calculator", href: "/#calc" },
        { label: "Solutions", href: "/services" },
      ] },
      { id: uid(), heading: "Company", links: [
        { label: "News", href: "/blog" },
        { label: "Contact", href: "/contact" },
      ] },
      { id: uid(), heading: "Resources", links: [
        { label: "FAQ", href: "/faq" },
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
        { label: "Cookie policy", href: "/cookie-policy" },
      ] },
    ],
  },
};

// Home page in the design's order. `data` is overwritten with the approved design copy.
const SECTIONS: { type: string; order: number; enabled: boolean; data: unknown }[] = [
  { type: "HERO", order: 0, enabled: true, data: HERO },
  { type: "LOGOS", order: 1, enabled: true, data: LOGOS },
  { type: "STATS", order: 2, enabled: true, data: STATS },
  { type: "FEATURES", order: 3, enabled: true, data: FEATURES },
  { type: "ROLES", order: 4, enabled: true, data: ROLES },
  { type: "HOW", order: 5, enabled: true, data: HOW },
  // The calculator sits between "How it works" and the showcase (handoff 03).
  { type: "CALCULATOR", order: 6, enabled: true, data: CALCULATOR },
  { type: "SHOWCASE", order: 7, enabled: true, data: SHOWCASE },
  { type: "TESTIMONIALS", order: 8, enabled: true, data: TESTIMONIALS },
  { type: "CTA", order: 9, enabled: true, data: CTA },
  { type: "NAV", order: 20, enabled: true, data: NAV },
  { type: "FOOTER", order: 21, enabled: true, data: FOOTER },
];

// Sections not in the design's home flow — pushed after it and disabled (re-enable in the CMS if wanted).
const PARKED = [
  { type: "PRICING", order: 10 },
  { type: "NEWS", order: 11 },
];

async function main() {
  for (const s of SECTIONS) {
    await db.landingSection.upsert({
      where: { type: s.type },
      update: { order: s.order, enabled: s.enabled, data: s.data as any },
      create: { type: s.type, order: s.order, enabled: s.enabled, data: s.data as any },
    });
  }
  for (const p of PARKED) {
    const row = await db.landingSection.findUnique({ where: { type: p.type } });
    if (row) await db.landingSection.update({ where: { type: p.type }, data: { order: p.order, enabled: false } });
  }
  const count = await db.landingSection.count();
  console.log(`Landing sections seeded. Total rows: ${count}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
