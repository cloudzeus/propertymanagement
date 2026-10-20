"use client";

import { RiChat3Line, RiDeleteBinLine } from "react-icons/ri";
import type { ConversationRow } from "@/app/actions/ai-assistant";

const when = (iso: string) => new Date(iso).toLocaleDateString("el-GR", { day: "numeric", month: "short" });

export function ConversationList({ rows, activeId, onOpen, onDelete }: { rows: ConversationRow[]; activeId: string | null; onOpen: (id: string) => void; onDelete: (id: string) => void }) {
  if (!rows.length) return <div className="ast-empty">Δεν υπάρχουν αποθηκευμένες συνομιλίες.</div>;
  return (
    <div className="ast-list">
      {rows.map((r) => (
        <div key={r.id} className={`ast-list-item${r.id === activeId ? " is-active" : ""}`} role="button" tabIndex={0} onClick={() => onOpen(r.id)} onKeyDown={(e) => { if (e.key === "Enter") onOpen(r.id); }}>
          <RiChat3Line style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title ?? "Συνομιλία"}</span>
          <span className="ast-when">{when(r.lastMessageAt)}</span>
          <button type="button" className="ast-iconbtn" title="Διαγραφή" aria-label="Διαγραφή συνομιλίας" onClick={(e) => { e.stopPropagation(); onDelete(r.id); }} style={{ width: 32, height: 32, minWidth: 32 }}><RiDeleteBinLine /></button>
        </div>
      ))}
    </div>
  );
}
