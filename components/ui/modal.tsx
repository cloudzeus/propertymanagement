"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { RiCloseLine } from "react-icons/ri";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: number;
  footer?: React.ReactNode;
};

export function Modal({ open, onClose, title, children, width = 520, footer }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{
        width: "100%", maxWidth: width,
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        display: "flex", flexDirection: "column",
        maxHeight: "calc(100vh - 48px)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28, borderRadius: 6,
              border: "1px solid var(--border)", background: "var(--bg-canvas)",
              cursor: "pointer", color: "var(--muted-foreground)",
            }}
          >
            <RiCloseLine style={{ fontSize: 16 }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8,
            flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// Reusable form field wrapper
export function FormField({
  label, required, children, hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>
        {label}
        {required && <span style={{ color: "#dc2626", marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {hint && <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0 }}>{hint}</p>}
    </div>
  );
}

// Reusable text input
export function FieldInput({
  value, onChange, placeholder, type = "text", required, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      style={{
        width: "100%", height: 36, padding: "0 10px",
        border: "1px solid var(--border)", borderRadius: 6,
        fontSize: 13, color: "var(--foreground)",
        background: disabled ? "var(--bg-canvas)" : "var(--card)",
        outline: "none", boxSizing: "border-box",
      }}
    />
  );
}

// Reusable select
export function FieldSelect({
  value, onChange, options, placeholder, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        width: "100%", height: 36, padding: "0 10px",
        border: "1px solid var(--border)", borderRadius: 6,
        fontSize: 13, color: "var(--foreground)",
        background: disabled ? "var(--bg-canvas)" : "var(--card)",
        outline: "none", boxSizing: "border-box",
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// Reusable textarea
export function FieldTextarea({
  value, onChange, placeholder, rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: "100%", padding: "8px 10px",
        border: "1px solid var(--border)", borderRadius: 6,
        fontSize: 13, color: "var(--foreground)",
        background: "var(--card)", outline: "none",
        boxSizing: "border-box", resize: "vertical",
        fontFamily: "inherit",
      }}
    />
  );
}
