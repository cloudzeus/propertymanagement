import createMiddleware from "next-intl/middleware";
import { defaultLocale, locales } from "./i18n";

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "as-needed", // Only add prefix if not default locale
});

export const config = {
  matcher: [
    "/((?!api|_next|.*\\..*).*)", // Match all paths except api, _next, and static files
  ],
};
