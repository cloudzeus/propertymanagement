"use client";

import { useCallback, useEffect, useState } from "react";
import { RiQuestionLine, RiCloseLine } from "react-icons/ri";
import { HelpDrawer } from "./HelpDrawer";
import { DRAWER_OPEN_EVENT, HELP_EVENT } from "@/components/assistant/AssistantDrawer";

/** Floating «Βοήθεια» button (left of the assistant FAB) opening the page's wiki article. */
export function HelpButton() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onOther = (e: Event) => { if ((e as CustomEvent<{ which?: string }>).detail?.which !== "help") setOpen(false); };
    const onOpen = () => { setOpen(true); window.dispatchEvent(new CustomEvent(DRAWER_OPEN_EVENT, { detail: { which: "help" } })); };
    window.addEventListener(DRAWER_OPEN_EVENT, onOther);
    window.addEventListener(HELP_EVENT, onOpen);
    return () => { window.removeEventListener(DRAWER_OPEN_EVENT, onOther); window.removeEventListener(HELP_EVENT, onOpen); };
  }, []);

  const toggle = () => {
    if (!open) window.dispatchEvent(new CustomEvent(DRAWER_OPEN_EVENT, { detail: { which: "help" } }));
    setOpen((v) => !v);
  };

  return (
    <>
      <button type="button" className="ast-fab ast-fab--help" onClick={toggle} aria-expanded={open} title="Βοήθεια για αυτή τη σελίδα" aria-label="Βοήθεια για αυτή τη σελίδα">
        {open ? <RiCloseLine /> : <RiQuestionLine />}
      </button>
      <HelpDrawer open={open} onClose={close} />
    </>
  );
}
