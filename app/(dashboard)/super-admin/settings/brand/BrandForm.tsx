"use client";

import { useState, useTransition, useRef } from "react";
import { RiSaveLine, RiCheckLine, RiUploadCloud2Line, RiDeleteBin6Line, RiImageLine } from "react-icons/ri";
import { uploadBrandLogo, removeBrandLogo } from "@/app/actions/brand";

type LogoSlot = "logoFullLight" | "logoFullDark" | "logoSquareLight" | "logoSquareDark";

type BrandSettings = {
  companyName: string;
  logoFullLight: string | null;
  logoFullDark: string | null;
  logoSquareLight: string | null;
  logoSquareDark: string | null;
  colorPrimary: string;
  colorPrimaryDk: string;
  colorAccent: string;
  colorSuccess: string;
  colorWarning: string;
  colorDanger: string;
  colorPurple: string;
  colorTeal: string;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
  websiteUrl: string | null;
};

const LOGO_SLOTS: { slot: LogoSlot; label: string; shape: "full" | "square"; bg: "light" | "dark" }[] = [
  { slot: "logoFullLight",   label: "Full — Light mode",   shape: "full",   bg: "light" },
  { slot: "logoFullDark",    label: "Full — Dark mode",    shape: "full",   bg: "dark" },
  { slot: "logoSquareLight", label: "Square — Light mode", shape: "square", bg: "light" },
  { slot: "logoSquareDark",  label: "Square — Dark mode",  shape: "square", bg: "dark" },
];

