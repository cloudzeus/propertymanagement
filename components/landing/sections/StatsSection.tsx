import type { StatsData } from "@/lib/cms/landing-types";
import { Reveal } from "@/components/landing/Reveal";

export function StatsSection({ data }: { data: StatsData }) {
  if (!data.items || data.items.length === 0) return null;
  return (
    <section>
      <div className="mx-auto max-w-[1200px] px-5 sm:px-7 py-[84px]">
        <Reveal stagger className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {data.items.map((s, i) => (
            <div
              key={i}
              className="rounded-2xl border bg-[var(--card)] px-6 py-[26px] shadow-[var(--shadow-card)]"
              style={{ borderColor: "rgba(27,28,26,.12)" }}
            >
              <div className="text-[42px] font-extrabold tracking-[-0.02em] text-[var(--foreground)]">
                {s.value}
              </div>
              <div className="mt-1.5 text-sm text-[var(--muted-foreground)]">{s.label}</div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
