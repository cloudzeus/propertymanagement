import type { FeaturesData } from "@/lib/cms/landing-types";
import { resolveIcon } from "@/lib/cms/icon-registry";
import { Reveal } from "@/components/landing/Reveal";

export function FeaturesSection({ data }: { data: FeaturesData }) {
  const items = data.items ?? [];
  return (
    <section>
      <div className="mx-auto max-w-[1200px] px-5 sm:px-7 py-[84px]">
        {data.heading && (
          <Reveal>
            <h2 className="mb-3 text-center text-[32px] font-extrabold tracking-[-0.02em] text-[var(--foreground)] md:text-[46px]">
              {data.heading}
            </h2>
          </Reveal>
        )}
        <Reveal stagger className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {items.map((item, i) => {
            const Icon = resolveIcon(item.icon);
            // First tile spans two columns for a bento feel.
            const wide = i === 0;
            return (
              <div
                key={i}
                className={`rounded-[var(--radius-lg)] border bg-[var(--card)] p-[26px] shadow-[var(--shadow-card)] ${
                  wide ? "sm:col-span-2" : ""
                }`}
                style={{ borderColor: "rgba(27,28,26,.12)" }}
              >
                <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-[var(--primary)]">
                  <Icon className="h-[19px] w-[19px]" style={{ color: "#fff" }} />
                </div>
                <h3
                  className={`mt-5 font-bold text-[var(--foreground)] ${
                    wide ? "text-[24px]" : "text-[18.5px]"
                  }`}
                >
                  {item.title}
                </h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--muted-foreground)]">
                  {item.body}
                </p>
              </div>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
