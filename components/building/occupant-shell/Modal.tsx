"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { RiCloseLine } from "react-icons/ri";

const FOCUSABLE =
  'a[href], button:not([disabled]), select, input, textarea, iframe, [tabindex]:not([tabindex="-1"])';

type Props = {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  /** Header title — ignored by the bare (lightbox) variant. */
  title?: ReactNode;
  /** Fixed footer bar under the scrollable body (card variant only). */
  footer?: ReactNode;
  maxWidth?: number;
  /** Bare dark variant: no card chrome — children centered on a dark overlay (lightbox). */
  bare?: boolean;
  children: ReactNode;
};

/**
 * Shared portal modal for the occupant shell (idiom: DemoBookingModal).
 * Behaviors: ESC + backdrop close, body scroll lock, focus stays inside
 * (initial focus on the close button, Tab wraps at the edges).
 */
export function ModalShell({ open, onClose, ariaLabel, title, footer, maxWidth = 760, bare = false, children }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => closeRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = boxRef.current;
      if (!root) return;
      const els = root.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !root.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={onClose}
      ref={bare ? boxRef : undefined}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: bare ? "rgba(12,12,14,.9)" : "rgba(27,28,26,.5)",
        backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, overscrollBehavior: "contain",
      }}
    >
      {bare ? (
        <>
          <button
            ref={closeRef}
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            aria-label="Κλείσιμο"
            style={{
              position: "absolute", top: 18, right: 18, zIndex: 2,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 38, height: 38, borderRadius: 10, cursor: "pointer", lineHeight: 0,
              border: "1px solid rgba(255,255,255,.25)", background: "rgba(255,255,255,.08)", color: "#fff",
            }}
          >
            <RiCloseLine size={20} />
          </button>
          {children}
        </>
      ) : (
        <div
          ref={boxRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%", maxWidth, maxHeight: "min(88dvh, 940px)",
            display: "flex", flexDirection: "column", overflow: "hidden",
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 16, boxShadow: "0 44px 90px -30px rgba(27,28,26,.5)",
          }}
        >
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            padding: "15px 20px", borderBottom: "1px solid var(--border)", flex: "none",
          }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: "var(--foreground)", minWidth: 0 }}>{title}</div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Κλείσιμο"
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 32, height: 32, borderRadius: 8, cursor: "pointer", lineHeight: 0, flex: "none",
                border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)",
              }}
            >
              <RiCloseLine size={17} />
            </button>
          </div>
          <div style={{ overflowY: "auto", padding: 20, flex: "1 1 auto", minHeight: 0 }}>{children}</div>
          {footer && (
            <div style={{ flex: "none", padding: "12px 20px", borderTop: "1px solid var(--border)", background: "var(--bg-canvas)" }}>
              {footer}
            </div>
          )}
        </div>
      )}
    </div>,
    document.body
  );
}
