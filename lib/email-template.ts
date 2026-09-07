/**
 * One branded HTML shell for EVERY outgoing email (Orithon design: warm cream
 * canvas, white card, ink text, amber accent, logo on top). Pure functions —
 * no DB — so they are usable from actions, cron routes and tests. Brand
 * values come from `getEmailBrand()` (lib/email-brand.ts) or the defaults here.
 */

export type EmailBrand = {
  name: string;
  logoUrl: string;
  siteUrl: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
};

export const DEFAULT_EMAIL_BRAND: EmailBrand = {
  name: "Orithon",
  logoUrl: "https://propertymanagement.b-cdn.net/brand/orithon-lockup-black.png",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://property.dgsmart.gr",
  address: "Αθήνα, Ελλάδα",
  phone: null,
  email: null,
};

// Palette mirrors app/globals.css (emails can't read CSS variables).
const C = {
  canvas: "#F6F4EC",
  card: "#FFFFFF",
  ink: "#1b1c1a",
  muted: "rgba(27,28,26,.62)",
  faint: "rgba(27,28,26,.45)",
  line: "rgba(27,28,26,.10)",
  accent: "#F2A23C",
  primary: "#15161a",
  paper: "#FBFAF5",
  success: "#2E7D5B",
  danger: "#C0392B",
};
const FONT = "'Commissioner','Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export const escapeHtml = (s: string) =>
  s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Plain text (with \n) → escaped paragraphs. */
