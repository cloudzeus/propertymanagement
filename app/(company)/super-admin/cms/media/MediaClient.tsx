"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  RiImage2Line,
  RiUploadLine,
  RiFilmLine,
  RiPlayFill,
  RiFileCopyLine,
  RiDeleteBinLine,
} from "react-icons/ri";
import { CmsPage, CmsCard, CmsField, CmsInput, CmsButton } from "@/components/cms/ui";
import { Modal } from "@/components/ui/modal";
import { deleteMedia, updateMediaMeta } from "@/app/actions/media";

type MediaAsset = {
  id: string;
  type: "IMAGE" | "SVG" | "VIDEO";
  url: string;
  mime: string;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  alt: string | null;
  title: string | null;
  originalName: string | null;
  createdAt: string;
};

const CHECKER =
  "repeating-conic-gradient(var(--muted) 0% 25%, transparent 0% 50%) 50% / 16px 16px";

const TYPES = ["Όλα", "IMAGE", "SVG", "VIDEO"] as const;

function fmtBytes(n: number | null): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function MediaClient({ initial }: { initial: MediaAsset[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<(typeof TYPES)[number]>("Όλα");
  const [uploading, setUploading] = useState(0);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);

  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [alt, setAlt] = useState("");
  const [title, setTitle] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return initial.filter((m) => {
      if (typeFilter !== "Όλα" && m.type !== typeFilter) return false;
      if (!needle) return true;
      return (
        (m.title || "").toLowerCase().includes(needle) ||
        (m.alt || "").toLowerCase().includes(needle) ||
        (m.originalName || "").toLowerCase().includes(needle)
      );
    });
  }, [initial, q, typeFilter]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadErrors([]);
    const list = Array.from(files);
    setUploading(list.length);
    const errors: string[] = [];
    for (const file of list) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/cms/media/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          errors.push(`${file.name}: ${data.error || res.status}`);
        }
      } catch (e: any) {
        errors.push(`${file.name}: ${e?.message || "σφάλμα"}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    setUploadErrors(errors);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  function openDetail(m: MediaAsset) {
    setSelected(m);
    setAlt(m.alt || "");
    setTitle(m.title || "");
    setCopied(false);
  }

  function copyUrl() {
    if (!selected) return;
    navigator.clipboard.writeText(selected.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function save() {
    if (!selected) return;
    startTransition(async () => {
      await updateMediaMeta(selected.id, { alt, title });
      setSelected(null);
      router.refresh();
    });
  }

  function remove() {
    if (!selected) return;
    if (!confirm("Διαγραφή αρχείου; Η ενέργεια δεν αναιρείται.")) return;
    startTransition(async () => {
      await deleteMedia(selected.id);
      setSelected(null);
      router.refresh();
    });
  }

  return (
    <CmsPage
      icon={<RiImage2Line size={20} />}
      title="Media"
      subtitle="Βιβλιοθήκη πολυμέσων (WebP auto, max 1920)"
    >
      {/* Toolbar */}
      <CmsCard>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,video/*,.svg"
            style={{ display: "none" }}
            onChange={(e) => handleFiles(e.target.files)}
          />
          <CmsButton
            variant="primary"
            icon={<RiUploadLine size={15} />}
            onClick={() => fileRef.current?.click()}
            loading={uploading > 0}
          >
            {uploading > 0 ? `Ανέβασμα… (${uploading})` : "Ανέβασμα"}
          </CmsButton>

          <div style={{ flex: 1, minWidth: 180 }}>
            <CmsInput
              placeholder="Αναζήτηση…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            {TYPES.map((t) => {
              const active = typeFilter === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "1px solid var(--border)",
                    background: active ? "var(--color-primary)" : "transparent",
                    color: active ? "#fff" : "var(--muted-foreground)",
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        {uploadErrors.length > 0 && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 6,
              background: "color-mix(in srgb, var(--color-danger) 10%, white)",
              border: "1px solid var(--color-danger)",
              fontSize: 12,
              color: "var(--color-danger)",
            }}
          >
            {uploadErrors.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        )}
      </CmsCard>

      {/* Grid */}
      <CmsCard>
        {filtered.length === 0 ? (
          <div
            style={{
              padding: "48px 0",
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
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            {filtered.map((m) => (
              <div
                key={m.id}
                onClick={() => openDetail(m)}
                style={{
                  border: "1px solid var(--border)",
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
                  {m.type === "VIDEO" ? (
                    <>
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <video
                        src={m.url}
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
                        <RiPlayFill size={28} />
                      </div>
                    </>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={m.url}
                      alt={m.alt || ""}
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  )}
                </div>
                <div style={{ padding: "8px 10px" }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--foreground)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {m.title || m.originalName || m.id}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 6,
                      fontSize: 11,
                      color: "var(--muted-foreground)",
                    }}
                  >
                    <span>{m.width && m.height ? `${m.width}×${m.height}` : "—"}</span>
                    <span
                      style={{
                        padding: "1px 7px",
                        borderRadius: 999,
                        background: "var(--muted)",
                        fontWeight: 600,
                        fontSize: 10,
                      }}
                    >
                      {m.type}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CmsCard>

      {/* Detail modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Στοιχεία αρχείου"
        width={560}
        footer={
          selected ? (
            <>
              <CmsButton
                variant="danger"
                icon={<RiDeleteBinLine size={15} />}
                onClick={remove}
                loading={pending}
                style={{ marginRight: "auto" }}
              >
                Διαγραφή
              </CmsButton>
              <CmsButton variant="secondary" onClick={() => setSelected(null)}>
                Άκυρο
              </CmsButton>
              <CmsButton variant="primary" onClick={save} loading={pending}>
                Αποθήκευση
              </CmsButton>
            </>
          ) : null
        }
      >
        {selected && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                aspectRatio: "16 / 9",
                background: CHECKER,
                borderRadius: 8,
                border: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {selected.type === "VIDEO" ? (
                /* eslint-disable-next-line jsx-a11y/media-has-caption */
                <video
                  src={selected.url}
                  controls
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={selected.url}
                  alt={selected.alt || ""}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              )}
            </div>

            <CmsField label="URL">
              <div style={{ display: "flex", gap: 8 }}>
                <CmsInput readOnly value={selected.url} onClick={(e) => e.currentTarget.select()} />
                <CmsButton
                  variant="secondary"
                  icon={<RiFileCopyLine size={15} />}
                  onClick={copyUrl}
                  style={{ flexShrink: 0 }}
                >
                  {copied ? "Αντιγράφηκε" : "Αντιγραφή URL"}
                </CmsButton>
              </div>
            </CmsField>

            <CmsField label="Alt">
              <CmsInput value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Εναλλακτικό κείμενο" />
            </CmsField>

            <CmsField label="Τίτλος">
              <CmsInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Τίτλος" />
            </CmsField>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 16,
                fontSize: 12,
                color: "var(--muted-foreground)",
              }}
            >
              <span>
                <strong style={{ color: "var(--foreground)" }}>Τύπος:</strong> {selected.type}
              </span>
              <span>
                <strong style={{ color: "var(--foreground)" }}>Διαστάσεις:</strong>{" "}
                {selected.width && selected.height ? `${selected.width}×${selected.height}` : "—"}
              </span>
              <span>
                <strong style={{ color: "var(--foreground)" }}>Μέγεθος:</strong> {fmtBytes(selected.sizeBytes)}
              </span>
              <span>
                <strong style={{ color: "var(--foreground)" }}>Αρχείο:</strong>{" "}
                {selected.originalName || "—"}
              </span>
            </div>
          </div>
        )}
      </Modal>
    </CmsPage>
  );
}
