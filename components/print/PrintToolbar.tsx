"use client";
import { RiPrinterLine, RiArrowLeftLine } from "react-icons/ri";

/** Fixed toolbar above the sheets — hidden in print. */
export function PrintToolbar({ title, backHref }: { title: string; backHref: string }) {
  return (
    <div className="print-toolbar">
      <a href={backHref}><RiArrowLeftLine /> Εκτυπωτικά</a>
      <div className="grow">{title}</div>
      <button type="button" className="primary" onClick={() => window.print()}><RiPrinterLine /> Εκτύπωση / PDF</button>
    </div>
  );
}
