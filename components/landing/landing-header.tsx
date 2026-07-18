import { getLocale } from "next-intl/server";
import { getChromeSection } from "@/lib/cms/landing";
import { pickLocale } from "@/lib/i18n/translatable";
import type { Locale } from "@/i18n";
import type { NavData } from "@/lib/cms/landing-types";
import { LandingHeaderClient } from "./landing-header-client";

export async function LandingHeader() {
  const locale = (await getLocale()) as Locale;
  const raw = await getChromeSection("NAV");
  const nav = raw ? (pickLocale(raw as any, locale) as NavData) : null;
  return <LandingHeaderClient nav={nav} />;
}
