import Link from "next/link";
import { getLocale } from "next-intl/server";
import type { HeroData } from "@/lib/cms/landing-types";

const BARS = ["46%", "62%", "54%", "72%", "64%", "84%", "70%", "92%", "80%"];

const T = {
  el: {
    eyebrow: "Διαχείριση κτηρίων & κοινοχρήστων",
    trust: "Εμπιστοσύνη από διαχειριστές σε 200+ κτήρια",
    occ: "πληρότητα",
    toastT: "Πληρωμή ελήφθη",
    toastS: "Διαμ. 4Β · €84,50",
    live: "Ζωντανό χαρτοφυλάκιο",
    month: "Ιούνιος 2026",
    k1: "Εισπράχθηκαν",
    k2: "Ανοιχτά αιτήματα",
    chart: "Εισπράξεις vs. προϋπολογισμός",
  },
  en: {
    eyebrow: "Property & common-area management",
    trust: "Trusted by managers across 200+ buildings",
    occ: "occupied",
    toastT: "Payment received",
    toastS: "Apt 4B · €84.50",
    live: "Live portfolio",
    month: "June 2026",
    k1: "Collected",
    k2: "Open tickets",
    chart: "Collections vs. budget",
  },
};

export async function HeroSection({ data }: { data: HeroData }) {
  const raw = await getLocale();
  const t = T[raw === "en" ? "en" : "el"];
  return (
    <section className="relative overflow-hidden pt-[78px] pb-24">
      {/* Glow blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[260px] left-1/2 -z-10 h-[780px] w-[1100px] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(closest-side, rgba(242,162,60,.16), rgba(91,182,214,.07) 55%, transparent 75%)",
          filter: "blur(8px)",
        }}
      />
      {/* Line grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "linear-gradient(rgba(27,28,26,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(27,28,26,.045) 1px,transparent 1px)",
          backgroundSize: "54px 54px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 30%,#000,transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 30%,#000,transparent 75%)",
        }}
      />

      <div className="mx-auto max-w-[1200px] px-5 sm:px-7">
        <div className="grid grid-cols-1 items-center gap-[50px] md:grid-cols-[1.05fr_0.95fr]">
          {/* Copy */}
          <div>
            <span
              className="pop inline-flex items-center gap-2 rounded-full border bg-[var(--card)] px-3 py-1.5 text-[13px] font-semibold text-[var(--foreground)]"
              style={{ borderColor: "rgba(27,28,26,.12)", animationDelay: ".05s" }}
            >
              <span
                className="h-[7px] w-[7px] rounded-full bg-[var(--accent)]"
                style={{ boxShadow: "0 0 10px rgba(242,162,60,.55)" }}
              />
              {t.eyebrow}
            </span>

            <h1 className="mt-6 text-[42px] font-extrabold leading-[1.0] tracking-[-0.025em] text-[var(--foreground)] md:text-[74px]">
              <span className="pop inline-block" style={{ animationDelay: ".12s" }}>
                {data.title}
              </span>
            </h1>

            <p
              className="pop mt-6 max-w-[520px] text-[19px] leading-relaxed text-[var(--muted-foreground)]"
              style={{ animationDelay: ".3s" }}
            >
              {data.subtitle}
            </p>

            <div className="pop mt-[34px] flex flex-col gap-4 sm:flex-row" style={{ animationDelay: ".38s" }}>
              {data.primaryCta?.label && (
                <Link
                  href={data.primaryCta.href}
                  className="inline-flex items-center justify-center rounded-[var(--radius-sm)] bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[var(--primary-foreground)] shadow-[var(--shadow-btn)] transition hover:-translate-y-0.5 hover:brightness-[1.18]"
                >
                  {data.primaryCta.label}
                </Link>
              )}
              {data.secondaryCta?.label && (
                <Link
                  href={data.secondaryCta.href}
                  className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] border bg-[var(--card)] px-6 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_-16px_rgba(27,28,26,.3)]"
                  style={{ borderColor: "rgba(27,28,26,.12)" }}
                >
                  ▷ {data.secondaryCta.label}
                </Link>
              )}
            </div>

            {/* Trust row */}
            <div className="pop mt-[38px] flex items-center gap-3.5" style={{ animationDelay: ".46s" }}>
              <div className="flex">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="h-[34px] w-[34px] rounded-full border-2 border-white"
                    style={{
                      marginLeft: i === 0 ? 0 : -10,
                      background: "linear-gradient(135deg,#c9c4b6,#9aa39a)",
                    }}
                  />
                ))}
              </div>
              <span className="text-[13.5px] text-[var(--muted-foreground)]">
                {t.trust}
              </span>
            </div>
          </div>

          {/* Visual */}
          <div className="pop relative h-[480px]" style={{ animationDelay: ".32s" }}>
            {/* Spinning ring */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-[54%] top-1/2 h-[430px] w-[430px] rounded-full opacity-[0.32]"
              style={{
                transform: "translate(-50%,-50%)",
                background:
                  "conic-gradient(from 200deg,var(--accent),var(--accent-2),var(--accent),var(--accent-2),var(--accent))",
                filter: "blur(2px)",
                WebkitMask:
                  "radial-gradient(circle, transparent 56%, #000 57%, #000 60%, transparent 61%)",
                mask: "radial-gradient(circle, transparent 56%, #000 57%, #000 60%, transparent 61%)",
                animation: "spin 44s linear infinite",
              }}
            />

            {/* Photo card */}
            <div
              className="absolute right-0 top-2 h-[420px] w-[340px] overflow-hidden rounded-[22px] border"
              style={{ borderColor: "rgba(27,28,26,.12)", boxShadow: "0 44px 80px -40px rgba(27,28,26,.4)" }}
            >
              {data.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.imageUrl} alt={data.title} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-[#EFEDE2] to-[#E7F0E0]" />
              )}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg,rgba(15,22,30,.04) 0%,rgba(15,22,30,.06) 50%,rgba(15,22,30,.42) 100%)",
                }}
              />
              <div
                className="absolute inset-x-3.5 bottom-3.5 flex items-center justify-between rounded-[14px] border bg-[var(--card)] px-4 py-3"
                style={{ borderColor: "rgba(27,28,26,.12)" }}
              >
                <div>
                  <div className="text-sm font-bold text-[var(--foreground)]">Astra Residences</div>
                  <div className="text-[11.5px] text-[var(--muted-foreground)]">Λ. Κηφισίας 124</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-extrabold text-[var(--foreground)]">96%</div>
                  <div className="text-[10.5px] text-[var(--muted-foreground)]">{t.occ}</div>
                </div>
              </div>
            </div>

            {/* Toast float */}
            <div
              className="absolute left-1.5 top-1.5 z-[4] flex items-center gap-2.5 rounded-[14px] border bg-[var(--card)] px-3.5 py-2.5 shadow-[var(--shadow-card)]"
              style={{ borderColor: "rgba(27,28,26,.12)", animation: "floaty 6s ease-in-out .8s infinite" }}
            >
              <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-[var(--accent)] text-[13px] font-extrabold text-[#1b1c1a]">
                €
              </span>
              <div>
                <div className="text-xs font-bold text-[var(--foreground)]">{t.toastT}</div>
                <div className="text-[10.5px] text-[var(--muted-foreground)]">{t.toastS}</div>
              </div>
            </div>

            {/* Dashboard float */}
            <div
              className="absolute -left-2 bottom-[18px] z-[3] w-[310px] rounded-[18px] border bg-[var(--card)] p-4 shadow-[var(--shadow-card)]"
              style={{ borderColor: "rgba(27,28,26,.12)", animation: "floaty 7s ease-in-out infinite" }}
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
                    style={{ boxShadow: "0 0 8px rgba(242,162,60,.6)" }}
                  />
                  {t.live}
                </span>
                <span className="text-[10.5px] text-[var(--muted-foreground)]">{t.month}</span>
              </div>
              <div className="my-3 grid grid-cols-2 gap-2.5">
                <div className="rounded-[11px] border bg-[var(--paper)] px-3 py-2.5" style={{ borderColor: "rgba(27,28,26,.12)" }}>
                  <div className="text-[10px] text-[var(--muted-foreground)]">{t.k1}</div>
                  <div className="mt-0.5 text-[21px] font-extrabold text-[var(--foreground)]">€184k</div>
                </div>
                <div className="rounded-[11px] border bg-[var(--paper)] px-3 py-2.5" style={{ borderColor: "rgba(27,28,26,.12)" }}>
                  <div className="text-[10px] text-[var(--muted-foreground)]">{t.k2}</div>
                  <div className="mt-0.5 text-[21px] font-extrabold text-[var(--foreground)]">12</div>
                </div>
              </div>
              <div className="text-[10.5px] text-[var(--muted-foreground)]">{t.chart}</div>
              <div className="mt-2 flex h-[60px] items-end gap-1.5">
                {BARS.map((h, i) => (
                  <i
                    key={i}
                    className="flex-1 rounded-t-[3px]"
                    style={{ height: h, background: i >= 7 ? "var(--accent)" : "rgba(27,28,26,.12)" }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
