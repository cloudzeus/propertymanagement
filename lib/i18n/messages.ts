import "server-only";
import { db } from "@/lib/db";

export function applyOverrides(base: Record<string, any>, overrides: { key: string; value: string }[]): Record<string, any> {
  const out = structuredClone(base);
  for (const { key, value } of overrides) {
    const parts = key.split(".");
    let node: any = out;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof node[parts[i]] !== "object" || node[parts[i]] == null) node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
  }
  return out;
}

export async function loadMessages(locale: "el" | "en"): Promise<Record<string, any>> {
  const base = (await import(`../../messages/${locale}.json`)).default;
  try {
    const rows = await db.uiMessage.findMany();
    const overrides = rows.map((r) => ({ key: r.key, value: (locale === "el" ? r.el : r.en) ?? "" })).filter((o) => o.value !== "");
    return applyOverrides(base, overrides);
  } catch {
    return base;
  }
}
