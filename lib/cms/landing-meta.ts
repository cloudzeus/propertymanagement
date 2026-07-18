import type { IconType } from "react-icons";
import {
  RiLayoutTopLine, RiRepeatLine, RiBarChartBoxLine, RiApps2Line, RiTeamLine,
  RiListOrdered2, RiSlideshow3Line, RiPriceTag3Line, RiChatQuoteLine,
  RiMegaphoneLine, RiNewspaperLine, RiNavigationLine, RiLayoutBottomLine,
} from "react-icons/ri";

/** Human-facing metadata for each landing section type — shown in the CMS editor. */
export const LANDING_META: Record<string, { label: string; description: string; icon: IconType }> = {
  HERO: {
    label: "Hero — Κεντρική ενότητα",
    description: "Τίτλος, υπότιτλος, κουμπιά, εικόνα ή βίντεο, floating κάρτες (toast, mini dashboard).",
    icon: RiLayoutTopLine,
  },
  LOGOS: {
    label: "Marquee εμπιστοσύνης",
    description: "Κυλιόμενα ονόματα/λογότυπα πελατών κάτω από το hero.",
    icon: RiRepeatLine,
  },
  STATS: {
    label: "Στατιστικά",
    description: "4 κάρτες με αριθμούς (π.χ. 200+ κτήρια, 98% έγκαιρες πληρωμές).",
    icon: RiBarChartBoxLine,
  },
  FEATURES: {
    label: "Δυνατότητες (bento)",
    description: "Πλέγμα καρτών δυνατοτήτων με μεγάλη κάρτα, φωτογραφικό tile και εικονίδια.",
    icon: RiApps2Line,
  },
  ROLES: {
    label: "Ρόλοι (tabs)",
    description: "Διαχειριστές / Ένοικοι / Τεχνικοί — καρτέλες με σημεία ανά ρόλο.",
    icon: RiTeamLine,
  },
  HOW: {
    label: "Πώς δουλεύει",
    description: "3 αριθμημένα βήματα σε μπεζ φόντο.",
    icon: RiListOrdered2,
  },
  SHOWCASE: {
    label: "Showcase",
    description: "Μεγάλη εικόνα με floating στατιστικά + λίστα σημείων και CTA.",
    icon: RiSlideshow3Line,
  },
  PRICING: {
    label: "Τιμολόγηση",
    description: "Πακέτα τιμών — το περιεχόμενο επεξεργάζεται στη σελίδα «Τιμές».",
    icon: RiPriceTag3Line,
  },
  TESTIMONIALS: {
    label: "Μαρτυρίες",
    description: "Με 1 μαρτυρία εμφανίζεται ως μεγάλο κεντραρισμένο quote· με περισσότερες ως πλέγμα.",
    icon: RiChatQuoteLine,
  },
  CTA: {
    label: "Τελικό CTA",
    description: "Full-width κάλεσμα με εικόνα φόντου και δύο κουμπιά, πριν το footer.",
    icon: RiMegaphoneLine,
  },
  NEWS: {
    label: "Νέα / Blog",
    description: "Τελευταία άρθρα από το blog.",
    icon: RiNewspaperLine,
  },
  NAV: {
    label: "Header (μενού)",
    description: "Σύνδεσμοι μενού, κουμπί demo και κείμενα σύνδεσης — εμφανίζεται σε όλες τις δημόσιες σελίδες.",
    icon: RiNavigationLine,
  },
  FOOTER: {
    label: "Footer",
    description: "Tagline, στήλες συνδέσμων και copyright — εμφανίζεται σε όλες τις δημόσιες σελίδες.",
    icon: RiLayoutBottomLine,
  },
};

/** Chrome types are always rendered (header/footer) — the enable toggle only returns them to τα default κείμενα. */
export const CHROME_TYPES = ["NAV", "FOOTER"];
