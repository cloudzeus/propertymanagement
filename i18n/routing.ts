import { defineRouting } from "next-intl/routing";
import { locales, defaultLocale } from "@/i18n";

export const routing = defineRouting({
  locales: [...locales],
  defaultLocale,
  localePrefix: "as-needed",
});
