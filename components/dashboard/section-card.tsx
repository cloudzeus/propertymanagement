import type { ReactNode } from "react";
import Link from "next/link";
import { RiArrowRightLine } from "react-icons/ri";

export function SectionCard({
  title, viewAllHref, viewAllLabel = "Όλα", children,
}: { title: string; viewAllHref?: string; viewAllLabel?: string; children: ReactNode }) {
  return (
    <section style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", boxShadow: "var(--shadow-card)", padding: 24,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>{title}</h2>
        {viewAllHref && (
          <Link href={viewAllHref} style={{
            fontSize: 12, color: "var(--color-accent)", display: "flex", alignItems: "center",
            gap: 4, textDecoration: "none", fontWeight: 600,
          }}>
            {viewAllLabel} <RiArrowRightLine />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
