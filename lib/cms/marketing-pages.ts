import type { Translatable } from "@/lib/i18n/translatable";

/* ─────────────────────────────────────────────────────────────────────────────
   Structured content for the public marketing pages (handoff 05–07).

   One MarketingPage row per slug, holding a { el, en } blob. Plan rows live in
   PricingTier, questions in FAQ and articles in Article — this covers the page
   furniture around them: headers, strips, comparison tables, office cards.

   Types only. The DB reads/writes live in marketing-pages.server.ts so client
   forms can import the shapes and defaults without pulling in `server-only`.
   ──────────────────────────────────────────────────────────────────────────── */

export const MARKETING_PAGE_SLUGS = ["pricing", "news", "faq", "contact"] as const;
export type MarketingPageSlug = (typeof MARKETING_PAGE_SLUGS)[number];

export function isMarketingPageSlug(v: string): v is MarketingPageSlug {
  return (MARKETING_PAGE_SLUGS as readonly string[]).includes(v);
}

export interface Cta {
  label: string;
  href: string;
}

/** Header block shared by all four inner pages (handoff 05 §1). */
export interface PageHeaderContent {
  eyebrow: string;
  title: string;
  lead: string;
}

/* ── Pricing ───────────────────────────────────────────────────────────────── */

export interface ComparisonRow {
  feature: string;
  /** "✓", "—" or free text ("∞", "Email", "Priority", "Dedicated"). */
  essential: string;
  standard: string;
  pro: string;
}

export interface PricingPageContent {
  header: PageHeaderContent;
  billingMonthlyLabel: string;
  billingAnnualLabel: string;
  /** Unit line beside each price — "per apartment / month". */
  priceUnit: string;
  /** "Minimum {value} per building / month" — {value} is substituted. */
  minimumTemplate: string;
  enterprise: { heading: string; body: string; cta: Cta };
  includedKicker: string;
  included: { title: string; body: string }[];
  comparison: { kicker: string; heading: string; columns: [string, string, string]; rows: ComparisonRow[] };
  calculatorStrip: { heading: string; body: string; cta: Cta };
}

/* ── News ──────────────────────────────────────────────────────────────────── */

export interface NewsPageContent {
  header: PageHeaderContent;
  /** Chip labels; the first is the "all" chip. `slug` empty means no filter. */
  categories: { slug: string; label: string }[];
  featuredCtaLabel: string;
  loadMoreLabel: string;
  readTimeTemplate: string;
  newsletter: {
    heading: string; body: string; placeholder: string;
    submitLabel: string; successMessage: string; errorMessage: string;
    /** GDPR: the exact wording stored with each signup (double opt-in follows). */
    consentLabel?: string; consentLinkLabel?: string; pendingMessage?: string;
  };
  /** Article page furniture. */
  article: {
    breadcrumbRoot: string;
    shareLabel: string;
    takeawaysLabel: string;
    relatedKicker: string;
    relatedHeading: string;
    relatedCtaLabel: string;
  };
}

/* ── FAQ ───────────────────────────────────────────────────────────────────── */

export interface FaqPageContent {
  header: PageHeaderContent;
  /** Sidebar order and labels. `slug` matches FAQ.category. */
  categories: { slug: string; label: string }[];
  help: { heading: string; body: string; cta: Cta };
}

/* ── Contact ───────────────────────────────────────────────────────────────── */

export interface ContactPageContent {
  header: PageHeaderContent;
  form: {
    heading: string;
    body: string;
    labels: {
      name: string; company: string; email: string; phone: string;
      buildings: string; topic: string; message: string;
    };
    placeholders: {
      name: string; company: string; email: string; phone: string; message: string;
    };
    buildingOptions: string[];
    topicOptions: string[];
    consent: string;
    consentLinkLabel: string;
    consentLinkHref: string;
    submitLabel: string;
    submittingLabel: string;
    footnote: string;
    errorMessage: string;
    success: { heading: string; body: string; againLabel: string };
  };
  cards: { icon: "phone" | "mail" | "flag"; title: string; body: string; value: string; href: string }[];
  hours: { heading: string; rows: { day: string; hours: string }[] };
  offices: { city: string; address: string; imageUrl?: string }[];
}

export type MarketingPageContent =
  | PricingPageContent
  | NewsPageContent
  | FaqPageContent
  | ContactPageContent;

