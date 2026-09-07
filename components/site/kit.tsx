import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/* ─────────────────────────────────────────────────────────────────────────────
   Orithon marketing UI kit — the shared primitives of handoff 02 §3–§5.
   Server-safe: nothing here holds state. Interactive surfaces live next to the
   page that owns them.
   ──────────────────────────────────────────────────────────────────────────── */

/** 1200px content wrapper, 28px gutters (20px on mobile). */
export function Wrap({
  children,
  className = "",
  narrow,
  style,
}: {
  children: ReactNode;
  className?: string;
  /** 760px prose container, or 1000px for an article hero. */
  narrow?: 760 | 1000;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`mx-auto w-full px-5 sm:px-7 ${className}`}
      style={{ maxWidth: narrow ?? 1200, ...style }}
    >
      {children}
    </div>
  );
}

/* ── Background layers ─────────────────────────────────────────────────────── */

/** The amber→sky bloom behind a hero or page header. Parent needs relative+overflow-hidden. */
export function GlowBlob({
  variant = "header",
  style,
}: {
  variant?: "hero" | "calc" | "header";
  style?: CSSProperties;
}) {
  const preset: Record<string, CSSProperties> = {
    hero: { top: -260, left: "50%", transform: "translateX(-50%)", width: 1100, height: 780 },
    calc: { top: -180, right: -120, width: 760, height: 620 },
    header: { top: -260, left: "50%", transform: "translateX(-50%)", width: 1000, height: 640 },
  };
  return (
    <div
      aria-hidden
      className={variant === "hero" ? "glow-blob" : "glow-blob-soft"}
      style={{ ...preset[variant], ...style }}
    />
  );
}

export function Grain() {
  return <div aria-hidden className="grain" />;
}

export function GridOverlay() {
  return <div aria-hidden className="grid-overlay" />;
}

/* ── Buttons ───────────────────────────────────────────────────────────────── */

type BtnVariant = "primary" | "ghost" | "amber";
type BtnSize = "sm" | "md";

const BTN_BASE =
  "inline-flex items-center justify-center gap-[9px] font-semibold whitespace-nowrap border-0 cursor-pointer " +
  "transition-[transform,box-shadow,filter] duration-[180ms] ease-[cubic-bezier(.2,.7,.3,1)]";

const BTN_SIZE: Record<BtnSize, string> = {
  md: "text-[length:var(--fs-15)] rounded-[12px] px-[22px] py-[14px]",
  sm: "text-[length:var(--fs-14)] rounded-[10px] px-[17px] py-[10px]",
};

const BTN_VARIANT: Record<BtnVariant, string> = {
  primary:
    "bg-[var(--ink-chip)] text-white font-bold shadow-[var(--shadow-btn)] " +
    "hover:-translate-y-0.5 hover:brightness-[1.18]",
  ghost:
    "bg-white text-[var(--txt)] border border-[var(--line)] shadow-[var(--shadow-ghost)] " +
    "hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]",
  amber:
    "bg-[var(--accent)] text-[#1b1c1a] font-bold hover:brightness-[1.08]",
};

export function btnClass(variant: BtnVariant = "primary", size: BtnSize = "md", extra = "") {
  return `${BTN_BASE} ${BTN_SIZE[size]} ${BTN_VARIANT[variant]} ${extra}`.trim();
}

/** Anchor-flavoured button. Use `btnClass()` directly on a real <button> for form actions. */
export function BtnLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: {
  href: string;
  variant?: BtnVariant;
  size?: BtnSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={btnClass(variant, size, className)}>
      {children}
    </Link>
  );
}

/* ── Small components (02 §5) ──────────────────────────────────────────────── */

/** Pill with a glowing amber dot. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-[9px] rounded-full border border-[var(--line)] bg-white py-[7px] pl-[10px] pr-[15px] text-[length:var(--fs-13)] font-semibold shadow-[var(--shadow-ghost)]">
      <span
        aria-hidden
        className="h-[7px] w-[7px] shrink-0 rounded-full bg-[var(--accent)]"
        style={{ boxShadow: "0 0 10px rgba(242,162,60,.55)" }}
      />
      {children}
    </span>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <div className="u-caps text-[length:var(--fs-13)] font-bold tracking-[.14em] text-[var(--mut2)]">{children}</div>
  );
}

/** News category tag — amber on light. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="u-caps inline-flex rounded-full bg-[var(--accent)] px-[11px] py-[5px] text-[length:var(--fs-11)] font-extrabold tracking-[.1em] text-[#1b1c1a]">
      {children}
    </span>
  );
}

/** Quiet tag for post cards. */
export function TagQuiet({ children }: { children: ReactNode }) {
  return (
    <span className="u-caps inline-flex rounded-full border border-[var(--line2)] bg-[var(--paper)] px-[9px] py-[4px] text-[length:var(--fs-10-5)] font-extrabold tracking-[.1em] text-[var(--mut)]">
      {children}
    </span>
  );
}