export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:${C.ink}">${escapeHtml(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Key/value table used for booking details, offer summaries, etc. */
export function detailRows(rows: [string, string | null | undefined][]): string {
  const body = rows
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(
      ([k, v]) => `<tr>
        <td style="padding:9px 12px;font-size:13px;color:${C.muted};border-top:1px solid ${C.line};white-space:nowrap;vertical-align:top">${escapeHtml(k)}</td>
        <td style="padding:9px 12px;font-size:14px;font-weight:600;color:${C.ink};border-top:1px solid ${C.line}">${v}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" style="width:100%;border-collapse:collapse;margin:16px 0;background:${C.paper};border-radius:10px;overflow:hidden">${body}</table>`;
}

export function emailButton(label: string, href: string, variant: "primary" | "accent" | "ghost" = "primary"): string {
  const bg = variant === "accent" ? C.accent : variant === "ghost" ? "transparent" : C.primary;
  const color = variant === "accent" ? C.ink : variant === "ghost" ? C.ink : "#ffffff";
  const border = variant === "ghost" ? `1px solid ${C.line}` : "none";
  return `<a href="${href}" style="display:inline-block;background:${bg};color:${color};border:${border};text-decoration:none;padding:12px 26px;border-radius:999px;font-weight:700;font-size:14px;font-family:${FONT}">${escapeHtml(label)}</a>`;
}

/** Big OTP / code block. */
export function codeBlock(code: string): string {
  return `<div style="background:${C.paper};border:1px dashed ${C.accent};border-radius:14px;padding:22px;text-align:center;margin:18px 0">
    <div style="font-size:34px;font-weight:800;letter-spacing:.22em;color:${C.ink};font-family:${FONT}">${escapeHtml(code)}</div>
  </div>`;
}

export function noteBox(text: string, tone: "info" | "success" | "danger" = "info"): string {
  const color = tone === "success" ? C.success : tone === "danger" ? C.danger : C.accent;
  return `<div style="border-left:3px solid ${color};background:${C.paper};padding:10px 14px;border-radius:0 10px 10px 0;margin:14px 0;font-size:13.5px;line-height:1.6;color:${C.ink}">${text}</div>`;
}

export type RenderEmailOptions = {
  title: string;
  /** hidden inbox preview line */
  preheader?: string;
  /** small label above the title, e.g. building name or "Βλάβη #123" */
  eyebrow?: string;
  greeting?: string;
  /** already-HTML body (use textToHtml / detailRows / noteBox helpers) */
  bodyHtml: string;
  cta?: { label: string; href: string; variant?: "primary" | "accent" | "ghost" };
  /** small muted line under the CTA */
  afterCta?: string;
  /** footer extras for marketing mail (GDPR) */
  unsubscribeUrl?: string;
  brand?: Partial<EmailBrand>;
};

export function renderEmail(o: RenderEmailOptions): string {
  const b: EmailBrand = { ...DEFAULT_EMAIL_BRAND, ...o.brand };
  const contact = [b.address, b.phone, b.email].filter(Boolean).map((x) => escapeHtml(String(x))).join(" · ");
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(o.title)}</title></head>
<body style="margin:0;padding:0;background:${C.canvas};font-family:${FONT};-webkit-font-smoothing:antialiased">
${o.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(o.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.canvas}"><tr><td align="center" style="padding:32px 14px">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px">
    <tr><td align="center" style="padding:0 0 20px">
      <a href="${b.siteUrl}" style="text-decoration:none"><img src="${b.logoUrl}" alt="${escapeHtml(b.name)}" width="150" style="display:block;width:150px;height:auto;border:0"></a>
    </td></tr>
    <tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:20px;padding:34px 34px 28px;box-shadow:0 22px 48px -32px rgba(27,28,26,.28)">
      ${o.eyebrow ? `<div style="font-size:11.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${C.accent};margin:0 0 8px">${escapeHtml(o.eyebrow)}</div>` : ""}
      <h1 style="margin:0 0 16px;font-size:23px;line-height:1.25;letter-spacing:-.01em;color:${C.ink};font-weight:800">${escapeHtml(o.title)}</h1>
      ${o.greeting ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:${C.ink}">${escapeHtml(o.greeting)}</p>` : ""}
      ${o.bodyHtml}
      ${o.cta ? `<div style="text-align:center;margin:26px 0 8px">${emailButton(o.cta.label, o.cta.href, o.cta.variant)}</div>` : ""}
      ${o.afterCta ? `<p style="margin:10px 0 0;text-align:center;font-size:12.5px;color:${C.faint};line-height:1.5">${o.afterCta}</p>` : ""}
    </td></tr>
    <tr><td align="center" style="padding:22px 12px 0;font-size:12px;line-height:1.7;color:${C.faint}">
      <div style="font-weight:700;color:${C.muted}">${escapeHtml(b.name)}</div>
      ${contact ? `<div>${contact}</div>` : ""}
      <div>© ${year} ${escapeHtml(b.name)} · <a href="${b.siteUrl}" style="color:${C.faint}">${b.siteUrl.replace(/^https?:\/\//, "")}</a>${o.unsubscribeUrl ? ` · <a href="${o.unsubscribeUrl}" style="color:${C.faint}">Διαγραφή από τη λίστα</a>` : ""}</div>
      <div style="margin-top:6px">Αυτό το μήνυμα στάλθηκε αυτόματα από την πλατφόρμα ${escapeHtml(b.name)}. <a href="${b.siteUrl}/el/privacy" style="color:${C.faint}">Πολιτική απορρήτου</a></div>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

/** Text fallback built from the same pieces. */
export function renderText(o: { title: string; greeting?: string; text: string; cta?: { label: string; href: string }; brand?: Partial<EmailBrand> }): string {
  const b = { ...DEFAULT_EMAIL_BRAND, ...o.brand };
  return [o.title, "", o.greeting, o.text, o.cta ? `\n${o.cta.label}: ${o.cta.href}` : "", "", `— ${b.name} · ${b.siteUrl}`].filter((x) => x != null).join("\n");
}

/** Absolute app link for in-app hrefs like "/admin/maintenance/123". */
export function absoluteUrl(href: string, brand?: Partial<EmailBrand>): string {
  if (/^https?:\/\//.test(href)) return href;
  const base = (brand?.siteUrl ?? DEFAULT_EMAIL_BRAND.siteUrl).replace(/\/$/, "");
  return `${base}${href.startsWith("/") ? "" : "/"}${href}`;
}
