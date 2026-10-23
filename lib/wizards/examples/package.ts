/**
 * Client-safe package pricing preview (the server's lib/billing/service-amount is
 * the authority for payment; this mirrors it for wizards and the PropertyPackages
 * panel so previews never disagree with the invoice).
 */
export type PkgCounts = { units: number; buildings: number; commonAreas: number };
export type PkgServiceLike = { pricingModel: string; price: number; zonePrices?: Record<string, number> | null };
export type PkgLinePreview = { qty: number | null; amount: number; detail: string | null };

const round2 = (n: number) => Math.round(n * 100) / 100;
const eur = (n: number) => `${n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/**
 * Monthly line of one service for the given counts. For PER_ZONE pass the zone
 * code of every building (`null` = no distance yet) to get base + Σ zone amounts;
 * without codes only the base price is known.
 */
export function lineFor(s: PkgServiceLike, c: PkgCounts, zoneCodes?: (string | null)[]): PkgLinePreview {
  switch (s.pricingModel) {
    case "PER_UNIT": return { qty: c.units, amount: round2(s.price * c.units), detail: null };
    case "PER_BUILDING": return { qty: c.buildings, amount: round2(s.price * c.buildings), detail: null };
    case "PER_COMMON_AREA": return { qty: c.commonAreas, amount: round2(s.price * c.commonAreas), detail: null };
    case "FLAT": return { qty: 1, amount: round2(s.price), detail: null };
    case "METERED_PREPAID": return { qty: null, amount: 0, detail: "προπληρωμένα λεπτά συνελεύσεων" };
    case "PER_ZONE": {
      if (!zoneCodes) return { qty: 1, amount: round2(s.price), detail: "από τη βασική τιμή· το ποσό ζώνης προστίθεται όταν ενεργοποιηθεί" };
      const zonesSum = round2(zoneCodes.reduce((t, code) => t + (code ? Number(s.zonePrices?.[code] ?? 0) || 0 : 0), 0));
      const unknown = zoneCodes.filter((z) => !z).length;
      const note = unknown ? ` (${unknown} ${unknown === 1 ? "κτήριο" : "κτήρια"} χωρίς απόσταση)` : "";
      return { qty: 1, amount: round2(s.price + zonesSum), detail: `βάση ${eur(s.price)} + ζώνες ${eur(zonesSum)}${note}` };
    }
    default: return { qty: null, amount: 0, detail: null };
  }
}

/** Monthly total of the enabled services. */
export function packageTotal(services: (PkgServiceLike & { enabled: boolean })[], c: PkgCounts, zoneCodes?: (string | null)[]): number {
  return round2(services.filter((s) => s.enabled).reduce((t, s) => t + lineFor(s, c, zoneCodes).amount, 0));
}
