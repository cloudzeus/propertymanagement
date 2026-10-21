"use client";

import { useEffect } from "react";

export type ToastMessage = { kind: "ok" | "error"; text: string };

/** Same strip as the work center's status message; auto-hides after 5s. */
export function ActionToast({ message, onClose }: { message: ToastMessage | null; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [message, onClose]);
  if (!message) return null;
  return (
    <div role="status" onClick={onClose} style={{
      position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 1100, maxWidth: "min(92vw, 560px)",
      padding: "10px 14px", borderRadius: "var(--radius-sm)", fontSize: "var(--fs-13)", fontWeight: 600, boxShadow: "0 6px 20px rgba(0,0,0,.18)", cursor: "pointer",
      background: message.kind === "ok" ? "#dcfce7" : "#fee2e2", color: message.kind === "ok" ? "#166534" : "#991b1b",
    }}>
      {message.text}
    </div>
  );
}
