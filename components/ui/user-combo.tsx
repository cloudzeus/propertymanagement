"use client";

import { useEffect, useRef, useState } from "react";
import { RiUserLine, RiLoaderLine, RiCloseLine, RiSearchLine } from "react-icons/ri";
import { searchUsers, type UserOption } from "@/app/actions/employees";

type Props = {
  /** Currently linked user, if any (shown as the selected value). */
  selected: UserOption | null;
  onSelect: (user: UserOption | null) => void;
  placeholder?: string;
  /** Restrict the search to specific roles (e.g. employees combo). */
  roles?: readonly string[];
  /** Restrict candidates to a single customer (data isolation). */
  customerId?: string;
};

export function UserCombo({ selected, onSelect, placeholder = "Αναζήτηση χρήστη…", roles, customerId }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced search — loads all users when the query is empty.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        setResults(await searchUsers(query, roles, customerId));
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query, open, customerId]);

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function pick(u: UserOption) {
    onSelect(u);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      {selected ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, height: 36,
          padding: "0 8px 0 10px", borderRadius: 6, border: "1px solid var(--border)",
          background: "var(--card)",
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
            background: "var(--color-primary)18", color: "var(--color-primary)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700,
          }}>
            {(selected.name ?? selected.email)[0]?.toUpperCase()}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selected.name ?? "—"}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selected.email}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelect(null)}
            title="Αποσύνδεση"
            style={{ flexShrink: 0, border: "none", background: "transparent", cursor: "pointer", color: "var(--muted-foreground)", display: "flex", padding: 4 }}
          >
            <RiCloseLine style={{ fontSize: 16 }} />
          </button>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <RiSearchLine style={{
            position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
            fontSize: 14, color: "var(--muted-foreground)", pointerEvents: "none",
          }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            autoComplete="off"
            style={{
              height: 36, padding: "0 30px 0 32px", borderRadius: 6,
              border: "1px solid var(--border)", fontSize: 13,
              color: "var(--foreground)", background: "var(--card)",
              outline: "none", boxSizing: "border-box", width: "100%",
            }}
          />
          {loading && (
            <RiLoaderLine style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              fontSize: 14, color: "var(--muted-foreground)", animation: "spin 1s linear infinite",
            }} />
          )}
        </div>
      )}

      {open && !selected && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 300,
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 6, marginTop: 4, boxShadow: "0 4px 16px rgba(0,0,0,.12)",
          maxHeight: 260, overflowY: "auto",
        }}>
          {loading && results.length === 0 && (
            <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--muted-foreground)" }}>Φόρτωση…</div>
          )}
          {!loading && results.length === 0 && (
            <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--muted-foreground)" }}>Δεν βρέθηκαν χρήστες</div>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => pick(u)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                width: "100%", padding: "9px 12px", border: "none",
                background: "transparent", cursor: "pointer", textAlign: "left",
                borderBottom: "1px solid var(--border)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-canvas)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{
                width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                background: "var(--color-primary)18", color: "var(--color-primary)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700,
              }}>
                <RiUserLine style={{ fontSize: 13 }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{u.name ?? u.email}</div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{u.email} · {u.role}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
