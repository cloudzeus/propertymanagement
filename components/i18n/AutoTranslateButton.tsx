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
      className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
    >
      {loading ? "Μετάφραση…" : `Μετάφραση ${from.toUpperCase()}→${to.toUpperCase()}`}
    </button>
  );
}
