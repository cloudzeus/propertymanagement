"use client";

import { useState } from "react";
import type { RolesData } from "@/lib/cms/landing-types";
import { Reveal } from "@/components/landing/Reveal";

export function RolesSection({ data }: { data: RolesData }) {
  const roles = data.roles ?? [];
  const [active, setActive] = useState(0);
  if (roles.length === 0) return null;
  const role = roles[Math.min(active, roles.length - 1)];

  return (
    <section id="roles">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-7 py-[84px]">
        <Reveal className="mb-12 max-w-[620px]">
          {data.kicker && (
            <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              {data.kicker}
            </span>
          )}
          <h2 className="mt-3.5 text-[32px] font-extrabold leading-[1.05] tracking-[-0.02em] text-[var(--foreground)] md:text-[46px]">
            {data.heading}
          </h2>
          {data.subtitle && (
            <p className="mt-4 text-[17px] leading-relaxed text-[var(--muted-foreground)]">{data.subtitle}</p>
          )}
        </Reveal>

        <Reveal className="grid items-start gap-6 md:grid-cols-[320px_1fr]">
          {/* Tab list */}
          <div className="flex flex-row flex-wrap gap-2.5 md:flex-col">
            {roles.map((r, i) => {
              const on = i === active;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActive(i)}
                  className="flex cursor-pointer items-center gap-3.5 rounded-[14px] px-[18px] py-[15px] text-left transition-all duration-200"
                  style={
                    on
                      ? { background: "#fff", border: "1px solid rgba(27,28,26,.14)", boxShadow: "0 10px 24px -18px rgba(27,28,26,.35)" }
                      : { background: "transparent", border: "1px solid transparent" }
                  }
                >
                  <span
                    className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-extrabold"
                    style={
                      on
                        ? { background: "var(--primary)", color: "#fff" }
                        : { background: "rgba(27,28,26,.06)", color: "var(--muted-foreground)" }
                    }
                  >
                    {r.initial}
                  </span>
                  <span>
                    <span className="block text-[15px] font-bold text-[var(--foreground)]">{r.name}</span>
                    <span className="text-[12.5px] text-[var(--muted-foreground)]">{r.tag}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Panel */}
          <div
            className="min-h-[260px] rounded-[20px] border bg-[var(--card)] p-[34px] shadow-[var(--shadow-card)]"
            style={{ borderColor: "rgba(27,28,26,.12)" }}
          >
            <div className="flex items-center gap-3.5">
              <span className="flex h-[46px] w-[46px] items-center justify-center rounded-xl bg-[var(--primary)] text-lg font-extrabold text-white">
                {role.initial}
              </span>
              <div>
                <div className="text-2xl font-extrabold tracking-[-0.01em] text-[var(--foreground)]">{role.name}</div>
                <div className="text-[13.5px] text-[var(--muted-foreground)]">{role.tag}</div>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(role.points ?? []).map((p, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 rounded-xl border bg-[var(--paper)] px-4 py-[15px] text-[14.5px] leading-normal text-[var(--foreground)]"
                  style={{ borderColor: "rgba(27,28,26,.07)" }}
                >
                  <b className="text-[13px] text-[var(--accent)]">›</b>
                  {p}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
