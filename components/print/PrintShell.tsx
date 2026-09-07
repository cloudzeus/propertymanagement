import type { ReactNode } from "react";
import type { PrintBrand } from "@/lib/print/brand";
import type { PrintBuilding } from "@/lib/print/data";
import { dateLabel } from "@/lib/print/format";

export type MetaCell = { k: string; v: ReactNode; s?: ReactNode };

type Props = {
  brand: PrintBrand;
  building?: Pick<PrintBuilding, "name" | "address" | "city" | "postalCode"> | null;
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  meta?: MetaCell[];
  /** Document number printed in the meta strip and footer (e.g. ΕΚ-2026-06-Δ2). */
  docNo?: string;
  issuedAt?: Date;
  children: ReactNode;
  footNote?: ReactNode;
};

/** One A4 sheet: issuer header (logo + company), document title, meta strip, body, footer. */
export function PrintSheet({ brand, building, eyebrow, title, subtitle, meta = [], docNo, issuedAt = new Date(), children, footNote }: Props) {
  const cells: MetaCell[] = [
    ...(building ? [{ k: "Πολυκατοικία", v: building.name, s: [building.address, [building.postalCode, building.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") }] : []),
    ...meta,
    { k: "Ημερομηνία έκδοσης", v: dateLabel(issuedAt), s: docNo ? `Αρ. ${docNo}` : undefined },
  ];
  return (
    <section className="pdoc">
      <header className="pdoc-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={brand.logoUrl} alt={brand.name} className="pdoc-logo" />
        <div className="pdoc-issuer">
          <b>{brand.name}</b>
          {brand.address && <div>{brand.address}</div>}
          <div>{[brand.phone, brand.email].filter(Boolean).join(" · ")}</div>
          {(brand.afm || brand.taxOffice) && <div>{[brand.afm ? `ΑΦΜ ${brand.afm}` : null, brand.taxOffice ? `ΔΟΥ ${brand.taxOffice}` : null].filter(Boolean).join(" · ")}</div>}
        </div>
      </header>
      <div className="pdoc-title">
        <div className="pdoc-eyebrow">{eyebrow}</div>
        <h1 className="pdoc-h1">{title}</h1>
        {subtitle && <div className="pdoc-sub">{subtitle}</div>}
      </div>
      <div className="pdoc-meta" style={{ gridTemplateColumns: `repeat(${Math.min(cells.length, 4)}, minmax(0, 1fr))` }}>
        {cells.map((c, i) => (
          <div key={i}>
            <div className="k">{c.k}</div>
            <div className="v">{c.v}</div>
            {c.s && <div className="s">{c.s}</div>}
          </div>
        ))}
      </div>
      <div className="pdoc-body">{children}</div>
      <footer className="pdoc-foot">
        <span>{footNote ?? `Εκδόθηκε από ${brand.name} μέσω της πλατφόρμας Orithon Property Management`}</span>
        <span>{docNo ? `${docNo} · ` : ""}{dateLabel(issuedAt)}</span>
      </footer>
    </section>
  );
}

/** Signature block: manager (left) + optional counter-party (right). */
export function Signatures({ managerName, right }: { managerName: string | null; right?: { line: string; name?: string | null } }) {
  return (
    <div className="psign">
      <div>
        <div className="line">Ο/Η Διαχειριστής/τρια</div>
        {managerName && <div className="name">{managerName}</div>}
      </div>
      {right && (
        <div>
          <div className="line">{right.line}</div>
          {right.name && <div className="name">{right.name}</div>}
        </div>
      )}
    </div>
  );
}
