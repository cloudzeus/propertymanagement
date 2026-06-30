import type { LogosData } from "@/lib/cms/landing-types";

export function LogosSection({ data }: { data: LogosData }) {
  if (!data.items || data.items.length === 0) return null;

  return (
    <section className="bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {data.heading && (
          <p className="text-center text-sm font-medium uppercase tracking-wide text-gray-500 mb-8">
            {data.heading}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {data.items.map((item, i) =>
            item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={item.imageUrl}
                alt={item.label}
                className="h-8 w-auto object-contain opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0"
              />
            ) : (
              <span key={i} className="text-lg font-semibold text-gray-400">
                {item.label}
              </span>
            )
          )}
        </div>
      </div>
    </section>
  );
}
