import Link from "next/link";
import type { HeroData } from "@/lib/cms/landing-types";

export function HeroSection({ data }: { data: HeroData }) {
  return (
    <section className="bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">
              {data.title}
            </h1>
            <p className="mt-6 text-lg text-gray-600 leading-relaxed">
              {data.subtitle}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              {data.primaryCta?.label && (
                <Link
                  href={data.primaryCta.href}
                  className="inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                  style={{ background: "var(--color-primary)" }}
                >
                  {data.primaryCta.label}
                </Link>
              )}
              {data.secondaryCta?.label && (
                <Link
                  href={data.secondaryCta.href}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  {data.secondaryCta.label}
                </Link>
              )}
            </div>
          </div>
          <div className="aspect-video rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
            {data.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.imageUrl}
                alt={data.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