export type StoredMarketingPage<T> = Translatable<T>;

/* ─────────────────────────────────────────────────────────────────────────────
   Defaults — the handoff copy, verbatim where it exists. These render until an
   editor overwrites them, so the pages are never blank on a fresh install.
   ──────────────────────────────────────────────────────────────────────────── */

const PRICING_EN: PricingPageContent = {
  header: {
    eyebrow: "Pricing",
    title: "Priced per apartment. Never per headache.",
    lead: "One transparent rate per apartment, per month. No setup fees, no per-user charges, no lock-in — cancel whenever you like.",
  },
  billingMonthlyLabel: "Monthly",
  billingAnnualLabel: "Annual · save 20%",
  priceUnit: "per apartment / month",
  minimumTemplate: "Minimum {value} per building / month",
  enterprise: {
    heading: "Managing more than 100 buildings?",
    body: "Volume pricing, a dedicated migration team, custom SLAs and SSO. Tell us the shape of your portfolio and you will have a quote within two working days.",
    cta: { label: "Request a quote", href: "/contact" },
  },
  includedKicker: "All plans include",
  included: [
    { title: "No setup fee", body: "Onboarding, training and data import are included in every plan." },
    { title: "Unlimited users", body: "Every colleague, owner and technician, at no extra cost." },
    { title: "Greek compliance", body: "Built around Greek common-expense law and myDATA reporting." },
    { title: "Cancel anytime", body: "Monthly plans stop when you say so, and your data exports with you." },
  ],
  comparison: {
    kicker: "Compare",
    heading: "What is in each plan",
    columns: ["Essential", "Standard", "Pro"],
    rows: [
      { feature: "Buildings & units", essential: "∞", standard: "∞", pro: "∞" },
      { feature: "Automatic expense splitting", essential: "✓", standard: "✓", pro: "✓" },
      { feature: "Online payments", essential: "✓", standard: "✓", pro: "✓" },
      { feature: "Resident portal & app", essential: "✓", standard: "✓", pro: "✓" },
      { feature: "Tickets & maintenance", essential: "—", standard: "✓", pro: "✓" },
      { feature: "Document archive", essential: "—", standard: "✓", pro: "✓" },
      { feature: "Announcements & polls", essential: "—", standard: "✓", pro: "✓" },
      { feature: "Owner reports & exports", essential: "—", standard: "✓", pro: "✓" },
      { feature: "Custom dashboards", essential: "—", standard: "—", pro: "✓" },
      { feature: "Open API & webhooks", essential: "—", standard: "—", pro: "✓" },
      { feature: "Accounting integrations", essential: "—", standard: "—", pro: "✓" },
      { feature: "Single sign-on (SSO)", essential: "—", standard: "—", pro: "✓" },
      { feature: "Support", essential: "Email", standard: "Priority", pro: "Dedicated" },
    ],
  },
  calculatorStrip: {
    heading: "Not sure which plan fits?",
    body: "Put your own numbers into the calculator on the home page — buildings, apartments, add-ons — and see the per-apartment cost before you talk to anyone.",
    cta: { label: "Open the calculator", href: "/#calc" },
  },
};

