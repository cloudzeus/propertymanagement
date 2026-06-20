"use client";

import { useState, useTransition } from "react";
import { RichTextEditor } from "@/components/ui/rich-text";
import { generateMinutes, approveAndSendMinutes } from "@/app/actions/assemblies";
import { RiRefreshLine, RiCheckLine, RiLoaderLine, RiMailSendLine } from "react-icons/ri";

const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: 20,
};

export function MinutesEditor({ assemblyId, initialHtml, readonly }: { assemblyId: string; initialHtml: string; readonly: boolean }) {
  const [html, setHtml] = useState(initialHtml);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleRegenerate() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await generateMinutes(assemblyId);
        setHtml(res.html ?? "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Σφάλμα δημιουργίας πρακτικών.");
      }
    });
  }

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      try {
        await approveAndSendMinutes(assemblyId, html);
        setSent(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Σφάλμα αποστολής πρακτικών.");
      }
    });
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Πρακτικά</h2>
        {!readonly && (
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={handleRegenerate} disabled={pending} style={btnStyle(pending)}>
              {pending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiRefreshLine />} Δημιουργία ξανά
            </button>
            <button type="button" onClick={handleApprove} disabled={pending} style={btnStyle(pending, true)}>
              {pending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiMailSendLine />} Έγκριση &amp; Αποστολή
            </button>
          </div>
        )}
      </div>

      {sent && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#16a34a", marginBottom: 12 }}>
          <RiCheckLine /> Τα πρακτικά εγκρίθηκαν και απεστάλησαν στους συμμετέχοντες.
        </div>
      )}
      {error && (
        <div style={{ fontSize: 13, color: "#dc2626", marginBottom: 12 }}>{error}</div>
      )}

      {readonly ? (
        <div
          className="rte-body"
          style={{ fontSize: 13, lineHeight: 1.6, color: "var(--foreground)" }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <RichTextEditor value={html} onChange={setHtml} placeholder="Πρακτικά συνέλευσης…" />
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function btnStyle(disabled: boolean, primary = false): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    fontWeight: 600,
    padding: "7px 12px",
    borderRadius: 8,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.6 : 1,
    border: `1px solid ${primary ? "var(--color-primary)" : "var(--border)"}`,
    background: primary ? "var(--color-primary)" : "var(--card)",
    color: primary ? "#fff" : "var(--foreground)",
  };
}
