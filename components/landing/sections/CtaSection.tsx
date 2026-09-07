import Link from "next/link";
import type { CtaData } from "@/lib/cms/landing-types";
import { Reveal } from "@/components/landing/Reveal";
import { Grain } from "@/components/site/kit";

export function CtaSection({ data }: { data: CtaData }) {
  return (
    <section id="cta" className="relative overflow-hidden py-[84px] text-center md:py-32">
      {/*
        Full-bleed photo under a near-opaque cream veil (handoff 01 §5.6) — the
        odd scrim out, because dark text sits on top of the photo.
        No negative z-index: the section has no z-index of its own, so `-z-10`
        escaped to the root stacking context and painted behind the page
        background, hiding the photo entirely.
      */}
      <div aria-hidden className="absolute inset-0">
        {data.imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.imageUrl} alt="" className="h-full w-full object-cover" />
            <div className="scrim-cream" />
          </>
        ) : (
          <div
            className="h-full w-full"
            style={{ background: "radial-gradient(80% 120% at 50% 0%, rgba(242,162,60,.14), transparent 60%)" }}
          />
        )}
      </div>
      <Grain />

      <Reveal className="relative mx-auto max-w-[1200px] px-5 sm:px-7">
        <h2 className="mx-auto max-w-[680px] text-[length:var(--fs-32)] font-extrabold leading-[1.05] tracking-[-0.02em] text-[var(--foreground)] md:text-[length:var(--fs-54)]">
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
              className="inline-flex items-center justify-center rounded-[var(--radius-sm)] bg-[var(--primary)] px-7 py-3.5 text-[length:var(--fs-15)] font-bold text-[var(--primary-foreground)] shadow-[var(--shadow-btn)] transition hover:-translate-y-0.5 hover:brightness-[1.18]"
            >
              {data.cta.label}
            </Link>
          )}
          {data.secondaryCta?.label && (
            <Link
              href={data.secondaryCta.href}
              className="inline-flex items-center justify-center rounded-[var(--radius-sm)] border bg-[var(--card)] px-7 py-3.5 text-[length:var(--fs-15)] font-semibold text-[var(--foreground)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_-16px_rgba(27,28,26,.3)]"
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
