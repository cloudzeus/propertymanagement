import Link from "next/link";
import type { ShowcaseData } from "@/lib/cms/landing-types";
import { Reveal } from "@/components/landing/Reveal";

export function ShowcaseSection({ data }: { data: ShowcaseData }) {
  return (
    <section>
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-8 px-5 py-[84px] sm:px-7 md:grid-cols-[1.05fr_0.95fr] md:gap-[54px] md:py-[108px]">
        {/* Media with floating stats */}
        <Reveal className="relative h-[380px] md:h-[440px]">
          <div
            className="absolute inset-0 overflow-hidden rounded-[22px] border"
            style={{ borderColor: "rgba(27,28,26,.12)", boxShadow: "0 44px 90px -44px rgba(27,28,26,.4)" }}
          >
            {data.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.imageUrl} alt={data.heading} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-[#EFEDE2] to-[#E7F0E0]" />
            )}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ background: "linear-gradient(120deg,rgba(15,22,30,.18),rgba(15,22,30,.02))" }}
            />
          </div>
          {data.stat1?.value && (
            <div
              className="absolute left-0 top-10 w-[200px] rounded-2xl border bg-[var(--card)] px-[18px] py-4 shadow-[var(--shadow-card)] md:-left-[22px]"
              style={{ borderColor: "rgba(27,28,26,.12)" }}
            >
              <div className="text-[30px] font-extrabold text-[var(--foreground)]">{data.stat1.value}</div>
              <div className="text-[12.5px] text-[var(--muted-foreground)]">{data.stat1.label}</div>
            </div>
          )}
          {data.stat2?.value && (
            <div
              className="absolute bottom-12 right-0 w-[200px] rounded-2xl border bg-[var(--card)] px-[18px] py-4 shadow-[var(--shadow-card)] md:-right-[18px]"
              style={{ borderColor: "rgba(27,28,26,.12)" }}
            >
              <div className="text-[30px] font-extrabold text-[var(--foreground)]">{data.stat2.value}</div>
              <div className="text-[12.5px] text-[var(--muted-foreground)]">{data.stat2.label}</div>
            </div>
          )}
        </Reveal>

        {/* Copy */}
        <Reveal>
          {data.kicker && (
            <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              {data.kicker}
            </span>
          )}
          <h2 className="mb-2.5 mt-3.5 text-[32px] font-extrabold leading-[1.05] tracking-[-0.02em] text-[var(--foreground)] md:text-[46px]">
            {data.heading}
          </h2>
          {data.subtitle && (
            <p className="mb-3.5 text-[17px] leading-relaxed text-[var(--muted-foreground)]">{data.subtitle}</p>
          )}
          {(data.points ?? []).map((p, i) => (
            <div
              key={i}
              className="flex items-start gap-3.5 border-t py-3.5"
              style={{ borderColor: "rgba(27,28,26,.07)" }}
            >
              <div className="mt-0.5 h-[22px] w-[22px] flex-none rounded-[7px] bg-[var(--accent)]" />
              <div className="text-[15.5px] text-[var(--foreground)]">
                {p.title}
                {p.body && <span className="mt-0.5 block text-[13.5px] text-[var(--muted-foreground)]">{p.body}</span>}
              </div>
            </div>
          ))}
          {data.cta?.label && (
            <Link
              href={data.cta.href || "/register"}
              className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-sm)] border bg-[var(--card)] px-6 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_-16px_rgba(27,28,26,.3)]"
              style={{ borderColor: "rgba(27,28,26,.12)" }}
            >
              {data.cta.label}
            </Link>
          )}
        </Reveal>
      </div>
    </section>
  );
}
