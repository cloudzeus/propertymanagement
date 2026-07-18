import type { FeaturesData } from "@/lib/cms/landing-types";
import { resolveIcon } from "@/lib/cms/icon-registry";
import { Reveal } from "@/components/landing/Reveal";

const BARS = ["46%", "62%", "54%", "72%", "64%", "84%", "70%", "92%", "80%"];
const BORDER = { borderColor: "rgba(27,28,26,.12)" };

export function FeaturesSection({ data }: { data: FeaturesData }) {
  const items = data.items ?? [];
  const tile = data.imageTile;
  return (
    <section id="features">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-7 py-[84px] md:py-[108px]">
        <Reveal className="mb-12 max-w-[620px]">
          {data.kicker && (
            <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              {data.kicker}
            </span>
          )}
          <h2 className="mt-3.5 text-[32px] font-extrabold leading-[1.05] tracking-[-0.02em] text-[var(--foreground)] md:text-[46px]">
            {data.heading}
          </h2>
          {data.subtitle && (
            <p className="mt-4 text-[17px] leading-relaxed text-[var(--muted-foreground)]">{data.subtitle}</p>
          )}
        </Reveal>

        <Reveal stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:[grid-auto-rows:minmax(180px,auto)]">
          {items.map((item, i) => {
            const Icon = resolveIcon(item.icon);
            const big = i === 0;
            return (
              <div
                key={i}
                className={`flex flex-col rounded-[18px] border bg-[var(--card)] p-[26px] shadow-[var(--shadow-card)] ${
                  big ? "sm:col-span-2" : ""
                }`}
                style={BORDER}
              >
                <div className="mb-auto flex h-[42px] w-[42px] items-center justify-center rounded-full bg-[var(--primary)]">
                  <Icon className="h-[19px] w-[19px]" style={{ color: "#fff" }} />
                </div>
                <h3 className={`mb-2 mt-[18px] font-bold tracking-[-0.01em] text-[var(--foreground)] ${big ? "text-[24px]" : "text-[18.5px]"}`}>
                  {item.title}
                </h3>
                <p className="text-[14.5px] leading-relaxed text-[var(--muted-foreground)]">{item.body}</p>
                {big && (
                  <div className="mt-[18px] flex h-[54px] items-end gap-[7px]">
                    {BARS.map((h, j) => (
                      <i
                        key={j}
                        className="flex-1 rounded-t-[3px]"
                        style={{ height: h, background: j >= 7 ? "var(--accent)" : "rgba(27,28,26,.10)" }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Photo tile — spans two rows in the right column on desktop */}
          {tile && (tile.imageUrl || tile.title) && (
            <div
              className="relative min-h-[240px] overflow-hidden rounded-[18px] border shadow-[var(--shadow-card)] sm:col-span-2 md:col-start-3 md:row-start-1 md:row-span-2 md:col-span-1 md:min-h-[376px]"
              style={BORDER}
            >
              {tile.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tile.imageUrl} alt={tile.title ?? ""} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#EFEDE2] to-[#E7F0E0]" />
              )}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{ background: "linear-gradient(180deg,rgba(15,22,30,.02),rgba(15,22,30,.5))" }}
              />
              {(tile.title || tile.subtitle) && (
                <div
                  className="absolute inset-x-4 bottom-4 rounded-[13px] border bg-[var(--card)] px-3.5 py-3"
                  style={BORDER}
                >
                  {tile.title && <div className="text-[13.5px] font-bold text-[var(--foreground)]">{tile.title}</div>}
                  {tile.subtitle && (
                    <div className="mt-0.5 text-[11.5px] text-[var(--muted-foreground)]">{tile.subtitle}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}
