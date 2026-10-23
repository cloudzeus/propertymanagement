"use client";

import { RiCheckboxCircleLine, RiArrowRightLine, RiInformationLine, RiErrorWarningLine, RiCheckLine } from "react-icons/ri";
import { WizardIcon } from "@/components/wizards/icons";

/** Uniform look for the «Παράδειγμα εφαρμογής» step: a titled card in an info/success/warn tone. */
export function ExampleCard({ title, children, tone = "info" }: { title?: string; children: React.ReactNode; tone?: "info" | "success" | "warn" }) {
  const palette = {
    info: { bg: "var(--paper)", border: "var(--border)", icon: <RiInformationLine style={{ color: "var(--color-primary)" }} /> },
    success: { bg: "var(--success-soft)", border: "color-mix(in srgb, var(--color-success) 30%, transparent)", icon: <RiCheckboxCircleLine style={{ color: "var(--color-success)" }} /> },
    warn: { bg: "var(--warning-soft)", border: "color-mix(in srgb, var(--color-warning) 30%, transparent)", icon: <RiErrorWarningLine style={{ color: "var(--color-warning)" }} /> },
  }[tone];
  return (
    <section style={{ background: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      {title && <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, fontSize: "var(--fs-14)", fontWeight: 700, color: "var(--foreground)" }}>{palette.icon} {title}</h3>}
      <div style={{ fontSize: "var(--fs-13-5)", lineHeight: 1.5, color: "var(--foreground)" }}>{children}</div>
    </section>
  );
}

/** Small example table (units × amounts, scenarios × cost…). Numbers right-aligned, tabular. */
export function ExampleTable({ columns, rows, footer, align }: { columns: string[]; rows: React.ReactNode[][]; footer?: React.ReactNode[]; align?: ("left" | "right")[] }) {
  const al = (i: number) => align?.[i] ?? (i === 0 ? "left" : "right");
  const cell: React.CSSProperties = { padding: "6px 8px", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  return (
    <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 8, background: "var(--card)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)" }}>
        <thead>
          <tr style={{ color: "var(--muted-foreground)", fontSize: "var(--fs-11)", textAlign: "left" }}>
            {columns.map((c, i) => <th key={i} style={{ ...cell, textAlign: al(i), fontWeight: 600 }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} style={{ borderTop: "1px solid var(--border)" }}>
              {r.map((v, i) => <td key={i} style={{ ...cell, textAlign: al(i), color: "var(--foreground)" }}>{v ?? "—"}</td>)}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 700 }}>
              {footer.map((v, i) => <td key={i} style={{ ...cell, textAlign: al(i), color: "var(--foreground)" }}>{v}</td>)}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/** Numeric input that accepts a comma decimal and shows a unit suffix (τ.μ., €, ‰, %). */
export function NumberField({ value, onChange, unit, min, step, placeholder, disabled, ariaLabel }: {
  value: string; onChange: (v: string) => void; unit?: "τ.μ." | "€" | "‰" | "%" | string; min?: number; step?: number | "any"; placeholder?: string; disabled?: boolean; ariaLabel?: string;
}) {
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <input
        type="text" inputMode="decimal" value={value} disabled={disabled} placeholder={placeholder} aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,-]/g, ""))}
        onBlur={(e) => { const n = parseNumber(e.target.value); if (n !== null && min !== undefined && n < min) onChange(String(min).replace(".", ",")); }}
        data-step={step}
        style={{ width: "100%", height: 40, padding: unit ? "0 42px 0 10px" : "0 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "var(--fs-13)", color: "var(--foreground)", background: disabled ? "var(--paper)" : "var(--card)", outline: "none", boxSizing: "border-box", textAlign: "right", fontVariantNumeric: "tabular-nums" }}
      />
      {unit && <span style={{ position: "absolute", right: 10, fontSize: "var(--fs-12)", color: "var(--muted-foreground)", pointerEvents: "none" }}>{unit}</span>}
    </div>
  );
}

/** "1.234,5" / "1234.5" → 1234.5; empty or junk → null. */
export function parseNumber(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const normalized = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export type DoneNext = { label: string; onClick: () => void; icon?: string; hint?: string };

/** «Έγινε!» screen: what was created + the next step of the chain. */
export function DoneScreen({ title, lines = [], next = [], onClose }: { title: string; lines?: string[]; next?: DoneNext[]; onClose: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 14, padding: "12px 0 4px" }}>
      <div className="pop" style={{ width: 64, height: 64, borderRadius: 999, background: "var(--color-success)", color: "#fff", display: "grid", placeItems: "center", fontSize: "var(--fs-28)" }}><RiCheckLine /></div>
      <div style={{ fontSize: "var(--fs-18)", fontWeight: 800, color: "var(--foreground)" }}>{title}</div>
      {lines.length > 0 && <ul style={{ margin: 0, padding: 0, listStyle: "none", color: "var(--muted-foreground)", fontSize: "var(--fs-13-5)", lineHeight: 1.6 }}>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>}
      {next.length > 0 && (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
          <div style={{ fontSize: "var(--fs-12)", fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: 0.4 }}>Επόμενο βήμα</div>
          {next.map((n) => (
            <button key={n.label} type="button" onClick={n.onClick} style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", minHeight: 48, padding: "10px 14px", borderRadius: 10, border: "2px solid var(--color-primary)", background: "var(--card)", color: "var(--foreground)", cursor: "pointer", fontSize: "var(--fs-14)", fontWeight: 700 }}>
              {n.icon && <WizardIcon name={n.icon} style={{ fontSize: "var(--fs-20)", color: "var(--color-primary)" }} />}
              <span style={{ flex: 1, minWidth: 0 }}>
                {n.label}
                {n.hint && <span style={{ display: "block", fontSize: "var(--fs-12)", fontWeight: 400, color: "var(--muted-foreground)" }}>{n.hint}</span>}
              </span>
              <RiArrowRightLine />
            </button>
          ))}
        </div>
      )}
      <button type="button" onClick={onClose} style={{ marginTop: 4, padding: "9px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: "var(--fs-13)", color: "var(--foreground)" }}>Κλείσιμο</button>
    </div>
  );
}
