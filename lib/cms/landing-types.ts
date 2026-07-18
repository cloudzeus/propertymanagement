import type { Translatable } from "@/lib/i18n/translatable";
// Stored shape per section: the whole SectionData duplicated per locale.
export type LocalizedSectionData = Translatable<any>;

export const LANDING_SECTION_TYPES = [
  "HERO", "LOGOS", "STATS", "FEATURES", "ROLES", "HOW", "SHOWCASE",
  "PRICING", "TESTIMONIALS", "CTA", "NEWS", "NAV", "FOOTER",
] as const;
export type SectionType = (typeof LANDING_SECTION_TYPES)[number];

/** Types rendered inside <main>. NAV/FOOTER are page chrome, edited separately. */
export const LANDING_BODY_TYPES = LANDING_SECTION_TYPES.filter((t) => t !== "NAV" && t !== "FOOTER");

export function isSectionType(v: string): v is SectionType {
  return (LANDING_SECTION_TYPES as readonly string[]).includes(v);
}

export interface Cta { label: string; href: string }
export interface HeroData {
  title: string; subtitle: string; primaryCta: Cta; secondaryCta: Cta;
  imageUrl: string;
  /** Optional video for the hero visual — takes precedence over imageUrl. */
  videoUrl?: string;
  eyebrow?: string; propertyName?: string; propertyAddress?: string; occupancy?: string;
  /** Small-print strings of the hero visual — all optional, with design defaults. */
  trustText?: string;
  toastTitle?: string; toastSub?: string;
  liveBadge?: string; monthLabel?: string; chartLabel?: string;
  kpi1Label?: string; kpi1Value?: string; kpi2Label?: string; kpi2Value?: string;
  occLabel?: string;
}
export interface LogosData { heading: string; items: { label: string; imageUrl?: string }[] }
export interface StatsData { items: { value: string; label: string }[] }
export interface FeatureItem { icon: string; title: string; body: string; imageUrl?: string }
export interface FeaturesData {
  heading: string; items: FeatureItem[];
  kicker?: string; subtitle?: string;
  /** The photo tile of the bento grid. */
  imageTile?: { imageUrl?: string; title?: string; subtitle?: string };
}
export interface RoleItem { initial: string; name: string; tag: string; points: string[] }
export interface RolesData { kicker?: string; heading: string; subtitle?: string; roles: RoleItem[] }
export interface HowStep { title: string; body: string }
export interface HowData { kicker?: string; heading: string; subtitle?: string; steps: HowStep[] }
export interface ShowcaseData {
  kicker?: string; heading: string; subtitle?: string;
  imageUrl?: string;
  stat1?: { value: string; label: string };
  stat2?: { value: string; label: string };
  points: { title: string; body?: string }[];
  cta?: Cta;
}
export interface PricingData { heading: string; subtitle: string }
export interface TestimonialItem { quote: string; author: string; role?: string; avatarUrl?: string }
export interface TestimonialsData { heading: string; items: TestimonialItem[] }
export interface CtaData {
  heading: string; body?: string; cta: Cta;
  secondaryCta?: Cta;
  /** Full-bleed background image behind the light scrim. */
  imageUrl?: string;
}
export interface NewsData { heading: string; intro?: string; count: number }
export interface NavData {
  links: Cta[];
  loginLabel?: string; demoLabel?: string; demoHref?: string; mineLabel?: string;
}
export interface FooterData {
  tagline?: string;
  columns: { heading: string; links: Cta[] }[];
  copyright?: string;
}

export type SectionData =
  | HeroData | LogosData | StatsData | FeaturesData | RolesData | HowData | ShowcaseData
  | PricingData | TestimonialsData | CtaData | NewsData | NavData | FooterData;

export function defaultSectionData(type: SectionType): any {
  switch (type) {
    case "HERO": return { title: "", subtitle: "", primaryCta: { label: "Δοκιμή", href: "/register" }, secondaryCta: { label: "Επικοινωνία", href: "/contact" }, imageUrl: "" };
    case "LOGOS": return { heading: "", items: [] };
    case "STATS": return { items: [] };
    case "FEATURES": return { heading: "", items: [] };
    case "ROLES": return { heading: "", roles: [] };
    case "HOW": return { heading: "", steps: [] };
    case "SHOWCASE": return { heading: "", points: [] };
    case "PRICING": return { heading: "", subtitle: "" };
    case "TESTIMONIALS": return { heading: "", items: [] };
    case "CTA": return { heading: "", body: "", cta: { label: "Δοκιμή", href: "/register" } };
    case "NEWS": return { heading: "", intro: "", count: 3 };
    case "NAV": return { links: [], loginLabel: "", demoLabel: "", demoHref: "/register" };
    case "FOOTER": return { tagline: "", columns: [] };
  }
}
