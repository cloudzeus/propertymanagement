import { db } from "@/lib/db";
import { Prisma } from "@/lib/prisma/client";

// ── 1. PageSeo copy (slug → {el, en}) ──────────────────────────────────────
const PAGE_SEO: Record<string, { el: { title: string; description: string }; en: { title: string; description: string } }> = {
  pricing: {
    el: { title: "Τιμές — PropertyPro", description: "Διαφανή πλάνα συνδρομής για διαχειριστές πολυκατοικιών και ακινήτων. Επιλέξτε το πακέτο που ταιριάζει στις ανάγκες σας, χωρίς κρυφές χρεώσεις." },
    en: { title: "Pricing — PropertyPro", description: "Transparent subscription plans for building and property managers. Choose the package that fits your needs, with no hidden fees." },
  },
  services: {
    el: { title: "Υπηρεσίες — PropertyPro", description: "Ολοκληρωμένες υπηρεσίες διαχείρισης κοινοχρήστων, ακινήτων και κατοίκων σε μία πλατφόρμα." },
    en: { title: "Services — PropertyPro", description: "End-to-end services for managing common expenses, properties and residents in a single platform." },
  },
  faq: {
    el: { title: "Συχνές Ερωτήσεις — PropertyPro", description: "Απαντήσεις στις πιο συχνές ερωτήσεις για τη χρέωση, τις γλώσσες και την έναρξη με το PropertyPro." },
    en: { title: "FAQ — PropertyPro", description: "Answers to the most common questions about billing, languages and getting started with PropertyPro." },
  },
  contact: {
    el: { title: "Επικοινωνία — PropertyPro", description: "Επικοινωνήστε με την ομάδα του PropertyPro για ερωτήσεις, υποστήριξη ή μια επίδειξη της πλατφόρμας." },
    en: { title: "Contact — PropertyPro", description: "Get in touch with the PropertyPro team for questions, support or a platform demo." },
  },
  privacy: {
    el: { title: "Πολιτική Απορρήτου — PropertyPro", description: "Πώς συλλέγουμε, χρησιμοποιούμε και προστατεύουμε τα προσωπικά σας δεδομένα στο PropertyPro." },
    en: { title: "Privacy Policy — PropertyPro", description: "How we collect, use and protect your personal data on PropertyPro." },
  },
  terms: {
    el: { title: "Όροι Χρήσης — PropertyPro", description: "Οι όροι και προϋποθέσεις που διέπουν τη χρήση της πλατφόρμας PropertyPro." },
    en: { title: "Terms of Service — PropertyPro", description: "The terms and conditions that govern your use of the PropertyPro platform." },
  },
  "cookie-policy": {
    el: { title: "Πολιτική Cookies — PropertyPro", description: "Πληροφορίες για τα cookies που χρησιμοποιεί το PropertyPro και πώς να διαχειριστείτε τις προτιμήσεις σας." },
    en: { title: "Cookie Policy — PropertyPro", description: "Information about the cookies PropertyPro uses and how to manage your preferences." },
  },
};

