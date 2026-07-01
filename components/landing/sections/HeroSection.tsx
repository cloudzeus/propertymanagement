import Link from "next/link";
import type { HeroData } from "@/lib/cms/landing-types";

export function HeroSection({ data }: { data: HeroData }) {
  return (
    <section className="relative overflow-hidden">
      {/* Glow blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[780px] w-[1100px] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(closest-side, rgba(242,162,60,.16), rgba(91,182,214,.07) 55%, transparent)",
          filter: "blur(8px)",
        }}
      />
      <div className="mx-auto max-w-[1200px] px-5 sm:px-7 py-20 md:py-28">
        <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-[1.05fr_0.95fr]">
          {/* Copy */}
          <div>
            <span
              className="inline-flex items-center gap-2 rounded-full border bg-[var(--card)] px-3 py-1.5 text-[13px] font-semibold text-[var(--foreground)]"
              style={{ borderColor: "rgba(27,28,26,.12)" }}
            >
              <span
                className="h-[7px] w-[7px] rounded-full bg-[var(--accent)]"
                style={{ boxShadow: "0 0 10px rgba(242,162,60,.55)" }}
              />
              Νέο · Διαχείριση κτηρίων με AI
            </span>

            <h1
              className="mt-5 text-[42px] font-extrabold leading-[1.03] tracking-[-0.025em] text-[var(--foreground)] md:text-[74px]"
            >
              {data.title}
            </h1>

            <p className="mt-6 max-w-[520px] text-[19px] leading-relaxed text-[var(--muted-foreground)]">
              {data.subtitle}
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              {data.primaryCta?.label && (
                <Link
                  href={data.primaryCta.href}
                  className="inline-flex items-center justify-center rounded-[var(--radius-sm)] bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[var(--primary-foreground)] shadow-[var(--shadow-btn)] transition hover:-translate-y-px hover:brightness-[1.12]"
                >
                  {data.primaryCta.label}
                </Link>
              )}
              {data.secondaryCta?.label && (
                <Link
                  href={data.secondaryCta.href}
                  className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] border bg-[var(--card)] px-6 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:-translate-y-px hover:bg-[var(--paper)]"
                  style={{ borderColor: "rgba(27,28,26,.12)" }}
                >
                  ▷ {data.secondaryCta.label}
                </Link>
              )}
            </div>
          </div>

          {/* Visual */}
          <div className="relative flex justify-center md:justify-end">
            {/* Spinning ring */}
            <div
              aria-hidden
              className="pointer-events-none absolute -z-10 h-[430px] w-[430px] rounded-full opacity-[0.32]"
              style={{
                background:
                  "conic-gradient(var(--accent), var(--accent-2), var(--accent), var(--accent-2), var(--accent))",
                filter: "blur(2px)",
                WebkitMask: "radial-gradient(closest-side, transparent 66%, #000 67%)",
                mask: "radial-gradient(closest-side, transparent 66%, #000 67%)",
                animation: "spin 44s linear infinite",
              }}
            />
            <div
              className="relative aspect-[340/420] w-full max-w-[340px] overflow-hidden rounded-[var(--radius-xl)]"
              style={{ boxShadow: "0 44px 80px -40px rgba(27,28,26,.4)" }}
            >
              {data.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.imageUrl} alt={data.title} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-[#EFEDE2] to-[#E7F0E0]" />
              )}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(15,22,30,.04) 0%, rgba(15,22,30,.42) 100%)",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
