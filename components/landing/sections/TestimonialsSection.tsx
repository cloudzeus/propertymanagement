import type { TestimonialsData } from "@/lib/cms/landing-types";

export function TestimonialsSection({ data }: { data: TestimonialsData }) {
  if (!data.items || data.items.length === 0) return null;

  return (
    <section className="bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {data.heading && (
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 text-center mb-14">
            {data.heading}
          </h2>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {data.items.map((item, i) => (
            <figure
              key={i}
              className="flex flex-col rounded-xl border border-gray-200 bg-white p-7 shadow-sm"
            >
              <blockquote className="flex-1 text-gray-700 leading-relaxed">
                “{item.quote}”
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                {item.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.avatarUrl}
                    alt={item.author}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200" />
                )}
                <div>
                  <div className="text-sm font-semibold text-gray-900">{item.author}</div>
                  {item.role && <div className="text-xs text-gray-500">{item.role}</div>}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
