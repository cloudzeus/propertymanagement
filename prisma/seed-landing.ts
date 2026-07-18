import { db } from "@/lib/db";

// Bilingual content transcribed from the approved design (Orithon Landing.dc.html).
// Run with: npx tsx --env-file=.env prisma/seed-landing.ts

const uid = () => crypto.randomUUID();

const HERO = {
  el: {
    eyebrow: "Διαχείριση κτηρίων & κοινοχρήστων",
    title: "Κάθε κτήριο, υπό έλεγχο.",
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
    title: "Every building, under control.",
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

const NAV = {
  el: {
    links: [
      { id: uid(), label: "Λειτουργίες", href: "/#features" },
      { id: uid(), label: "Λύσεις", href: "/#roles" },
      { id: uid(), label: "Πώς δουλεύει", href: "/#how" },
      { id: uid(), label: "Τιμές", href: "/pricing" },
    ],
    loginLabel: "Σύνδεση", demoLabel: "Κλείσε demo", demoHref: "#demo", mineLabel: "Ο χώρος μου",
  },
  en: {
    links: [
      { id: uid(), label: "Features", href: "/#features" },
      { id: uid(), label: "Solutions", href: "/#roles" },
      { id: uid(), label: "How it works", href: "/#how" },
      { id: uid(), label: "Pricing", href: "/pricing" },
    ],
    loginLabel: "Log in", demoLabel: "Book a demo", demoHref: "#demo", mineLabel: "My workspace",
  },
};

const FOOTER = {
  el: {
    tagline: "Σύγχρονη διαχείριση κοινοχρήστων, εργασιών και επικοινωνίας για κτήρια κατοικιών και επαγγελματικούς χώρους.",
    copyright: "© 2026 Orithon · Αθήνα · Ελλάδα",
    columns: [
      { id: uid(), heading: "Προϊόν", links: [
        { label: "Λειτουργίες", href: "/#features" },
        { label: "Λύσεις", href: "/#roles" },
        { label: "Τιμές", href: "/pricing" },
        { label: "Συχνές ερωτήσεις", href: "/faq" },
      ] },
      { id: uid(), heading: "Εταιρεία", links: [
        { label: "Blog", href: "/blog" },
        { label: "Επικοινωνία", href: "/contact" },
      ] },
      { id: uid(), heading: "Νομικά", links: [
        { label: "Απόρρητο", href: "/privacy" },
        { label: "Όροι χρήσης", href: "/terms" },
        { label: "Πολιτική cookies", href: "/cookie-policy" },
      ] },
    ],
  },
  en: {
    tagline: "Modern management for shared expenses, tasks and communication across residential and commercial buildings.",
    copyright: "© 2026 Orithon · Athens · Greece",
    columns: [
      { id: uid(), heading: "Product", links: [
        { label: "Features", href: "/#features" },
        { label: "Solutions", href: "/#roles" },
        { label: "Pricing", href: "/pricing" },
        { label: "FAQ", href: "/faq" },
      ] },
      { id: uid(), heading: "Company", links: [
        { label: "Blog", href: "/blog" },
        { label: "Contact", href: "/contact" },
      ] },
      { id: uid(), heading: "Legal", links: [
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
  { type: "SHOWCASE", order: 6, enabled: true, data: SHOWCASE },
  { type: "TESTIMONIALS", order: 7, enabled: true, data: TESTIMONIALS },
  { type: "CTA", order: 8, enabled: true, data: CTA },
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
