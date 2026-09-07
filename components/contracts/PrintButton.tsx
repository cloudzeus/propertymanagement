"use client";

import { RiPrinterLine } from "react-icons/ri";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", border: "1px solid var(--border)", background: "var(--card)", borderRadius: "var(--radius-sm)", fontSize: "var(--fs-13)", fontWeight: 600, cursor: "pointer", color: "var(--foreground)" }}>
      <RiPrinterLine /> Εκτύπωση / PDF
    </button>
  );
}
