"use client";

import { RiLinkedinFill, RiTwitterXFill, RiFacebookFill, RiMailLine } from "react-icons/ri";

/**
 * Share row (handoff 06 part B §5) — real share URLs, not the prototype's
 * glyph placeholders. The URL is built client-side so it carries whatever
 * origin the page is actually served from.
 */
export function ShareRow({ label, title }: { label: string; title: string }) {
  function share(kind: "linkedin" | "x" | "facebook" | "email") {
    const url = window.location.href;
    const u = encodeURIComponent(url);
    const t = encodeURIComponent(title);
    const targets = {
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
      x: `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      email: `mailto:?subject=${t}&body=${u}`,
    };
    window.open(targets[kind], kind === "email" ? "_self" : "_blank", "noopener,noreferrer");
  }

  const buttons = [
    { kind: "linkedin" as const, Icon: RiLinkedinFill, label: "LinkedIn" },
    { kind: "x" as const, Icon: RiTwitterXFill, label: "X" },
    { kind: "facebook" as const, Icon: RiFacebookFill, label: "Facebook" },
    { kind: "email" as const, Icon: RiMailLine, label: "Email" },
  ];

  return (
    <div className="my-12 flex flex-wrap items-center gap-[11px] border-y border-[var(--line2)] py-7 text-[13.5px] text-[var(--mut)]">
      <span>{label}</span>
      {buttons.map(({ kind, Icon, label: name }) => (
        <button
          key={kind}
          type="button"
          onClick={() => share(kind)}
          aria-label={name}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-[var(--line)] bg-white transition-[transform,background,color,border-color] duration-[180ms] hover:-translate-y-0.5 hover:border-[var(--ink-chip)] hover:bg-[var(--ink-chip)] hover:text-white"
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}