function LogoTile({ slot, label, shape, bg, initialUrl }: { slot: LogoSlot; label: string; shape: "full" | "square"; bg: "light" | "dark"; initialUrl: string | null }) {
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    const fd = new FormData();
    fd.append("slot", slot);
    fd.append("file", file);
    startTransition(async () => {
      const res = await uploadBrandLogo(fd);
      if (res?.error) setErr(res.error);
      else if (res?.url) setUrl(res.url);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function onRemove() {
    setErr(null);
    startTransition(async () => {
      const res = await removeBrandLogo(slot);
      if (res?.error) setErr(res.error);
      else setUrl(null);
    });
  }

  const previewBg = bg === "dark" ? "#1F1F1F" : "#FFFFFF";
  const previewH = shape === "square" ? 96 : 80;

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14, background: "var(--bg-canvas)", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>{label}</span>
        <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{shape === "square" ? "1:1" : "οριζόντιο"}</span>
      </div>
      <div style={{
        height: previewH, borderRadius: 8, background: previewBg,
        border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} style={{ maxHeight: previewH - 20, maxWidth: "85%", objectFit: "contain" }} />
        ) : (
          <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: bg === "dark" ? "#6B6B6B" : "#B3B3B3", fontSize: 11 }}>
            <RiImageLine size={22} /> Χωρίς λογότυπο
          </span>
        )}
      </div>
      {err && <span style={{ fontSize: 11, color: "var(--color-danger)" }}>{err}</span>}
      <div style={{ display: "flex", gap: 8 }}>
        <input ref={inputRef} type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp" onChange={onPick} style={{ display: "none" }} />
        <button type="button" disabled={pending} onClick={() => inputRef.current?.click()} style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)",
          cursor: pending ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, color: "var(--foreground)",
        }}>
          <RiUploadCloud2Line size={14} /> {pending ? "..." : url ? "Αλλαγή" : "Ανέβασμα"}
        </button>
        {url && (
          <button type="button" disabled={pending} onClick={onRemove} title="Αφαίρεση" style={{
            padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)",
            cursor: pending ? "not-allowed" : "pointer", color: "var(--color-danger)",
          }}>
            <RiDeleteBin6Line size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

type Props = { settings: BrandSettings; action: (formData: FormData) => Promise<void> };

const COLOR_FIELDS: { key: keyof BrandSettings; label: string; cssVar: string }[] = [
  { key: "colorPrimary",   label: "Κύριο Χρώμα",        cssVar: "--color-primary" },
  { key: "colorPrimaryDk", label: "Κύριο (σκούρο)",     cssVar: "--color-primary-dk" },
  { key: "colorAccent",    label: "Accent",              cssVar: "--color-accent" },
  { key: "colorSuccess",   label: "Επιτυχία",            cssVar: "--color-success" },
  { key: "colorWarning",   label: "Προειδοποίηση",       cssVar: "--color-warning" },
  { key: "colorDanger",    label: "Κίνδυνος",            cssVar: "--color-danger" },
  { key: "colorPurple",    label: "Μωβ",                 cssVar: "--color-purple" },
  { key: "colorTeal",      label: "Teal",                cssVar: "--color-teal" },
];

export function BrandForm({ settings, action }: Props) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<Record<string, string>>({});

  function handleColorChange(key: string, value: string) {
    setPreview((p) => ({ ...p, [key]: value }));
    // Live preview the primary color
    if (key === "colorPrimary") {
      document.documentElement.style.setProperty("--color-primary", value);
      document.documentElement.style.setProperty("--primary", value);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await action(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Company info */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: "0 0 18px" }}>Στοιχεία Εταιρείας</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[
            { name: "companyName", label: "Όνομα Εταιρείας", type: "text", defaultValue: settings.companyName },
            { name: "websiteUrl",  label: "Website URL",      type: "url",  defaultValue: settings.websiteUrl ?? "" },
            { name: "contactEmail", label: "Email Επικοινωνίας", type: "email", defaultValue: settings.contactEmail ?? "" },
            { name: "contactPhone", label: "Τηλέφωνο",          type: "text",  defaultValue: settings.contactPhone ?? "" },
          ].map((field) => (
            <div key={field.name}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", display: "block", marginBottom: 6, letterSpacing: "0.03em" }}>
                {field.label}
              </label>
              <input
                name={field.name}
                type={field.type}
                defaultValue={field.defaultValue}
                style={{
                  width: "100%", padding: "8px 12px",
                  border: "1px solid var(--border)", borderRadius: 6,
                  fontSize: 13, color: "var(--foreground)", background: "var(--bg-canvas)",
                  outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
          ))}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", display: "block", marginBottom: 6, letterSpacing: "0.03em" }}>
              Διεύθυνση
            </label>
            <input
              name="contactAddress"
              type="text"
              defaultValue={settings.contactAddress ?? ""}
              style={{
                width: "100%", padding: "8px 12px",
                border: "1px solid var(--border)", borderRadius: 6,
                fontSize: 13, color: "var(--foreground)", background: "var(--bg-canvas)",
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      </div>

      {/* Logos */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: "0 0 6px" }}>Λογότυπα</h2>
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "0 0 18px" }}>
          Full (οριζόντιο) και Square (εικονίδιο), για light & dark mode. SVG αποθηκεύεται ως έχει· οποιαδήποτε άλλη μορφή μετατρέπεται αυτόματα σε WebP με διαφάνεια. Ανεβαίνουν αμέσως (ανεξάρτητα από την Αποθήκευση χρωμάτων).
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {LOGO_SLOTS.map((l) => (
            <LogoTile key={l.slot} slot={l.slot} label={l.label} shape={l.shape} bg={l.bg} initialUrl={settings[l.slot]} />
          ))}
        </div>
      </div>

      {/* Colors */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: "0 0 6px" }}>Χρώματα Brand</h2>
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "0 0 18px" }}>
          Τα χρώματα εφαρμόζονται άμεσα σε όλη την εφαρμογή ως CSS variables.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {COLOR_FIELDS.map(({ key, label, cssVar }) => {
            const currentValue = (preview[key] ?? settings[key]) as string;
            return (
              <div key={key}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", display: "block", marginBottom: 6 }}>
                  {label}
                  <span style={{ fontSize: 10, fontFamily: "monospace", marginLeft: 4, color: "#A0A0A0" }}>{cssVar}</span>
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="color"
                    name={key}
                    value={currentValue}
                    onChange={(e) => handleColorChange(key, e.target.value)}
                    style={{
                      width: 40, height: 36, border: "1px solid var(--border)",
                      borderRadius: 6, cursor: "pointer", padding: 2, background: "var(--bg-canvas)",
                    }}
                  />
                  <input
                    type="text"
                    value={currentValue}
                    onChange={(e) => handleColorChange(key, e.target.value)}
                    name={`${key}_text`}
                    style={{
                      flex: 1, padding: "8px 10px", border: "1px solid var(--border)",
                      borderRadius: 6, fontSize: 12, fontFamily: "monospace",
                      color: "var(--foreground)", background: "var(--bg-canvas)", outline: "none",
                    }}
                  />
                </div>
                <div style={{
                  marginTop: 6, height: 6, borderRadius: 3,
                  background: currentValue,
                }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Color preview */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: "0 0 16px" }}>Προεπισκόπηση</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {COLOR_FIELDS.map(({ key, label }) => {
            const color = (preview[key] ?? settings[key]) as string;
            return (
              <div key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 10,
                  background: color,
                  boxShadow: "0 2px 8px rgba(0,0,0,.12)",
                }} />
                <span style={{ fontSize: 11, color: "var(--muted-foreground)", textAlign: "center" }}>{label}</span>
                <span style={{ fontSize: 10, fontFamily: "monospace", color: "#A0A0A0" }}>{color}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save */}
      <div style={{ display: "flex", gap: 12 }}>
        <button
          type="submit"
          disabled={isPending}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "10px 20px", borderRadius: "var(--radius)",
            background: saved ? "var(--color-success)" : "var(--color-primary)", color: "#fff",
            border: "none", cursor: isPending ? "not-allowed" : "pointer",
            fontSize: 13, fontWeight: 600, opacity: isPending ? 0.7 : 1,
            transition: "background 0.3s",
          }}
        >
          {saved ? <RiCheckLine size={15} /> : <RiSaveLine size={15} />}
          {isPending ? "Αποθήκευση..." : saved ? "Αποθηκεύτηκε!" : "Αποθήκευση Αλλαγών"}
        </button>
      </div>
    </form>
  );
}
