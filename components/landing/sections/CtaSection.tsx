import Link from "next/link";
import type { CtaData } from "@/lib/cms/landing-types";
import { Reveal } from "@/components/landing/Reveal";

export function CtaSection({ data }: { data: CtaData }) {
  return (
    <section id="cta" className="relative overflow-hidden py-[84px] text-center md:py-32">
      {/* Full-bleed background image behind a light cream scrim */}
      <div aria-hidden className="absolute inset-0 -z-10">
        {data.imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.imageUrl} alt="" className="h-full w-full object-cover" />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(180deg,rgba(244,242,234,.84),rgba(244,242,234,.93))" }}
            />
          </>
        ) : (
          <div
            className="h-full w-full"
            style={{ background: "radial-gradient(80% 120% at 50% 0%, rgba(242,162,60,.14), transparent 60%)" }}
          />
        )}
      </div>

      <Reveal className="relative mx-auto max-w-[1200px] px-5 sm:px-7">
        <h2 className="mx-auto max-w-[680px] text-[32px] font-extrabold leading-[1.05] tracking-[-0.02em] text-[var(--foreground)] md:text-[54px]">
          {data.heading}
        </h2>
        {data.body && (
          <p className="mx-auto mb-8 mt-5 max-w-[480px] text-lg leading-relaxed text-[var(--muted-foreground)]">
            {data.body}
          </p>
        )}
        <div className="flex flex-col items-center justify-center gap-3.5 sm:flex-row">
          {data.cta?.label && (
            <Link
              href={data.cta.href}
              className="inline-flex items-center justify-center rounded-[var(--radius-sm)] bg-[var(--primary)] px-7 py-3.5 text-[15px] font-bold text-[var(--primary-foreground)] shadow-[var(--shadow-btn)] transition hover:-translate-y-0.5 hover:brightness-[1.18]"
            >
              {data.cta.label}
            </Link>
          )}
          {data.secondaryCta?.label && (
            <Link
              href={data.secondaryCta.href}
              className="inline-flex items-center justify-center rounded-[var(--radius-sm)] border bg-[var(--card)] px-7 py-3.5 text-[15px] font-semibold text-[var(--foreground)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_-16px_rgba(27,28,26,.3)]"
              style={{ borderColor: "rgba(27,28,26,.12)" }}
            >
              {data.secondaryCta.label}
            </Link>
          )}
        </div>
      </Reveal>
    </section>
  );
}
