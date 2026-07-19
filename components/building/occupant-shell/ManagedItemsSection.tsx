"use client";

import { RiListCheck2, RiMapPinLine } from "react-icons/ri";
import type { OccupantData } from "@/lib/building/occupant-data";
import { EmptyState } from "@/components/dashboard";
import { Lightbox, useLightbox, type LightboxImage } from "./Lightbox";

const card: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", padding: 16,
  display: "flex", flexDirection: "column", gap: 10,
};

/** Read-only inventory of managed items (fixtures the company maintains). Managed buildings only. */
export function ManagedItemsSection({ managedItems }: { managedItems: OccupantData["managedItems"] }) {
  const { state, open, close, step } = useLightbox();

  if (managedItems.length === 0) {
    return <EmptyState icon={RiListCheck2} label="Δεν έχουν καταχωρηθεί διαχειριζόμενα στοιχεία για το κτήριο." />;
  }

  return (
    <>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
      {managedItems.map((m) => {
        const meta = [m.location, m.floorLabel].filter(Boolean).join(" · ");
        const img: LightboxImage[] = m.photoUrl ? [{ id: m.id, url: m.photoUrl, name: m.name }] : [];
        return (
          <div key={m.id} style={card}>
            {m.photoUrl ? (
              <button
                type="button"
                onClick={() => open(img, 0, m.name)}
                title={m.name}
                style={{ padding: 0, border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", cursor: "zoom-in", background: "var(--bg-canvas)", display: "block" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.photoUrl} alt={m.name} loading="lazy" style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", display: "block" }} />
              </button>
            ) : null}
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--foreground)" }}>{m.name}</div>
            {meta && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--muted-foreground)" }}>
                <RiMapPinLine style={{ flex: "none" }} /> <span>{meta}</span>
              </div>
            )}
            <div style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>
              Ποσότητα: <span style={{ fontWeight: 700, color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>{m.quantity.toLocaleString("el-GR")}</span>
            </div>
          </div>
        );
      })}
    </div>
    <Lightbox state={state} onClose={close} onStep={step} />
    </>
  );
}
