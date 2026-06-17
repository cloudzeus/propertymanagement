"use client";

import { useRouter, usePathname } from "next/navigation";
import { locales, type Locale, defaultLocale } from "@/i18n";
import { useLocale } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const languageNames: Record<Locale, string> = {
  el: "Ελληνικά",
  en: "English",
};

export function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  function handleLanguageChange(newLocale: string) {
    // Remove the current locale from the pathname
    const pathWithoutLocale = pathname.replace(new RegExp(`^/${locale}`), "") || "/";

    // Build the new path
    const newPath =
      newLocale === defaultLocale
        ? pathWithoutLocale
        : `/${newLocale}${pathWithoutLocale}`;

    router.push(newPath);
  }

  return (
    <Select value={locale} onValueChange={handleLanguageChange}>
      <SelectTrigger className="w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {locales.map((loc) => (
          <SelectItem key={loc} value={loc}>
            {languageNames[loc]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
