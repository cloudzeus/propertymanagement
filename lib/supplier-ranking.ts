/* Pure ranking of company-registry suppliers for a job (safe for client + Vitest).
 *
 * Signals (see suppliers program): continuity (preferred for this building /
 * category, or used here before), specialty match, rating, proximity to the
 * building, and 24/7 availability for urgent faults.
 */

export type RankCandidate = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  ratingAvg: number | null;
  ratingCount: number;
  emergency24h: boolean;
  categoryIds: string[];
  /** explicitly set as preferred for this building (+ this category or building-wide) */
  preferred: boolean;
  /** has done work in this building before */
  lastUsedHere: boolean;
  onboarded: boolean;
};

export type RankContext = {
  categoryId: string | null;
  lat: number | null;
  lng: number | null;
  priority: string; // LOW | NORMAL | HIGH | URGENT
};

export type RankedSupplier = RankCandidate & { score: number; distanceKm: number | null; reasons: string[] };

// Continuity is the business rule: an explicitly preferred supplier must beat
// even a top-rated specialist (specialty 40 + rating 30 = 70 < 80).
export const RANK_WEIGHTS = {
  preferred: 80,
  lastUsedHere: 25,
  specialty: 40,
  ratingPerStar: 6, // ×5 stars = 30
  distance: [[5, 20], [15, 12], [40, 5]] as [number, number][],
  emergencyUrgent: 10,
  notOnboarded: -5,
};

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function rankSuppliers(candidates: RankCandidate[], ctx: RankContext): RankedSupplier[] {
  const ranked = candidates.map((c) => {
    let score = 0;
    const reasons: string[] = [];

    if (c.preferred) { score += RANK_WEIGHTS.preferred; reasons.push("προτιμώμενος"); }
    else if (c.lastUsedHere) { score += RANK_WEIGHTS.lastUsedHere; reasons.push("ίδιος με προηγούμενη"); }

    if (ctx.categoryId && c.categoryIds.includes(ctx.categoryId)) { score += RANK_WEIGHTS.specialty; reasons.push("ειδικότητα"); }

    if (c.ratingCount > 0 && c.ratingAvg != null) {
      score += c.ratingAvg * RANK_WEIGHTS.ratingPerStar;
      reasons.push(`${c.ratingAvg.toLocaleString("el-GR", { maximumFractionDigits: 1 })}★ (${c.ratingCount})`);
    }

    let distanceKm: number | null = null;
    if (ctx.lat != null && ctx.lng != null && c.lat != null && c.lng != null) {
      distanceKm = haversineKm(ctx.lat, ctx.lng, c.lat, c.lng);
      const band = RANK_WEIGHTS.distance.find(([km]) => distanceKm! <= km);
      if (band) score += band[1];
      reasons.push(`${distanceKm < 10 ? distanceKm.toLocaleString("el-GR", { maximumFractionDigits: 1 }) : Math.round(distanceKm)} km`);
    }

    if (ctx.priority === "URGENT" && c.emergency24h) { score += RANK_WEIGHTS.emergencyUrgent; reasons.push("24/7"); }
    if (!c.onboarded) score += RANK_WEIGHTS.notOnboarded;

    return { ...c, score, distanceKm, reasons };
  });
  // stable: higher score first, then nearer, then name
  return ranked.sort((a, b) => b.score - a.score || (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9) || a.name.localeCompare(b.name, "el"));
}

/** One-line label for a <select> option: "Παπαδόπουλος — προτιμώμενος · ειδικότητα · 4,8★ (12) · 3,2 km". */
export function describeRank(r: RankedSupplier): string {
  return r.reasons.length ? `${r.name} — ${r.reasons.join(" · ")}` : r.name;
}
