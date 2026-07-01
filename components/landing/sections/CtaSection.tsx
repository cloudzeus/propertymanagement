import Link from "next/link";
import type { CtaData } from "@/lib/cms/landing-types";

export function CtaSection({ data }: { data: CtaData }) {
  return (
    <section>
      <div className="mx-auto max-w-[1200px] px-5 sm:px-7 py-[84px]">
        <div
          className="relative overflow-hidden rounded-[var(--radius-xl)] border bg-[var(--card)] px-8 py-16 text-center shadow-[var(--shadow-card)]"
          style={{ borderColor: "rgba(27,28,26,.12)" }}
        >
          {/* Soft brand glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-0"
            style={{
              background:
                "radial-gradient(80% 120% at 50% 0%, rgba(242,162,60,.14), transparent 60%)",
            }}
          />
          <div className="relative">
            <h2 className="text-[32px] font-extrabold tracking-[-0.02em] text-[var(--foreground)] md:text-[54px]">
              {data.heading}
            </h2>
            {data.body && (
              <p className="mx-auto mt-4 max-w-2xl text-[19px] leading-relaxed text-[var(--muted-foreground)]">
                {data.body}
              </p>
            )}
            {data.cta?.label && (
              <Link
                href={data.cta.href}
                className="mt-8 inline-flex items-center justify-center rounded-[var(--radius-sm)] bg-[var(--primary)] px-7 py-3 text-sm font-semibold text-[var(--primary-foreground)] shadow-[var(--shadow-btn)] transition hover:-translate-y-px hover:brightness-[1.12]"
              >
                {data.cta.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
