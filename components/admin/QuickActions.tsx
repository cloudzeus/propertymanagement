"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  RiFlashlightLine, RiCloseLine, RiAlarmWarningLine, RiMoneyEuroCircleLine, RiToolsLine, RiFileTextLine, RiCalendarTodoLine, RiCalendarLine,
  RiNotification2Line, RiTeamLine, RiPriceTag3Line, RiContactsLine, RiCommunityLine, RiRobot2Line, RiGroupLine, RiShieldUserLine, RiSettings3Line,
  RiBuilding2Line, RiLayoutLine, RiArticleLine, RiImage2Line, RiMailCheckLine, RiFileListLine, RiQuestionLine, RiTruckLine, RiMoneyDollarCircleLine, RiStoreLine, RiArrowRightSLine,
} from "react-icons/ri";
import { resolveQuickActions, quickActionsTitle, type QuickAction } from "@/lib/quick-actions";
import { ExpenseQuickModal } from "@/components/buildings/GlobalExpenseButton";
import type { ManageableBuilding } from "@/app/actions/building-expenses";

const ICONS: Record<string, React.ElementType> = {
  RiAlarmWarningLine, RiMoneyEuroCircleLine, RiToolsLine, RiFileTextLine, RiCalendarTodoLine, RiCalendarLine, RiNotification2Line, RiTeamLine, RiPriceTag3Line,
  RiContactsLine, RiCommunityLine, RiRobot2Line, RiGroupLine, RiShieldUserLine, RiSettings3Line, RiBuilding2Line, RiLayoutLine, RiArticleLine, RiImage2Line,
  RiMailCheckLine, RiFileListLine, RiQuestionLine, RiTruckLine, RiMoneyDollarCircleLine, RiStoreLine,
};

/**
 * Floating "Γρήγορες ενέργειες" button (bottom-left). The list is computed
 * from the current route + role + permitted menu, so it changes per screen.
 */
export function QuickActions({ role, allowedHrefs, expenseBuildings }: { role: string; allowedHrefs: string[]; expenseBuildings: ManageableBuilding[] }) {
  const pathname = usePathname();
  const search = useSearchParams();
  // Remember which path the menu was opened on: navigating away closes it without an effect.
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fullPath = search?.toString() ? `${pathname}?${search}` : pathname;

  const actions = useMemo(
    () => resolveQuickActions({ pathname: fullPath, role, allowed: new Set(allowedHrefs), canExpense: expenseBuildings.length > 0 }),
    [fullPath, role, allowedHrefs, expenseBuildings.length],
  );
  const title = quickActionsTitle(fullPath, role);
  const open = openedFor === fullPath;
  const setOpen = (v: boolean | ((prev: boolean) => boolean)) => setOpenedFor((prev) => ((typeof v === "function" ? v(prev === fullPath) : v) ? fullPath : null));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey); document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- setOpen is a stable wrapper over setOpenedFor

  if (actions.length === 0) return null;

  function run(a: QuickAction) {
    if (a.kind === "expense") { setOpen(false); setExpenseOpen(true); }
  }

  return (
    <div ref={ref} style={{ position: "absolute", left: 20, bottom: 20, zIndex: 60 }}>
      {open && (
        <div role="menu" aria-label={title} style={panel}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px 6px" }}>
            <RiFlashlightLine style={{ color: "var(--color-accent)" }} />
            <span style={{ fontSize: "var(--fs-11)", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>{title}</span>
          </div>
          {actions.map((a) => {
            const Icon = ICONS[a.icon] ?? RiArrowRightSLine;
            const inner = (
              <>
                <span style={iconWrap}><Icon /></span>
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0, textAlign: "left" }}>
                  <span style={{ fontSize: "var(--fs-13)", fontWeight: 600, color: "var(--foreground)" }}>{a.label}</span>
                  {a.hint && <span style={{ fontSize: "var(--fs-11)", color: "var(--muted-foreground)" }}>{a.hint}</span>}
                </span>
                <RiArrowRightSLine style={{ marginLeft: "auto", color: "var(--muted-foreground)" }} />
              </>
            );
            return a.href
              ? <Link key={a.key} href={a.href} role="menuitem" style={item} onClick={() => setOpen(false)}>{inner}</Link>
              : <button key={a.key} type="button" role="menuitem" style={item} onClick={() => run(a)}>{inner}</button>;
          })}
        </div>
      )}
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu" title="Γρήγορες ενέργειες" style={{ ...fab, transform: open ? "rotate(90deg)" : "none" }}>
        {open ? <RiCloseLine style={{ fontSize: "var(--fs-22)" }} /> : <RiFlashlightLine style={{ fontSize: "var(--fs-22)" }} />}
      </button>
      {expenseBuildings.length > 0 && <ExpenseQuickModal open={expenseOpen} onClose={() => setExpenseOpen(false)} buildings={expenseBuildings} />}
    </div>
  );
}

const fab: React.CSSProperties = {
  width: 52, height: 52, borderRadius: 999, border: "none", cursor: "pointer",
  background: "var(--color-primary)", color: "var(--color-accent)",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  boxShadow: "0 8px 24px rgba(21,22,26,.28)", transition: "transform 160ms ease",
};
const panel: React.CSSProperties = {
  position: "absolute", left: 0, bottom: 62, width: 300, maxWidth: "calc(100vw - 40px)",
  background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16,
  boxShadow: "0 18px 48px -12px rgba(21,22,26,.35)", padding: 6, display: "flex", flexDirection: "column", gap: 2,
};
const item: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, border: "none",
  background: "transparent", cursor: "pointer", textDecoration: "none", width: "100%", minHeight: 44,
};
const iconWrap: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 10, background: "var(--paper)", color: "var(--color-primary)",
  display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "var(--fs-17)", flexShrink: 0, border: "1px solid var(--border)",
};
