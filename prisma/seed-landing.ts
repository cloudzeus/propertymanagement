import { db } from "@/lib/db";

const SECTIONS = [
  { type: "HERO", order: 0, enabled: true, data: {
    title: "Διαχειριστείτε τα ακίνητά σας εύκολα",
    subtitle: "Η ολοκληρωμένη πλατφόρμα για διαχειριστές ακινήτων — λιγότερο κόστος, καλύτερη εξυπηρέτηση ενοίκων.",
    primaryCta: { label: "Δωρεάν δοκιμή", href: "/register" },
    secondaryCta: { label: "Ζητήστε demo", href: "/contact" },
    imageUrl: "",
  }},
  { type: "LOGOS", order: 1, enabled: false, data: { heading: "Μας εμπιστεύονται", items: [] } },
  { type: "FEATURES", order: 2, enabled: true, data: {
    heading: "Δυνατότητες",
    items: [
      { icon: "RiBuildingLine", title: "Διαχείριση ακινήτων", body: "Διαχειριστείτε πολλά ακίνητα και μονάδες από ένα dashboard." },
      { icon: "RiToolsLine", title: "Παρακολούθηση συντήρησης", body: "Αιτήματα συντήρησης με real-time παρακολούθηση και προγραμματισμό." },
      { icon: "RiMoneyEuroCircleLine", title: "Χρεώσεις & πληρωμές", body: "Αυτόματες χρεώσεις, είσπραξη και οικονομικές αναφορές." },
      { icon: "RiMegaphoneLine", title: "Ανακοινώσεις", body: "Μοιραστείτε ενημερώσεις και ψηφιακή σήμανση με τους ενοίκους." },
      { icon: "RiShieldUserLine", title: "Ρόλοι & δικαιώματα", body: "Διαφορετικοί τύποι ρόλων με παραμετροποιήσιμα δικαιώματα." },
      { icon: "RiGlobalLine", title: "Πολυγλωσσικό", body: "Πλήρης υποστήριξη Ελληνικών και Αγγλικών." },
    ],
  }},
  { type: "PRICING", order: 3, enabled: true, data: { heading: "Τιμολόγηση", subtitle: "Διαφανή πλάνα για κάθε μέγεθος." } },
  { type: "TESTIMONIALS", order: 4, enabled: false, data: { heading: "Τι λένε οι πελάτες μας", items: [] } },
  { type: "CTA", order: 5, enabled: true, data: {
    heading: "Έτοιμοι να αναβαθμίσετε τη διαχείριση των ακινήτων σας;",
    body: "Εκατοντάδες διαχειριστές εμπιστεύονται την πλατφόρμα μας.",
    cta: { label: "Ξεκινήστε τη δωρεάν δοκιμή", href: "/register" },
  }},
];

async function main() {
  for (const s of SECTIONS) {
    await db.landingSection.upsert({ where: { type: s.type }, update: {}, create: s });
  }
  const count = await db.landingSection.count();
  console.log(`Landing sections seeded. Total rows: ${count}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
