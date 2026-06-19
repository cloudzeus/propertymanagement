"use client";

import { useTransition } from "react";
import { RiMapPin2Line, RiLoaderLine, RiCheckLine } from "react-icons/ri";
import { geocodeProperty } from "@/app/actions/property-geodata";
import { useRouter } from "next/navigation";

export function GeocodeButton({ propertyId }: { propertyId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      await geocodeProperty(propertyId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      title="Αυτόματο geocoding από τη διεύθυνση"
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "7px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
        border: "1px solid var(--border)", background: "var(--bg-canvas)",
        cursor: isPending ? "wait" : "pointer", color: "var(--foreground)", whiteSpace: "nowrap",
      }}
    >
      {isPending
        ? <RiLoaderLine style={{ fontSize: 14, animation: "spin 1s linear infinite" }} />
        : <RiMapPin2Line style={{ fontSize: 14 }} />
      }
      Geocode
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </button>
  );
}
