import { getRequestConfig } from "next-intl/server";

// Supported languages
export const locales = ["el", "en"] as const;
export const defaultLocale = "el"; // Greek as default

export type Locale = (typeof locales)[number];

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default,
  timeZone: "Europe/Athens",
  now: new Date(),
}));
