"use client";
import { ICON_NAMES, resolveIcon } from "@/lib/cms/icon-registry";
import { CmsField } from "@/components/cms/ui";

export function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const Icon = resolveIcon(value);
  return (
    <CmsField label="Εικονίδιο">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ display: "flex", width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 8, background: "var(--primary)", color: "#fff" }}>
          <Icon size={18} />
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ height: 36, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", padding: "0 10px" }}
        >
          {ICON_NAMES.map((n) => (<option key={n} value={n}>{n}</option>))}
        </select>
      </div>
    </CmsField>
  );
}
