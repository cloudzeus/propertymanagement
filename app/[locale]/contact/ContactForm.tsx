"use client";

import { useState } from "react";
import Link from "next/link";
import type { ContactPageContent } from "@/lib/cms/marketing-pages";
import { btnClass } from "@/components/site/kit";

type FormContent = ContactPageContent["form"];

const FIELD =
  "w-full rounded-[11px] border border-[var(--line)] bg-[var(--paper)] px-[15px] py-[13px] text-[length:var(--fs-14-5)] outline-none " +
  "transition-[border-color,box-shadow,background] duration-[180ms] " +
  "focus:border-[var(--accent)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(242,162,60,.16)]";

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="mb-2 block text-[length:var(--fs-13)] font-bold">
      {children}
      {required ? <span className="text-[var(--accent)]"> *</span> : null}
    </span>
  );
}

export function ContactForm({ content }: { content: FormContent }) {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const l = content.labels;
  const p = content.placeholders;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const company = String(fd.get("company") ?? "").trim();
    const buildings = String(fd.get("buildings") ?? "").trim();
    // ContactMessage has no company/buildings columns — fold them into the body
    // rather than losing what the sender told us.
    const context = [company && `${l.company}: ${company}`, buildings && `${l.buildings}: ${buildings}`]
      .filter(Boolean)
      .join("\n");

    const payload = {
      name: fd.get("name"),
      email: fd.get("email"),
      phone: fd.get("phone") || null,
      subject: fd.get("topic"),
      message: context ? `${context}\n\n${fd.get("message")}` : fd.get("message"),
      // GDPR trail: the exact wording the person ticked.
      consent: true,
      consentText: `${content.consent} ${content.consentLinkLabel}`,
    };

    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("request failed");
      form.reset();
      setStatus("ok");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setStatus("error");
    }
  }

  if (status === "ok") {
    return (
      <div className="rounded-[22px] border border-[var(--line)] bg-white px-11 py-14 text-center shadow-[var(--shadow-card)]">
        <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h2 className="text-[length:var(--fs-30)] font-extrabold tracking-[-.02em]">{content.success.heading}</h2>
        <p className="mx-auto mb-7 mt-4 max-w-[400px] text-[length:var(--fs-16)] leading-[1.6] text-[var(--mut)]">
          {content.success.body}
        </p>
        <button type="button" onClick={() => setStatus("idle")} className={btnClass("ghost")}>
          {content.success.againLabel}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-[22px] border border-[var(--line)] bg-white px-6 py-7 shadow-[var(--shadow-card)] sm:px-[38px] sm:py-9"
    >
      <h2 className="text-[length:var(--fs-21)] font-extrabold tracking-[-.015em]">{content.heading}</h2>
      <p className="mb-7 mt-2.5 text-[length:var(--fs-14)] leading-[1.6] text-[var(--mut)]">{content.body}</p>

      <div className="mb-[18px] grid gap-4 min-[560px]:grid-cols-2">
        <label>
          <Label required>{l.name}</Label>
          <input name="name" required autoComplete="name" placeholder={p.name} className={FIELD} />
        </label>
        <label>
          <Label>{l.company}</Label>
          <input name="company" autoComplete="organization" placeholder={p.company} className={FIELD} />
        </label>
      </div>

      <div className="mb-[18px] grid gap-4 min-[560px]:grid-cols-2">
        <label>
          <Label required>{l.email}</Label>
          <input name="email" type="email" required autoComplete="email" placeholder={p.email} className={FIELD} />
        </label>
        <label>
          <Label>{l.phone}</Label>
          <input name="phone" type="tel" autoComplete="tel" placeholder={p.phone} className={FIELD} />
        </label>
      </div>

      <div className="mb-[18px] grid gap-4 min-[560px]:grid-cols-2">
        <label>
          <Label>{l.buildings}</Label>
          <select name="buildings" className={FIELD} defaultValue="">
            <option value="">—</option>
            {content.buildingOptions.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </label>
        <label>
          <Label required>{l.topic}</Label>
          <select name="topic" required className={FIELD} defaultValue={content.topicOptions[0] ?? ""}>
            {content.topicOptions.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="mb-[18px] block">
        <Label required>{l.message}</Label>
        <textarea
          name="message"
          required
          placeholder={p.message}
          className={`${FIELD} min-h-[130px] resize-y leading-[1.6]`}
        />
      </label>

      <label className="mb-[22px] mt-1.5 flex cursor-pointer items-start gap-[11px] text-[length:var(--fs-13)] leading-[1.55] text-[var(--mut)]">
        <input
          type="checkbox"
          required
          className="mt-0.5 h-[17px] w-[17px] flex-none"
          style={{ accentColor: "var(--accent)" }}
        />
        <span>
          {content.consent}{" "}
          <Link href={content.consentLinkHref} className="prose-link">
            {content.consentLinkLabel}
          </Link>
          .
        </span>
      </label>

      <button type="submit" disabled={status === "sending"} className={btnClass("primary", "md", "w-full disabled:opacity-60")}>
        {status === "sending" ? content.submittingLabel : content.submitLabel}
      </button>

      {status === "error" && (
        <p role="alert" className="mt-3 text-center text-[length:var(--fs-13)] font-semibold text-[var(--color-danger)]">
          {content.errorMessage}
        </p>
      )}

      <p className="mt-3.5 text-center text-[length:var(--fs-12)] text-[var(--mut2)]">{content.footnote}</p>
    </form>
  );
}
