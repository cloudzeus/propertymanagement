"use client";

import React from "react";
import { RiSaveLine, RiCheckLine } from "react-icons/ri";

/* ---------- CmsPage ---------- */

export function CmsPage({
  icon,
  title,
  subtitle,
  color,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  color?: string;
  children: React.ReactNode;
}) {
  const accent = color ?? "var(--color-primary)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: `color-mix(in srgb, ${accent} 12%, white)`,
            color: accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)" }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>{subtitle}</div>
          )}
        </div>
      </div>
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ---------- CmsCard ---------- */

export function CmsCard({
  title,
  actions,
  children,
}: {
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 24,
      }}
    >
      {(title || actions) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          {title && <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>{title}</h2>}
          {actions && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

/* ---------- CmsField ---------- */

export function CmsField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--muted-foreground)",
          display: "block",
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

/* ---------- CmsInput ---------- */

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 13,
  color: "var(--foreground)",
  background: "var(--bg-canvas)",
  outline: "none",
  boxSizing: "border-box",
};

export const CmsInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function CmsInput({ style, onFocus, onBlur, ...rest }, ref) {
    return (
      <input
        ref={ref}
        {...rest}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--color-primary)";
          onFocus?.(e);
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--border)";
          onBlur?.(e);
        }}
        style={{ ...fieldStyle, ...style }}
      />
    );
  }
);

/* ---------- CmsTextarea ---------- */

export const CmsTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean }
>(function CmsTextarea({ style, mono, onFocus, onBlur, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      {...rest}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "var(--color-primary)";
        onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        onBlur?.(e);
      }}
      style={{
        ...fieldStyle,
        ...(mono ? { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" } : null),
        ...style,
      }}
    />
  );
});

/* ---------- LocaleTabs ---------- */

export function LocaleTabs({
  value,
  onChange,
}: {
  value: "el" | "en";
  onChange: (v: "el" | "en") => void;
}) {
  const opts: { v: "el" | "en"; label: string }[] = [
    { v: "el", label: "Ελληνικά" },
    { v: "en", label: "English" },
  ];
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {opts.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              background: active ? "var(--color-primary)" : "var(--muted)",
              color: active ? "#fff" : "var(--muted-foreground)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- CmsButton ---------- */

type CmsButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
  icon?: React.ReactNode;
};

export function CmsButton({
  variant = "primary",
  loading = false,
  icon,
  children,
  style,
  disabled,
  ...rest
}: CmsButtonProps) {
  const variantStyle: React.CSSProperties =
    variant === "secondary"
      ? { background: "transparent", color: "var(--foreground)", border: "1px solid var(--border)" }
      : variant === "danger"
      ? { background: "var(--color-danger)", color: "#fff", border: "none" }
      : { background: "var(--color-primary)", color: "#fff", border: "none" };

  return (
    <button
      type="button"
      disabled={disabled ?? loading}
      {...rest}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "9px 18px",
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 600,
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.7 : 1,
        ...variantStyle,
        ...style,
      }}
    >
      {icon}
      {children}
    </button>
  );
}

/* ---------- SaveBar ---------- */

export function SaveBar({
  onSave,
  pending,
  saved,
  label,
}: {
  onSave: () => void;
  pending?: boolean;
  saved?: boolean;
  label?: string;
}) {
  return (
    <CmsButton
      variant="primary"
      loading={pending}
      onClick={onSave}
      disabled={pending}
      icon={saved ? <RiCheckLine size={15} /> : <RiSaveLine size={15} />}
      style={saved ? { background: "var(--color-success)" } : undefined}
    >
      {pending ? "Αποθήκευση…" : saved ? "Αποθηκεύτηκε" : label ?? "Αποθήκευση"}
    </CmsButton>
  );
}