const PRICING_EL: PricingPageContent = {
  header: {
    eyebrow: "Τιμές",
    title: "Χρέωση ανά διαμέρισμα. Ποτέ ανά πονοκέφαλο.",
    lead: "Μία διαφανής τιμή ανά διαμέρισμα, ανά μήνα. Χωρίς κόστος εγκατάστασης, χωρίς χρέωση ανά χρήστη, χωρίς δέσμευση — ακυρώνετε όποτε θέλετε.",
  },
  billingMonthlyLabel: "Μηνιαία",
  billingAnnualLabel: "Ετήσια · έκπτωση 20%",
  priceUnit: "ανά διαμέρισμα / μήνα",
  minimumTemplate: "Ελάχιστο {value} ανά κτήριο / μήνα",
  enterprise: {
    heading: "Διαχειρίζεστε πάνω από 100 κτήρια;",
    body: "Τιμολόγηση όγκου, αφοσιωμένη ομάδα μετάπτωσης, προσαρμοσμένα SLA και SSO. Πείτε μας τη μορφή του χαρτοφυλακίου σας και έχετε προσφορά μέσα σε δύο εργάσιμες.",
    cta: { label: "Ζητήστε προσφορά", href: "/contact" },
  },
  includedKicker: "Όλα τα πακέτα περιλαμβάνουν",
  included: [
    { title: "Χωρίς κόστος εγκατάστασης", body: "Η ενεργοποίηση, η εκπαίδευση και η εισαγωγή δεδομένων περιλαμβάνονται σε κάθε πακέτο." },
    { title: "Απεριόριστοι χρήστες", body: "Κάθε συνεργάτης, ιδιοκτήτης και τεχνικός, χωρίς επιπλέον χρέωση." },
    { title: "Ελληνική συμμόρφωση", body: "Χτισμένο γύρω από τη νομοθεσία κοινοχρήστων και την αναφορά myDATA." },
    { title: "Ακύρωση όποτε θέλετε", body: "Τα μηνιαία πακέτα σταματούν όταν το πείτε και τα δεδομένα σας φεύγουν μαζί σας." },
  ],
  comparison: {
    kicker: "Σύγκριση",
    heading: "Τι περιλαμβάνει κάθε πακέτο",
    columns: ["Essential", "Standard", "Pro"],
    rows: [
      { feature: "Κτήρια & ακίνητα", essential: "∞", standard: "∞", pro: "∞" },
      { feature: "Αυτόματος επιμερισμός δαπανών", essential: "✓", standard: "✓", pro: "✓" },
      { feature: "Ηλεκτρονικές πληρωμές", essential: "✓", standard: "✓", pro: "✓" },
      { feature: "Portal & εφαρμογή ενοίκων", essential: "✓", standard: "✓", pro: "✓" },
      { feature: "Αιτήματα & συντήρηση", essential: "—", standard: "✓", pro: "✓" },
      { feature: "Αρχείο εγγράφων", essential: "—", standard: "✓", pro: "✓" },
      { feature: "Ανακοινώσεις & ψηφοφορίες", essential: "—", standard: "✓", pro: "✓" },
      { feature: "Αναφορές & εξαγωγές ιδιοκτητών", essential: "—", standard: "✓", pro: "✓" },
      { feature: "Προσαρμοσμένα dashboards", essential: "—", standard: "—", pro: "✓" },
      { feature: "Ανοιχτό API & webhooks", essential: "—", standard: "—", pro: "✓" },
      { feature: "Λογιστικές ενοποιήσεις", essential: "—", standard: "—", pro: "✓" },
      { feature: "Ενιαία σύνδεση (SSO)", essential: "—", standard: "—", pro: "✓" },
      { feature: "Υποστήριξη", essential: "Email", standard: "Priority", pro: "Dedicated" },
    ],
  },
  calculatorStrip: {
    heading: "Δεν είστε σίγουροι ποιο πακέτο ταιριάζει;",
    body: "Βάλτε τα δικά σας νούμερα στο κοστολόγιο της αρχικής — κτήρια, διαμερίσματα, πρόσθετα — και δείτε το κόστος ανά διαμέρισμα πριν μιλήσετε με κανέναν.",
    cta: { label: "Ανοίξτε το κοστολόγιο", href: "/#calc" },
  },
};

const NEWS_EN: NewsPageContent = {
  header: {
    eyebrow: "Newsroom",
    title: "Notes on running better buildings.",
    lead: "Product releases, regulation updates and field notes from managers who run hundreds of buildings.",
  },
  categories: [
    { slug: "", label: "All" },
    { slug: "product", label: "Product" },
    { slug: "regulation", label: "Regulation" },
    { slug: "field-notes", label: "Field notes" },
    { slug: "company", label: "Company" },
  ],
  featuredCtaLabel: "Read the story",
  loadMoreLabel: "Load more articles",
  readTimeTemplate: "{minutes} min read",
  newsletter: {
    heading: "The monthly building brief",
    body: "One email a month: what changed in the product, what changed in the law, and one thing worth copying from another manager.",
    placeholder: "you@company.gr",
    submitLabel: "Subscribe",
    successMessage: "You are on the list. Look out for the next brief.",
    errorMessage: "That did not go through. Please try again.",
    consentLabel: "I agree to receive the Orithon newsletter by email and to my address being stored for that purpose, as described in the",
    consentLinkLabel: "privacy policy",
    pendingMessage: "Almost there — check your inbox and press the confirmation link.",
  },
  article: {
    breadcrumbRoot: "News",
    shareLabel: "Share this article",
    takeawaysLabel: "Key takeaways",
    relatedKicker: "Keep reading",
    relatedHeading: "Related articles",
    relatedCtaLabel: "All articles",
  },
};

