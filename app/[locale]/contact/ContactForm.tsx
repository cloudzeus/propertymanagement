"use client";

import { useState } from "react";

type Labels = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  send: string;
  sending: string;
  success: string;
  error: string;
};

export function ContactForm({ labels }: { labels: Labels }) {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("request failed");
      setStatus("ok");
      form.reset();
    } catch {
      setStatus("error");
    }
  }

  const inputCls =
    "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-xl">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{labels.name}</label>
        <input name="name" required className={inputCls} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{labels.email}</label>
        <input name="email" type="email" required className={inputCls} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{labels.phone}</label>
        <input name="phone" className={inputCls} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{labels.subject}</label>
        <input name="subject" required className={inputCls} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{labels.message}</label>
        <textarea name="message" required rows={5} className={inputCls} />
      </div>
      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {status === "sending" ? labels.sending : labels.send}
      </button>
      {status === "ok" && <p className="text-sm text-green-600">{labels.success}</p>}
      {status === "error" && <p className="text-sm text-red-600">{labels.error}</p>}
    </form>
  );
}
