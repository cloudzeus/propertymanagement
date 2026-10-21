"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RiArrowDownSLine, RiFlashlightLine } from "react-icons/ri";
import { useMediaQuery } from "@/lib/use-media-query";
import { ActionMenuList } from "@/components/ui/action-menu";
import { ActionSheet } from "@/components/ui/action-sheet";
import type { WorkSubject } from "@/lib/work/actions";
import type { WorkActionsApi } from "./useWorkActions";

/** «Ενέργειες» button for detail-page headers: dropdown on desktop, bottom sheet on phones. */
export function ActionsButton({ subject, api, label = "Ενέργειες", title }: { subject: WorkSubject; api: WorkActionsApi; label?: string; title?: string }) {
  const [open, setOpen] = useState(false);
  const isPhone = useMediaQuery("(max-width: 640px)");
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const entries = api.entries(subject);

  useEffect(() => {
    if (!open || isPhone) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onClick = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey); document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, [open, isPhone]);

  if (entries.length === 0) return null;

  function toggle() {
    if (!open && btnRef.current) { const r = btnRef.current.getBoundingClientRect(); setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) }); }
    setOpen((v) => !v);
  }

  return (
    <>
      <button ref={btnRef} type="button" onClick={toggle} aria-haspopup="menu" aria-expanded={open} style={{
        display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36, padding: "0 14px", border: "none", borderRadius: "var(--radius-sm)",
        background: "var(--primary)", color: "var(--primary-foreground)", fontSize: "var(--fs-13)", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
      }}>
        <RiFlashlightLine /> {label} <RiArrowDownSLine />
      </button>
      {open && isPhone && (
        <ActionSheet open title={title ?? label} onClose={() => setOpen(false)}>
          <ActionMenuList entries={entries} onPicked={() => setOpen(false)} />
        </ActionSheet>
      )}
      {open && !isPhone && typeof document !== "undefined" && createPortal(
        <div ref={menuRef} style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 999, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.14)", minWidth: 260, maxHeight: "70vh", overflowY: "auto" }}>
          <ActionMenuList entries={entries} onPicked={() => setOpen(false)} />
        </div>,
        document.body,
      )}
    </>
  );
}
