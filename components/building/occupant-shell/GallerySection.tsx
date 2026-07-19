"use client";

import { useEffect, useMemo, useState } from "react";
import { RiArrowLeftSLine, RiArrowRightSLine, RiImageLine } from "react-icons/ri";
import type { OccupantData } from "@/lib/building/occupant-data";
import { StatusChip } from "@/components/dashboard";
import { ModalShell } from "./Modal";

type GalleryImage = { id: string; url: string; name: string };
type GalleryGroup = { key: string; title: string; floorLabel: string | null; images: GalleryImage[] };

/** Common-area photos grouped by infra point + the building photo files, with a lightbox. */
export function GallerySection({ gallery }: { gallery: OccupantData["gallery"] }) {
  const groups = useMemo<GalleryGroup[]>(() => {
    const g: GalleryGroup[] = gallery.points.map((p) => ({
      key: p.id,
      title: p.name,
      floorLabel: p.floorLabel,
      images: p.images.map((m) => ({ id: m.id, url: m.url, name: m.name ?? "" })),
    }));
    if (gallery.buildingPhotos.length > 0) {
      g.push({
        key: "building-photos",
        title: "Φωτογραφίες κτηρίου",
        floorLabel: null,
        images: gallery.buildingPhotos.map((f) => ({ id: f.id, url: f.url, name: f.name })),
      });
    }
    return g;
  }, [gallery]);

  const [view, setView] = useState<{ g: number; i: number } | null>(null);
  const viewGroup = view ? groups[view.g] : undefined;
  const viewImage = view && viewGroup ? viewGroup.images[view.i] : undefined;

  const step = (dir: 1 | -1) => {
    setView((v) => {
      if (!v) return v;
      const imgs = groups[v.g]?.images;
      if (!imgs || imgs.length === 0) return v;
      return { g: v.g, i: (v.i + dir + imgs.length) % imgs.length };
    });
  };

  // arrow-key navigation while the lightbox is open
  useEffect(() => {
    if (!view) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!view, groups]);

  if (groups.length === 0) {
    return (
      <div style={{ background: "var(--card)", border: "1px dashed var(--border-strong)", borderRadius: 12, padding: "36px 20px", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
        <RiImageLine style={{ fontSize: 30, opacity: 0.35, display: "block", margin: "0 auto 8px" }} />
        Δεν υπάρχουν ακόμη φωτογραφίες χώρων για το κτήριο.
        <div style={{ marginTop: 6, fontSize: 12.5 }}>Η διαχείριση προσθέτει φωτογραφίες μέσα από τις εγκαταστάσεις και τα αρχεία του κτηρίου.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {groups.map((g, gi) => (
        <div key={g.key} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>{g.title}</div>
            {g.floorLabel && <StatusChip tone="neutral">{g.floorLabel}</StatusChip>}
            <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{g.images.length} φωτ.</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {g.images.map((img, ii) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setView({ g: gi, i: ii })}
                title={img.name || g.title}
                style={{
                  padding: 0, border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden",
                  cursor: "zoom-in", background: "var(--bg-canvas)", display: "block",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.name || g.title}
                  loading="lazy"
                  style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", display: "block" }}
                />
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* lightbox */}
      <ModalShell open={!!viewImage} onClose={() => setView(null)} bare ariaLabel="Προβολή φωτογραφίας">
        {view && viewGroup && viewImage && (
          <>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, maxWidth: "92vw" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={viewImage.url}
                alt={viewImage.name || viewGroup.title}
                style={{ maxWidth: "92vw", maxHeight: "78dvh", objectFit: "contain", borderRadius: 10 }}
              />
              <div style={{ color: "rgba(255,255,255,.88)", fontSize: 13, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                <span style={{ fontWeight: 700 }}>{viewGroup.title}{viewGroup.floorLabel ? ` · ${viewGroup.floorLabel}` : ""}</span>
                {viewImage.name && <span style={{ opacity: 0.7 }}>{viewImage.name}</span>}
                <span style={{ opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>{view.i + 1} / {viewGroup.images.length}</span>
              </div>
            </div>
            {viewGroup.images.length > 1 && (
              <>
                <button type="button" aria-label="Προηγούμενη φωτογραφία" onClick={(e) => { e.stopPropagation(); step(-1); }} style={navBtn("left")}>
                  <RiArrowLeftSLine size={26} />
                </button>
                <button type="button" aria-label="Επόμενη φωτογραφία" onClick={(e) => { e.stopPropagation(); step(1); }} style={navBtn("right")}>
                  <RiArrowRightSLine size={26} />
                </button>
              </>
            )}
          </>
        )}
      </ModalShell>
    </div>
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