const NEWS_EL: NewsPageContent = {
  header: {
    eyebrow: "Νέα",
    title: "Σημειώσεις για καλύτερη διαχείριση κτηρίων.",
    lead: "Νέες δυνατότητες, αλλαγές στη νομοθεσία και σημειώσεις πεδίου από διαχειριστές που τρέχουν εκατοντάδες κτήρια.",
  },
  categories: [
    { slug: "", label: "Όλα" },
    { slug: "product", label: "Προϊόν" },
    { slug: "regulation", label: "Νομοθεσία" },
    { slug: "field-notes", label: "Από το πεδίο" },
    { slug: "company", label: "Εταιρία" },
  ],
  featuredCtaLabel: "Διαβάστε το άρθρο",
  loadMoreLabel: "Περισσότερα άρθρα",
  readTimeTemplate: "{minutes} λεπτά ανάγνωσης",
  newsletter: {
    heading: "Το μηνιαίο ενημερωτικό",
    body: "Ένα email τον μήνα: τι άλλαξε στην πλατφόρμα, τι άλλαξε στη νομοθεσία και ένα πράγμα που αξίζει να αντιγράψετε από άλλον διαχειριστή.",
    placeholder: "esy@etaireia.gr",
    submitLabel: "Εγγραφή",
    successMessage: "Είστε στη λίστα. Τα λέμε στο επόμενο ενημερωτικό.",
    errorMessage: "Η εγγραφή δεν ολοκληρώθηκε. Δοκιμάστε ξανά.",
    consentLabel: "Συμφωνώ να λαμβάνω το ενημερωτικό του Orithon με email και να αποθηκευτεί η διεύθυνσή μου για αυτόν τον σκοπό, όπως περιγράφεται στην",
    consentLinkLabel: "πολιτική απορρήτου",
    pendingMessage: "Σχεδόν έτοιμο — ελέγξτε το inbox σας και πατήστε τον σύνδεσμο επιβεβαίωσης.",
  },
  article: {
    breadcrumbRoot: "Νέα",
    shareLabel: "Μοιραστείτε το άρθρο",
    takeawaysLabel: "Βασικά σημεία",
    relatedKicker: "Συνεχίστε",
    relatedHeading: "Σχετικά άρθρα",
    relatedCtaLabel: "Όλα τα άρθρα",
  },
};

const FAQ_EN: FaqPageContent = {
  header: {
    eyebrow: "Support",
    title: "Questions, answered plainly.",
    lead: "Everything managers ask us before they switch — pricing, migration, legal compliance and what happens on day one.",
  },
  categories: [
    { slug: "pricing", label: "Pricing & contracts" },
    { slug: "setup", label: "Setup & migration" },
    { slug: "compliance", label: "Compliance & data" },
    { slug: "operations", label: "Operations & support" },
  ],
  help: {
    heading: "Still not sure?",
    body: "Send us the question. A real person replies within four working hours, in Greek or English.",
    cta: { label: "Talk to a human", href: "/contact" },
  },
};

const FAQ_EL: FaqPageContent = {
  header: {
    eyebrow: "Υποστήριξη",
    title: "Ερωτήσεις, με απλές απαντήσεις.",
    lead: "Όσα μας ρωτούν οι διαχειριστές πριν αλλάξουν — τιμές, μετάπτωση, νομική συμμόρφωση και τι γίνεται την πρώτη μέρα.",
  },
  categories: [
    { slug: "pricing", label: "Τιμές & συμβόλαια" },
    { slug: "setup", label: "Εγκατάσταση & μετάπτωση" },
    { slug: "compliance", label: "Συμμόρφωση & δεδομένα" },
    { slug: "operations", label: "Λειτουργία & υποστήριξη" },
  ],
  help: {
    heading: "Έχετε ακόμη απορίες;",
    body: "Στείλτε μας την ερώτηση. Απαντά άνθρωπος μέσα σε τέσσερις εργάσιμες ώρες, στα ελληνικά ή στα αγγλικά.",
    cta: { label: "Μιλήστε με άνθρωπο", href: "/contact" },
  },
};

