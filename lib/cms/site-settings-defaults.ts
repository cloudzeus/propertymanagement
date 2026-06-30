import { makeTranslatable, type Translatable } from "@/lib/i18n/translatable";

export interface ConsentCategory { key: string; required: boolean; label: Translatable<string>; description: Translatable<string>; }
export interface ConsentConfig { title: Translatable<string>; body: Translatable<string>; policyLink: string; categories: ConsentCategory[]; }

export const DEFAULT_CONSENT_CONFIG: ConsentConfig = {
  title: makeTranslatable("Χρησιμοποιούμε cookies", "We use cookies"),
  body: makeTranslatable("Χρησιμοποιούμε cookies για να βελτιώσουμε την εμπειρία σας.", "We use cookies to improve your experience."),
  policyLink: "/cookie-policy",
  categories: [
    { key: "essential", required: true, label: makeTranslatable("Απαραίτητα", "Essential"), description: makeTranslatable("Αναγκαία για τη λειτουργία.", "Required for the site to work.") },
    { key: "analytics", required: false, label: makeTranslatable("Στατιστικά", "Analytics"), description: makeTranslatable("Μας βοηθούν να βελτιωνόμαστε.", "Help us improve.") },
    { key: "marketing", required: false, label: makeTranslatable("Marketing", "Marketing"), description: makeTranslatable("Εξατομικευμένες διαφημίσεις.", "Personalised ads.") },
  ],
};
