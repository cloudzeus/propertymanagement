"use client";

import type { IconType } from "react-icons";
import {
  RiBroadcastLine, RiDropLine, RiFireLine, RiFlashlightLine, RiHome8Line,
  RiImageLine, RiKey2Line, RiLockLine, RiMapPinLine, RiTeamLine, RiToolsLine, RiWaterFlashLine,
} from "react-icons/ri";
import type { OccupantData } from "@/lib/building/occupant-data";
import { StatusChip } from "@/components/dashboard";
import { Lightbox, useLightbox, type LightboxImage } from "./Lightbox";

const INFRA_LABEL: Record<string, string> = {
  ELECTRICITY: "Ηλεκτρολογικός πίνακας",
  OTE: "Τηλεπικοινωνίες (ΟΤΕ)",
  ROOF: "Ταράτσα",
  ANTENNA: "Κεραία",
  BOILER: "Λεβητοστάσιο",
  PUMP: "Πιεστικό / Αντλία",
  FIRE: "Πυρασφάλεια",
  WATER: "Παροχή νερού",
  OTHER: "Άλλη εγκατάσταση",
};

const INFRA_ICON: Record<string, IconType> = {
  ELECTRICITY: RiFlashlightLine,
  WATER: RiDropLine,
  BOILER: RiFireLine,
  PUMP: RiWaterFlashLine,
  FIRE: RiFireLine,
  ANTENNA: RiBroadcastLine,
  OTE: RiBroadcastLine,
  ROOF: RiHome8Line,
};
const infraIcon = (type: string): IconType => INFRA_ICON[type] ?? RiToolsLine;

const card: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", padding: 18,
};
const metaRow: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--muted-foreground)",
};

/** Read-only installations directory: where things are + WHO HAS KEYS, plus building photos. */
export function InstallationsSection({ infra, buildingPhotos }: {
  infra: OccupantData["infra"];
  buildingPhotos: OccupantData["gallery"]["buildingPhotos"];
}) {
  const { state, open, close, step } = useLightbox();

  const photoImages: LightboxImage[] = buildingPhotos.map((f) => ({ id: f.id, url: f.url, name: f.name }));

  if (infra.length === 0 && buildingPhotos.length === 0) {
    return (
      <div style={{ ...card, borderStyle: "dashed", borderColor: "var(--border-strong)", textAlign: "center", padding: "36px 20px", color: "var(--muted-foreground)", fontSize: 13 }}>
        <RiToolsLine style={{ fontSize: 30, opacity: 0.35, display: "block", margin: "0 auto 8px" }} />
        Δεν έχουν καταχωρηθεί ακόμη εγκαταστάσεις ή κοινόχρηστοι χώροι.
        <div style={{ marginTop: 6, fontSize: 12.5 }}>Η διαχείριση καταχωρεί εδώ τους πίνακες, τα λεβητοστάσια, τις κεραίες και ποιος κρατά τα κλειδιά.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {infra.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {infra.map((p) => {
            const Icon = infraIcon(p.type);
            const meta = [p.floorLabel, p.location].filter(Boolean).join(" · ");
            const images: LightboxImage[] = p.media.map((m) => ({ id: m.id, url: m.url, name: m.name }));
            return (
              <div key={p.id} style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
                {/* header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, flex: "none", background: "color-mix(in srgb, var(--color-primary) 9%, transparent)", color: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon style={{ fontSize: 21 }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", color: "var(--muted-foreground)" }}>{INFRA_LABEL[p.type] ?? p.type}</div>
                    </div>
                  </div>
                  {p.locked && <StatusChip tone="warning">Κλειδωμένο</StatusChip>}
                </div>

                {meta && <div style={metaRow}><RiMapPinLine style={{ flex: "none" }} /> <span>{meta}</span></div>}

                {/* key holder + access — the point of this section */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px", borderRadius: 10, background: "var(--bg-canvas)", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <RiKey2Line style={{ color: "var(--color-primary)", flex: "none" }} />
                    <span style={{ color: "var(--muted-foreground)" }}>Κλειδιά:</span>
                    <span style={{ fontWeight: 700, color: "var(--foreground)" }}>{p.keyHolderName ?? "—"}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13 }}>
                    <RiTeamLine style={{ color: "var(--muted-foreground)", flex: "none", marginTop: 2 }} />
                    <span style={{ color: "var(--muted-foreground)", flex: "none" }}>Πρόσβαση:</span>
                    <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{p.accessNames.length > 0 ? p.accessNames.join(", ") : "—"}</span>
                  </div>
                </div>

                {p.notes && <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--muted-foreground)" }}>{p.notes}</div>}

                {images.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: 8 }}>
                    {images.map((img, ii) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => open(images, ii, p.name)}
                        title={img.name || p.name}
                        style={{ padding: 0, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", cursor: "zoom-in", background: "var(--bg-canvas)", display: "block" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt={img.name || p.name} loading="lazy" style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* building photos */}
      {buildingPhotos.length > 0 && (
        <div style={{ ...card, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <RiImageLine style={{ color: "var(--muted-foreground)" }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>Φωτογραφίες κτηρίου</div>
            <span style={{ fontSize: 12, color: "var(--muted-foreground)", fontVariantNumeric: "tabular-nums" }}>{buildingPhotos.length} φωτ.</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {photoImages.map((img, ii) => (
              <button
                key={img.id}
                type="button"
                onClick={() => open(photoImages, ii, "Φωτογραφίες κτηρίου")}
                title={img.name || "Φωτογραφία κτηρίου"}
                style={{ padding: 0, border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", cursor: "zoom-in", background: "var(--bg-canvas)", display: "block" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.name || "Φωτογραφία κτηρίου"} loading="lazy" style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", display: "block" }} />
              </button>
            ))}
          </div>
        </div>
      )}

      <Lightbox state={state} onClose={close} onStep={step} />
    </div>
  );
}