const CONTACT_EN: ContactPageContent = {
  header: {
    eyebrow: "Contact",
    title: "Let us look at your portfolio together.",
    lead: "Book a 20-minute walkthrough, ask about migration, or just say what is broken today. A real person reads every message.",
  },
  form: {
    heading: "Send us a message",
    body: "Tell us a little about your buildings and we will come back with something useful, not a brochure.",
    labels: {
      name: "Full name", company: "Company", email: "Email", phone: "Phone",
      buildings: "Buildings you manage", topic: "What is this about?", message: "Message",
    },
    placeholders: {
      name: "Eleni Markou",
      company: "Markou Property Management",
      email: "eleni@company.gr",
      phone: "+30 210 000 0000",
      message: "How many buildings, what you use today, and what you would fix first.",
    },
    buildingOptions: ["1–5", "6–20", "21–60", "61–100", "More than 100 buildings"],
    topicOptions: ["Book a demo", "Pricing question", "Migrating from another tool", "Technical support", "Partnership"],
    consent: "I agree to be contacted about my request and to my details being stored in line with the",
    consentLinkLabel: "privacy policy",
    consentLinkHref: "/privacy",
    submitLabel: "Send message",
    submittingLabel: "Sending…",
    footnote: "We reply within four working hours.",
    errorMessage: "Something went wrong. Please try again, or email us directly.",
    success: {
      heading: "Message received.",
      body: "Thank you — we have your message and will come back to you within four working hours.",
      againLabel: "Send another message",
    },
  },
  cards: [
    { icon: "phone", title: "Talk to sales", body: "For demos, pricing and migration questions.", value: "+30 210 300 4500", href: "tel:+302103004500" },
    { icon: "mail", title: "Support", body: "Existing customers, any question, any plan.", value: "support@orithon.gr", href: "mailto:support@orithon.gr" },
    { icon: "flag", title: "Partnerships", body: "Accountants, technicians and software partners.", value: "partners@orithon.gr", href: "mailto:partners@orithon.gr" },
  ],
  hours: {
    heading: "Support hours",
    rows: [
      { day: "Monday – Friday", hours: "09:00 – 19:00" },
      { day: "Saturday", hours: "10:00 – 14:00" },
      { day: "Emergencies", hours: "24 / 7" },
    ],
  },
  offices: [
    { city: "Athens", address: "Kifisias Avenue 124, Marousi 151 25 — third floor, above the pharmacy." },
    { city: "Thessaloniki", address: "Tsimiski 43, Thessaloniki 546 23 — opening September 2026." },
  ],
};

