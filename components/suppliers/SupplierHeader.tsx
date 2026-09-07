"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SupplierFormModal, type CategoryOption } from "./SupplierFormModal";
import { SUPPLIER_KIND_LABELS, SCOPE_LABELS, formatHoursSummary, type SupplierDTO } from "@/lib/suppliers-shared";
import {
  RiPencilLine, RiPhoneLine, RiMailLine, RiMapPinLine, RiTimeLine, RiAlarmWarningLine, RiEyeOffLine,
  RiUserLine, RiBankLine, RiGlobalLine, RiSearchEyeLine,
} from "react-icons/ri";

/** Supplier identity card + edit button; used by the company detail page and the marketplace profile. */
export function SupplierHeader({ supplier, categories, canEdit, showScope }: {
  supplier: SupplierDTO;
  categories: CategoryOption[];
  canEdit: boolean;
  showScope?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const s = supplier;
  const addr = [s.address, [s.postalCode, s.city].filter(Boolean).join(" "), s.district].filter(Boolean).join(", ");

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: "var(--foreground)" }}>{s.name}</h1>
            <span style={pill}>{SUPPLIER_KIND_LABELS[s.kind]}</span>
            {showScope && <span style={pill}>{SCOPE_LABELS[s.scope]}</span>}
            {!s.isActive && <span style={{ ...pill, color: "var(--muted-foreground)" }}><RiEyeOffLine /> Ανενεργός</span>}
            {s.emergency24h && <span style={{ ...pill, color: "#c50f1f", borderColor: "#c50f1f40" }}><RiAlarmWarningLine /> Έκτακτα 24/7</span>}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 4 }}>
            {[s.afm ? `ΑΦΜ ${s.afm}` : null, s.doy ? `ΔΟΥ ${s.doy}` : null, s.code ? `Κωδ. ${s.code}` : null].filter(Boolean).join(" · ") || "Χωρίς φορολογικά στοιχεία"}
          </div>
          {s.categoryNames.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
              {s.categoryNames.map((n) => <span key={n} style={chip}>{n}</span>)}
            </div>
          )}
        </div>
        {canEdit && <button onClick={() => setOpen(true)} style={btn}><RiPencilLine /> Επεξεργασία</button>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 14, fontSize: 13, color: "var(--foreground)" }}>
        <Info icon={RiPhoneLine} label="Τηλέφωνα" value={[s.phone, s.phone2].filter(Boolean).join(" · ")} />
        <Info icon={RiMailLine} label="Email" value={s.email} />
        <Info icon={RiUserLine} label="Υπεύθυνος" value={[s.contactName, s.contactPhone, s.contactEmail].filter(Boolean).join(" · ")} />
        <Info icon={RiMapPinLine} label="Διεύθυνση" value={addr} />
        <Info icon={RiTimeLine} label="Ωράριο" value={formatHoursSummary(s.workingHours)} />
        <Info icon={RiBankLine} label="Πληρωμές" value={[s.iban, s.bank, s.paymentTermsDays != null ? `${s.paymentTermsDays} ημέρες` : null].filter(Boolean).join(" · ")} />
        <Info icon={RiSearchEyeLine} label="Αυτοψία" value={s.siteSurveyFee != null ? `${s.siteSurveyFee.toLocaleString("el-GR", { minimumFractionDigits: 2 })} € ${s.siteSurveyFeeWaived ? "(συμψηφίζεται με την εργασία)" : "(χρεώνεται πάντα)"}` : "Δωρεάν"} />
        {s.webpage && <Info icon={RiGlobalLine} label="Ιστοσελίδα" value={s.webpage} />}
      </div>
      {s.remarks && <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "var(--muted-foreground)", whiteSpace: "pre-wrap" }}>{s.remarks}</p>}

      {open && (
        <SupplierFormModal editing={s} scope={s.scope === "private" ? "private" : "company"} categories={categories}
          onClose={() => setOpen(false)} onDone={() => { setOpen(false); router.refresh(); }} />
      )}
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <Icon style={{ color: "var(--muted-foreground)", marginTop: 2, flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 600 }}>{label}</div>
        <div style={{ overflowWrap: "anywhere" }}>{value || "—"}</div>
      </div>
    </div>
  );
}

const pill: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, padding: "2px 9px", borderRadius: 9999, border: "1px solid var(--border)", background: "var(--bg-canvas)", color: "var(--foreground)" };
const chip: React.CSSProperties = { fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 9999, background: "var(--color-primary)14", color: "var(--color-primary)" };
const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 4, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
