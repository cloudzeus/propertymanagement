import type { Translatable } from "@/lib/i18n/translatable";
// Stored shape per section: the whole SectionData duplicated per locale.
export type LocalizedSectionData = Translatable<any>;

export const LANDING_SECTION_TYPES = ["HERO", "LOGOS", "FEATURES", "PRICING", "TESTIMONIALS", "CTA", "NEWS"] as const;
export type SectionType = (typeof LANDING_SECTION_TYPES)[number];

export function isSectionType(v: string): v is SectionType {
  return (LANDING_SECTION_TYPES as readonly string[]).includes(v);
}

export interface Cta { label: string; href: string }
export interface HeroData {
  title: string; subtitle: string; primaryCta: Cta; secondaryCta: Cta; imageUrl: string;
  eyebrow?: string; propertyName?: string; propertyAddress?: string; occupancy?: string;
}
export interface LogosData { heading: string; items: { label: string; imageUrl?: string }[] }
export interface FeatureItem { icon: string; title: string; body: string; imageUrl?: string }
export interface FeaturesData { heading: string; items: FeatureItem[] }
export interface PricingData { heading: string; subtitle: string }
export interface TestimonialItem { quote: string; author: string; role?: string; avatarUrl?: string }
export interface TestimonialsData { heading: string; items: TestimonialItem[] }
export interface CtaData { heading: string; body?: string; cta: Cta }
export interface NewsData { heading: string; intro?: string; count: number }

export type SectionData = HeroData | LogosData | FeaturesData | PricingData | TestimonialsData | CtaData | NewsData;

export function defaultSectionData(type: SectionType): any {
  switch (type) {
    case "HERO": return { title: "", subtitle: "", primaryCta: { label: "Δοκιμή", href: "/register" }, secondaryCta: { label: "Επικοινωνία", href: "/contact" }, imageUrl: "" };
    case "LOGOS": return { heading: "", items: [] };
    case "FEATURES": return { heading: "", items: [] };
    case "PRICING": return { heading: "", subtitle: "" };
    case "TESTIMONIALS": return { heading: "", items: [] };
    case "CTA": return { heading: "", body: "", cta: { label: "Δοκιμή", href: "/register" } };
    case "NEWS": return { heading: "", intro: "", count: 3 };
  }
}
