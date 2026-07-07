"use client";
import { useEffect, useState } from "react";
import { RiRobot2Line, RiAddLine } from "react-icons/ri";

interface Tool {
  apiName: string; displayName: string; category: string; costModel: string;
  unitLabel: string; basePrice: number; freeQuota: number; markupPercent: number;
  enabled: boolean; documentationUrl?: string | null; notes?: string | null;
}
const EMPTY: Tool = { apiName: "", displayName: "", category: "ai", costModel: "per_token", unitLabel: "tokens", basePrice: 0, freeQuota: 0, markupPercent: 0, enabled: true };

export default function AiToolsClient() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [draft, setDraft] = useState<Tool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/super-admin/ai-tools");
    if (res.ok) setTools((await res.json()).tools);
    else setError("Failed to load tools");
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!draft) return;
    const isNew = !tools.some((t) => t.apiName === draft.apiName);
    const res = await fetch(isNew ? "/api/super-admin/ai-tools" : `/api/super-admin/ai-tools/${encodeURIComponent(draft.apiName)}`, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (!res.ok) { setError("Save failed"); return; }
    setDraft(null); setError(null); await load();
  };
  const remove = async (apiName: string) => {
    if (!confirm(`Delete ${apiName}?`)) return;
    const res = await fetch(`/api/super-admin/ai-tools/${encodeURIComponent(apiName)}`, { method: "DELETE" });
    if (!res.ok) { setError("Delete failed"); return; }
    await load();
  };
  const isEditing = draft && tools.some((t) => t.apiName === draft.apiName);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2"><RiRobot2Line /> AI Tools &amp; APIs</h1>
          <p className="text-gray-600 mt-1">Define billable AI/API/video tools, base cost and markup.</p>
        </div>
        <button onClick={() => { setDraft({ ...EMPTY }); setError(null); }} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg">
          <RiAddLine /> Add tool
        </button>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}
      {loading ? <p className="text-gray-600">Loading…</p> : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b">
              <th className="p-3">Name</th><th>apiName</th><th>Category</th><th>Cost model</th>
              <th>Base price</th><th>Unit</th><th>Free quota</th><th>Markup %</th><th>Enabled</th><th></th>
            </tr></thead>
            <tbody>
              {tools.map((t) => (
                <tr key={t.apiName} className="border-b">
                  <td className="p-3 font-medium">{t.displayName}</td>
                  <td><code className="bg-gray-100 px-1 rounded text-xs">{t.apiName}</code></td><td>{t.category}</td><td>{t.costModel}</td>
                  <td>€{t.basePrice}</td><td>{t.unitLabel}</td><td>{t.freeQuota}</td><td>{t.markupPercent}%</td>
                  <td>{t.enabled ? "✓" : "—"}</td>
                  <td className="whitespace-nowrap">
                    <button className="text-blue-600 mr-3" onClick={() => { setDraft({ ...t }); setError(null); }}>Edit</button>
                    <button className="text-red-600" onClick={() => remove(t.apiName)}>Delete</button>
                  </td>
                </tr>
              ))}
              {tools.length === 0 && <tr><td colSpan={10} className="p-4 text-gray-500">No tools yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {draft && (
        <div className="bg-white rounded-lg shadow p-6 space-y-3 max-w-2xl">
          <h2 className="text-lg font-semibold">{isEditing ? "Edit" : "New"} tool</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">apiName<input disabled={!!isEditing} className="border p-2 w-full rounded disabled:bg-gray-100" value={draft.apiName} onChange={(e) => setDraft({ ...draft, apiName: e.target.value })} /></label>
            <label className="text-sm">Display name<input className="border p-2 w-full rounded" value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} /></label>
            <label className="text-sm">Category
              <select className="border p-2 w-full rounded" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                <option value="ai">ai</option><option value="api">api</option><option value="video">video</option>
              </select></label>
            <label className="text-sm">Cost model
              <select className="border p-2 w-full rounded" value={draft.costModel} onChange={(e) => setDraft({ ...draft, costModel: e.target.value })}>
                <option>per_token</option><option>per_minute</option><option>per_gb</option><option>per_request</option><option>per_email</option>
              </select></label>
            <label className="text-sm">Base price (€/unit)<input type="number" step="0.0001" className="border p-2 w-full rounded" value={draft.basePrice} onChange={(e) => setDraft({ ...draft, basePrice: Number(e.target.value) })} /></label>
            <label className="text-sm">Unit label<input className="border p-2 w-full rounded" value={draft.unitLabel} onChange={(e) => setDraft({ ...draft, unitLabel: e.target.value })} /></label>
            <label className="text-sm">Free quota<input type="number" className="border p-2 w-full rounded" value={draft.freeQuota} onChange={(e) => setDraft({ ...draft, freeQuota: Number(e.target.value) })} /></label>
            <label className="text-sm">Markup %<input type="number" className="border p-2 w-full rounded" value={draft.markupPercent} onChange={(e) => setDraft({ ...draft, markupPercent: Number(e.target.value) })} /></label>
            <label className="text-sm col-span-2">Documentation URL<input className="border p-2 w-full rounded" value={draft.documentationUrl ?? ""} onChange={(e) => setDraft({ ...draft, documentationUrl: e.target.value })} /></label>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Save</button>
            <button onClick={() => setDraft(null)} className="px-4 py-2 border rounded-lg">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
