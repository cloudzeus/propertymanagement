"use client";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { RiFileList3Line, RiTableLine, RiReceiptLine, RiMoneyEuroCircleLine, RiCheckboxCircleLine, RiDraftLine, RiCalendarEventLine, RiFileTextLine, RiMegaphoneLine, RiFileLine, RiExternalLinkLine } from "react-icons/ri";

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = { RiFileList3Line, RiTableLine, RiReceiptLine, RiMoneyEuroCircleLine, RiCheckboxCircleLine, RiDraftLine, RiCalendarEventLine, RiFileTextLine, RiMegaphoneLine };

const inputStyle = "hub-input";

export function HubSelectors({ buildings, buildingId, months, month }: { buildings: { id: string; name: string; address: string; city: string }[]; buildingId: string; months: { value: string; label: string }[]; month: string }) {
  const router = useRouter();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 10, marginTop: 18 }}>
      <label className="hub-field"><span>Κτήριο</span>
        <select className={inputStyle} value={buildingId} onChange={(e) => router.push(`/print?building=${e.target.value}`)}>
          {buildings.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.address}, {b.city}</option>)}
        </select>
      </label>
      <label className="hub-field"><span>Περίοδος κοινοχρήστων</span>
        <select className={inputStyle} value={month} onChange={(e) => router.push(`/print?building=${buildingId}&month=${e.target.value}`)} disabled={!months.length}>
          {months.length === 0 && <option value="">Χωρίς εκδόσεις</option>}
          {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </label>
      <style>{`
        .hub-field{display:flex;flex-direction:column;gap:4px;font-size:var(--fs-12);font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#555;min-width:0}
        .hub-input, .hub-card input, .hub-card select, .hub-card textarea{width:100%;font:inherit;font-size:var(--fs-13);font-weight:500;letter-spacing:0;text-transform:none;color:#111;background:#fff;border:1px solid #cfcac2;border-radius:8px;padding:8px 10px;min-height:38px}
        .hub-card textarea{min-height:0;resize:vertical}
        .hub-card{border:1px solid #d9d4cb;border-radius:12px;padding:14px 14px 12px;display:flex;flex-direction:column;gap:10px;background:#fbfaf8}
        .hub-card .hd{display:flex;gap:10px;align-items:flex-start}
        .hub-card .ic{width:36px;height:36px;border-radius:9px;background:#111;color:#f4f1ea;display:flex;align-items:center;justify-content:center;font-size:18px;flex:0 0 auto}
        .hub-card h3{margin:0;font-size:var(--fs-14-5);font-weight:800;line-height:1.2}
        .hub-card p{margin:2px 0 0;font-size:var(--fs-12-5);color:#555;line-height:1.4}
        .hub-card .fld{display:flex;flex-direction:column;gap:3px;font-size:var(--fs-11-5);font-weight:700;color:#555;letter-spacing:.03em;text-transform:uppercase}
        .hub-card .go{margin-top:auto;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:38px;border-radius:9px;border:0;background:#111;color:#f4f1ea;font:inherit;font-size:var(--fs-13);font-weight:700;cursor:pointer}
        .hub-card .go[disabled]{opacity:.4;cursor:not-allowed}
        @media (max-width:640px){.print-page > div{margin-top:-44px!important;padding:16px 14px 22px!important;border-radius:10px!important}}
      `}</style>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="fld"><span>{label}</span>{children}</label>;
}

/** One document card: a GET form that opens the print route in a new tab. */
export function DocCard({ doc, title, hint, icon, hidden, disabled, children }: { doc: string; title: string; hint: string; icon: string; hidden: Record<string, string>; disabled?: boolean; children?: ReactNode }) {
  const Icon = ICONS[icon] ?? RiFileLine;
  return (
    <form className="hub-card" method="GET" action={`/print/${doc}`} target="_blank">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="hd"><div className="ic"><Icon size={18} /></div><div><h3>{title}</h3><p>{hint}</p></div></div>
      {children}
      <button type="submit" className="go" disabled={disabled}><RiExternalLinkLine /> Άνοιγμα εντύπου</button>
    </form>
  );
}
