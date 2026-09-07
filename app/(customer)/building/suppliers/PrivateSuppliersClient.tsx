"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SupplierFormModal, type CategoryOption } from "@/components/suppliers/SupplierFormModal";
import { deleteSupplier } from "@/app/actions/suppliers";
import { SUPPLIER_KIND_LABELS, formatHoursSummary, type SupplierDTO } from "@/lib/suppliers-shared";
import {
  RiTruckLine, RiAddLine, RiPencilLine, RiDeleteBinLine, RiPhoneLine, RiMailLine, RiMapPinLine, RiTimeLine,
  RiSearchLine, RiEyeOffLine, RiAlarmWarningLine, RiBuilding4Line, RiUserLine,
} from "react-icons/ri";

export function PrivateSuppliersClient({ suppliers, categories, caps }: {
  suppliers: SupplierDTO[];
  categories: CategoryOption[];
  caps: { create: boolean; edit: boolean; delete: boolean };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<SupplierDTO | null | "new">(null);
  const [q, setQ] = useState("");
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const platform = suppliers.find((s) => s.scope === "platform") ?? null;
  const mine = useMemo(() => {
    const list = suppliers.filter((s) => s.scope === "private");
    const t = q.trim().toLowerCase();
    if (!t) return list;
    return list.filter((s) => [s.name, s.afm, s.city, s.phone, s.email, ...s.categoryNames].filter(Boolean).some((v) => v!.toLowerCase().includes(t)));
  }, [suppliers, q]);

  function remove(s: SupplierDTO) {
    if (!confirm(`Διαγραφή «${s.name}» από τη λίστα σας;`)) return;
    setErr(null);
    startTransition(async () => {
      const res = await deleteSupplier(s.id);
      if (res && "error" in res && res.error) { setErr(res.error); return; }
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "var(--fs-24)", fontWeight: 800, margin: 0, color: "var(--foreground)" }}>
            <RiTruckLine style={{ color: "var(--color-primary)" }} /> Οι προμηθευτές μου
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>
            Η δική σας λίστα συνεργείων και προμηθευτών. Τα παραστατικά τους συνδέονται αυτόματα (με το ΑΦΜ) όταν τα καταχωρείτε στα έξοδα.
          </p>
        </div>
        {caps.create && <button onClick={() => setEditing("new")} style={{ ...btn, ...btnPrimary }}><RiAddLine /> Νέος προμηθευτής</button>}
      </div>

      {err && <div style={errBox} role="alert">{err}</div>}

      {platform && (
        <div style={{ ...card, display: "flex", alignItems: "center", gap: 14, borderColor: "var(--color-primary)55", background: "var(--color-primary)08" }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--color-primary)18", color: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <RiBuilding4Line style={{ fontSize: "var(--fs-24)" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "var(--fs-15)", fontWeight: 800, color: "var(--foreground)" }}>{platform.name} <span style={pill}>Προεπιλογή</span></div>
            <div style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)" }}>
              Η εταιρεία διαχείρισης αναλαμβάνει υπηρεσίες και προμήθειες μέσω των συνεργατών της. Δηλώστε βλάβη ή αίτημα και θα λάβετε προσφορά.
            </div>
          </div>
        </div>
      )}

      <div style={{ position: "relative", maxWidth: 380 }}>
        <RiSearchLine style={{ position: "absolute", left: 10, top: 10, color: "var(--muted-foreground)" }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Αναζήτηση (επωνυμία, ΑΦΜ, ειδικότητα, πόλη)…"
          style={{ width: "100%", height: 36, padding: "0 10px 0 32px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "var(--fs-13)", background: "var(--card)", color: "var(--foreground)", boxSizing: "border-box" }} />
      </div>

      {mine.length === 0 ? (
        <div onClick={() => caps.create && setEditing("new")} style={{ border: "1.5px dashed var(--border-strong)", borderRadius: 8, padding: 40, textAlign: "center", color: "var(--muted-foreground)", cursor: caps.create ? "pointer" : "default", background: "var(--bg-canvas)", fontSize: "var(--fs-13)" }}>
          <RiTruckLine style={{ fontSize: "var(--fs-26)", display: "block", margin: "0 auto 8px" }} />
          <div style={{ fontWeight: 600, color: "var(--foreground)", marginBottom: 3 }}>{q ? "Κανένα αποτέλεσμα" : "Δεν έχετε προσθέσει προμηθευτές"}</div>
          {!q && "Πατήστε για να προσθέσετε τον πρώτο — π.χ. τον ηλεκτρολόγο ή το συνεργείο καθαρισμού σας."}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {mine.map((s) => (
            <div key={s.id} style={{ ...card, opacity: s.isActive ? 1 : 0.6 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "var(--fs-15)", fontWeight: 800, color: "var(--foreground)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {s.name}
                    {!s.isActive && <RiEyeOffLine title="Ανενεργός" style={{ fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }} />}
                    {s.emergency24h && <RiAlarmWarningLine title="Έκτακτα 24/7" style={{ fontSize: "var(--fs-13)", color: "#c50f1f" }} />}
                  </div>
                  <div style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }}>{SUPPLIER_KIND_LABELS[s.kind]}{s.afm ? ` · ΑΦΜ ${s.afm}` : ""}</div>
                </div>
                {caps.edit && <button onClick={() => setEditing(s)} style={iconBtn} title="Επεξεργασία"><RiPencilLine /></button>}
                {caps.delete && <button onClick={() => remove(s)} disabled={isPending} style={{ ...iconBtn, color: "#c50f1f" }} title="Διαγραφή"><RiDeleteBinLine /></button>}
              </div>
              {s.categoryNames.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                  {s.categoryNames.map((n) => <span key={n} style={chip}>{n}</span>)}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10, fontSize: "var(--fs-12-5)", color: "var(--foreground)" }}>
                {(s.phone || s.phone2) && <Row icon={RiPhoneLine}>{[s.phone, s.phone2].filter(Boolean).join(" · ")}</Row>}
                {s.email && <Row icon={RiMailLine}>{s.email}</Row>}
                {s.contactName && <Row icon={RiUserLine}>{[s.contactName, s.contactPhone].filter(Boolean).join(" · ")}</Row>}
                {(s.address || s.city) && <Row icon={RiMapPinLine}>{[s.address, s.city].filter(Boolean).join(", ")}</Row>}
                <Row icon={RiTimeLine}>{formatHoursSummary(s.workingHours)}</Row>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <SupplierFormModal
          editing={editing === "new" ? null : editing}
          scope="private"
          categories={categories}
          onClose={() => setEditing(null)}
          onDone={() => { setEditing(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function Row({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}><Icon style={{ color: "var(--muted-foreground)", flexShrink: 0 }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{children}</span></div>;
}

const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" };
const pill: React.CSSProperties = { fontSize: "var(--fs-10-5)", fontWeight: 700, padding: "1px 7px", borderRadius: 9999, background: "var(--color-primary)", color: "#fff", marginLeft: 6, verticalAlign: "middle" };
const chip: React.CSSProperties = { fontSize: "var(--fs-11)", fontWeight: 600, padding: "2px 7px", borderRadius: 9999, background: "var(--bg-canvas)", border: "1px solid var(--border)", color: "var(--foreground)" };
const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 4, padding: "7px 13px", fontSize: "var(--fs-13)", fontWeight: 600, cursor: "pointer" };
const btnPrimary: React.CSSProperties = { background: "var(--color-primary)", color: "#fff", borderColor: "var(--color-primary)" };
const iconBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 4, padding: 6, cursor: "pointer", flexShrink: 0 };
const errBox: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: "var(--fs-12)", border: "1px solid #fca5a530" };
