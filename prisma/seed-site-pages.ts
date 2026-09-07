/**
 * Seeds the public marketing pages with the design handoff copy:
 *   - MarketingPage rows (pricing / news / faq / contact) — page furniture
 *   - PricingTier rows — the three plans of handoff 05 §2
 *   - FAQ rows — the twelve questions of handoff 07 §5
 *
 *   npx tsx --env-file=.env prisma/seed-site-pages.ts
 *
 * Re-runnable. Page furniture is overwritten with the defaults; tiers and FAQs
 * are only created when the tables are empty, so editorial changes survive.
 */
import { db } from "@/lib/db";
import { MARKETING_PAGE_DEFAULTS, MARKETING_PAGE_SLUGS } from "@/lib/cms/marketing-pages";

/* ── Plans (handoff 05 §2) — monthlyPrice is € per apartment / month ───────── */

const TIERS = [
  {
    slug: "essential",
    monthlyPrice: 1.2,
    minPerBuilding: 18,
    highlighted: false,
    order: 0,
    el: {
      name: "Essential",
      description: "Για μικρά χαρτοφυλάκια που κυρίως χρειάζονται έκδοση και είσπραξη κοινοχρήστων.",
      features: [
        "Απεριόριστα κτήρια & ακίνητα",
        "Αυτόματος επιμερισμός δαπανών",
        "Πληρωμές με κάρτα & τράπεζα",
        "Portal ενοίκων",
        "Υποστήριξη μέσω email",
      ],
      ctaLabel: "Ξεκινήστε",
      badge: "",
    },
    en: {
      name: "Essential",
      description: "For small portfolios that mainly need charges issued and paid.",
      features: [
        "Unlimited buildings & units",
        "Automatic expense splitting",
        "Card & bank payments",
        "Resident portal",
        "Email support",
      ],
      ctaLabel: "Get started",
      badge: "",
    },
  },
  {
    slug: "standard",
    monthlyPrice: 2.2,
    minPerBuilding: 32,
    highlighted: true,
    order: 1,
    el: {
      name: "Standard",
      description: "Ο πλήρης καθημερινός χώρος εργασίας για επαγγελματίες διαχειριστές.",
      features: [
        "Όλα του Essential",
        "Ροή αιτημάτων & συντήρησης",
        "Αρχείο εγγράφων ανά κτήριο",
        "Ανακοινώσεις & ψηφοφορίες",
        "Αναφορές & εξαγωγές ιδιοκτητών",
        "Priority υποστήριξη",
      ],
      ctaLabel: "Κλείσε demo",
      badge: "Δημοφιλέστερο",
    },
    en: {
      name: "Standard",
      description: "The complete day-to-day workspace for professional managers.",
      features: [
        "Everything in Essential",
        "Tickets & maintenance workflow",
        "Document archive per building",
        "Announcements & polls",
        "Owner reports & exports",
        "Priority support",
      ],
      ctaLabel: "Book a demo",
      badge: "Most popular",
    },
  },
  {
    slug: "pro",
    monthlyPrice: 3.4,
    minPerBuilding: 55,
    highlighted: false,
    order: 2,
    el: {
      name: "Pro",
      description: "Για μεγάλες λειτουργίες που χρειάζονται ενοποιήσεις και βαθιά reporting.",
      features: [
        "Όλα του Standard",
        "Ανοιχτό API & webhooks",
        "Προσαρμοσμένα dashboards & KPI",
        "Λογιστικές ενοποιήσεις",
        "Ενιαία σύνδεση (SSO)",
        "Αφοσιωμένος success manager",
      ],
      ctaLabel: "Ξεκινήστε",
      badge: "",
    },
    en: {
      name: "Pro",
      description: "For large operations that need integrations and deep reporting.",
      features: [
        "Everything in Standard",
        "Open API & webhooks",
        "Custom dashboards & KPIs",
        "Accounting integrations",
        "Single sign-on (SSO)",
        "Dedicated success manager",
      ],
      ctaLabel: "Get started",
      badge: "",
    },
  },
];

/* ── FAQ (handoff 07 §5) ───────────────────────────────────────────────────── */

