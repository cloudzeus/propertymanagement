import { db } from "@/lib/db";
import el from "@/messages/el.json";
import en from "@/messages/en.json";
import { TranslationsEditor } from "./TranslationsEditor";

function flatten(obj: any, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v == null ? "" : String(v);
  }
  return out;
}

export default async function TranslationsCmsPage() {
  const elFlat = flatten(el);
  const enFlat = flatten(en);

  const keys = Array.from(new Set([...Object.keys(elFlat), ...Object.keys(enFlat)])).sort();
  const rows = keys.map((key) => ({
    key,
    el: elFlat[key] ?? "",
    en: enFlat[key] ?? "",
  }));

  const overrides = await db.uiMessage.findMany();
  const byKey = new Map(overrides.map((o) => [o.key, o]));
  for (const row of rows) {
    const o = byKey.get(row.key);
    if (o) {
      row.el = o.el ?? row.el;
      row.en = o.en ?? row.en;
    }
  }

  return <TranslationsEditor rows={rows} />;
}
