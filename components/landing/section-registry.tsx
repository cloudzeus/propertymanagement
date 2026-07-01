import { HeroSection } from "./sections/HeroSection";
import { LogosSection } from "./sections/LogosSection";
import { FeaturesSection } from "./sections/FeaturesSection";
import { PricingSection } from "./sections/PricingSection";
import { TestimonialsSection } from "./sections/TestimonialsSection";
import { CtaSection } from "./sections/CtaSection";
import { NewsSection } from "./sections/NewsSection";

export function renderSection(type: string, data: any, key: string) {
  switch (type) {
    case "HERO": return <HeroSection key={key} data={data} />;
    case "LOGOS": return <LogosSection key={key} data={data} />;
    case "FEATURES": return <FeaturesSection key={key} data={data} />;
    case "PRICING": return <PricingSection key={key} data={data} />;
    case "TESTIMONIALS": return <TestimonialsSection key={key} data={data} />;
    case "CTA": return <CtaSection key={key} data={data} />;
    case "NEWS": return <NewsSection key={key} data={data} />;
    default: return null;
  }
}
