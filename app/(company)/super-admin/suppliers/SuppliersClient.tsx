"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, type ColDef, type RowAction } from "@/components/ui/data-table";
import { SupplierFormModal, type CategoryOption } from "@/components/suppliers/SupplierFormModal";
import { deleteSupplier } from "@/app/actions/suppliers";
import { SUPPLIER_KIND_LABELS, formatHoursSummary, type SupplierDTO } from "@/lib/suppliers-shared";
import { RiTeamLine, RiEyeLine, RiPencilLine, RiDeleteBinLine, RiEyeOffLine, RiUserLine, RiAlarmWarningLine, RiPriceTag3Line } from "react-icons/ri";

export function SuppliersClient({ suppliers, categories, caps }: {
  suppliers: SupplierDTO[];
  categories: CategoryOption[];
  caps: { create: boolean; edit: boolean; delete: boolean };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<SupplierDTO | null | "new">(null);
  const [isPending, startTransition] = useTransition();
  const [rowError, setRowError] = useState<string | null>(null);

  const active = suppliers.filter((s) => s.isActive).length;
  const withLogin = suppliers.filter((s) => s.usersCount > 0).length;
  const emergency = suppliers.filter((s) => s.emergency24h && s.isActive).length;

  function remove(s: SupplierDTO) {
    if (!confirm(`Διαγραφή «${s.name}» από το μητρώο;`)) return;
    setRowError(null);
    startTransition(async () => {
      const res = await deleteSupplier(s.id);
      if (res && "error" in res && res.error) { setRowError(res.error); return; }
      router.refresh();
    });
  }

  const columns: ColDef<SupplierDTO>[] = [
    { id: "name", header: "Επωνυμία", width: 260, sortKey: "name", accessor: (r) => r.name,
      cell: (r) => (
        <div style={{ opacity: r.isActive ? 1 : 0.55 }}>
          <Link href={`/super-admin/suppliers/${r.id}`} style={{ fontWeight: 600, color: "var(--foreground)", textDecoration: "none" }}>{r.name}</Link>
          {!r.isActive && <RiEyeOffLine title="Ανενεργός" style={{ marginLeft: 6, fontSize: "var(--fs-12)", color: "var(--muted-foreground)", verticalAlign: "middle" }} />}
          {r.emergency24h && <RiAlarmWarningLine title="Έκτακτα 24/7" style={{ marginLeft: 6, fontSize: "var(--fs-12)", color: "#c50f1f", verticalAlign: "middle" }} />}
          <div style={{ fontSize: "var(--fs-11-5)", color: "var(--muted-foreground)" }}>{[r.afm ? `ΑΦΜ ${r.afm}` : null, r.code].filter(Boolean).join(" · ")}</div>
        </div>
      ) },
    { id: "kind", header: "Είδος", width: 130, accessor: (r) => SUPPLIER_KIND_LABELS[r.kind], cell: (r) => SUPPLIER_KIND_LABELS[r.kind] },
    { id: "specialties", header: "Ειδικότητες", width: 220, accessor: (r) => r.categoryNames.join(", "),
      cell: (r) => r.categoryNames.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {r.categoryNames.map((n) => <span key={n} style={chip}>{n}</span>)}
        </div>
      ) : <span style={{ color: "var(--muted-foreground)" }}>—</span> },
    { id: "contact", header: "Επικοινωνία", width: 200, accessor: (r) => [r.phone, r.email].filter(Boolean).join(" "),
      cell: (r) => <div style={{ fontSize: "var(--fs-12-5)" }}>{r.phone ?? "—"}<div style={{ color: "var(--muted-foreground)" }}>{r.email ?? ""}</div></div> },
    { id: "city", header: "Πόλη", width: 120, sortKey: "city", accessor: (r) => r.city ?? "", cell: (r) => r.city ?? "—" },
    { id: "hours", header: "Ωράριο", width: 200, defaultVisible: false, accessor: (r) => formatHoursSummary(r.workingHours), cell: (r) => <span style={{ fontSize: "var(--fs-12)" }}>{formatHoursSummary(r.workingHours)}</span> },
    { id: "catalog", header: "Κατάλογος", width: 110, accessor: (r) => r.servicesCount + r.productsCount,
      cell: (r) => <span style={{ fontSize: "var(--fs-12-5)" }}>{r.servicesCount} υπηρ. · {r.productsCount} προϊ.</span> },
    { id: "users", header: "Λογαριασμοί", width: 100, accessor: (r) => r.usersCount,
      cell: (r) => <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontVariantNumeric: "tabular-nums" }}><RiUserLine style={{ color: "var(--muted-foreground)" }} /> {r.usersCount}</span> },
  ];

  const rowActions = (r: SupplierDTO): RowAction<SupplierDTO>[] => [
    { label: "Προβολή", icon: <RiEyeLine />, onClick: () => router.push(`/super-admin/suppliers/${r.id}`) },
    ...(caps.edit ? [{ label: "Επεξεργασία", icon: <RiPencilLine />, onClick: () => setEditing(r) }] : []),
    ...(caps.delete ? [{ label: "Διαγραφή", icon: <RiDeleteBinLine />, danger: true, onClick: () => remove(r) }] : []),
  ];

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "var(--fs-22)", fontWeight: 800, margin: 0, color: "var(--foreground)" }}>
            <RiTeamLine style={{ color: "var(--color-primary)" }} /> Συνεργάτες & Προμηθευτές
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>
            Το μητρώο της εταιρίας: όποιος παρέχει υπηρεσίες ή προϊόντα στα κτήρια. Η ανάθεση εργασιών σε συνεργάτη γίνεται μόνο από εδώ (από τη βλάβη).
          </p>
        </div>
        <Link href="/super-admin/suppliers/catalog" style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "var(--fs-13)", color: "var(--foreground)", textDecoration: "none", background: "var(--card)" }}>
          <RiPriceTag3Line /> Κατάλογος υπηρεσιών
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {[
          { label: "Σύνολο", value: suppliers.length },
          { label: "Ενεργοί", value: active },
          { label: "Με λογαριασμό", value: withLogin },
          { label: "Έκτακτα 24/7", value: emergency },
        ].map((k) => (
          <div key={k.label} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "14px 16px" }}>
            <div style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }}>{k.label}</div>
            <div style={{ fontSize: "var(--fs-24)", fontWeight: 700, color: "var(--foreground)" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {rowError && <div style={errBox} role="alert">{rowError}</div>}

      <DataTable
        data={suppliers}
        columns={columns}
        totalRows={suppliers.length}
        page={1}
        pageSize={25}
        clientSide
        storageKey="suppliers-registry"
        searchPlaceholder="Αναζήτηση συνεργάτη (επωνυμία, ΑΦΜ, πόλη)…"
        getRowActions={rowActions}
        onAddNew={caps.create ? () => setEditing("new") : undefined}
        addNewLabel="Νέος συνεργάτης"
      />

      {editing !== null && (
        <SupplierFormModal
          editing={editing === "new" ? null : editing}
          scope="company"
          categories={categories}
          onClose={() => setEditing(null)}
          onDone={() => { setEditing(null); router.refresh(); }}
        />
      )}
      {isPending && null}
    </div>
  );
}

const chip: React.CSSProperties = { fontSize: "var(--fs-11)", fontWeight: 600, padding: "2px 7px", borderRadius: 9999, background: "var(--bg-canvas)", border: "1px solid var(--border)", color: "var(--foreground)" };
const errBox: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: "var(--fs-12)", border: "1px solid #fca5a530" };
