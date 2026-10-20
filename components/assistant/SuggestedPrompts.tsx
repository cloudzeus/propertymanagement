"use client";

import { RiSparklingLine } from "react-icons/ri";

export function SuggestedPrompts({ prompts, onPick }: { prompts: string[]; onPick: (p: string) => void }) {
  if (!prompts.length) return null;
  return (
    <div className="ast-prompts">
      <div className="ast-note" style={{ display: "flex", alignItems: "center", gap: 6 }}><RiSparklingLine /> Δοκιμάστε να ρωτήσετε</div>
      {prompts.map((p) => <button key={p} type="button" className="ast-prompt" onClick={() => onPick(p)}>{p}</button>)}
    </div>
  );
}
