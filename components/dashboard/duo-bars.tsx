import type { DuoPoint } from "@/lib/dashboard/alloc-view";

const MONTH_ABBR = ["Ιαν","Φεβ","Μαρ","Απρ","Μαϊ","Ιουν","Ιουλ","Αυγ","Σεπ","Οκτ","Νοε","Δεκ"];
const fmt = (n: number) => n.toLocaleString("el-GR", { maximumFractionDigits: 0 });

/** Grouped monthly bars: owner vs tenant charges. Zero months render a baseline dot. */
export function DuoBars({ data, height = 120 }: { data: DuoPoint[]; height?: number }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.owner, d.tenant]));
  const barW = 16, pair = barW * 2 + 4, gap = 22, w = data.length * (pair + gap);
  const label = data.map((d) => `${MONTH_ABBR[Number(d.month.split("-")[1]) - 1]}: ιδιοκτήτης ${fmt(d.owner)}€, ένοικος ${fmt(d.tenant)}€`).join("· ");
  const all0 = data.every((d) => d.owner === 0 && d.tenant === 0);
  if (all0) {
    return <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>Καμία χρέωση στο εξάμηνο.</p>;
  }
  const bar = (x: number, v: number, color: string) => {
    const h = Math.round((v / max) * height);
    return v === 0
      ? <circle cx={x + barW / 2} cy={height - 2} r={2} fill="var(--border-strong)" />
      : (
        <>
          <rect x={x} y={height - h} width={barW} height={Math.max(3, h)} rx={4} fill={color} />
          <text x={x + barW / 2} y={height - h - 4} textAnchor="middle" fontSize="9" fontWeight={700}
            fill="var(--muted-foreground)" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(v)}</text>
        </>
      );
  };
  return (
    <div>
      <svg width="100%" viewBox={`-2 -14 ${w} ${height + 34}`} role="img" aria-label={`Χρεώσεις 6μήνου — ${label}`} style={{ display: "block" }}>
        {data.map((d, i) => {
          const x = i * (pair + gap);
          return (
            <g key={d.month}>
              {bar(x, d.owner, "var(--color-primary)")}
              {bar(x + barW + 4, d.tenant, "var(--color-accent)")}
              <text x={x + pair / 2} y={height + 14} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">
                {MONTH_ABBR[Number(d.month.split("-")[1]) - 1]}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 11, color: "var(--muted-foreground)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--color-primary)" }} /> Ως ιδιοκτήτης
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--color-accent)" }} /> Ως ένοικος
        </span>
      </div>
    </div>
  );
}
