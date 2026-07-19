"use client";

import { useCallback, useEffect, useState } from "react";
import { RiArrowLeftSLine, RiArrowRightSLine } from "react-icons/ri";
import { ModalShell } from "./Modal";

export type LightboxImage = { id: string; url: string; name?: string | null };

type State = { images: LightboxImage[]; index: number; title: string };

/**
 * Shared read-only photo lightbox for the occupant shell (extracted from the old
 * GallerySection). `open(images, index, title)` shows a flat set with prev/next
 * + arrow-key navigation; reused by InstallationsSection and ManagedItemsSection.
 */
export function useLightbox() {
  const [state, setState] = useState<State | null>(null);
  const open = useCallback((images: LightboxImage[], index: number, title: string) => {
    if (images.length > 0) setState({ images, index, title });
  }, []);
  const close = useCallback(() => setState(null), []);
  const step = useCallback((dir: 1 | -1) => {
    setState((s) => (s ? { ...s, index: (s.index + dir + s.images.length) % s.images.length } : s));
  }, []);
  return { state, open, close, step };
}

export function Lightbox({ state, onClose, onStep }: {
  state: State | null;
  onClose: () => void;
  onStep: (dir: 1 | -1) => void;
}) {
  // arrow-key navigation while the lightbox is open
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onStep(1);
      else if (e.key === "ArrowLeft") onStep(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [!!state, onStep]);

  const img = state ? state.images[state.index] : undefined;

  return (
    <ModalShell open={!!img} onClose={onClose} bare ariaLabel="Προβολή φωτογραφίας">
      {state && img && (
        <>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, maxWidth: "92vw" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={img.name || state.title}
              style={{ maxWidth: "92vw", maxHeight: "78dvh", objectFit: "contain", borderRadius: 10 }}
            />
            <div style={{ color: "rgba(255,255,255,.88)", fontSize: 13, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <span style={{ fontWeight: 700 }}>{state.title}</span>
              {img.name && <span style={{ opacity: 0.7 }}>{img.name}</span>}
              <span style={{ opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>{state.index + 1} / {state.images.length}</span>
            </div>
          </div>
          {state.images.length > 1 && (
            <>
              <button type="button" aria-label="Προηγούμενη φωτογραφία" onClick={(e) => { e.stopPropagation(); onStep(-1); }} style={navBtn("left")}>
                <RiArrowLeftSLine size={26} />
              </button>
              <button type="button" aria-label="Επόμενη φωτογραφία" onClick={(e) => { e.stopPropagation(); onStep(1); }} style={navBtn("right")}>
                <RiArrowRightSLine size={26} />
              </button>
            </>
          )}
        </>
      )}
    </ModalShell>
  );
}

function navBtn(side: "left" | "right"): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute", top: "50%", transform: "translateY(-50%)",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 44, height: 44, borderRadius: "50%", cursor: "pointer", lineHeight: 0,
    border: "1px solid rgba(255,255,255,.25)", background: "rgba(255,255,255,.08)", color: "#fff",
  };
  if (side === "left") base.left = 18;
  else base.right = 18;
  return base;
}
