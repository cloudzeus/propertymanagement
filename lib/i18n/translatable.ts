import type { Locale } from "@/i18n";
import { defaultLocale } from "@/i18n";

export type Translatable<T> = { el: T; en: T };

export function isTranslatable(v: unknown): v is Translatable<unknown> {
  return !!v && typeof v === "object" && "el" in (v as any) && "en" in (v as any);
}

export function makeTranslatable<T>(el: T, en?: T): Translatable<T> {
  return { el, en: en ?? el };
}

export function pickLocale<T>(value: Translatable<T> | T, locale: Locale): T {
  if (isTranslatable(value)) {
    const v = value as Translatable<T>;
    const picked = v[locale];
    if (picked === undefined || picked === null || picked === "") return v[defaultLocale];
    return picked;
  }
  return value as T;
}
