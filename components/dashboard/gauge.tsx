/**
 * Open-arc gauge (≈270°, open at bottom) matching the inspiration's amber
 * "community" meter. Amber is the single decorative accent in the whole
 * dashboard — reserved for this component.
 */
function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, endDeg);
  const end = polar(cx, cy, r, startDeg);
  const large = endDeg - startDeg <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`;
}

export function Gauge({
  value, max, big, unit,
}: { value: number; max: number; big: string; unit?: string }) {
  const pct = max === 0 ? 0 : Math.max(0, Math.min(1, value / max));
  const cx = 80, cy = 76, r = 60;
  const START = -135, SWEEP = 270;
  const track = arcPath(cx, cy, r, START, START + SWEEP);
  const fill = arcPath(cx, cy, r, START, START + SWEEP * pct);
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <svg width="160" height="140" viewBox="0 0 160 150" role="img" aria-label={`${big} ${unit ?? ""}`}>
        <path d={track} fill="none" stroke="var(--muted)" strokeWidth="14" strokeLinecap="round" />
        {pct > 0 && (
          <path d={fill} fill="none" stroke="var(--color-accent)" strokeWidth="14" strokeLinecap="round" />
        )}
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="30" fontWeight="300" fill="var(--foreground)">{big}</text>
        {unit && <text x={cx} y={cy + 26} textAnchor="middle" fontSize="12" fill="var(--muted-foreground)">{unit}</text>}
      </svg>
    </div>
  );
}
