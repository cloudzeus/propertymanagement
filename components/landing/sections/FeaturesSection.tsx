import type { FeaturesData } from "@/lib/cms/landing-types";
import { resolveIcon } from "@/lib/cms/icon-registry";

export function FeaturesSection({ data }: { data: FeaturesData }) {
  return (
    <section className="bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {data.heading && (
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 text-center mb-14">
            {data.heading}
          </h2>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(data.items ?? []).map((item, i) => {
            const Icon = resolveIcon(item.icon);
            return (
              <div
                key={i}
                className="rounded-xl border border-gray-200 bg-white p-7 shadow-sm transition hover:shadow-md"
              >
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-lg"
                  style={{ background: "color-mix(in srgb, var(--color-primary) 12%, white)" }}
                >
                  <Icon className="w-7 h-7" style={{ color: "var(--color-primary)" }} />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{item.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
