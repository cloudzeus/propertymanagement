"use client";

import { useState } from "react";
import { RiPlayCircleLine, RiCloseLine } from "react-icons/ri";
import { formatSeconds } from "@/lib/wizards/flow";

export type WizardVideo = { src: string; poster?: string; seconds?: number; title: string };

/**
 * «Δείτε το video (1′20″)» button that expands into an inline, muted player.
 * Videos are text+motion explainers (no audio track) rendered by motion-studio.
 * `compact` keeps only the button (used in the wizard's example step).
 */
export function HelpVideoPlayer({ video, compact = false, autoOpen = false }: { video: WizardVideo; compact?: boolean; autoOpen?: boolean }) {
  const [open, setOpen] = useState(autoOpen);
  const len = video.seconds ? ` (${formatSeconds(video.seconds)})` : "";
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, padding: "8px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", cursor: "pointer", fontSize: "var(--fs-13)", fontWeight: 600 }}>
        <RiPlayCircleLine style={{ fontSize: "var(--fs-20)", color: "var(--color-primary)" }} /> Δείτε το video{len}
      </button>
    );
  }
  return (
    <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ position: "relative", aspectRatio: "16 / 9", background: "#000", borderRadius: 10, overflow: "hidden" }}>
        <video src={video.src} poster={video.poster} controls playsInline muted autoPlay preload="metadata" title={video.title} style={{ width: "100%", height: "100%", display: "block" }} />
        {!compact && (
          <button type="button" onClick={() => setOpen(false)} aria-label="Κλείσιμο video" style={{ position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: 999, border: "none", background: "rgba(0,0,0,.55)", color: "var(--primary-foreground)", display: "grid", placeItems: "center", cursor: "pointer" }}><RiCloseLine /></button>
        )}
      </div>
      <figcaption style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }}>{video.title}{len} · χωρίς ήχο, με κείμενο</figcaption>
    </figure>
  );
}