const FAQS = [
  {
    category: "pricing",
    el: {
      q: "Πώς τιμολογείται το Orithon;",
      a: "Ανά διαμέρισμα, ανά μήνα, με ένα μικρό ελάχιστο ανά κτήριο ώστε και τα μικρά κτήρια να βγάζουν νόημα. Δεν υπάρχει κόστος εγκατάστασης ούτε χρέωση ανά χρήστη — προσθέτετε όσους συνεργάτες, ιδιοκτήτες και τεχνικούς θέλετε.",
    },
    en: {
      q: "How is Orithon priced?",
      a: "Per apartment, per month, with a small per-building minimum so small buildings still make sense. There is no setup fee and no per-user charge — add as many colleagues, owners and technicians as you like.",
    },
  },
  {
    category: "pricing",
    el: {
      q: "Υπάρχει ελάχιστη διάρκεια συμβολαίου;",
      a: "Όχι. Το μηνιαίο πακέτο ακυρώνεται όποτε θέλετε· το ετήσιο εξοικονομεί 20%. Σε κάθε περίπτωση τα δεδομένα σας εξάγονται σε ανοιχτά αρχεία και φεύγουν μαζί σας.",
    },
    en: {
      q: "Is there a minimum contract?",
      a: "No. Monthly cancels any time and annual saves 20%. Either way your data exports in open formats and leaves with you.",
    },
  },
  {
    category: "pricing",
    el: {
      q: "Τι γίνεται αν φύγει ένα κτήριο από το χαρτοφυλάκιό μου;",
      a: "Χρεώνεστε με βάση τα διαμερίσματα που ήταν ενεργά στην αρχή της περιόδου, όχι με βάση την κορύφωσή σας. Όταν ένα κτήριο φεύγει, φεύγει και από τον επόμενο λογαριασμό.",
    },
    en: {
      q: "What happens if a building leaves my portfolio?",
      a: "You are billed on the apartments active at the start of the period, not your peak. When a building leaves, it leaves the next invoice too.",
    },
  },
  {
    category: "setup",
    el: {
      q: "Πόσο διαρκεί η μετάπτωση;",
      a: "Τα περισσότερα χαρτοφυλάκια είναι ζωντανά μέσα σε μια εβδομάδα. Στείλτε μας ό,τι μορφή έχετε — αντιστοιχίζουμε ακίνητα, ιδιοκτήτες, μετρητές και υπόλοιπα έναρξης, και τα ελέγχετε εσείς πριν ενεργοποιηθεί οτιδήποτε.",
    },
    en: {
      q: "How long does migration take?",
      a: "Most portfolios are live within a week. Send us whatever format you have — we map units, owners, meters and opening balances, and you review it all before anything goes live.",
    },
  },
  {
    category: "setup",
    el: {
      q: "Μπορώ να εισάγω υπόλοιπα έναρξης και ιστορικό;",
      a: "Ναι. Τα υπόλοιπα έναρξης και το ιστορικό εισάγονται σημειωμένα ξεχωριστά, ώστε να ξεχωρίζουν πάντα από όσα καταχωρήθηκαν μέσα στην πλατφόρμα.",
    },
    en: {
      q: "Can I import opening balances and history?",
      a: "Yes. Opening balances and history are imported flagged separately, so they stay distinguishable from anything entered inside the platform.",
    },
  },
  {
    category: "setup",
    el: {
      q: "Χρειάζεται να εγκαταστήσουν κάτι οι ένοικοι;",
      a: "Όχι. Ανοίγουν έναν σύνδεσμο στον browser. Υπάρχει και προαιρετική εφαρμογή για iOS και Android για όσους τη θέλουν.",
    },
    en: {
      q: "Do residents need to install anything?",
      a: "No — they open a link in the browser. There is an optional iOS and Android app for those who want one.",
    },
  },
  {
    category: "compliance",
    el: {
      q: "Είναι συμβατό με τη νομοθεσία περί κοινοχρήστων;",
      a: "Ναι. Υποστηρίζει επιμερισμό με χιλιοστά, εμβαδόν, ανά στήλη και προσαρμοσμένους κανόνες. Τα ειδοποιητήρια φέρουν τις πληροφορίες που χρειάζονται για ενστάσεις και για τα πρακτικά της γενικής συνέλευσης.",
    },
    en: {
      q: "Is Orithon compliant with Greek common-expense law?",
      a: "Yes. Share-based, area, per-riser and custom allocation are all supported, and statements carry the information needed for disputes and assembly minutes.",
    },
  },
  {
    category: "compliance",
    el: {
      q: "Συνδέεται με το myDATA και τον λογιστή μου;",
      a: "Το πακέτο Pro περιλαμβάνει λογιστικές ενοποιήσεις και εξαγωγές έτοιμες για myDATA. Εξαγωγή σε CSV υπάρχει σε όλα τα πακέτα.",
    },
    en: {
      q: "Does it connect to myDATA and my accountant?",
      a: "Pro includes accounting integrations and myDATA-ready exports. CSV export is on every plan.",
    },
  },
  {
    category: "compliance",
    el: {
      q: "Πού αποθηκεύονται τα δεδομένα μας;",
      a: "Σε data centres εντός ΕΕ, κρυπτογραφημένα σε ηρεμία και κατά τη μεταφορά, με αντίγραφα ασφαλείας 30 ημερών. Είμαστε συμβατοί με τον GDPR και παρέχουμε DPA κατόπιν αιτήματος.",
    },
    en: {
      q: "Where is our data stored?",
      a: "In EU data centres, encrypted at rest and in transit, with 30-day backups. We are GDPR-compliant and provide a DPA on request.",
    },
  },
  {
    category: "operations",
    el: {
      q: "Πώς φτάνουν οι πληρωμές στον λογαριασμό του κτηρίου;",
      a: "Εξοφλούνται απευθείας στον λογαριασμό που έχει οριστεί για το κτήριο. Το Orithon δεν κρατά ποτέ χρήματα — μόνο συμφωνεί τις κινήσεις.",
    },
    en: {
      q: "How do payments reach the building account?",
      a: "They settle directly into the nominated building account. Orithon never holds funds — it only reconciles them.",
    },
  },
  {
    category: "operations",
    el: {
      q: "Τι υποστήριξη έχουμε την πρώτη μέρα;",
      a: "Καθοδηγούμενη ενεργοποίηση, κλήση ελέγχου της μετάπτωσης και απεριόριστη υποστήριξη μέσω email. Το Standard προσθέτει priority ουρά και το Pro έναν συγκεκριμένο success manager.",
    },
    en: {
      q: "What support do we get on day one?",
      a: "Guided onboarding, a migration review call and unlimited email support. Standard adds a priority queue, and Pro a named success manager.",
    },
  },
  {
    category: "operations",
    el: {
      q: "Μπορούν οι τεχνικοί να το χρησιμοποιήσουν χωρίς λογαριασμό;",
      a: "Ναι. Στέλνετε την εντολή εργασίας με σύνδεσμο· εξωτερικοί συνεργάτες ενημερώνουν κατάσταση και ανεβάζουν φωτογραφίες χωρίς να συνδεθούν πουθενά.",
    },
    en: {
      q: "Can technicians use it without an account?",
      a: "Yes — dispatch a work order by link, and external contractors update status and upload photos with no login.",
    },
  },
];

