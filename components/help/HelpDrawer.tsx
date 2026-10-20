"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { RiCloseLine, RiBookOpenLine, RiRobot2Line, RiExternalLinkLine, RiQuestionLine } from "react-icons/ri";
import { Markdown } from "@/components/cms/Markdown";
import { ASSISTANT_EVENT } from "@/components/assistant/AssistantDrawer";

type Article = { slug: string; title: string; route: string; markdown: string; prompts: string[]; related: { slug: string; title: string }[]; anchor: string | null; hubHref: string; openInHub: string };
type Fallback = { title: string; hubHref: string; manualHref: string };
type State = { kind: "loading" } | { kind: "article"; article: Article } | { kind: "fallback"; fallback: Fallback } | { kind: "error" };

/** The wiki article for the current page, role-filtered, with links to the hub and the assistant. */
export function HelpDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const key = `${open}|${pathname}|${search?.toString() ?? ""}`;
  const [loaded, setLoaded] = useState<{ key: string; state: State } | null>(null);
  // Derived: anything not fetched for the current page/open state renders as loading (no setState inside the effect body).
  const state: State = loaded && loaded.key === key ? loaded.state : { kind: "loading" };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const setState = (st: State) => setLoaded({ key, state: st });
    fetch(`/api/help/article?path=${encodeURIComponent(pathname)}&s=${encodeURIComponent(search?.get("s") ?? "")}`)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (cancelled) return;
        if (r.ok && j?.markdown !== undefined) setState({ kind: "article", article: j as Article });
        else if (j?.fallback) setState({ kind: "fallback", fallback: j.fallback as Fallback });
        else setState({ kind: "error" });
      })
      .catch(() => { if (!cancelled) setState({ kind: "error" }); });
    return () => { cancelled = true; };
  }, [open, pathname, search, key]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // `?s=<tab>` → the article's matching section (anchor computed server-side from the article's `sections`).
  const anchor = state.kind === "article" ? state.article.anchor : null;
  useEffect(() => {
    if (!open || !anchor) return;
    const el = document.getElementById(anchor);
    if (el) el.scrollIntoView({ block: "start" });
  }, [open, anchor, key]);

  if (!open) return null;
  const title = state.kind === "article" ? state.article.title : "Βοήθεια";
  const askAssistant = (prompt: string) => { onClose(); window.dispatchEvent(new CustomEvent(ASSISTANT_EVENT, { detail: { prompt } })); };

  return (
    <>
      <div className="ast-backdrop" onClick={onClose} />
      <aside className="ast-drawer" role="dialog" aria-label="Βοήθεια για αυτή τη σελίδα">
        <div className="ast-head">
          <h2><RiBookOpenLine style={{ color: "var(--color-accent)" }} /> {title}</h2>
          <button type="button" className="ast-iconbtn" onClick={onClose} title="Κλείσιμο" aria-label="Κλείσιμο"><RiCloseLine /></button>
        </div>
        <div className="ast-body">
          {state.kind === "loading" && <div className="ast-empty">Φόρτωση οδηγού…</div>}
          {state.kind === "error" && <div className="ast-empty">Ο οδηγός δεν είναι διαθέσιμος αυτή τη στιγμή.</div>}
          {state.kind === "fallback" && (
            <div className="ast-empty" style={{ textAlign: "left" }}>
              <p style={{ margin: "0 0 10px" }}>Δεν υπάρχει ακόμη οδηγός για αυτή τη σελίδα.</p>
              <Link href={state.fallback.manualHref} className="ast-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><RiBookOpenLine /> {state.fallback.title}</Link>
            </div>
          )}
          {state.kind === "article" && (
            <>
              <div className="ast-msg ast-msg--assistant" style={{ maxWidth: "100%", alignSelf: "stretch" }}>
                <Markdown>{state.article.markdown}</Markdown>
              </div>
              {state.article.related.length > 0 && (
                <div>
                  <div className="ast-note" style={{ marginBottom: 6 }}>Σχετικοί οδηγοί</div>
                  <div className="ast-chips">
                    {state.article.related.map((r) => <Link key={r.slug} href={`${state.article.hubHref}?a=${encodeURIComponent(r.slug)}`} className="ast-chip">{r.title}</Link>)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="ast-foot">
          <div className="ast-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {state.kind === "article" && <Link href={state.article.openInHub} className="ast-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><RiExternalLinkLine /> Άνοιγμα στο Wiki</Link>}
            {state.kind === "fallback" && <Link href={state.fallback.hubHref} className="ast-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><RiQuestionLine /> Κέντρο βοήθειας</Link>}
            <button type="button" className="ast-btn ast-btn--primary" onClick={() => askAssistant(state.kind === "article" ? `Πώς χρησιμοποιώ τη σελίδα «${state.article.title}»;` : "Πώς χρησιμοποιώ αυτή τη σελίδα;")}><RiRobot2Line /> Ρώτα τον βοηθό</button>
          </div>
        </div>
      </aside>
    </>
  );
}
