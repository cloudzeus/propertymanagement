"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RiExchangeLine, RiPlugLine, RiNodeTree, RiListSettingsLine, RiRefreshLine, RiQuestionLine } from "react-icons/ri";

const TABS = [
  { href: "/super-admin/settings/softone", label: "Σύνδεση", icon: RiPlugLine },
  { href: "/super-admin/settings/softone/structure", label: "Δομή & έλεγχοι", icon: RiNodeTree },
  { href: "/super-admin/settings/softone/params", label: "Παράμετροι", icon: RiListSettingsLine },
  { href: "/super-admin/settings/softone/sync", label: "Συγχρονισμός", icon: RiRefreshLine },
];

/** Shared header + tab strip of the «SoftOne» settings group. */
export function SoftoneHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const pathname = usePathname();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "color-mix(in srgb, var(--color-info) 9%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <RiExchangeLine style={{ fontSize: "var(--fs-20)", color: "var(--color-info)" }} />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ fontSize: "var(--fs-22)", fontWeight: 700, color: "var(--foreground)", margin: 0 }}>{title}</h1>
          <p style={{ fontSize: "var(--fs-13)", color: "var(--muted-foreground)", margin: "4px 0 0" }}>{subtitle}</p>
        </div>
        <Link href="/staff/help?m=softone" style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36, padding: "0 12px", borderRadius: 999, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", textDecoration: "none", fontSize: "var(--fs-12-5)", fontWeight: 600 }}>
          <RiQuestionLine /> Οδηγός
        </Link>
      </div>
      <nav style={{ display: "flex", gap: 6, flexWrap: "wrap", borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
        {TABS.map((t) => {
          const on = pathname === t.href;
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href} style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36, padding: "0 14px", borderRadius: 999, textDecoration: "none", fontSize: "var(--fs-13)", fontWeight: on ? 700 : 500, background: on ? "var(--color-primary)" : "var(--card)", color: on ? "#fff" : "var(--foreground)", border: `1px solid ${on ? "var(--color-primary)" : "var(--border)"}` }}>
              <Icon /> {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export const S1_LABEL: React.CSSProperties = { fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--muted-foreground)", display: "block", marginBottom: 6, letterSpacing: "0.03em" };
export const S1_INPUT: React.CSSProperties = { width: "100%", minHeight: 38, padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6, fontSize: "var(--fs-13)", color: "var(--foreground)", background: "var(--bg-canvas)", outline: "none", boxSizing: "border-box" };
export const S1_CARD: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20, display: "flex", flexDirection: "column", gap: 16 };
export const S1_BTN = (variant: "primary" | "ghost" | "danger" = "primary", disabled = false): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40, padding: "0 18px", borderRadius: "var(--radius)", fontSize: "var(--fs-13)", fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.65 : 1,
  background: variant === "primary" ? "var(--color-primary)" : variant === "danger" ? "var(--color-danger)" : "var(--card)",
  color: variant === "ghost" ? "var(--foreground)" : "#fff", border: variant === "ghost" ? "1px solid var(--border)" : "none",
});

export const fmtDate = (iso: string | Date | null | undefined) => (iso ? new Date(iso).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" }) : "—");
