"use client";

import { useState } from "react";
import Link from "next/link";
import { RiCheckLine, RiCloseLine, RiAlertLine, RiExternalLinkLine, RiLoader4Line } from "react-icons/ri";
import type { ConfirmState } from "./reducer";

export function ConfirmCard({ card, onConfirm, onCancel }: { card: ConfirmState; onConfirm: (id: string) => Promise<void>; onCancel: (id: string) => Promise<void> }) {
  const [busy, setBusy] = useState<"confirm" | "cancel" | null>(null);
  const run = async (kind: "confirm" | "cancel") => {
    setBusy(kind);
    try { await (kind === "confirm" ? onConfirm(card.actionId) : onCancel(card.actionId)); } finally { setBusy(null); }
  };
  return (
    <div className="ast-card" role="group" aria-label={card.title}>
      <h4>{card.title}</h4>
      <ul>{card.summaryLines.map((l, i) => <li key={i}>{l}</li>)}</ul>
      {card.warnings.map((w, i) => <div key={i} className="ast-warn"><RiAlertLine style={{ verticalAlign: "-2px", marginRight: 4 }} />{w}</div>)}
      {card.state === "pending" && (
        <div className="ast-actions">
          <button type="button" className="ast-btn ast-btn--primary" disabled={busy !== null} onClick={() => run("confirm")}>
            {busy === "confirm" ? <RiLoader4Line className="ast-spin" /> : <RiCheckLine />} Επιβεβαίωση
          </button>
          <button type="button" className="ast-btn" disabled={busy !== null} onClick={() => run("cancel")}><RiCloseLine /> Ακύρωση</button>
        </div>
      )}
      {card.state === "executed" && (
        <div className="ast-result ast-result--ok"><RiCheckLine /> {card.resultMessage}{card.href && <Link href={card.href} style={{ marginLeft: 6, display: "inline-flex", alignItems: "center", gap: 3 }}>Άνοιγμα <RiExternalLinkLine /></Link>}</div>
      )}
      {card.state === "failed" && <div className="ast-result ast-result--bad"><RiAlertLine /> {card.resultMessage}</div>}
      {card.state === "cancelled" && <div className="ast-result ast-result--muted"><RiCloseLine /> Ακυρώθηκε.</div>}
    </div>
  );
}
