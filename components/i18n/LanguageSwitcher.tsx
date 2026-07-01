"use client";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LABELS: Record<string, string> = { el: "ΕΛ", en: "EN" };

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-full border p-0.5 text-xs"
      style={{ borderColor: "rgba(27,28,26,.12)" }}
    >
      {routing.locales.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            onClick={() => router.replace(pathname, { locale: l })}
            aria-pressed={active}
            className={
              active
                ? "rounded-full bg-[var(--primary)] px-3 py-1 font-bold text-[var(--primary-foreground)]"
                : "rounded-full px-3 py-1 font-semibold text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            }
          >
            {LABELS[l] ?? l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
