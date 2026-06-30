"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RiImageLine, RiUploadLine, RiPlayFill, RiCloseLine } from "react-icons/ri";
import { CmsInput, CmsButton } from "@/components/cms/ui";
import { Modal } from "@/components/ui/modal";

type MediaAsset = {
  id: string;
  type: "IMAGE" | "SVG" | "VIDEO";
  url: string;
  alt: string | null;
  title: string | null;
  originalName: string | null;
  width: number | null;
  height: number | null;
};

const CHECKER =
  "repeating-conic-gradient(var(--muted) 0% 25%, transparent 0% 50%) 50% / 16px 16px";

function matchesAccept(type: MediaAsset["type"], accept: "image" | "video" | "all"): boolean {
  if (accept === "all") return true;
  if (accept === "image") return type === "IMAGE" || type === "SVG";
  return type === "VIDEO";
}

function toArray(v: string | string[] | null): string[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function AssetThumb({ asset, size = 64 }: { asset: MediaAsset; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        border: "1px solid var(--border)",
        background: CHECKER,
        overflow: "hidden",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {asset.type === "VIDEO" ? (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={asset.url} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              textShadow: "0 1px 4px rgba(0,0,0,0.5)",
            }}
          >
            <RiPlayFill size={20} />
          </div>
        </>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={asset.url}
          alt={asset.alt || ""}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      )}
    </div>
  );
}

export function MediaPicker({
  value,
  onChange,
  multiple = false,
  accept = "image",
}: {
  value: string | string[] | null;
  onChange: (v: string | string[]) => void;
  multiple?: boolean;
  accept?: "image" | "video" | "all";
}) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const currentIds = toArray(value);

  async function load() {
    try {
      const res = await fetch("/api/cms/media/list");
      if (!res.ok) return;
      const data = await res.json();
      setAssets((data.items as MediaAsset[]) || []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openModal() {
    setSelected(currentIds);
    setQ("");
    load();
    setOpen(true);
  }

  function confirmSingle(id: string) {
    onChange(id);
    setOpen(false);
  }

  function toggleMulti(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function confirmMulti() {
    onChange(selected);
    setOpen(false);
  }

  function removeCurrent(id: string) {
    if (multiple) {
      onChange(currentIds.filter((x) => x !== id));
    } else {
      onChange("");
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const file = files[0];
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/cms/media/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        const asset = data.asset as MediaAsset;
        if (asset) {
          setAssets((prev) => [asset, ...prev.filter((a) => a.id !== asset.id)]);
          if (multiple) {
            setSelected((prev) => (prev.includes(asset.id) ? prev : [...prev, asset.id]));
          } else {
            confirmSingle(asset.id);
          }
        }
      }
    } catch {
      /* ignore */
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return assets.filter((a) => {
      if (!matchesAccept(a.type, accept)) return false;
      if (!needle) return true;
      return (
        (a.title || "").toLowerCase().includes(needle) ||
        (a.alt || "").toLowerCase().includes(needle) ||
        (a.originalName || "").toLowerCase().includes(needle)
      );
    });
  }, [assets, q, accept]);

  const acceptAttr =
    accept === "video" ? "video/*" : accept === "all" ? "image/*,video/*,.svg" : "image/*,.svg";

  return (
    <div>
      {/* Preview area */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        {currentIds.map((id) => {
          const a = byId.get(id);
          return (
            <div key={id} style={{ position: "relative" }}>
              {a ? (
                <AssetThumb asset={a} />
              ) : (
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--muted-foreground)",
                  }}
                >
                  <RiImageLine size={20} />
                </div>
              )}
              <button
                type="button"
                onClick={() => removeCurrent(id)}
                aria-label="Αφαίρεση"
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  color: "var(--muted-foreground)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                <RiCloseLine size={13} />
              </button>
            </div>
          );
        })}

        <CmsButton variant="secondary" icon={<RiImageLine size={15} />} onClick={openModal}>
          {currentIds.length > 0
            ? multiple
              ? `Επιλογή από βιβλιοθήκη (${currentIds.length})`
              : "Αλλαγή"
            : "Επιλογή από βιβλιοθήκη"}
        </CmsButton>
      </div>

      {/* Picker modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Βιβλιοθήκη πολυμέσων"
        width={720}
        footer={
          multiple ? (
            <>
              <CmsButton variant="secondary" onClick={() => setOpen(false)}>
                Άκυρο
              </CmsButton>
              <CmsButton variant="primary" onClick={confirmMulti}>
                Τέλος ({selected.length})
              </CmsButton>
            </>
          ) : null
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              ref={fileRef}
              type="file"
              accept={acceptAttr}
              style={{ display: "none" }}
              onChange={(e) => handleUpload(e.target.files)}
            />
            <div style={{ flex: 1 }}>
              <CmsInput
                placeholder="Αναζήτηση…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <CmsButton
              variant="secondary"
              icon={<RiUploadLine size={15} />}
              onClick={() => fileRef.current?.click()}
              loading={uploading}
              style={{ flexShrink: 0 }}
            >
              {uploading ? "Ανέβασμα…" : "Ανέβασμα"}
            </CmsButton>
          </div>

          {filtered.length === 0 ? (
            <div
              style={{
                padding: "40px 0",
                textAlign: "center",
                color: "var(--muted-foreground)",
                fontSize: 13,
              }}
            >
              Δεν υπάρχουν αρχεία.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: 12,
              }}
            >
              {filtered.map((a) => {
                const isSel = multiple ? selected.includes(a.id) : false;
                return (
                  <div
                    key={a.id}
                    onClick={() => (multiple ? toggleMulti(a.id) : confirmSingle(a.id))}
                    style={{
                      border: isSel
                        ? "2px solid var(--color-primary)"
                        : "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      background: "var(--card)",
                      overflow: "hidden",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        aspectRatio: "4 / 3",
                        background: CHECKER,
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {a.type === "VIDEO" ? (
                        <>
                          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                          <video
                            src={a.url}
                            muted
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                              textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                            }}
                          >
                            <RiPlayFill size={26} />
                          </div>
                        </>
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={a.url}
                          alt={a.alt || ""}
                          style={{ width: "100%", height: "100%", objectFit: "contain" }}
                        />
                      )}
                    </div>
                    <div style={{ padding: "6px 8px" }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--foreground)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {a.title || a.originalName || a.id}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
