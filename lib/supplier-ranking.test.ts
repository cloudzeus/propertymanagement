import { describe, it, expect } from "vitest";
import { haversineKm, rankSuppliers, describeRank, type RankCandidate } from "./supplier-ranking";

const base = (over: Partial<RankCandidate>): RankCandidate => ({
  id: over.id ?? "x", name: over.name ?? "X", lat: null, lng: null, ratingAvg: null, ratingCount: 0,
  emergency24h: false, categoryIds: [], preferred: false, lastUsedHere: false, onboarded: true, ...over,
});
// Athens centre vs. Piraeus (~8 km) and Thessaloniki (~300 km)
const ATHENS = { lat: 37.9838, lng: 23.7275 };

describe("haversineKm", () => {
  it("measures Athens → Piraeus ≈ 8 km and Athens → Thessaloniki ≈ 300 km", () => {
    expect(haversineKm(ATHENS.lat, ATHENS.lng, 37.9475, 23.6415)).toBeCloseTo(8.5, 0);
    expect(Math.round(haversineKm(ATHENS.lat, ATHENS.lng, 40.6401, 22.9444))).toBeGreaterThan(290);
  });
});

describe("rankSuppliers", () => {
  const ctx = { categoryId: "elec", lat: ATHENS.lat, lng: ATHENS.lng, priority: "NORMAL" };

  it("puts the preferred supplier first even against a better-rated specialist", () => {
    const out = rankSuppliers([
      base({ id: "a", name: "Specialist", categoryIds: ["elec"], ratingAvg: 5, ratingCount: 10 }),
      base({ id: "b", name: "Preferred", preferred: true }),
    ], ctx);
    expect(out[0].id).toBe("b");
    expect(out[0].reasons).toContain("προτιμώμενος");
  });

  it("continuity: a supplier used here before outranks an equal stranger", () => {
    const out = rankSuppliers([
      base({ id: "a", name: "Stranger", categoryIds: ["elec"] }),
      base({ id: "b", name: "Known", categoryIds: ["elec"], lastUsedHere: true }),
    ], ctx);
    expect(out[0].id).toBe("b");
  });

  it("proximity: nearer supplier wins when everything else is equal", () => {
    const out = rankSuppliers([
      base({ id: "far", name: "Far", lat: 40.6401, lng: 22.9444 }),
      base({ id: "near", name: "Near", lat: 37.9475, lng: 23.6415 }),
    ], ctx);
    expect(out[0].id).toBe("near");
    expect(out[0].distanceKm).not.toBeNull();
  });

  it("24/7 only counts for URGENT faults", () => {
    const cands = [base({ id: "a", name: "A" }), base({ id: "b", name: "B", emergency24h: true })];
    expect(rankSuppliers(cands, { ...ctx, priority: "NORMAL" })[0].score).toBe(rankSuppliers(cands, { ...ctx, priority: "NORMAL" })[1].score);
    expect(rankSuppliers(cands, { ...ctx, priority: "URGENT" })[0].id).toBe("b");
  });

  it("describeRank renders a compact label", () => {
    const [r] = rankSuppliers([base({ id: "a", name: "Παπαδόπουλος", categoryIds: ["elec"], ratingAvg: 4.75, ratingCount: 12 })], { ...ctx, lat: null, lng: null });
    expect(describeRank(r)).toBe("Παπαδόπουλος — ειδικότητα · 4,8★ (12)");
  });
});
