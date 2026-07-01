import type { LogosData } from "@/lib/cms/landing-types";

export function LogosSection({ data }: { data: LogosData }) {
  if (!data.items || data.items.length === 0) return null;

  const items = [...data.items, ...data.items];

  return (
    <section className="border-y" style={{ borderColor: "rgba(27,28,26,.07)" }}>
      <div className="mx-auto max-w-[1200px] px-5 sm:px-7 py-10">
        {data.heading && (
          <p className="mb-6 text-center text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            {data.heading}
          </p>
        )}
        <div
          className="overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
            WebkitMaskImage:
              "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
          }}
        >
          <div
            className="flex w-max items-center gap-16"
            style={{ animation: "marquee 30s linear infinite" }}
          >
            {items.map((item, i) =>
              item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={item.imageUrl}
                  alt={item.label}
                  className="h-7 w-auto object-contain opacity-70"
                />
              ) : (
                <span
                  key={i}
                  className="whitespace-nowrap text-[23px] text-[var(--muted-foreground)] opacity-70"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {item.label}
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
