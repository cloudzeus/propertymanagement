import { describe, it, expect } from "vitest";
import { exampleForAnnouncement } from "./announcement";

describe("exampleForAnnouncement", () => {
  it("counts recipients per audience and lists the channels", () => {
    const targets = [{ roles: ["OWNER"] }, { roles: ["RESIDENT"] }, { roles: ["OWNER", "RESIDENT"] }] as { roles: ("OWNER" | "RESIDENT")[] }[];
    expect(exampleForAnnouncement({ kind: "URGENT", title: "Διακοπή νερού", audience: "ALL", targets, selectedCount: 0, addToCalendar: false }).recipients).toBe(3);
    expect(exampleForAnnouncement({ kind: "INFO", title: "X", audience: "OWNERS", targets, selectedCount: 0, addToCalendar: false }).recipients).toBe(2);
    expect(exampleForAnnouncement({ kind: "INFO", title: "X", audience: "RESIDENTS", targets, selectedCount: 0, addToCalendar: false }).recipients).toBe(2);
    expect(exampleForAnnouncement({ kind: "INFO", title: "X", audience: "CUSTOM", targets, selectedCount: 1, addToCalendar: true }).recipients).toBe(1);
  });
  it("channels: email + bell + portal, signage board, and calendar when asked", () => {
    const ex = exampleForAnnouncement({ kind: "MEETING", title: "ΓΣ", audience: "ALL", targets: [], selectedCount: 0, addToCalendar: true });
    expect(ex.channels).toEqual(expect.arrayContaining(["Email με σύνδεσμο «Έλαβα γνώση»", "Ημερολόγιο κτηρίου"]));
    expect(ex.kindLine).toContain("συνέλευση");
  });
});
