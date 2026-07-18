/** Media (images/videos) are language-independent in the CMS: every `*Url` field must hold the
 *  same value in all locales. Walks el/en in parallel (objects by key, arrays by index) and fills
 *  an empty side from the non-empty one. Pure — usable from server actions and scripts. */
export function syncMediaAcrossLocales<T extends { el?: any; en?: any }>(data: T): T {
  if (!data || typeof data !== "object" || !("el" in data) || !("en" in data)) return data;
  const [el, en] = syncPair(data.el, data.en);
  return { ...data, el, en };
}

function syncPair(a: any, b: any): [any, any] {
  if (Array.isArray(a) && Array.isArray(b)) {
    const outA = [...a]; const outB = [...b];
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) [outA[i], outB[i]] = syncPair(a[i], b[i]);
    return [outA, outB];
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const outA: Record<string, unknown> = { ...a };
    const outB: Record<string, unknown> = { ...b };
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (/Url$/.test(k)) {
        const va = typeof a[k] === "string" ? a[k] : "";
        const vb = typeof b[k] === "string" ? b[k] : "";
        if (va && !vb) outB[k] = va;
        else if (vb && !va) outA[k] = vb;
      } else {
        [outA[k], outB[k]] = syncPair(a[k], b[k]);
      }
    }
    return [outA, outB];
  }
  return [a, b];
}
