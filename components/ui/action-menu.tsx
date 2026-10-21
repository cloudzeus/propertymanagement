"use client";

/**
 * Grouped action menu shared by the DataTable row dropdown, the phone action
 * sheet and the «Ενέργειες» button. `groupActions` / `pickPrimary` are pure.
 */
export type MenuEntry = {
  key: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  section?: string;
  primary?: boolean;
  onPick: () => void;
};

/** Groups by section in first-appearance order; an unsectioned entry forms its own run where it appears. */
export function groupActions(entries: MenuEntry[]): MenuEntry[][] {
  const groups: MenuEntry[][] = [];
  const bySection = new Map<string, MenuEntry[]>();
  for (const e of entries) {
    if (e.section === undefined) {
      const last = groups[groups.length - 1];
      if (last && last[0].section === undefined) last.push(e);
      else groups.push([e]);
      continue;
    }
    let g = bySection.get(e.section);
    if (!g) { g = []; bySection.set(e.section, g); groups.push(g); }
    g.push(e);
  }
  return groups;
}

/**
 * Phone cards: which actions become pills and whether a «Ενέργειες» sheet is
 * needed. Lists that never flag `primary` and have ≤ 3 actions keep today's
 * behaviour (every action is a pill).
 */
export function pickPrimary(entries: MenuEntry[], max = 2): { pills: MenuEntry[]; overflow: MenuEntry[] } {
  const primary = entries.filter((e) => e.primary);
  if (primary.length === 0 && entries.length <= 3) return { pills: entries, overflow: [] };
  const pills = (primary.length ? primary : entries).slice(0, max);
  return { pills, overflow: entries };
}

const item: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, width: "100%", minHeight: 36,
  padding: "7px 12px", border: "none", background: "transparent", cursor: "pointer",
  fontSize: "var(--fs-12-5)", fontFamily: "inherit", textAlign: "left",
};

export function ActionMenuList({ entries, onPicked }: { entries: MenuEntry[]; onPicked?: () => void }) {
  const groups = groupActions(entries);
  return (
    <div role="menu">
      {groups.map((g, gi) => (
        <div key={gi} style={{ borderTop: gi === 0 ? "none" : "1px solid var(--border)", padding: "2px 0" }}>
          {g.map((e) => (
            <button
              key={e.key}
              type="button"
              role="menuitem"
              onClick={() => { e.onPick(); onPicked?.(); }}
              style={{ ...item, color: e.danger ? "var(--destructive)" : "var(--foreground)", fontWeight: e.primary ? 600 : 500 }}
              onMouseEnter={(ev) => (ev.currentTarget.style.background = e.danger ? "color-mix(in oklch, var(--destructive) 8%, var(--card))" : "var(--muted)")}
              onMouseLeave={(ev) => (ev.currentTarget.style.background = "transparent")}
            >
              {e.icon && <span style={{ flexShrink: 0, display: "inline-flex" }}>{e.icon}</span>}
              {e.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