// ── 2. CMSPage prose (slug → {title/body per locale}) ──────────────────────
const CMS_PAGES: Record<string, { title: { el: string; en: string }; body: { el: string; en: string } }> = {
  privacy: {
    title: { el: "Πολιτική Απορρήτου", en: "Privacy Policy" },
    body: {
      el: `## Πολιτική Απορρήτου

Η προστασία των προσωπικών σας δεδομένων αποτελεί προτεραιότητα για το PropertyPro. Η παρούσα πολιτική περιγράφει ποια δεδομένα συλλέγουμε και πώς τα χρησιμοποιούμε.

Συλλέγουμε μόνο τα δεδομένα που είναι απαραίτητα για την παροχή των υπηρεσιών διαχείρισης ακινήτων, όπως στοιχεία επικοινωνίας, στοιχεία κατοίκων και δεδομένα χρέωσης κοινοχρήστων.

Δεν πωλούμε τα δεδομένα σας σε τρίτους. Έχετε δικαίωμα πρόσβασης, διόρθωσης και διαγραφής των προσωπικών σας δεδομένων ανά πάσα στιγμή, σύμφωνα με τον Γενικό Κανονισμό Προστασίας Δεδομένων (GDPR).

Για οποιοδήποτε αίτημα σχετικά με τα δεδομένα σας, επικοινωνήστε μαζί μας.`,
      en: `## Privacy Policy

Protecting your personal data is a priority for PropertyPro. This policy describes what data we collect and how we use it.

We only collect the data necessary to provide our property management services, such as contact details, resident information and common-expense billing data.

We do not sell your data to third parties. You have the right to access, correct and delete your personal data at any time, in accordance with the General Data Protection Regulation (GDPR).

For any request regarding your data, please contact us.`,
    },
  },
  terms: {
    title: { el: "Όροι Χρήσης", en: "Terms of Service" },
    body: {
      el: `## Όροι Χρήσης

Καλώς ήρθατε στο PropertyPro. Με τη χρήση της πλατφόρμας μας αποδέχεστε τους παρακάτω όρους.

Η πλατφόρμα παρέχεται «ως έχει» για τη διαχείριση ακινήτων, κοινοχρήστων και κατοίκων. Είστε υπεύθυνοι για την ακρίβεια των στοιχείων που καταχωρείτε και για τη φύλαξη των κωδικών πρόσβασής σας.

Διατηρούμε το δικαίωμα να τροποποιήσουμε ή να διακόψουμε υπηρεσίες, ενημερώνοντας έγκαιρα τους χρήστες. Η συνεχιζόμενη χρήση μετά από αλλαγές συνιστά αποδοχή των ανανεωμένων όρων.`,
      en: `## Terms of Service

Welcome to PropertyPro. By using our platform you accept the following terms.

The platform is provided "as is" for managing properties, common expenses and residents. You are responsible for the accuracy of the information you enter and for safeguarding your access credentials.

We reserve the right to modify or discontinue services with timely notice to users. Continued use after changes constitutes acceptance of the updated terms.`,
    },
  },
  "cookie-policy": {
    title: { el: "Πολιτική Cookies", en: "Cookie Policy" },
    body: {
      el: `## Πολιτική Cookies

Το PropertyPro χρησιμοποιεί cookies για να βελτιώσει την εμπειρία σας και να διασφαλίσει τη σωστή λειτουργία της πλατφόρμας.

Χρησιμοποιούμε απαραίτητα cookies για τη σύνδεση και την ασφάλεια, καθώς και προαιρετικά cookies ανάλυσης για να κατανοήσουμε πώς χρησιμοποιείται ο ιστότοπος.

Μπορείτε να διαχειριστείτε ή να απορρίψετε τα προαιρετικά cookies ανά πάσα στιγμή μέσω των ρυθμίσεων συγκατάθεσης.`,
      en: `## Cookie Policy

PropertyPro uses cookies to improve your experience and ensure the platform works correctly.

We use essential cookies for login and security, as well as optional analytics cookies to understand how the site is used.

You can manage or reject optional cookies at any time through the consent settings.`,
    },
  },
  contact: {
    title: { el: "Επικοινωνία", en: "Get in Touch" },
    body: {
      el: `## Επικοινωνήστε μαζί μας

Έχετε ερωτήσεις ή θέλετε μια επίδειξη του PropertyPro; Η ομάδα μας είναι εδώ για να βοηθήσει.

Συμπληρώστε τη φόρμα επικοινωνίας και θα σας απαντήσουμε το συντομότερο δυνατό. Είτε είστε διαχειριστής πολυκατοικίας είτε ιδιοκτήτης ακινήτου, θα βρούμε μαζί τη λύση που ταιριάζει στις ανάγκες σας.`,
      en: `## Get in Touch

Have questions or want a demo of PropertyPro? Our team is here to help.

Fill in the contact form and we will get back to you as soon as possible. Whether you are a building manager or a property owner, we will find the solution that fits your needs together.`,
    },
  },
  services: {
    title: { el: "Υπηρεσίες", en: "Services" },
    body: {
      el: `## Οι Υπηρεσίες μας

Το PropertyPro προσφέρει μια ολοκληρωμένη πλατφόρμα για τη διαχείριση πολυκατοικιών και ακινήτων.

- **Διαχείριση κοινοχρήστων** με αυτόματο υπολογισμό χιλιοστών και έκδοση ειδοποιητηρίων.
- **Διαχείριση κατοίκων και ιδιοκτητών** με προσωπικούς λογαριασμούς και αυτοεξυπηρέτηση.
- **Online πληρωμές** μέσω ασφαλών παρόχων, με αυτόματη ενημέρωση υπολοίπων.
- **Αναφορές και διαφάνεια** για κάθε δαπάνη και είσπραξη.

Όλα όσα χρειάζεστε για αποδοτική και διαφανή διαχείριση, σε ένα μέρος.`,
      en: `## Our Services

PropertyPro offers an all-in-one platform for managing buildings and properties.

- **Common-expense management** with automatic millième calculation and notice issuing.
- **Resident and owner management** with personal accounts and self-service.
- **Online payments** via secure providers, with automatic balance updates.
- **Reporting and transparency** for every expense and collection.

Everything you need for efficient and transparent management, in one place.`,
    },
  },
};

