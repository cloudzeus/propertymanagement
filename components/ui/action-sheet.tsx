"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { RiCloseLine } from "react-icons/ri";

/** Bottom sheet for phones: a titled panel with the full grouped action list. */
export function ActionSheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(27,28,26,.42)", display: "flex", alignItems: "flex-end" }}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxHeight: "80vh", overflowY: "auto", background: "var(--card)", borderRadius: "16px 16px 0 0",
          boxShadow: "0 -8px 24px rgba(0,0,0,.18)", paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--card)" }}>
          <span style={{ flex: 1, fontSize: "var(--fs-14)", fontWeight: 700, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
          <button type="button" onClick={onClose} aria-label="Κλείσιμο" style={{ width: 36, height: 36, border: "none", background: "transparent", cursor: "pointer", color: "var(--muted-foreground)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <RiCloseLine size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
