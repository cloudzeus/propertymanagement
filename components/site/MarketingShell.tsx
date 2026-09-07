import type { ReactNode } from "react";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";

/**
 * Every public page's outer frame. `orithon-marketing` carries the fixed warm
 * gradient wash (globals.css) — without it a page renders on the flat dashboard
 * canvas and the light palette falls apart.
 */
export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="orithon-marketing flex min-h-screen flex-col text-[var(--txt)]">
      <LandingHeader />
      <main className="fade-in flex-1">{children}</main>
      <LandingFooter />
    </div>
  );
}
