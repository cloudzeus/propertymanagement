import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import { loadMessages } from "@/lib/i18n/messages";
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as any)) locale = routing.defaultLocale;
  return { locale, messages: await loadMessages(locale as "el" | "en") };
});
