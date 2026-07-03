import type { ReactNode } from "react";

type Tone = "success" | "warning" | "danger" | "neutral" | "accent";
const TONE: Record<Tone, string> = {
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  accent: "var(--color-accent)",
  neutral: "var(--muted-foreground)",
};

export function StatusChip({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const c = TONE[tone];
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
      background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c, whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}
