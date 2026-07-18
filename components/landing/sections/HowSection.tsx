import type { HowData } from "@/lib/cms/landing-types";
import { Reveal } from "@/components/landing/Reveal";

export function HowSection({ data }: { data: HowData }) {
  const steps = data.steps ?? [];
  if (steps.length === 0) return null;
  return (
    <section id="how" style={{ background: "var(--section-alt)" }}>
      <div className="mx-auto max-w-[1200px] px-5 sm:px-7 py-[84px] md:py-[108px]">
        <Reveal className="mb-12 max-w-[620px]">
          {data.kicker && (
            <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#8a8a7e]">{data.kicker}</span>
          )}
          <h2 className="mt-3.5 text-[32px] font-extrabold leading-[1.05] tracking-[-0.02em] text-[var(--foreground)] md:text-[46px]">
            {data.heading}
          </h2>
          {data.subtitle && (
            <p className="mt-4 text-[17px] leading-relaxed text-[#5b5c58]">{data.subtitle}</p>
          )}
        </Reveal>

        <Reveal stagger className="relative grid grid-cols-1 gap-5 md:grid-cols-3">
          <div
            aria-hidden
            className="absolute left-[8%] right-[8%] top-12 hidden h-px md:block"
            style={{ background: "rgba(27,28,26,.10)" }}
          />
          {steps.map((s, i) => (
            <div
              key={i}
              className="relative rounded-[18px] border bg-white p-7"
              style={{ borderColor: "rgba(27,28,26,.10)", boxShadow: "0 20px 44px -34px rgba(27,28,26,.28)" }}
            >
              <div className="text-[40px] font-extrabold leading-none tracking-[-0.02em] text-[var(--accent)]">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="mb-2 mt-4 text-[19px] font-bold text-[var(--foreground)]">{s.title}</div>
              <div className="text-[14.5px] leading-relaxed text-[#5b5c58]">{s.body}</div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
