import type { TestimonialsData } from "@/lib/cms/landing-types";

export function TestimonialsSection({ data }: { data: TestimonialsData }) {
  if (!data.items || data.items.length === 0) return null;

  return (
    <section style={{ background: "var(--section-alt)" }}>
      <div className="mx-auto max-w-[1200px] px-5 sm:px-7 py-[84px]">
        {data.heading && (
          <h2 className="mb-10 text-center text-[32px] font-extrabold tracking-[-0.02em] text-[var(--foreground)] md:text-[46px]">
            {data.heading}
          </h2>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {data.items.map((item, i) => (
            <figure
              key={i}
              className="flex flex-col rounded-[var(--radius-lg)] border bg-[var(--card)] p-7 shadow-[var(--shadow-card)]"
              style={{ borderColor: "rgba(27,28,26,.12)" }}
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
                {item.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.avatarUrl}
                    alt={item.author}
                    className="h-11 w-11 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-11 w-11 rounded-full bg-[var(--paper)] border" style={{ borderColor: "rgba(27,28,26,.12)" }} />
                )}
                <div>
                  <div className="text-sm font-bold text-[var(--foreground)]">{item.author}</div>
                  {item.role && (
                    <div className="text-xs text-[var(--muted-foreground)]">{item.role}</div>
                  )}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
