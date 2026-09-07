"use client";
import { useEffect, useId, useState } from "react";

/** Renders a Mermaid diagram on the client (mermaid is loaded lazily, only where a ```mermaid block exists). */
export function Mermaid({ code }: { code: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "neutral", fontFamily: "var(--font-sans)", securityLevel: "strict" });
        const { svg } = await mermaid.render(`mmd-${id}`, code);
        if (!cancelled) setSvg(svg);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [code, id]);
  if (error) return <pre style={{ whiteSpace: "pre-wrap", fontSize: "var(--fs-12)", color: "#a33" }}>{code}</pre>;
  if (!svg) return <div style={{ minHeight: 80, color: "var(--muted-foreground)", fontSize: "var(--fs-12-5)" }}>Φόρτωση διαγράμματος…</div>;
  return <div className="mermaid-diagram" style={{ overflowX: "auto", margin: "12px 0", padding: 12, border: "1px solid var(--border)", borderRadius: 10, background: "var(--card)" }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
