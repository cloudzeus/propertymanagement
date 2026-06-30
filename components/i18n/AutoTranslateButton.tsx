"use client";
import { useState } from "react";
import { autoTranslate } from "@/app/actions/translate";

export function AutoTranslateButton({
  source,
  from = "el",
  to = "en",
  onResult,
}: {
  source: string;
  from?: string;
  to?: string;
  onResult: (translated: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      disabled={loading || !source?.trim()}
      onClick={async () => {
        setLoading(true);
        try {
          onResult(await autoTranslate(source, from, to));
        } finally {
          setLoading(false);
        }
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        border: "1px solid var(--border)",
        background: "transparent",
        color: "var(--muted-foreground)",
        cursor: loading || !source?.trim() ? "not-allowed" : "pointer",
        opacity: loading || !source?.trim() ? 0.5 : 1,
      }}
    >
      {loading ? "Μετάφραση…" : `Μετάφραση ${from.toUpperCase()}→${to.toUpperCase()}`}
    </button>
  );
}
