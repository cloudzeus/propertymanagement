"use client";

import { useState, useTransition } from "react";
import { PropertyMapPicker } from "./PropertyMapPicker";
import { RiMapPin2Line, RiSaveLine, RiLoaderLine } from "react-icons/ri";
import { geocodeProperty, updatePropertyGeodata } from "@/app/actions/property-geodata";

type Props = {
  propertyId: string;
  address: string;
};

export function GeocodePicker({ propertyId, address }: Props) {
  const [isPending, startTransition] = useTransition();
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleAutoGeocode() {
    startTransition(async () => {
      const result = await geocodeProperty(propertyId);
      if ("error" in result) {
        setMessage(`Σφάλμα: ${result.error}`);
      } else {
        setMessage(`Εντοπίστηκε: ${result.lat?.toFixed(5)}, ${result.lng?.toFixed(5)}`);
      }
    });
  }

  function handleSave() {
    if (lat === null || lng === null) return;
    startTransition(async () => {
      const result = await updatePropertyGeodata(propertyId, lat, lng);
      if ("error" in result) {
        setMessage(`Σφάλμα: ${result.error}`);
      } else {
        setMessage("Αποθηκεύτηκε. Ανανεώστε τη σελίδα για να δείτε τον χάρτη.");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Auto-geocode from address */}
      <div style={{
        padding: "12px 16px", borderRadius: 8,
        background: "var(--bg-canvas)", border: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        flexWrap: "wrap",
      }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
            Αυτόματο Geocoding
          </p>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
            Χρήση διεύθυνσης: <em>{address}</em>
          </p>
        </div>
        <button
          type="button"
          onClick={handleAutoGeocode}
          disabled={isPending}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600,
            background: "var(--color-primary)", color: "#fff",
            border: "none", cursor: "pointer",
          }}
        >
          {isPending
            ? <RiLoaderLine style={{ fontSize: 14, animation: "spin 1s linear infinite" }} />
            : <RiMapPin2Line style={{ fontSize: 14 }} />
          }
          Geocoding
        </button>
      </div>

      {/* Manual picker */}
      <div>
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "0 0 8px" }}>
          Ή τοποθετήστε το pin χειροκίνητα στον χάρτη:
        </p>
        <PropertyMapPicker
          onLocationChange={(newLat, newLng) => { setLat(newLat); setLng(newLng); }}
          height={360}
        />
      </div>

      {/* Save manual coordinates */}
      {lat !== null && lng !== null && (
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "9px 20px", borderRadius: 6, fontSize: 13, fontWeight: 600,
            background: "#16a34a", color: "#fff", border: "none", cursor: "pointer",
          }}
        >
          {isPending
            ? <RiLoaderLine style={{ fontSize: 15, animation: "spin 1s linear infinite" }} />
            : <RiSaveLine style={{ fontSize: 15 }} />
          }
          Αποθήκευση θέσης ({lat.toFixed(5)}, {lng.toFixed(5)})
        </button>
      )}

      {message && (
        <p style={{
          fontSize: 12, padding: "8px 12px", borderRadius: 6,
          background: message.startsWith("Σφάλμα") ? "#fee2e218" : "#dcfce718",
          color: message.startsWith("Σφάλμα") ? "#dc2626" : "#16a34a",
          border: `1px solid ${message.startsWith("Σφάλμα") ? "#fca5a530" : "#86efac30"}`,
        }}>
          {message}
        </p>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
