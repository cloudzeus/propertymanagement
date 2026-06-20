"use client";

import { useRef, useEffect, useState } from "react";
import {
  RiBold, RiItalic, RiUnderline, RiListUnordered, RiListOrdered,
  RiLink, RiLinkUnlink, RiH2, RiSeparator,
} from "react-icons/ri";

/**
 * Lightweight contentEditable rich-text editor (no external deps).
 * Emits HTML via onChange. Uses document.execCommand for formatting.
 */
export function RichTextEditor({ value, onChange, placeholder }: { value: string; onChange: (html: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  // Initialise content once (uncontrolled thereafter to preserve caret).
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function emit() {
    if (ref.current) onChange(ref.current.innerHTML);
  }

  function exec(cmd: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
  }

  function addLink() {
    const url = prompt("Διεύθυνση συνδέσμου (URL):", "https://");
    if (url) exec("createLink", url);
  }

  const isEmpty = !value || value === "<br>" || value.replace(/<[^>]*>/g, "").trim() === "";

  return (
    <div style={{ border: `1px solid ${focused ? "var(--color-primary)" : "var(--border)"}`, borderRadius: 6, overflow: "hidden", background: "var(--card)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "5px 6px", borderBottom: "1px solid var(--border)", background: "var(--bg-canvas)", flexWrap: "wrap" }}>
        <TBtn title="Έντονα" onClick={() => exec("bold")}><RiBold /></TBtn>
        <TBtn title="Πλάγια" onClick={() => exec("italic")}><RiItalic /></TBtn>
        <TBtn title="Υπογράμμιση" onClick={() => exec("underline")}><RiUnderline /></TBtn>
        <Sep />
        <TBtn title="Επικεφαλίδα" onClick={() => exec("formatBlock", "<h3>")}><RiH2 /></TBtn>
        <TBtn title="Λίστα" onClick={() => exec("insertUnorderedList")}><RiListUnordered /></TBtn>
        <TBtn title="Αριθμημένη λίστα" onClick={() => exec("insertOrderedList")}><RiListOrdered /></TBtn>
        <Sep />
        <TBtn title="Σύνδεσμος" onClick={addLink}><RiLink /></TBtn>
        <TBtn title="Αφαίρεση συνδέσμου" onClick={() => exec("unlink")}><RiLinkUnlink /></TBtn>
        <TBtn title="Διαχωριστικό" onClick={() => exec("insertHorizontalRule")}><RiSeparator /></TBtn>
      </div>
      <div style={{ position: "relative" }}>
        {isEmpty && !focused && (
          <div style={{ position: "absolute", top: 10, left: 12, fontSize: 13, color: "var(--muted-foreground)", pointerEvents: "none" }}>{placeholder ?? "Γράψτε το κείμενο…"}</div>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={() => { setFocused(false); emit(); }}
          onFocus={() => setFocused(true)}
          className="rte-body"
          style={{ minHeight: 140, maxHeight: 360, overflowY: "auto", padding: "10px 12px", fontSize: 13, lineHeight: 1.6, color: "var(--foreground)", outline: "none" }}
        />
      </div>
      <style>{`
        .rte-body h3 { font-size: 15px; font-weight: 700; margin: 8px 0 4px; }
        .rte-body ul, .rte-body ol { margin: 4px 0; padding-left: 22px; }
        .rte-body a { color: var(--color-primary); text-decoration: underline; }
        .rte-body hr { border: none; border-top: 1px solid var(--border); margin: 10px 0; }
      `}</style>
    </div>
  );
}

function TBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, border: "none", background: "transparent", borderRadius: 5, cursor: "pointer", color: "var(--foreground)", fontSize: 16 }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--border)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span style={{ width: 1, height: 18, background: "var(--border)", margin: "0 3px" }} />;
}
