"use client";

import { useState } from "react";
import { DarkPanel, btnClass } from "@/components/site/kit";

/**
 * Dark newsletter panel (handoff 06 §6). The prototype had no validation,
 * pending state or success message — all three are here.
 *
 * There is no subscriber backend yet, so a submission is recorded as a contact
 * message. Swap the endpoint when a mailing list exists.
 */
export function NewsletterStrip({
  heading,
  body,
  placeholder,
  submitLabel,
  successMessage,
  errorMessage,
}: {
  heading: string;
  body: string;
  placeholder: string;
  submitLabel: string;
  successMessage: string;
  errorMessage: string;
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = String(new FormData(form).get("email") ?? "").trim();
    if (!email) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: email,
          email,
          subject: "Newsletter subscription",
          message: `Newsletter subscription request from ${email}.`,
        }),
      });
      if (!res.ok) throw new Error("request failed");
      form.reset();
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  return (
    <DarkPanel className="mt-[60px] flex flex-wrap items-center justify-between gap-[34px] px-8 py-11 sm:px-[46px]">
      <div>
        <h3 className="text-[length:var(--fs-24)] font-extrabold tracking-[-.015em] text-white">{heading}</h3>
        <p className="mt-3 max-w-[420px] text-[length:var(--fs-14-5)] leading-[1.6] text-[rgba(255,255,255,.6)]">{body}</p>
      </div>
      {status === "ok" ? (
        <p className="text-[length:var(--fs-14-5)] font-semibold text-[var(--accent)]">{successMessage}</p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-wrap items-start gap-[9px]">
          <div>
            <input
              name="email"
              type="email"
              required
              placeholder={placeholder}
              aria-label={placeholder}
              className="min-w-[250px] rounded-[11px] border border-[rgba(255,255,255,.18)] bg-[rgba(255,255,255,.09)] px-4 py-[13px] text-[length:var(--fs-14-5)] text-white outline-none transition-colors placeholder:text-[rgba(255,255,255,.42)] focus:border-[var(--accent)]"
            />
            {/* Amber rather than red — there is no red anywhere in this palette. */}
            {status === "error" && (
              <p role="alert" className="mt-2 max-w-[250px] text-[length:var(--fs-12-5)] text-[var(--accent)]">
                {errorMessage}
              </p>
            )}
          </div>
          <button type="submit" disabled={status === "sending"} className={btnClass("amber", "md", "disabled:opacity-60")}>
            {submitLabel}
          </button>
        </form>
      )}
    </DarkPanel>
  );
}
