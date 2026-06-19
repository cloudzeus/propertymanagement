"use client";

import { useEffect, useRef, useState } from "react";
import { RiMapPin2Line, RiLoaderLine } from "react-icons/ri";

type Prediction = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

export type ResolvedAddress = {
  formattedAddress: string;
  address: string;
  district: string;
  city: string;
  postalCode: string;
  country: string;
  lat: number | null;
  lng: number | null;
};

type Props = {
  label: string;
  value: string;
  /** Free-text edits to the address field (typing). */
  onChange: (v: string) => void;
  /** A place was picked → fill the rest of the form + map. */
  onResolved: (r: ResolvedAddress) => void;
  placeholder?: string;
  s1?: string;
};

// Lightweight session token (groups autocomplete + details billing).
function newToken() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${performance.now()}`;
}

export function AddressAutocomplete({ label, value, onChange, onResolved, placeholder, s1 }: Props) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef<string>(newToken());
  const boxRef = useRef<HTMLDivElement>(null);
  const skipNextFetch = useRef(false);
  // Only the user typing should trigger a Places search. Programmatic value
  // changes (ΑΑΔΕ lookup, address resolve) must not fire a search/error.
  const userTyping = useRef(false);

  // Debounced autocomplete
  useEffect(() => {
    if (skipNextFetch.current) { skipNextFetch.current = false; return; }
    if (!userTyping.current) { setError(null); setPredictions([]); setOpen(false); return; }
    if (!value || value.trim().length < 3) { setPredictions([]); setOpen(false); setError(null); return; }

    const handle = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/places/autocomplete?input=${encodeURIComponent(value)}&token=${tokenRef.current}`
        );
        const data = await res.json();
        if (data.error) {
          setError(data.error === "GOOGLE_MAPS_API_KEY not configured"
            ? "Λείπει το Google API key" : "Σφάλμα αναζήτησης");
          setPredictions([]);
        } else {
          setPredictions(data.predictions ?? []);
          setOpen((data.predictions ?? []).length > 0);
        }
      } catch {
        setError("Σφάλμα δικτύου");
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(handle);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function selectPrediction(p: Prediction) {
    setOpen(false);
    setResolving(true);
    skipNextFetch.current = true;
    onChange(p.mainText || p.description);
    try {
      const res = await fetch(
        `/api/places/details?placeId=${encodeURIComponent(p.placeId)}&token=${tokenRef.current}`
      );
      const data = await res.json();
      if (data.details) onResolved(data.details as ResolvedAddress);
      else setError("Δεν ήταν δυνατή η ανάκτηση στοιχείων");
    } catch {
      setError("Σφάλμα δικτύου");
    } finally {
      setResolving(false);
      tokenRef.current = newToken(); // new session after a pick
    }
  }

  return (
    <div ref={boxRef} style={{ display: "flex", flexDirection: "column", gap: 4, position: "relative" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>{label}</label>
        {s1 && <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontFamily: "monospace" }}>{s1}</span>}
      </div>
      <div style={{ position: "relative" }}>
        <RiMapPin2Line style={{
          position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)",
          fontSize: 14, color: "var(--muted-foreground)", pointerEvents: "none",
        }} />
        <input
          type="text"
          value={value}
          onChange={(e) => { userTyping.current = true; onChange(e.target.value); }}
          onFocus={() => predictions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          style={{
            height: 34, padding: "0 30px 0 30px", borderRadius: 6,
            border: "1px solid var(--border)", fontSize: 13,
            color: "var(--foreground)", background: "var(--card)",
            outline: "none", boxSizing: "border-box", width: "100%",
          }}
        />
        {(loading || resolving) && (
          <RiLoaderLine style={{
            position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)",
            fontSize: 14, color: "var(--muted-foreground)", animation: "spin 1s linear infinite",
          }} />
        )}
      </div>

      {error && <p style={{ fontSize: 11, color: "#dc2626", margin: 0 }}>{error}</p>}

      {open && predictions.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200,
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 6, marginTop: 2, boxShadow: "0 4px 16px rgba(0,0,0,.12)",
          overflow: "hidden",
        }}>
          {predictions.map((p) => (
            <button
              key={p.placeId}
              type="button"
              onClick={() => selectPrediction(p)}
              style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                width: "100%", padding: "9px 12px", border: "none",
                background: "transparent", cursor: "pointer", textAlign: "left",
                borderBottom: "1px solid var(--border)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-canvas)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <RiMapPin2Line style={{ fontSize: 14, color: "var(--color-primary)", flexShrink: 0, marginTop: 2 }} />
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ fontSize: 13, color: "var(--foreground)", fontWeight: 500 }}>{p.mainText}</span>
                {p.secondaryText && (
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{p.secondaryText}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
