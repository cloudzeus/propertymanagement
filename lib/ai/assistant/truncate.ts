/** Serialize a tool result for the model, bounded to `maxChars` and always valid JSON. */
export function truncateToolResult(data: unknown, maxChars = 6000): string {
  let s = JSON.stringify(data ?? null);
  if (s.length <= maxChars) return s;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const obj = { ...(data as Record<string, unknown>) };
    const arrays = Object.entries(obj).filter(([, v]) => Array.isArray(v) && (v as unknown[]).length > 1) as [string, unknown[]][];
    for (const [key, arr] of arrays) {
      let keep = arr.length;
      while (keep > 1) {
        keep = Math.max(1, Math.floor(keep / 2));
        const trial = { ...obj, [key]: arr.slice(0, keep), _note: `…και ${arr.length - keep} ακόμη` };
        s = JSON.stringify(trial);
        if (s.length <= maxChars) return s;
      }
      obj[key] = arr.slice(0, 1);
      obj._note = `…και ${arr.length - 1} ακόμη`;
    }
    s = JSON.stringify(obj);
    if (s.length <= maxChars) return s;
  }
  // Last resort: a shortened text payload, re-serialized so escaping stays valid.
  let cut = Math.max(0, maxChars - 40);
  for (;;) {
    const out = JSON.stringify({ truncated: true, text: s.slice(0, cut) });
    if (out.length <= maxChars || cut === 0) return out;
    cut = Math.floor(cut * 0.8);
  }
}
