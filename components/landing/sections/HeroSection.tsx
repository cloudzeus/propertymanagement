import Link from "next/link";
import { getLocale } from "next-intl/server";
import type { HeroData } from "@/lib/cms/landing-types";
import { GlowBlob, Grain, GridOverlay, ImagePlaceholder } from "@/components/site/kit";

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
      {/*
        Three stacked background layers (handoff 03 §1 / 01 §5.2–5.4).
        They must NOT use a negative z-index: `section.relative` has no z-index,
        so it creates no stacking context, and `-z-10` children escape all the
        way to the root — painting behind the opaque `.orithon-marketing`
        background, where they are invisible. Instead they paint in source order
        and the content wrapper below is given `relative` to sit above them.
      */}
      <GlowBlob variant="hero" />
      <GridOverlay />
      <Grain />

      <div className="relative mx-auto max-w-[1200px] px-5 sm:px-7">
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
              {data.eyebrow || t.eyebrow}
            </span>

            {/* Two lines: the first in ink, the second in amber (handoff 03 §1).
                `titleAccent` is optional — an unsplit title renders on its own. */}
            <h1 className="mt-6 text-[42px] font-extrabold leading-[1.0] tracking-[-0.025em] text-[var(--foreground)] md:text-[74px]">
              <span className="pop block" style={{ animationDelay: ".12s" }}>
                {data.title}
              </span>
              {data.titleAccent ? (
                <span
                  className="pop block text-[var(--accent)]"
                  style={{ animationDelay: ".2s" }}
                >
                  {data.titleAccent}
                </span>
              ) : null}
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
                {data.trustText || t.trust}
              </span>
            </div>
          </div>

          {/* Visual */}
          <div className="pop relative h-[480px]" style={{ animationDelay: ".32s" }}>
            {/* Rotating conic ring. The shared utility uses `spin-ring`, whose
                keyframe keeps the centring translate — plain `spin` drops it and
                the ring jumps a half-width off-centre the moment it animates. */}
            <div aria-hidden className="conic-ring pointer-events-none" />

            {/* Photo card */}
            <div
              className="absolute right-0 top-2 h-[420px] w-[340px] overflow-hidden rounded-[22px] border"
              style={{ borderColor: "rgba(27,28,26,.12)", boxShadow: "0 44px 80px -40px rgba(27,28,26,.4)" }}
            >
              {data.videoUrl ? (
                <video
                  src={data.videoUrl}
                  poster={data.imageUrl || undefined}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="h-full w-full object-cover"
                />
              ) : data.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.imageUrl} alt={data.title} className="h-full w-full object-cover" />
              ) : (
                /* Placeholders stay obvious and name what belongs there
                   (handoff README §10) — never a stand-in that reads as a photo. */
                <ImagePlaceholder label={data.propertyName || "Building photo"} />
              )}
              <div aria-hidden className="scrim-photo" />
              <div
                className="absolute inset-x-3.5 bottom-3.5 flex items-center justify-between rounded-[14px] border bg-[var(--card)] px-4 py-3"
                style={{ borderColor: "rgba(27,28,26,.12)" }}
              >
                <div>
                  <div className="text-sm font-bold text-[var(--foreground)]">{data.propertyName || "Astra Residences"}</div>
                  <div className="text-[11.5px] text-[var(--muted-foreground)]">{data.propertyAddress || "Λ. Κηφισίας 124"}</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-extrabold text-[var(--foreground)]">{data.occupancy || "96%"}</div>
                  <div className="text-[10.5px] text-[var(--muted-foreground)]">{data.occLabel || t.occ}</div>
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
                <div className="text-xs font-bold text-[var(--foreground)]">{data.toastTitle || t.toastT}</div>
                <div className="text-[10.5px] text-[var(--muted-foreground)]">{data.toastSub || t.toastS}</div>
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
                  {data.liveBadge || t.live}
                </span>
                <span className="text-[10.5px] text-[var(--muted-foreground)]">{data.monthLabel || t.month}</span>
              </div>
              <div className="my-3 grid grid-cols-2 gap-2.5">
                <div className="rounded-[11px] border bg-[var(--paper)] px-3 py-2.5" style={{ borderColor: "rgba(27,28,26,.12)" }}>
                  <div className="text-[10px] text-[var(--muted-foreground)]">{data.kpi1Label || t.k1}</div>
                  <div className="mt-0.5 text-[21px] font-extrabold text-[var(--foreground)]">{data.kpi1Value || "€184k"}</div>
                </div>
                <div className="rounded-[11px] border bg-[var(--paper)] px-3 py-2.5" style={{ borderColor: "rgba(27,28,26,.12)" }}>
                  <div className="text-[10px] text-[var(--muted-foreground)]">{data.kpi2Label || t.k2}</div>
                  <div className="mt-0.5 text-[21px] font-extrabold text-[var(--foreground)]">{data.kpi2Value || "12"}</div>
                </div>
              </div>
              <div className="text-[10.5px] text-[var(--muted-foreground)]">{data.chartLabel || t.chart}</div>
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
