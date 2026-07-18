"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setUnitCategoryExclusion } from "@/app/actions/building-millesimes";
import { RiLoaderLine, RiStore2Line, RiCheckLine } from "react-icons/ri";
import type { BuildingCaps } from "@/lib/building-caps";

export function ExclusionMatrix({
  buildingId,
  units,
  categories,
  exclusions,
  can,
}: {
  buildingId: string;
  units: Array<{ id: string; unitNumber: string; unitType: string }>;
  categories: Array<{ id: string; name: string }>;
  exclusions: Array<{ unitId: string; categoryId: string }>;
  can: BuildingCaps;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const excludedSet = new Set(exclusions.map((e) => `${e.unitId}:${e.categoryId}`));

  function toggle(unitId: string, categoryId: string, nowChecked: boolean) {
    // checked = pays; excluded is the inverse of the new checked state
    startTransition(async () => {
      await setUnitCategoryExclusion(buildingId, unitId, categoryId, !nowChecked);
      router.refresh();
    });
  }

  function excludeShops(categoryId: string) {
    const shops = units.filter((u) => u.unitType === "SHOP");
    if (shops.length === 0) return;
    startTransition(async () => {
      for (const u of shops) {
        await setUnitCategoryExclusion(buildingId, u.id, categoryId, true);
      }
      router.refresh();
    });
  }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.06)", overflow: "auto" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 8 }}>
        Επιλεγμένο = η μονάδα συμμετέχει (πληρώνει) στην κατηγορία.
        {isPending && <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} />}
      </div>
      <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--muted-foreground)", fontSize: 11 }}>
            <th style={{ ...th, position: "sticky", left: 0, background: "var(--card)" }}>Μονάδα</th>
            {categories.map((c) => (
              <th key={c.id} style={{ ...th, textAlign: "center", minWidth: 120 }}>
                <div style={{ marginBottom: 4 }}>{c.name}</div>
                {can.editDistribution && (
                  <button onClick={() => excludeShops(c.id)} disabled={isPending} style={shopBtn}>
                    <RiStore2Line /> Εξαίρεσε καταστήματα
                  </button>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {units.map((u) => (
            <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ ...td, fontWeight: 600, position: "sticky", left: 0, background: "var(--card)" }}>{u.unitNumber}</td>
              {categories.map((c) => {
                const checked = !excludedSet.has(`${u.id}:${c.id}`);
                return (
                  <td key={c.id} style={{ ...td, textAlign: "center" }}>
                    {can.editDistribution ? (
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isPending}
                        onChange={(e) => toggle(u.id, c.id, e.target.checked)}
                      />
                    ) : checked ? (
                      <RiCheckLine style={{ color: "var(--color-green)" }} title="Συμμετέχει" />
                    ) : (
                      <span style={{ color: "var(--muted-foreground)" }}>—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const th: React.CSSProperties = { padding: "8px 12px" };
const td: React.CSSProperties = { padding: "6px 12px", color: "var(--foreground)" };
const shopBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid var(--border)", background: "var(--card)", color: "var(--muted-foreground)", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" };
