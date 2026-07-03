export function Donut({
  value, total, label, tone = "var(--color-accent)",
}: { value: number; total: number; label: string; tone?: string }) {
  const pct = total === 0 ? 0 : value / total;
  const r = 42, c = 2 * Math.PI * r;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width="104" height="104" viewBox="0 0 104 104">
        <circle cx="52" cy="52" r={r} fill="none" stroke="var(--muted)" strokeWidth="12" />
        <circle cx="52" cy="52" r={r} fill="none" stroke={tone} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 52 52)" />
        <text x="52" y="50" textAnchor="middle" fontSize="22" fontWeight="700"
          fill="var(--foreground)" style={{ fontFamily: "var(--font-display)" }}>{Math.round(pct * 100)}%</text>
        <text x="52" y="68" textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">{value}/{total}</text>
      </svg>
      <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{label}</span>
    </div>
  );
}
