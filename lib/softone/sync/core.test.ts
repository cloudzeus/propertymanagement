import { describe, it, expect } from "vitest";
import { PULL_ENTITIES, PULL_ORDER, diffRows, pullEntity, type ExistingRow } from "./core";

const col = (row: Record<string, unknown>, f: string): unknown => {
  if (f in row) return row[f];
  const k = Object.keys(row).find((k) => k.endsWith(`.${f}`));
  return k ? row[k] : undefined;
};

describe("PULL_ENTITIES", () => {
  it("runs VAT first and ZIP last", () => {
    expect(PULL_ORDER[0]).toBe("vat");
    expect(PULL_ORDER[PULL_ORDER.length - 1]).toBe("zip");
    expect(new Set(PULL_ORDER).size).toBe(PULL_ENTITIES.length);
  });

  it("normalizes VAT rows whether columns are prefixed or not", () => {
    const vat = pullEntity("vat")!;
    const a = vat.normalize({ VAT: 1410, NAME: "Κανονικός 24%", PERCNT: 24, ISACTIVE: 1 }, col)!;
    const b = vat.normalize({ "VAT.VAT": "1410", "VAT.NAME": "Κανονικός 24%", "VAT.PERCNT": "24,00", "VAT.ISACTIVE": "1" }, col)!;
    expect(a.s1Key).toBe(1410);
    expect(a.extra.percent).toBe(24);
    expect(b.s1Key).toBe(1410);
    expect(b.extra.percent).toBe(24);
    expect(b.isActive).toBe(true);
  });

  it("refuses rows without a key", () => {
    expect(pullEntity("unit")!.normalize({ NAME: "τεμ." }, col)).toBeNull();
  });

  it("labels SERIES flows and keeps unknown flows as plain numbers", () => {
    const s = pullEntity("series")!;
    const r = s.normalize({ SERIES: 7000, CODE: "ΤΠΥ", NAME: "Τιμολόγιο παροχής υπηρεσιών", SOSOURCE: 1351, TFPRMS: 20, ISACTIVE: 1 }, col)!;
    expect(r.extra.sosourceLabel).toBe("Πωλήσεις");
    expect(r.extra.tfprms).toBe(20);
    const u = s.normalize({ SERIES: 7001, CODE: "X", NAME: "X", SOSOURCE: 9999 }, col)!;
    expect(u.extra.sosource).toBe(9999);
    expect(u.extra.sosourceLabel).toBeNull();
  });

  it("uses the ZIP area as the name (city list)", () => {
    const z = pullEntity("zip")!.normalize({ ZIP: 5, CODE: "10431", DISTRICTS: "ΑΘΗΝΑ", DISTRICT: 1, COUNTRY: 1000 }, col)!;
    expect(z.name).toBe("ΑΘΗΝΑ");
    expect(z.code).toBe("10431");
    expect(z.extra.district).toBe(1);
  });
});

describe("diffRows", () => {
  const existing: ExistingRow[] = [
    { s1Key: 1, code: "A", name: "Alpha", isActive: true, extra: { percent: 24 } },
    { s1Key: 2, code: "B", name: "Beta", isActive: true, extra: { percent: 13 } },
    { s1Key: 3, code: "C", name: "Gamma", isActive: true, extra: { percent: 6 } },
    { s1Key: 9, code: "Z", name: "Old", isActive: false, extra: { percent: 0 } },
  ];
  const row = (s1Key: number, name: string, percent: number, isActive = true) => ({ s1Key, code: null, name, isActive, extra: { percent }, raw: {} });

  it("classifies inserted / updated / unchanged / deactivated", () => {
    const d = diffRows([row(1, "Alpha", 24), row(2, "Beta (new)", 13), row(4, "Delta", 0), null], existing);
    expect(d.fetched).toBe(4);
    expect(d.skipped).toBe(1);
    expect(d.unchanged).toBe(0); // row 1 differs only in code (A → null) → update
    expect(d.updated.map((u) => u.s1Key)).toEqual([1, 2]);
    expect(d.updated[1].changes?.name).toEqual({ from: "Beta", to: "Beta (new)" });
    expect(d.inserted.map((i) => i.s1Key)).toEqual([4]);
    expect(d.deactivated.map((x) => x.s1Key)).toEqual([3]); // 9 was already inactive
  });

  it("treats numeric strings and numbers as equal", () => {
    const d = diffRows([{ s1Key: 1, code: "A", name: "Alpha", isActive: true, extra: { percent: "24" }, raw: {} }], existing.slice(0, 1));
    expect(d.unchanged).toBe(1);
    expect(d.updated).toHaveLength(0);
  });
});
