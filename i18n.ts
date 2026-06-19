// Supported languages
export const locales = ["el", "en"] as const;
export const defaultLocale = "el"; // Greek as default

export type Locale = (typeof locales)[number];