/** Amber check square for feature lists. `size="lg"` is the plain showcase square. */
export function Tick({ size = "sm" }: { size?: "sm" | "lg" }) {
  if (size === "lg") {
    return (
      <span
        aria-hidden
        className="mt-[2px] block h-[22px] w-[22px] shrink-0 rounded-[7px] bg-[var(--accent)]"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] bg-[var(--accent)]"
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}

/** Dark circular icon badge. */
export function IconBadge({
  children,
  size = 42,
  square,
}: {
  children: ReactNode;
  size?: number;
  square?: boolean;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center bg-[var(--ink-chip)] text-white"
      style={{ width: size, height: size, borderRadius: square ? 12 : "50%" }}
    >
      {children}
    </span>
  );
}

/** kicker → H2 → lead, max 620px. */
export function SectionHead({
  kicker,
  heading,
  body,
  className = "",
  wide,
}: {
  kicker?: string;
  heading: string;
  body?: string;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div className={`mb-12 ${className}`} style={{ maxWidth: wide ? 660 : 620 }}>
      {kicker ? <Kicker>{kicker}</Kicker> : null}
      <h2 className="mt-[14px] text-[length:var(--fs-32)] font-extrabold leading-[1.05] tracking-[-.02em] sm:text-[length:var(--fs-40)]">
        {heading}
      </h2>
      {body ? <p className="mt-4 text-[length:var(--fs-17)] leading-[1.6] text-[var(--mut)]">{body}</p> : null}
    </div>
  );
}

/** author · date · read time, dot-separated. */
export function MetaRow({ items }: { items: (string | null | undefined)[] }) {
  const parts = items.filter(Boolean) as string[];
  return (
    <div className="flex flex-wrap items-center gap-[10px] text-[length:var(--fs-12-5)] text-[var(--mut2)]">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-[10px]">
          {i > 0 && <span aria-hidden className="h-[3px] w-[3px] rounded-full bg-[var(--mut2)]" />}
          <span>{p}</span>
        </span>
      ))}
    </div>
  );
}

export function Avatar({ size = 46, src, alt = "" }: { size?: number; src?: string | null; alt?: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="shrink-0 rounded-full"
      style={{ width: size, height: size, background: "linear-gradient(135deg,#c9c4b6,#9aa39a)" }}
    />
  );
}

/**
 * Deliberately obvious stand-in — a warm neutral surface naming what belongs
 * there. Never ship a fake photo (handoff README §10). Renders the real image
 * once `src` is supplied.
 */
export function ImagePlaceholder({
  label,
  src,
  className = "",
  style,
}: {
  label: string;
  src?: string | null;
  className?: string;
  style?: CSSProperties;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={label} className={`h-full w-full object-cover ${className}`} style={style} />;
  }
  return (
    <div
      className={`flex h-full w-full items-center justify-center ${className}`}
      style={{ background: "linear-gradient(135deg,#EDEAE0,#E3E0D4)", ...style }}
    >
      <span className="px-4 text-center text-[length:var(--fs-12-5)] font-semibold text-[rgba(27,28,26,.38)]">
        {label}
      </span>
    </div>
  );
}

/* ── Surfaces ──────────────────────────────────────────────────────────────── */

export function Card({
  children,
  className = "",
  radius = 22,
  onAlt,
  style,
}: {
  children: ReactNode;
  className?: string;
  radius?: number;
  /** Drops the tiny top shadow — the alt band needs a deeper single shadow. */
  onAlt?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`border border-[var(--line)] bg-white ${className}`}
      style={{
        borderRadius: radius,
        boxShadow: onAlt ? "var(--shadow-card-alt)" : "var(--shadow-card)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Deliberate ink panel — the only dark surface in the palette. */
export function DarkPanel({
  children,
  className = "",
  radius = 22,
  style,
}: {
  children: ReactNode;
  className?: string;
  radius?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`bg-[var(--ink-chip)] text-white ${className}`}
      style={{ borderRadius: radius, ...style }}
    >
      {children}
    </div>
  );
}

/* ── Inner-page header (05 §1) ─────────────────────────────────────────────── */

export function PageHeader({
  eyebrow,
  title,
  lead,
  titleMaxWidth = 820,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  titleMaxWidth?: number;
  /** Billing toggle, category chips — anything that sits under the lead. */
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden pb-3 pt-[74px]">
      <GlowBlob variant="header" />
      <Grain />
      <Wrap className="relative">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1
          className="mt-[22px] text-[length:var(--fs-36)] font-extrabold leading-[1.02] tracking-[-.03em] sm:text-[length:var(--fs-46)] lg:text-[length:var(--fs-62)]"
          style={{ maxWidth: titleMaxWidth }}
        >
          {title}
        </h1>
        {lead ? (
          <p className="mt-[18px] max-w-[640px] text-[length:var(--fs-19)] leading-[1.62] text-[var(--mut)]">{lead}</p>
        ) : null}
        {children}
      </Wrap>
    </section>
  );
}
