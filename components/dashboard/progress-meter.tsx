export function ProgressMeter({ pct, label }: { pct: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{label}</span>}
      <div style={{ height: 10, borderRadius: 999, background: "var(--muted)", overflow: "hidden" }}>
        <div style={{ width: `${clamped}%`, height: "100%", borderRadius: 999,
          background: "linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 70%, #fff))" }} />
      </div>
    </div>
  );
}
