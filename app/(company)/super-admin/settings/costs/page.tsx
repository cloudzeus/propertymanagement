"use client";

import { useEffect, useState } from "react";
import { RiMoneyEuroCircleLine, RiRefreshLine } from "react-icons/ri";

interface APICostData {
  apiName: string;
  period: string;
  totalRequests: number;
  totalTokens: number;
  totalBytes: number;
  totalGB: string;
  totalCost: number;
}

interface MonthlyCostData {
  year: number;
  month: number;
  summary: any[];
  totalCost: number;
}

export default function CostsPage() {
  const [apiCosts, setApiCosts] = useState<APICostData[]>([]);
  const [monthlyCosts, setMonthlyCosts] = useState<MonthlyCostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configs, setConfigs] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ basePrice: string; freeQuota: string; markupPercent: string }>({ basePrice: "", freeQuota: "", markupPercent: "" });
  const [saving, setSaving] = useState(false);

  const saveConfig = async (apiName: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/super-admin/costs/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiName,
          basePrice: parseFloat(draft.basePrice),
          freeQuota: parseInt(draft.freeQuota || "0", 10),
          markupPercent: parseFloat(draft.markupPercent || "0"),
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      const { config } = await res.json();
      setConfigs((cs) => cs.map((c) => (c.apiName === apiName ? { ...c, ...config } : c)));
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const fetchCosts = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/super-admin/costs/summary");
        if (!response.ok) throw new Error("Failed to fetch costs");
        const data = await response.json();
        setApiCosts(data.breakdown || []);

        const cfgRes = await fetch("/api/super-admin/costs/config");
        if (cfgRes.ok) {
          const cfgData = await cfgRes.json();
          setConfigs(cfgData.configs || []);
        }

        const now = new Date();
        const monthResponse = await fetch(
          `/api/super-admin/costs/monthly?year=${now.getFullYear()}&month=${now.getMonth() + 1}`
        );
        if (monthResponse.ok) {
          const monthData = await monthResponse.json();
          setMonthlyCosts(monthData);
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load costs");
      } finally {
        setLoading(false);
      }
    };
    fetchCosts();
  }, []);

  const currentMonthTotal = monthlyCosts?.totalCost || 0;
  const last30DaysTotal = apiCosts.reduce((sum, api) => sum + api.totalCost, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <RiMoneyEuroCircleLine style={{ fontSize: 24, color: "var(--color-success)" }} />
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Κόστη API</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>Χρήση και κόστη API υπηρεσιών</p>
        </div>
      </div>

      {error && (
        <div style={{
          padding: 16, borderRadius: "var(--radius)",
          background: "#FEE7E618", border: "1px solid var(--color-danger)",
          color: "var(--color-danger)", fontSize: 13,
        }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {[
          { label: "Τρέχων Μήνας", value: `€${currentMonthTotal.toFixed(2)}`, sub: new Date().toLocaleDateString("el-GR", { month: "long", year: "numeric" }) },
          { label: "Τελευταίες 30 μέρες", value: `€${last30DaysTotal.toFixed(2)}`, sub: "Σύνολο κόστους API" },
        ].map((s) => (
          <div key={s.label} style={{
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", padding: "20px 24px",
          }}>
            <div style={{ fontSize: 13, color: "var(--muted-foreground)", fontWeight: 500, marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--foreground)" }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: "0 0 16px" }}>Ανάλυση ανά API (30 ημέρες)</h2>

        {loading ? (
          <div style={{ padding: "24px 0", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
            <RiRefreshLine style={{ fontSize: 24, display: "block", margin: "0 auto 8px", opacity: 0.5 }} />
            Φόρτωση δεδομένων...
          </div>
        ) : apiCosts.length === 0 ? (
          <div style={{ padding: "24px 0", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
            Δεν υπάρχουν δεδομένα χρήσης API ακόμα
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {apiCosts.map((api) => {
              const config = configs.find((c) => c.apiName === api.apiName);
              const percentage = last30DaysTotal > 0 ? (api.totalCost / last30DaysTotal) * 100 : 0;
              return (
                <div key={api.apiName} style={{
                  padding: 16, border: "1px solid var(--border)",
                  borderRadius: 8, background: "var(--bg-canvas)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                        {config?.displayName || api.apiName}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{config?.costModel}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)" }}>€{api.totalCost.toFixed(2)}</div>
                      <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{percentage.toFixed(1)}% του συνόλου</div>
                    </div>
                  </div>
                  {config && (
                    <div style={{ display: "flex", gap: 20, fontSize: 12, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ color: "var(--muted-foreground)" }}>
                        Πραγματικό: <strong style={{ color: "var(--foreground)" }}>€{api.totalCost.toFixed(2)}</strong>
                      </span>
                      <span style={{ color: "var(--muted-foreground)" }}>
                        Markup: <strong style={{ color: "var(--foreground)" }}>{config.markupPercent}%</strong>
                      </span>
                      <span style={{ color: "var(--muted-foreground)" }}>
                        Χρέωση admin: <strong style={{ color: "var(--color-success)" }}>€{(api.totalCost * (1 + (config.markupPercent || 0) / 100)).toFixed(2)}</strong>
                      </span>
                      <button
                        onClick={() => { setEditing(api.apiName); setDraft({ basePrice: String(config.basePrice), freeQuota: String(config.freeQuota), markupPercent: String(config.markupPercent) }); }}
                        style={{ marginLeft: "auto", fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", color: "var(--foreground)" }}
                      >
                        Επεξεργασία
                      </button>
                    </div>
                  )}
                  {editing === api.apiName && (
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 12, flexWrap: "wrap" }}>
                      {([
                        { key: "basePrice", label: `Τιμή/μονάδα (${config?.costModel})`, step: "0.0001" },
                        { key: "freeQuota", label: "Δωρεάν όριο", step: "1" },
                        { key: "markupPercent", label: "Markup %", step: "1" },
                      ] as const).map((f) => (
                        <label key={f.key} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--muted-foreground)" }}>
                          {f.label}
                          <input
                            type="number" step={f.step} value={draft[f.key]}
                            onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                            style={{ width: 130, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-canvas)", color: "var(--foreground)" }}
                          />
                        </label>
                      ))}
                      <button disabled={saving} onClick={() => saveConfig(api.apiName)} style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                        {saving ? "Αποθήκευση…" : "Αποθήκευση"}
                      </button>
                      <button disabled={saving} onClick={() => setEditing(null)} style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", cursor: "pointer" }}>
                        Άκυρο
                      </button>
                    </div>
                  )}
                  <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
                    <div style={{ height: "100%", width: `${Math.min(percentage, 100)}%`, background: "var(--color-primary)", borderRadius: 3 }} />
                  </div>
                  <div style={{ display: "flex", gap: 24, fontSize: 12 }}>
                    {api.totalRequests > 0 && (
                      <div>
                        <div style={{ color: "var(--muted-foreground)" }}>Αιτήματα</div>
                        <div style={{ fontWeight: 600, color: "var(--foreground)" }}>{api.totalRequests.toLocaleString()}</div>
                      </div>
                    )}
                    {api.totalTokens > 0 && (
                      <div>
                        <div style={{ color: "var(--muted-foreground)" }}>Tokens</div>
                        <div style={{ fontWeight: 600, color: "var(--foreground)" }}>{(api.totalTokens / 1000).toFixed(1)}K</div>
                      </div>
                    )}
                    {api.totalBytes > 0 && (
                      <div>
                        <div style={{ color: "var(--muted-foreground)" }}>Δεδομένα</div>
                        <div style={{ fontWeight: 600, color: "var(--foreground)" }}>{api.totalGB} GB</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {monthlyCosts && monthlyCosts.summary.length > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: "0 0 16px" }}>
            {new Date().toLocaleDateString("el-GR", { month: "long", year: "numeric" })} — Ανά Υπηρεσία
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {monthlyCosts.summary.map((item: any) => (
              <div key={item.apiName} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", background: "var(--bg-canvas)", borderRadius: 6,
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>{item.apiName}</div>
                  {item.requestCount > 0 && (
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{item.requestCount} αιτήματα</div>
                  )}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>€{item.totalCost.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
