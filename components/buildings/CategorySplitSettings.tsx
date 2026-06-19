"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RiPieChartLine, RiSaveLine, RiRefreshLine, RiEditLine, RiCloseLine } from "react-icons/ri";
import {
  upsertBuildingCategoryOverride,
  clearBuildingCategoryOverride,
} from "@/app/actions/expense-categories";

type SplitRow = {
  category: {
    id: string;
    name: string;
    code: string;
    utilityType: "NONE" | "POWER" | "WATER" | "GAS";
    defaultTenantPct: number;
    defaultOwnerPct: number;
  };
  override: unknown;
  effective: { tenantPct: number; ownerPct: number };
  isOverridden: boolean;
};

function clampPct(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function CategorySplitSettings({
  buildingId, rows,
}: {
  buildingId: string;
  rows: SplitRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editId, setEditId] = useState<string | null>(null);
  const [tenantPct, setTenantPct] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function startEdit(r: SplitRow) {
    setError(null);
    setEditId(r.category.id);
    setTenantPct(r.effective.tenantPct);
  }
  function cancel() {
    setEditId(null);
    setError(null);
  }

  function save(categoryId: string) {
    const t = clampPct(tenantPct);
    setError(null);
    startTransition(async () => {
      try {
        await upsertBuildingCategoryOverride(buildingId, categoryId, t, 100 - t);
        setEditId(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Σφάλμα αποθήκευσης");
      }
    });
  }

  function reset(categoryId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await clearBuildingCategoryOverride(buildingId, categoryId);
        setEditId(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Σφάλμα επαναφοράς");
      }
    });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 6 }}>
          <RiPieChartLine /> Ρυθμίσεις κατανομής · {rows.length}
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 6, fontSize: 13, background: "color-mix(in srgb, var(--color-danger) 12%, transparent)", color: "var(--color-danger)", border: "1px solid var(--color-danger)" }}>
          {error}
        </div>
      )}

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Κατηγορία</th>
              <th style={th}>Επιμερισμός</th>
              <th style={th}>Πηγή</th>
              <th style={{ ...th, textAlign: "right" }}>Ενέργειες</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ ...td, textAlign: "center", color: "var(--muted-foreground)" }}>
                  Δεν υπάρχουν κατηγορίες
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const editing = editId === r.category.id;
                const t = editing ? clampPct(tenantPct) : r.effective.tenantPct;
                return (
                  <tr key={r.category.id}>
                    <td style={{ ...td, fontWeight: 600 }}>{r.category.name}</td>
                    <td style={td}>
                      {editing ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={tenantPct}
                            disabled={isPending}
                            onChange={(e) => setTenantPct(clampPct(Number(e.target.value)))}
                            style={{ width: 70, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-canvas)", color: "var(--foreground)", fontSize: 13 }}
                          />
                          <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                            % ενοικ. / {100 - t}% ιδιοκτ.
                          </span>
                        </span>
                      ) : (
                        `${r.effective.tenantPct}% ενοικ. / ${r.effective.ownerPct}% ιδιοκτ.`
                      )}
                    </td>
                    <td style={td}>
                      <span style={{
                        display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                        background: r.isOverridden ? "color-mix(in srgb, var(--color-primary) 12%, transparent)" : "var(--bg-canvas)",
                        color: r.isOverridden ? "var(--color-primary)" : "var(--muted-foreground)",
                        border: `1px solid ${r.isOverridden ? "var(--color-primary)" : "var(--border)"}`,
                      }}>
                        {r.isOverridden ? "Override" : "Προεπιλογή"}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        {editing ? (
                          <>
                            <button onClick={() => save(r.category.id)} disabled={isPending} title="Αποθήκευση" style={iconBtn}>
                              <RiSaveLine style={{ fontSize: 15 }} />
                            </button>
                            <button onClick={cancel} disabled={isPending} title="Άκυρο" style={iconBtn}>
                              <RiCloseLine style={{ fontSize: 15 }} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(r)} disabled={isPending} title="Επεξεργασία" style={iconBtn}>
                              <RiEditLine style={{ fontSize: 15 }} />
                            </button>
                            {r.isOverridden && (
                              <button onClick={() => reset(r.category.id)} disabled={isPending} title="Επαναφορά" style={{ ...iconBtn, color: "var(--color-danger)" }}>
                                <RiRefreshLine style={{ fontSize: 15 }} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", padding: "10px 14px", borderBottom: "1px solid var(--border)" };
const td: React.CSSProperties = { fontSize: 13, color: "var(--foreground)", padding: "12px 14px", borderBottom: "1px solid var(--border)" };
const iconBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-canvas)", cursor: "pointer", color: "var(--foreground)" };
