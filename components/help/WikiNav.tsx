import Link from "next/link";
import { RiFileTextLine } from "react-icons/ri";
import type { AreaGroup } from "@/lib/help/hub";

/** Per-area accordion of the role's page guides (server component). */
export function WikiNav({ groups, base, active }: { groups: AreaGroup[]; base: string; active?: string }) {
  if (!groups.length) return <p style={{ margin: 0, fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)" }}>Δεν υπάρχουν ακόμη οδηγοί ανά σελίδα.</p>;
  return (
    <nav style={{ display: "flex", flexDirection: "column", gap: 6 }} aria-label="Οδηγοί ανά σελίδα">
      {groups.map((g) => {
        const isOpen = !active || g.articles.some((a) => a.slug === active) || groups.length === 1;
        return (
          <details key={g.area} open={isOpen} style={{ border: "1px solid var(--border)", borderRadius: 10, background: "var(--card)" }}>
            <summary style={{ cursor: "pointer", padding: "9px 12px", fontSize: "var(--fs-13)", fontWeight: 700, listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 44 }}>
              <span>{g.label}</span><span style={{ fontSize: "var(--fs-11)", color: "var(--muted-foreground)", fontWeight: 500 }}>{g.articles.length}</span>
            </summary>
            <div style={{ display: "flex", flexDirection: "column", padding: "0 6px 6px" }}>
              {g.articles.map((a) => {
                const on = a.slug === active;
                return (
                  <Link key={a.slug} href={`${base}?a=${encodeURIComponent(a.slug)}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 8px", borderRadius: 8, textDecoration: "none", minHeight: 40, fontSize: "var(--fs-13)", fontWeight: on ? 700 : 500, background: on ? "var(--color-primary)" : "transparent", color: on ? "#fff" : "var(--foreground)" }}>
                    <RiFileTextLine style={{ flexShrink: 0, opacity: 0.7 }} /> <span>{a.title}</span>
                  </Link>
                );
              })}
            </div>
          </details>
        );
      })}
    </nav>
  );
}