async function main() {
  for (const slug of MARKETING_PAGE_SLUGS) {
    await db.marketingPage.upsert({
      where: { slug },
      update: { data: MARKETING_PAGE_DEFAULTS[slug] as object },
      create: { slug, data: MARKETING_PAGE_DEFAULTS[slug] as object },
    });
  }
  console.log(`Marketing pages seeded: ${MARKETING_PAGE_SLUGS.join(", ")}`);

  const tierCount = await db.pricingTier.count();
  if (tierCount === 0) {
    for (const t of TIERS) {
      await db.pricingTier.create({
        data: {
          slug: t.slug,
          name: t.el.name,
          description: t.el.description,
          features: t.el.features,
          monthlyPrice: t.monthlyPrice,
          // The billing toggle derives the annual rate from the multiplier, so
          // this column is only the stored equivalent, not what the page reads.
          annualPrice: Number((t.monthlyPrice * 0.8).toFixed(2)),
          minPerBuilding: t.minPerBuilding,
          badge: t.el.badge || null,
          ctaLabel: t.el.ctaLabel,
          ctaHref: "/contact",
          highlighted: t.highlighted,
          order: t.order,
          published: true,
          i18n: {
            name: { el: t.el.name, en: t.en.name },
            description: { el: t.el.description, en: t.en.description },
            features: { el: t.el.features, en: t.en.features },
            badge: { el: t.el.badge, en: t.en.badge },
            ctaLabel: { el: t.el.ctaLabel, en: t.en.ctaLabel },
          },
        },
      });
    }
    console.log(`Created ${TIERS.length} pricing tiers.`);
  } else {
    // Fill only what is still empty, so an editor's numbers are never overwritten.
    let touched = 0;
    for (const preset of TIERS) {
      const row = await db.pricingTier.findUnique({ where: { slug: preset.slug } });
      if (!row || row.minPerBuilding != null) continue;
      await db.pricingTier.update({
        where: { id: row.id },
        data: { minPerBuilding: preset.minPerBuilding },
      });
      touched++;
    }
    console.log(
      touched > 0
        ? `Backfilled the per-building minimum on ${touched} existing tier(s).`
        : `${tierCount} pricing tier(s) already present — left untouched.`,
    );
  }

  // Keyed on the handoff categories, not on the table being empty — an install
  // seeded earlier with placeholder "general" questions should still receive the
  // designed set, and those placeholders are left alone rather than deleted.
  const seededFaqs = await db.fAQ.count({
    where: { category: { in: ["pricing", "setup", "compliance", "operations"] } },
  });
  if (seededFaqs === 0) {
    for (const [i, f] of FAQS.entries()) {
      await db.fAQ.create({
        data: {
          question: f.el.q,
          answer: f.el.a,
          category: f.category,
          order: i,
          published: true,
          i18n: {
            question: { el: f.el.q, en: f.en.q },
            answer: { el: f.el.a, en: f.en.a },
          },
        },
      });
    }
    console.log(`Created ${FAQS.length} FAQ entries.`);
  } else {
    console.log(`${seededFaqs} FAQ entries already in the handoff categories — left untouched.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
