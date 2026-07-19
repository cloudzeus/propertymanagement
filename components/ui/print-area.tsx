"use client";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const emptySubscribe = () => () => {};

/** Renders `children` into a body-level container that is hidden on screen and
 *  the ONLY thing shown when printing (see the `.print-area` rules in globals.css).
 *  Body-level + normal flow → no modal clipping, reliable A4 output. */
export function PrintArea({ children }: { children: React.ReactNode }) {
  // SSR-safe: false on the server/first paint, true once hydrated on the client.
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  if (!mounted) return null;
  return createPortal(<div className="print-area">{children}</div>, document.body);
}
