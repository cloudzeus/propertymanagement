"use client";
import { HeroForm } from "./forms/HeroForm";
import { FeaturesForm } from "./forms/FeaturesForm";
import { TestimonialsForm } from "./forms/TestimonialsForm";
import { LogosForm } from "./forms/LogosForm";
import { CtaForm } from "./forms/CtaForm";
import { NewsForm } from "./forms/NewsForm";

type Section = { id: string; type: string; data: unknown };

export function SectionForm({ section }: { section: Section }) {
  switch (section.type) {
    case "HERO": return <HeroForm section={section} />;
    case "FEATURES": return <FeaturesForm section={section} />;
    case "TESTIMONIALS": return <TestimonialsForm section={section} />;
    case "LOGOS": return <LogosForm section={section} />;
    case "CTA": return <CtaForm section={section} />;
    case "NEWS": return <NewsForm section={section} />;
    case "PRICING":
      return <p style={{ color: "var(--muted-foreground)" }}>Τα πακέτα τιμών επεξεργάζονται στη σελίδα «Τιμές».</p>;
    default:
      return <p>Άγνωστος τύπος.</p>;
  }
}
