"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { DarkPanel, btnClass } from "@/components/site/kit";

/**
 * Dark newsletter panel (handoff 06 §6) with a GDPR-grade signup: explicit
 * consent checkbox (wording stored verbatim server-side), honeypot, and
 * double opt-in — the address only becomes active after the emailed link.
 */
export function NewsletterStrip({
  heading,
  body,
  placeholder,
  submitLabel,
  successMessage,
  errorMessage,
  consentLabel,
  consentLinkLabel,
  pendingMessage,
}: {
  heading: string;
  body: string;
  placeholder: string;
  submitLabel: string;
  successMessage: string;
  errorMessage: string;
  consentLabel?: string;
  consentLinkLabel?: string;
  pendingMessage?: string;
}) {
  const locale = useLocale() === "en" ? "en" : "el";
  const [status, setStatus] = useState<"idle" | "sending" | "pending" | "ok" | "error">("idle");
  const [consent, setConsent] = useState(false);
  const consentText = consentLabel ?? (locale === "en"
    ? "I agree to receive the Orithon newsletter by email and to my address being stored for that purpose, as described in the"
    : "Συμφωνώ να λαμβάνω το ενημερωτικό του Orithon με email και να αποθηκευτεί η διεύθυνσή μου για αυτόν τον σκοπό, όπως περιγράφεται στην");
  const linkLabel = consentLinkLabel ?? (locale === "en" ? "privacy policy" : "πολιτική απορρήτου");
  const pendingText = pendingMessage ?? (locale === "en" ? "Almost there — check your inbox and press the confirmation link." : "Σχεδόν έτοιμο — ελέγξτε το inbox σας και πατήστε τον σύνδεσμο επιβεβαίωσης.");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const email = String(fd.get("email") ?? "").trim();
    if (!email || !consent) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale, source: "news", consent: true, consentText: `${consentText} ${linkLabel}`, website: fd.get("website") || "" }),
      });
      if (!res.ok) throw new Error("request failed");
      const json = (await res.json()) as { status?: string };
      form.reset();
      setConsent(false);
      setStatus(json.status === "CONFIRMED" ? "ok" : "pending");
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
      {status === "ok" || status === "pending" ? (
        <p className="max-w-[360px] text-[length:var(--fs-14-5)] font-semibold text-[var(--accent)]">{status === "ok" ? successMessage : pendingText}</p>
      ) : (
        <form onSubmit={onSubmit} className="flex max-w-[420px] flex-col gap-[10px]">
          <div className="flex flex-wrap items-start gap-[9px]">
            <input
              name="email"
              type="email"
              required
              placeholder={placeholder}
              aria-label={placeholder}
              className="min-w-[250px] flex-1 rounded-[11px] border border-[rgba(255,255,255,.18)] bg-[rgba(255,255,255,.09)] px-4 py-[13px] text-[length:var(--fs-14-5)] text-white outline-none transition-colors placeholder:text-[rgba(255,255,255,.42)] focus:border-[var(--accent)]"
            />
            {/* honeypot — real users never see or fill it */}
            <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
            <button type="submit" disabled={status === "sending" || !consent} className={btnClass("amber", "md", "disabled:opacity-60")}>
              {submitLabel}
            </button>
          </div>
          <label className="flex cursor-pointer items-start gap-[9px] text-[length:var(--fs-12-5)] leading-[1.5] text-[rgba(255,255,255,.62)]">
            <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-[2px] h-4 w-4 flex-none" style={{ accentColor: "var(--accent)" }} />
            <span>
              {consentText}{" "}
              <a href={`/${locale}/privacy`} className="underline decoration-[rgba(255,255,255,.4)] underline-offset-2 hover:text-white">{linkLabel}</a>.
            </span>
          </label>
          {/* Amber rather than red — there is no red anywhere in this palette. */}
          {status === "error" && (
            <p role="alert" className="text-[length:var(--fs-12-5)] text-[var(--accent)]">{errorMessage}</p>
          )}
        </form>
      )}
    </DarkPanel>
  );
}
