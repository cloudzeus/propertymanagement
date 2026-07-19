"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Renders `children` into a body-level container that is hidden on screen and
 *  the ONLY thing shown when printing (see the `.print-area` rules in globals.css).
 *  Body-level + normal flow → no modal clipping, reliable A4 output. */
export function PrintArea({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(<div className="print-area">{children}</div>, document.body);
}
