"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCategoryBasis } from "@/app/actions/building-millesimes";
import { DistributionBasis, type DistributionBasis as TDistributionBasis } from "@/lib/prisma/enums";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { RiLoaderLine } from "react-icons/ri";

const BASIS_LABEL: Record<string, string> = {
  GENERAL_MILLESIMES: "Γενικά χιλιοστά",
  ELEVATOR_MILLESIMES: "Χιλιοστά ανελκυστήρα",
  HEATING_MILLESIMES: "Χιλιοστά θέρμανσης",
  EQUAL_PER_UNIT: "Ισόποσα ανά μονάδα",
  METERED_70_30: "70/30 μετρητής",
};

const DEFAULT_SENTINEL = "__DEFAULT__";

export function DistributionTab({
  buildingId,
  categories,
  overrides,
}: {
  buildingId: string;
  categories: Array<{ id: string; name: string; defaultBasis: string }>;
  overrides: Array<{ categoryId: string; distributionBasis: string | null }>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const overrideMap = new Map(overrides.map((o) => [o.categoryId, o.distributionBasis]));

  function change(categoryId: string, value: string) {
    startTransition(async () => {
      const basis = value === DEFAULT_SENTINEL ? null : (value as TDistributionBasis);
      await setCategoryBasis(buildingId, categoryId, basis);
      router.refresh();
    });
  }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.06)", overflow: "hidden" }}>
      {isPending && <div style={{ padding: "8px 16px", fontSize: 12, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 6 }}><RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> Αποθήκευση…</div>}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--muted-foreground)", fontSize: 11 }}>
            <th style={th}>Κατηγορία</th>
            <th style={th}>Default (νόμος)</th>
            <th style={th}>Μέθοδος</th>
            <th style={th}>Ένδειξη</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => {
            const hasOverride = overrideMap.has(c.id);
            const overrideBasis = overrideMap.get(c.id) ?? null;
            const current = hasOverride && overrideBasis ? overrideBasis : DEFAULT_SENTINEL;
            const differs = hasOverride && overrideBasis != null && overrideBasis !== c.defaultBasis;
            return (
              <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ ...td, fontWeight: 600 }}>{c.name}</td>
                <td style={{ ...td, color: "var(--muted-foreground)" }}>{BASIS_LABEL[c.defaultBasis] ?? c.defaultBasis}</td>
                <td style={td}>
                  <Select value={current} onValueChange={(v) => change(c.id, v)}>
                    <SelectTrigger style={{ width: 240 }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={DEFAULT_SENTINEL}>(Προεπιλογή νόμου)</SelectItem>
                      {Object.values(DistributionBasis).map((b) => (
                        <SelectItem key={b} value={b}>{BASIS_LABEL[b]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td style={td}>
                  {differs && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: "#fffbeb", color: "#92400e", border: "1px solid #f59e0b" }}>κανονισμός</span>
                      <button onClick={() => change(c.id, DEFAULT_SENTINEL)} style={linkBtn}>επαναφορά σε default</button>
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const th: React.CSSProperties = { padding: "8px 12px" };
const td: React.CSSProperties = { padding: "8px 12px", color: "var(--foreground)" };
const linkBtn: React.CSSProperties = { border: "none", background: "transparent", color: "var(--color-primary)", cursor: "pointer", fontSize: 12, textDecoration: "underline", padding: 0 };
