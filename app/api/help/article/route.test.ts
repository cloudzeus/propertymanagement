import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ eff: vi.fn(), findForPath: vi.fn(), getArticle: vi.fn(), loadIndex: vi.fn(async () => [] as unknown[]) }));
vi.mock("@/lib/auth-effective", () => ({ getEffectiveSession: m.eff }));
vi.mock("@/lib/help/index", () => ({ findArticleForPath: m.findForPath, getArticle: m.getArticle, loadWikiIndex: m.loadIndex, hubHrefForRole: () => "/portal/help" }));
vi.mock("@/lib/help", () => ({ MANUALS: { owner: { title: "Οδηγός ιδιοκτήτη" } }, manualForRole: () => "owner" }));

import { GET } from "./route";

const meta = { slug: "building-detail", title: "Το κτήριο", route: "/building/[id]", roles: [], surface: "customer", area: "assets", summary: "s", prompts: ["Πώς πληρώνω;"], related: ["building-home", "staff-only"], sections: ["koino: Κοινόχρηστα"] };
const all = [meta, { ...meta, slug: "building-home", title: "Τα κτήριά μου", related: [], sections: [] }, { ...meta, slug: "staff-only", title: "Μόνο στελέχη", roles: ["ADMIN"], related: [], sections: [] }];
const get = (qs: string) => GET(new Request(`http://x/api/help/article?${qs}`));

beforeEach(() => {
  vi.clearAllMocks();
  m.eff.mockResolvedValue({ user: { id: "u1", role: "PROPERTY_OWNER" } });
  m.findForPath.mockResolvedValue(meta);
  m.getArticle.mockResolvedValue({ meta, markdown: "## Επισκόπηση\nx\n## Κοινόχρηστα\ny" });
  m.loadIndex.mockResolvedValue(all);
});

describe("GET /api/help/article", () => {
  it("returns the anchor of the section that matches ?s= (tab) and role-visible related titles", async () => {
    const res = await get("path=%2Fbuilding%2Fb1&s=koino");
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.anchor).toBe("κοινόχρηστα");
    expect(j.related).toEqual([{ slug: "building-home", title: "Τα κτήριά μου" }]);
  });
  it("returns anchor null when the tab has no section", async () => {
    const j = await (await get("path=%2Fbuilding%2Fb1&s=people")).json();
    expect(j.anchor).toBeNull();
    expect(j.markdown).toBeDefined();
  });
  it("serves only the prompts (no markdown, no role filtering work) with ?fields=prompts", async () => {
    const j = await (await get("path=%2Fbuilding%2Fb1&fields=prompts")).json();
    expect(j).toEqual({ prompts: ["Πώς πληρώνω;"] });
    expect(m.getArticle).not.toHaveBeenCalled();
    expect(m.loadIndex).not.toHaveBeenCalled();
  });
  it("answers ?fields=prompts with an empty list when the page has no article", async () => {
    m.findForPath.mockResolvedValue(null);
    const res = await get("path=%2Fnowhere&fields=prompts");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ prompts: [] });
  });
  it("rejects anonymous callers", async () => {
    m.eff.mockResolvedValue(null);
    expect((await get("path=%2F")).status).toBe(401);
  });
});
