import { describe, it, expect } from "vitest";
import { addBusinessDays, businessDaysUntil, applyMarkup, withVat, invitationState, filterCandidates, type RfqCandidateDTO } from "./rfq-shared";

describe("business days", () => {
  it("skips weekends", () => {
    // Fri 2026-09-04 + 1 business day → Mon 2026-09-07
    expect(addBusinessDays(new Date(2026, 8, 4, 10), 1).getDate()).toBe(7);
    // Mon + 5 → next Mon
    expect(addBusinessDays(new Date(2026, 8, 7), 5).getDate()).toBe(14);
    expect(addBusinessDays(new Date(2026, 8, 7), 0).getDate()).toBe(7);
  });
  it("counts remaining business days", () => {
    expect(businessDaysUntil(new Date(2026, 8, 14), new Date(2026, 8, 7))).toBe(5);
    expect(businessDaysUntil(new Date(2026, 8, 7), new Date(2026, 8, 9))).toBe(-2);
    expect(businessDaysUntil(new Date(2026, 8, 7), new Date(2026, 8, 7))).toBe(0);
  });
});

describe("pricing", () => {
  it("applies markup and VAT with 2-decimal rounding", () => {
    expect(applyMarkup(100, 15)).toBe(115);
    expect(withVat(115, 24)).toBe(142.6);
  });
});

describe("invitationState", () => {
  const rfq = { status: "OPEN", deadlineAt: null as string | null };
  const base = { status: "INVITED", viewedAt: null as string | null, emailCount: 1, hasRecipient: true };
  const now = new Date("2026-10-20T12:00:00Z");
  it("SENT when mailed, OPENED once viewed", () => {
    expect(invitationState(base, rfq, now)).toBe("SENT");
    expect(invitationState({ ...base, viewedAt: "2026-10-20T11:00:00Z" }, rfq, now)).toBe("OPENED");
  });
  it("OFFERED / DECLINED follow the invitation status", () => {
    expect(invitationState({ ...base, status: "OFFERED" }, rfq, now)).toBe("OFFERED");
    expect(invitationState({ ...base, status: "DECLINED" }, rfq, now)).toBe("DECLINED");
  });
  it("EXPIRED when the invitation or RFQ is closed, or the deadline passed unanswered", () => {
    expect(invitationState({ ...base, status: "EXPIRED" }, rfq, now)).toBe("EXPIRED");
    expect(invitationState(base, { status: "CANCELLED", deadlineAt: null }, now)).toBe("EXPIRED");
    expect(invitationState(base, { status: "OPEN", deadlineAt: "2026-10-19T12:00:00Z" }, now)).toBe("EXPIRED");
    // an offer that came in before the deadline stays OFFERED afterwards
    expect(invitationState({ ...base, status: "OFFERED" }, { status: "OFFERED", deadlineAt: "2026-10-19T12:00:00Z" }, now)).toBe("OFFERED");
  });
  it("NO_EMAIL when nothing was ever sent and there is nobody to send to", () => {
    expect(invitationState({ ...base, emailCount: 0, hasRecipient: false }, rfq, now)).toBe("NO_EMAIL");
    expect(invitationState({ ...base, emailCount: 0, hasRecipient: true }, rfq, now)).toBe("SENT");
  });
});

describe("filterCandidates", () => {
  const c = (over: Partial<RfqCandidateDTO>): RfqCandidateDTO => ({ id: "x", name: "Χ", categories: [], categoryIds: [], distanceKm: null, ratingAvg: null, ratingCount: 0, score: 0, reasons: [], hasAccounts: false, recipientEmail: null, emergency24h: false, ...over });
  const rows = [
    c({ id: "near", name: "Κοντινός", distanceKm: 3, ratingAvg: 4.6, ratingCount: 9, categoryIds: ["el"], hasAccounts: true }),
    c({ id: "far", name: "Μακρινός", distanceKm: 48, ratingAvg: 3.2, ratingCount: 2, categoryIds: ["pl"] }),
    c({ id: "unknown", name: "Άγνωστος", distanceKm: null, ratingAvg: null, categoryIds: ["el"] }),
  ];
  it("maxKm drops rows beyond the limit and rows with unknown distance", () => {
    expect(filterCandidates(rows, { maxKm: 10 }).map((r) => r.id)).toEqual(["near"]);
    expect(filterCandidates(rows, { maxKm: null }).length).toBe(3);
  });
  it("minRating excludes unrated and low-rated rows", () => {
    expect(filterCandidates(rows, { minRating: 4 }).map((r) => r.id)).toEqual(["near"]);
  });
  it("category, account and text search filters", () => {
    expect(filterCandidates(rows, { categoryId: "el" }).map((r) => r.id)).toEqual(["near", "unknown"]);
    expect(filterCandidates(rows, { withAccount: true }).map((r) => r.id)).toEqual(["near"]);
    expect(filterCandidates(rows, { q: "μακρ" }).map((r) => r.id)).toEqual(["far"]);
  });
});
