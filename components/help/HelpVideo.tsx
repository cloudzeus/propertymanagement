import { RiPlayCircleLine } from "react-icons/ri";

/**
 * Explainer video of a wiki guide (server-safe: plain <video>, no state).
 * Videos are muted text+motion renders from motion-studio (Bunny CDN), so
 * `muted` is honest and autoplay-safe; `controls` lets the reader scrub.
 */
export function HelpVideo({ src, poster, minutes, title }: { src: string; poster?: string | null; minutes?: number | null; title: string }) {
  return (
    <figure style={{ margin: "0 0 18px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ aspectRatio: "16 / 9", background: "#000", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
        <video src={src} poster={poster ?? undefined} controls playsInline muted preload="metadata" title={title} style={{ width: "100%", height: "100%", display: "block" }} />
      </div>
      <figcaption style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)" }}>
        <RiPlayCircleLine style={{ color: "var(--color-primary)" }} /> Video{minutes ? ` ${minutes}′` : ""} · {title} · χωρίς ήχο, με κείμενο
      </figcaption>
    </figure>
  );
}