// ── 4. Sample FAQs ─────────────────────────────────────────────────────────
const SAMPLE_FAQS = [
  {
    order: 0,
    q: { el: "Πώς λειτουργεί η χρέωση;", en: "How does billing work?" },
    a: {
      el: "Πληρώνετε μια μηνιαία ή ετήσια συνδρομή ανάλογα με το πλάνο που επιλέγετε. Δεν υπάρχουν κρυφές χρεώσεις και μπορείτε να αλλάξετε ή να ακυρώσετε το πλάνο σας ανά πάσα στιγμή.",
      en: "You pay a monthly or annual subscription depending on the plan you choose. There are no hidden fees and you can change or cancel your plan at any time.",
    },
  },
  {
    order: 1,
    q: { el: "Σε ποιες γλώσσες είναι διαθέσιμη η πλατφόρμα;", en: "Which languages does the platform support?" },
    a: {
      el: "Το PropertyPro είναι πλήρως διαθέσιμο στα Ελληνικά και στα Αγγλικά. Μπορείτε να αλλάξετε γλώσσα ανά πάσα στιγμή από τις ρυθμίσεις σας.",
      en: "PropertyPro is fully available in Greek and English. You can switch language at any time from your settings.",
    },
  },
  {
    order: 2,
    q: { el: "Πώς ξεκινάω;", en: "How do I get started?" },
    a: {
      el: "Δημιουργήστε έναν λογαριασμό, προσθέστε το πρώτο σας κτίριο με τον οδηγό εγκατάστασης και ξεκινήστε να διαχειρίζεστε κοινόχρηστα μέσα σε λίγα λεπτά.",
      en: "Create an account, add your first building with the setup wizard, and start managing common expenses within minutes.",
    },
  },
];

async function main() {
  // 1. PageSeo
  for (const [slug, copy] of Object.entries(PAGE_SEO)) {
    const seo = {
      el: { ...copy.el, ogImage: "" },
      en: { ...copy.en, ogImage: "" },
    };
    await db.pageSeo.upsert({ where: { slug }, update: { seo }, create: { slug, seo } });
  }
  console.log(`PageSeo: upserted ${Object.keys(PAGE_SEO).length} rows.`);

  // 2. CMSPage (create-only on conflict — preserve admin edits)
  let cmsCreated = 0;
  for (const [slug, page] of Object.entries(CMS_PAGES)) {
    const res = await db.cMSPage.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        title: page.title.el,
        content: page.body.el,
        status: "PUBLISHED",
        publishedAt: new Date(),
        i18n: { title: page.title, body: page.body },
      },
    });
    if (res.title === page.title.el && res.content === page.body.el) cmsCreated++;
  }
  console.log(`CMSPage: upserted ${Object.keys(CMS_PAGES).length} rows (create-only on conflict).`);

  // 3. Backfill PricingTier.i18n where null
  const tiers = await db.pricingTier.findMany({ where: { i18n: { equals: Prisma.DbNull } } });
  let tiersBackfilled = 0;
  for (const t of tiers) {
    await db.pricingTier.update({
      where: { id: t.id },
      data: {
        i18n: {
          name: { el: t.name, en: t.name },
          description: { el: t.description ?? "", en: t.description ?? "" },
          features: { el: t.features, en: t.features },
        },
      },
    });
    tiersBackfilled++;
  }
  console.log(`PricingTier: backfilled i18n on ${tiersBackfilled} rows.`);

  // 4. FAQ
  const faqCount = await db.fAQ.count();
  if (faqCount === 0) {
    for (const f of SAMPLE_FAQS) {
      await db.fAQ.create({
        data: {
          question: f.q.el,
          answer: f.a.el,
          category: "general",
          order: f.order,
          published: true,
          i18n: { question: f.q, answer: f.a },
        },
      });
    }
    console.log(`FAQ: inserted ${SAMPLE_FAQS.length} sample rows.`);
  } else {
    const faqs = await db.fAQ.findMany({ where: { i18n: { equals: Prisma.DbNull } } });
    for (const f of faqs) {
      await db.fAQ.update({
        where: { id: f.id },
        data: { i18n: { question: { el: f.question, en: f.question }, answer: { el: f.answer, en: f.answer } } },
      });
    }
    console.log(`FAQ: ${faqCount} existing rows; backfilled i18n on ${faqs.length} rows.`);
  }

  console.log("seed-pages complete.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
