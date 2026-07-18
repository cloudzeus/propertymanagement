import type { TestimonialsData, TestimonialItem } from "@/lib/cms/landing-types";
import { Reveal } from "@/components/landing/Reveal";

const BORDER = { borderColor: "rgba(27,28,26,.12)" };

function Avatar({ item }: { item: TestimonialItem }) {
  return item.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.avatarUrl} alt={item.author} className="h-[46px] w-[46px] rounded-full object-cover" />
  ) : (
    <span
      className="h-[46px] w-[46px] rounded-full"
      style={{ background: "linear-gradient(135deg,#c9c4b6,#9aa39a)" }}
    />
  );
}

export function TestimonialsSection({ data }: { data: TestimonialsData }) {
  if (!data.items || data.items.length === 0) return null;

  // Single testimonial → the design's large centred quote card.
  if (data.items.length === 1) {
    const item = data.items[0];
    return (
      <section>
        <div className="mx-auto max-w-[1200px] px-5 sm:px-7 pb-[84px]">
          <Reveal>
            <figure
              className="rounded-[24px] border bg-[var(--card)] px-7 py-12 text-center shadow-[var(--shadow-card)] md:px-14 md:py-[54px]"
              style={BORDER}
            >
              <div
                aria-hidden
                className="h-[42px] text-[90px] leading-[0.5] text-[var(--accent)]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                &ldquo;
              </div>
              <blockquote className="mx-auto mt-[22px] max-w-[760px] text-[23px] font-medium leading-[1.42] tracking-[-0.01em] text-[var(--foreground)] md:text-[28px]">
                {item.quote}
              </blockquote>
              <figcaption className="mt-[30px] flex items-center justify-center gap-3.5">
                <Avatar item={item} />
                <div className="text-left">
                  <div className="text-[15px] font-bold text-[var(--foreground)]">{item.author}</div>
                  {item.role && <div className="text-[13px] text-[var(--muted-foreground)]">{item.role}</div>}
                </div>
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </section>
    );
  }

  return (
    <section style={{ background: "var(--section-alt)" }}>
      <div className="mx-auto max-w-[1200px] px-5 sm:px-7 py-[84px]">
        {data.heading && (
          <Reveal>
            <h2 className="mb-10 text-center text-[32px] font-extrabold tracking-[-0.02em] text-[var(--foreground)] md:text-[46px]">
              {data.heading}
            </h2>
          </Reveal>
        )}
        <Reveal stagger className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {data.items.map((item, i) => (
            <figure
              key={i}
              className="flex flex-col rounded-[var(--radius-lg)] border bg-[var(--card)] p-7 shadow-[var(--shadow-card)]"
              style={BORDER}
            >
              <div
                className="mb-2 text-[46px] leading-none text-[var(--accent)]"
                style={{ fontFamily: "var(--font-display)" }}
                aria-hidden
              >
                &ldquo;
              </div>
              <blockquote className="-mt-4 flex-1 text-[17px] leading-relaxed text-[var(--foreground)]">
                {item.quote}
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <Avatar item={item} />
                <div>
                  <div className="text-sm font-bold text-[var(--foreground)]">{item.author}</div>
                  {item.role && (
                    <div className="text-xs text-[var(--muted-foreground)]">{item.role}</div>
                  )}
                </div>
              </figcaption>
            </figure>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