const CONTACT_EL: ContactPageContent = {
  header: {
    eyebrow: "Επικοινωνία",
    title: "Ας δούμε μαζί το χαρτοφυλάκιό σας.",
    lead: "Κλείστε μια παρουσίαση 20 λεπτών, ρωτήστε για τη μετάπτωση ή απλώς πείτε μας τι δεν δουλεύει σήμερα. Κάθε μήνυμα το διαβάζει άνθρωπος.",
  },
  form: {
    heading: "Στείλτε μας μήνυμα",
    body: "Πείτε μας λίγα λόγια για τα κτήριά σας και θα επανέλθουμε με κάτι χρήσιμο, όχι με φυλλάδιο.",
    labels: {
      name: "Ονοματεπώνυμο", company: "Εταιρία", email: "Email", phone: "Τηλέφωνο",
      buildings: "Κτήρια που διαχειρίζεστε", topic: "Σχετικά με τι;", message: "Μήνυμα",
    },
    placeholders: {
      name: "Ελένη Μάρκου",
      company: "Μάρκου Διαχείριση Ακινήτων",
      email: "eleni@etaireia.gr",
      phone: "+30 210 000 0000",
      message: "Πόσα κτήρια, τι χρησιμοποιείτε σήμερα και τι θα θέλατε να διορθώσετε πρώτο.",
    },
    buildingOptions: ["1–5", "6–20", "21–60", "61–100", "Πάνω από 100 κτήρια"],
    topicOptions: ["Κλείσιμο demo", "Ερώτηση για τιμές", "Μετάπτωση από άλλο εργαλείο", "Τεχνική υποστήριξη", "Συνεργασία"],
    consent: "Συμφωνώ να επικοινωνήσετε μαζί μου για το αίτημά μου και να αποθηκευτούν τα στοιχεία μου σύμφωνα με την",
    consentLinkLabel: "πολιτική απορρήτου",
    consentLinkHref: "/privacy",
    submitLabel: "Αποστολή μηνύματος",
    submittingLabel: "Αποστολή…",
    footnote: "Απαντάμε μέσα σε τέσσερις εργάσιμες ώρες.",
    errorMessage: "Κάτι πήγε στραβά. Δοκιμάστε ξανά ή στείλτε μας email απευθείας.",
    success: {
      heading: "Το μήνυμα ελήφθη.",
      body: "Ευχαριστούμε — λάβαμε το μήνυμά σας και θα επανέλθουμε μέσα σε τέσσερις εργάσιμες ώρες.",
      againLabel: "Στείλτε άλλο μήνυμα",
    },
  },
  cards: [
    { icon: "phone", title: "Μιλήστε με πωλήσεις", body: "Για demo, τιμές και ερωτήσεις μετάπτωσης.", value: "+30 210 300 4500", href: "tel:+302103004500" },
    { icon: "mail", title: "Υποστήριξη", body: "Υπάρχοντες πελάτες, κάθε ερώτηση, κάθε πακέτο.", value: "support@orithon.gr", href: "mailto:support@orithon.gr" },
    { icon: "flag", title: "Συνεργασίες", body: "Λογιστές, τεχνικοί και συνεργάτες λογισμικού.", value: "partners@orithon.gr", href: "mailto:partners@orithon.gr" },
  ],
  hours: {
    heading: "Ώρες υποστήριξης",
    rows: [
      { day: "Δευτέρα – Παρασκευή", hours: "09:00 – 19:00" },
      { day: "Σάββατο", hours: "10:00 – 14:00" },
      { day: "Έκτακτα περιστατικά", hours: "24 / 7" },
    ],
  },
  offices: [
    { city: "Αθήνα", address: "Λεωφόρος Κηφισίας 124, Μαρούσι 151 25 — τρίτος όροφος, πάνω από το φαρμακείο." },
    { city: "Θεσσαλονίκη", address: "Τσιμισκή 43, Θεσσαλονίκη 546 23 — ανοίγει Σεπτέμβριο 2026." },
  ],
};

export const MARKETING_PAGE_DEFAULTS = {
  pricing: { el: PRICING_EL, en: PRICING_EN } as Translatable<PricingPageContent>,
  news: { el: NEWS_EL, en: NEWS_EN } as Translatable<NewsPageContent>,
  faq: { el: FAQ_EL, en: FAQ_EN } as Translatable<FaqPageContent>,
  contact: { el: CONTACT_EL, en: CONTACT_EN } as Translatable<ContactPageContent>,
};

export const MARKETING_PAGE_META: Record<MarketingPageSlug, { label: string; description: string; path: string }> = {
  pricing: {
    label: "Τιμές",
    description: "Επικεφαλίδα, strip για μεγάλα χαρτοφυλάκια, «όλα τα πακέτα περιλαμβάνουν» και ο πίνακας σύγκρισης.",
    path: "/pricing",
  },
  news: {
    label: "Νέα",
    description: "Επικεφαλίδα, κατηγορίες, newsletter strip και τα κείμενα της σελίδας άρθρου.",
    path: "/blog",
  },
  faq: {
    label: "Συχνές ερωτήσεις",
    description: "Επικεφαλίδα, κατηγορίες πλαϊνής στήλης και η κάρτα βοήθειας. Οι ερωτήσεις επεξεργάζονται στο «FAQ».",
    path: "/faq",
  },
  contact: {
    label: "Επικοινωνία",
    description: "Επικεφαλίδα, όλα τα πεδία και τα μηνύματα της φόρμας, κάρτες επικοινωνίας, ώρες και γραφεία.",
    path: "/contact",
  },
};

/** Shallow-merges a stored blob over the defaults so a partial row still renders. */
export function withDefaults<S extends MarketingPageSlug>(
  slug: S,
  stored: unknown,
  locale: "el" | "en",
): (typeof MARKETING_PAGE_DEFAULTS)[S]["el"] {
  const fallback = MARKETING_PAGE_DEFAULTS[slug][locale];
  if (!stored || typeof stored !== "object") return fallback;
  const perLocale = (stored as Record<string, unknown>)[locale];
  if (!perLocale || typeof perLocale !== "object") return fallback;
  return { ...fallback, ...(perLocale as object) } as (typeof MARKETING_PAGE_DEFAULTS)[S]["el"];
}
