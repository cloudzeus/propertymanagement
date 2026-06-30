import Link from "next/link";
import type { CtaData } from "@/lib/cms/landing-types";

export function CtaSection({ data }: { data: CtaData }) {
  return (
    <section className="bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div
          className="rounded-2xl px-8 py-16 text-center"
          style={{ background: "var(--color-primary)" }}
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
            {data.heading}
          </h2>
          {data.body && (
            <p className="mt-4 text-lg text-white/90 max-w-2xl mx-auto">{data.body}</p>
          )}
          {data.cta?.label && (
            <Link
              href={data.cta.href}
              className="mt-8 inline-flex items-center justify-center rounded-lg bg-white px-7 py-3 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-gray-100"
            >
              {data.cta.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
