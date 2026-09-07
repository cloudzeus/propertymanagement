import type { Metadata } from "next";
import "./print.css";

export const metadata: Metadata = { title: "Εκτυπωτικά" };

/** Standalone print surface (no app shell). The `.print-page` root is exempt from
 *  the global `.print-area` print rule in app/globals.css. */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="print-page">{children}</div>;
}
