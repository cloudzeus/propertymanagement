"use client";

/**
 * «Ενέργειες» button for the building page header: grouped dropdown on
 * desktop (portal, like the work center's ActionsButton), bottom sheet on
 * phones, with a type-to-filter box once the list is long. Every entry opens
 * its modal in place via `api.open(key)`.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RiArrowDownSLine, RiFlashlightLine, RiSearchLine, RiExternalLinkLine } from "react-icons/ri";
import { useMediaQuery } from "@/lib/use-media-query";
import { ActionSheet } from "@/components/ui/action-sheet";
import { SEARCH_THRESHOLD, filterBuildingActions, groupBuildingActions, type BuildingAction } from "@/lib/building-actions";
import { BUILDING_ACTION_ICONS, FALLBACK_ICON } from "./icons";
import type { BuildingActionsApi } from "./useBuildingActions";

export function BuildingActionsMenu({ api, label = "Ενέργειες" }: { api: BuildingActionsApi; label?: string }) {
  const [open, setOpen] = useState(false);
  const isPhone = useMediaQuery("(max-width: 640px)");
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (!open || isPhone) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onClick = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey); document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, [open, isPhone]);

  if (api.actions.length === 0) return null;

  function toggle() {
    if (!open && btnRef.current) { const r = btnRef.current.getBoundingClientRect(); setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) }); }
    setOpen((v) => !v);
  }
  const pick = (a: BuildingAction) => { setOpen(false); api.open(a.key); };

  return (
    <>
      <button ref={btnRef} type="button" onClick={toggle} aria-haspopup="menu" aria-expanded={open} data-testid="building-actions" style={{
        display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36, padding: "0 14px", border: "none", borderRadius: "var(--radius-sm)",
        background: "var(--primary)", color: "var(--primary-foreground)", fontSize: "var(--fs-13)", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
      }}>
        <RiFlashlightLine /> {label} <RiArrowDownSLine />
      </button>
      {open && isPhone && (
        <ActionSheet open title={label} onClose={() => setOpen(false)}>
          <GroupedList actions={api.actions} onPick={pick} />
        </ActionSheet>
      )}
      {open && !isPhone && typeof document !== "undefined" && createPortal(
        <div ref={menuRef} role="menu" aria-label={label} style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 999, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.14)", width: 340, maxWidth: "calc(100vw - 16px)", maxHeight: "min(78vh, 720px)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <GroupedList actions={api.actions} onPick={pick} />
        </div>,
        document.body,
      )}
    </>
  );
}

/** Group headers + items; search box above once the list is long. Enter runs the first match. */
export function GroupedList({ actions, onPick }: { actions: BuildingAction[]; onPick: (a: BuildingAction) => void }) {
  const [q, setQ] = useState("");
  const searchable = actions.length > SEARCH_THRESHOLD;
  const visible = useMemo(() => filterBuildingActions(actions, q), [actions, q]);
  const groups = useMemo(() => groupBuildingActions(visible), [visible]);

  return (
    <>
      {searchable && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <RiSearchLine style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
          <input
            autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Πληκτρολογήστε για αναζήτηση…" aria-label="Αναζήτηση ενέργειας"
            onKeyDown={(e) => { if (e.key === "Enter" && visible[0]) { e.preventDefault(); onPick(visible[0]); } }}
            style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: "var(--fs-13)", color: "var(--foreground)", fontFamily: "inherit" }}
          />
        </label>
      )}
      <div style={{ overflowY: "auto", padding: "4px 0" }}>
        {groups.length === 0 && (
          <div style={{ padding: "14px 12px", fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)" }}>Καμία ενέργεια για «{q}».</div>
        )}
        {groups.map((g) => (
          <div key={g.group} role="group" aria-label={g.label} style={{ padding: "4px 0 6px" }}>
            <div style={{ padding: "6px 12px 2px", fontSize: "var(--fs-10-5)", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>{g.label}</div>
            {g.actions.map((a) => {
              const Icon = BUILDING_ACTION_ICONS[a.icon] ?? FALLBACK_ICON;
              return (
                <button key={a.key} type="button" role="menuitem" data-action={a.key} onClick={() => onPick(a)} style={item}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--muted)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <span style={{ flexShrink: 0, display: "inline-flex", color: "var(--color-primary)", fontSize: "var(--fs-15)" }}><Icon /></span>
                  <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: "var(--fs-13)", fontWeight: 600, color: "var(--foreground)" }}>{a.label}</span>
                    {a.hint && <span style={{ fontSize: "var(--fs-11)", color: "var(--muted-foreground)" }}>{a.hint}</span>}
                  </span>
                  {a.external && <RiExternalLinkLine style={{ color: "var(--muted-foreground)", flexShrink: 0 }} aria-label="Ανοίγει σε νέα καρτέλα" />}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

const item: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 40,
  padding: "6px 12px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
};
