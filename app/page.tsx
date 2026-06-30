import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { getLandingSections } from "@/lib/cms/landing";
import { renderSection } from "@/components/landing/section-registry";

export default async function Home() {
  let sections: Awaited<ReturnType<typeof getLandingSections>> = [];
  try {
    sections = await getLandingSections();
  } catch {
    sections = [];
  }

  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />
      <main>{sections.map((s) => renderSection(s.type, s.data, s.id))}</main>
      <LandingFooter />
    </div>
  );
}
