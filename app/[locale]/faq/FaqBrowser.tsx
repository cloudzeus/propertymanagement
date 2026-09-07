"use client";

import { useEffect, useId, useState } from "react";

export interface FaqCategory {
  slug: string;
  label: string;
  items: { id: string; question: string; answer: string }[];
}

/**
 * Category sidebar + single-open accordion (handoff 07 §3–§4).
 * All-collapsed is a valid state; switching category reopens the first question.
 */
export function FaqBrowser({ categories }: { categories: FaqCategory[] }) {
  const [activeSlug, setActiveSlug] = useState(categories[0]?.slug ?? "");
  const [openId, setOpenId] = useState(categories[0]?.items[0]?.id ?? "");
  const baseId = useId();

  const active = categories.find((c) => c.slug === activeSlug) ?? categories[0];

  // A category change must not leave a question from the previous list open.
  useEffect(() => {
    setOpenId(active?.items[0]?.id ?? "");
  }, [activeSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!active) return null;

  return (
    <div className="mt-[52px] grid items-start gap-10 lg:grid-cols-[250px_1fr]">
      {/* Sidebar — unsticks and wraps into a row below the breakpoint */}
      <nav className="flex flex-wrap gap-1.5 lg:sticky lg:top-24 lg:flex-col lg:gap-[5px]">
        {categories.map((c) => {
          const on = c.slug === active.slug;
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => setActiveSlug(c.slug)}
              aria-current={on ? "true" : undefined}
              className={`flex min-h-[44px] items-center justify-between gap-2.5 rounded-[11px] px-4 py-[13px] text-left text-[14.5px] transition-colors ${
                on ? "bg-[var(--ink-chip)] font-bold text-white" : "font-semibold text-[var(--mut)] hover:text-[var(--txt)]"
              }`}
            >
              <span>{c.label}</span>
              <span className="tnum text-[11.5px] opacity-55">{c.items.length}</span>
            </button>
          );
        })}
      </nav>

      <div>
        {active.items.map((item) => {
          const open = item.id === openId;
          const panelId = `${baseId}-${item.id}`;
          return (
            <div
              key={item.id}
              className="mb-2.5 overflow-hidden rounded-[16px] border bg-white transition-shadow"
              style={{
                borderColor: open ? "rgba(27,28,26,.18)" : "var(--line)",
                boxShadow: open ? "var(--shadow-open)" : "var(--shadow-card)",
              }}
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? "" : item.id)}
                aria-expanded={open}
                aria-controls={panelId}
                className="flex w-full items-start justify-between gap-5 px-7 py-6 text-left text-[16.5px] font-bold leading-[1.4] tracking-[-.008em]"
              >
                <span>{item.question}</span>
                <span
                  aria-hidden
                  className="mt-px flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full transition-[transform,background] duration-[250ms] ease-[cubic-bezier(.2,.7,.3,1)]"
                  style={{
                    background: open ? "var(--accent)" : "rgba(27,28,26,.06)",
                    /* the plus becomes an × */
                    transform: open ? "rotate(135deg)" : "none",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={open ? "#fff" : "rgba(27,28,26,.55)"} strokeWidth="2.4" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </button>
              {/* grid-rows transition — height animates without a max-height guess */}
              <div
                id={panelId}
                role="region"
                className="grid transition-[grid-template-rows] duration-[250ms] ease-[cubic-bezier(.2,.7,.3,1)]"
                style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <p className="max-w-[720px] whitespace-pre-line px-7 pb-[26px] text-[15.5px] leading-[1.68] text-[var(--mut)]">
                    {item.answer}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
