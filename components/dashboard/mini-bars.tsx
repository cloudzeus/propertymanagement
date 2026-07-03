import type { TrendPoint } from "@/lib/dashboard/aggregations";

const MONTH_ABBR = ["Ιαν","Φεβ","Μαρ","Απρ","Μαϊ","Ιουν","Ιουλ","Αυγ","Σεπ","Οκτ","Νοε","Δεκ"];

export function MiniBars({ data, height = 72 }: { data: TrendPoint[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = 26, gap = 14, w = data.length * (barW + gap);
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${height + 18}`} role="img" aria-label="Μηνιαία τάση" style={{ display: "block" }}>
      {data.map((d, i) => {
        const h = Math.round((d.value / max) * height);
        const x = i * (barW + gap);
        const mLabel = MONTH_ABBR[Number(d.month.split("-")[1]) - 1];
        return (
          <g key={d.month}>
            <rect x={x} y={height - h} width={barW} height={Math.max(2, h)} rx={5}
              fill="var(--color-accent)" opacity={i === data.length - 1 ? 1 : 0.4} />
            <text x={x + barW / 2} y={height + 14} textAnchor="middle" fontSize="10"
              fill="var(--muted-foreground)">{mLabel}</text>
          </g>
        );
      })}
    </svg>
  );
}
