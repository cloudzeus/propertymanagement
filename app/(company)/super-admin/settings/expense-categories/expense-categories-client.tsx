"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  RiAddLine,
  RiEdit2Line,
  RiDeleteBinLine,
  RiPriceTag3Line,
} from "react-icons/ri";
import { Modal, FormField, FieldInput, FieldSelect } from "@/components/ui/modal";
import {
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
} from "@/app/actions/expense-categories";

type UtilityType = "NONE" | "POWER" | "WATER" | "GAS";

type DistributionBasis =
  | "GENERAL_MILLESIMES"
  | "ELEVATOR_MILLESIMES"
  | "HEATING_MILLESIMES"
  | "EQUAL_PER_UNIT"
  | "METERED_70_30";

type Category = {
  id: string;
  name: string;
  code: string;
  utilityType: UtilityType;
  defaultTenantPct: number;
  defaultOwnerPct: number;
  defaultBasis: DistributionBasis;
  active: boolean;
  sortOrder: number;
};

const BASIS_OPTIONS: { value: DistributionBasis; label: string }[] = [
  { value: "GENERAL_MILLESIMES", label: "Γενικά χιλιοστά" },
  { value: "ELEVATOR_MILLESIMES", label: "Χιλιοστά ανελκυστήρα" },
  { value: "HEATING_MILLESIMES", label: "Χιλιοστά θέρμανσης" },
  { value: "EQUAL_PER_UNIT", label: "Ισόποσα ανά μονάδα" },
  { value: "METERED_70_30", label: "70/30 μετρητής" },
];

const UTILITY_OPTIONS: { value: UtilityType; label: string }[] = [
  { value: "NONE", label: "Καμία" },
  { value: "POWER", label: "Ρεύμα" },
  { value: "WATER", label: "Νερό" },
  { value: "GAS", label: "Φυσικό αέριο" },
];

const UTILITY_LABEL: Record<UtilityType, string> = {
  NONE: "Καμία",
  POWER: "Ρεύμα",
  WATER: "Νερό",
  GAS: "Φυσικό αέριο",
};

type FormState = {
  name: string;
  code: string;
  utilityType: UtilityType;
  defaultBasis: DistributionBasis;
  tenantPct: string;
  sortOrder: string;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  code: "",
  utilityType: "NONE",
  defaultBasis: "GENERAL_MILLESIMES",
  tenantPct: "100",
  sortOrder: "",
  active: true,
};

export function ExpenseCategoriesClient({ initial }: { initial: Category[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const tenantPct = Math.max(0, Math.min(100, Math.round(Number(form.tenantPct) || 0)));
  const ownerPct = 100 - tenantPct;

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setOpen(true);
  }

  function openEdit(c: Category) {
    setEditId(c.id);
    setForm({
      name: c.name,
      code: c.code,
      utilityType: c.utilityType,
      defaultBasis: c.defaultBasis,
      tenantPct: String(c.defaultTenantPct),
      sortOrder: c.sortOrder != null ? String(c.sortOrder) : "",
      active: c.active,
    });
    setError(null);
    setOpen(true);
  }

  function handleSubmit() {
    setError(null);
    const input = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      utilityType: form.utilityType,
      defaultBasis: form.defaultBasis,
      defaultTenantPct: tenantPct,
      defaultOwnerPct: ownerPct,
      sortOrder: form.sortOrder.trim() === "" ? undefined : Number(form.sortOrder),
      active: form.active,
    };
    if (!input.name || !input.code) {
      setError("Συμπληρώστε όνομα και κωδικό.");
      return;
    }
    startTransition(async () => {
      try {
        if (editId) await updateExpenseCategory(editId, input);
        else await createExpenseCategory(input);
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Σφάλμα αποθήκευσης.");
      }
    });
  }

  function handleDelete(c: Category) {
    if (!confirm(`Διαγραφή κατηγορίας «${c.name}»;`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteExpenseCategory(c.id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Σφάλμα διαγραφής.");
      }
    });
  }

  const th: React.CSSProperties = {
    textAlign: "left",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--muted-foreground)",
    padding: "10px 14px",
    borderBottom: "1px solid var(--border)",
  };
  const td: React.CSSProperties = {
    fontSize: 13,
    color: "var(--foreground)",
    padding: "12px 14px",
    borderBottom: "1px solid var(--border)",
  };

  const iconBtn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 30,
    height: 30,
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--bg-canvas)",
    cursor: "pointer",
    color: "var(--muted-foreground)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <RiPriceTag3Line style={{ fontSize: 24, color: "var(--color-primary)" }} />
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
              Κατηγορίες Εξόδων
            </h1>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
              Διαχείριση κατηγοριών και προεπιλεγμένου επιμερισμού ενοικιαστή/ιδιοκτήτη
            </p>
          </div>
        </div>
        <button
          onClick={openCreate}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            height: 36, padding: "0 14px", borderRadius: 6,
            border: "1px solid var(--color-primary)",
            background: "var(--color-primary)", color: "#fff",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          <RiAddLine style={{ fontSize: 16 }} /> Προσθήκη κατηγορίας
        </button>
      </div>

      {error && (
        <div style={{
          padding: 14, borderRadius: "var(--radius)",
          background: "#FEE7E618", border: "1px solid var(--color-danger)",
          color: "var(--color-danger)", fontSize: 13,
        }}>
          {error}
        </div>
      )}

      <div style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", overflow: "hidden",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Όνομα</th>
              <th style={th}>Κωδικός</th>
              <th style={th}>Τύπος</th>
              <th style={th}>Επιμερισμός</th>
              <th style={th}>Ενεργή</th>
              <th style={{ ...th, textAlign: "right" }}>Ενέργειες</th>
            </tr>
          </thead>
          <tbody>
            {initial.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ ...td, textAlign: "center", color: "var(--muted-foreground)" }}>
                  Δεν υπάρχουν κατηγορίες ακόμα
                </td>
              </tr>
            ) : (
              initial.map((c) => (
                <tr key={c.id} style={{ opacity: c.active ? 1 : 0.5 }}>
                  <td style={{ ...td, fontWeight: 600 }}>{c.name}</td>
                  <td style={td}>{c.code}</td>
                  <td style={td}>{UTILITY_LABEL[c.utilityType]}</td>
                  <td style={td}>{`${c.defaultTenantPct}% ενοικ. / ${c.defaultOwnerPct}% ιδιοκτ.`}</td>
                  <td style={td}>
                    <span style={{
                      display: "inline-block", padding: "2px 8px", borderRadius: 999,
                      fontSize: 11, fontWeight: 600,
                      background: c.active ? "#16a34a18" : "var(--bg-canvas)",
                      color: c.active ? "#16a34a" : "var(--muted-foreground)",
                      border: `1px solid ${c.active ? "#16a34a44" : "var(--border)"}`,
                    }}>
                      {c.active ? "Ναι" : "Όχι"}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      <button style={iconBtn} onClick={() => openEdit(c)} title="Επεξεργασία" disabled={isPending}>
                        <RiEdit2Line style={{ fontSize: 15 }} />
                      </button>
                      <button
                        style={{ ...iconBtn, color: "var(--color-danger)" }}
                        onClick={() => handleDelete(c)}
                        title="Διαγραφή"
                        disabled={isPending}
                      >
                        <RiDeleteBinLine style={{ fontSize: 15 }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? "Επεξεργασία κατηγορίας" : "Νέα κατηγορία"}
        footer={
          <>
            <button
              onClick={() => setOpen(false)}
              disabled={isPending}
              style={{
                height: 34, padding: "0 14px", borderRadius: 6,
                border: "1px solid var(--border)", background: "var(--bg-canvas)",
                fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--foreground)",
              }}
            >
              Άκυρο
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending}
              style={{
                height: 34, padding: "0 14px", borderRadius: 6,
                border: "1px solid var(--color-primary)",
                background: "var(--color-primary)", color: "#fff",
                fontSize: 13, fontWeight: 600,
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending ? "Αποθήκευση…" : "Αποθήκευση"}
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {error && (
            <div style={{
              padding: 10, borderRadius: 6,
              background: "#FEE7E618", border: "1px solid var(--color-danger)",
              color: "var(--color-danger)", fontSize: 12,
            }}>
              {error}
            </div>
          )}
          <FormField label="Όνομα" required>
            <FieldInput value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          </FormField>
          <FormField label="Κωδικός" required hint="Κεφαλαία γράμματα">
            <FieldInput
              value={form.code}
              onChange={(v) => setForm((f) => ({ ...f, code: v.toUpperCase() }))}
            />
          </FormField>
          <FormField label="Τύπος παροχής">
            <FieldSelect
              value={form.utilityType}
              onChange={(v) => setForm((f) => ({ ...f, utilityType: v as UtilityType }))}
              options={UTILITY_OPTIONS}
            />
          </FormField>
          <FormField label="Βάση επιμερισμού" hint="Προεπιλεγμένη μέθοδος κατανομής">
            <FieldSelect
              value={form.defaultBasis}
              onChange={(v) => setForm((f) => ({ ...f, defaultBasis: v as DistributionBasis }))}
              options={BASIS_OPTIONS}
            />
          </FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="Ποσοστό ενοικιαστή (%)" required>
              <FieldInput
                type="number"
                value={form.tenantPct}
                onChange={(v) => setForm((f) => ({ ...f, tenantPct: v }))}
              />
            </FormField>
            <FormField label="Ποσοστό ιδιοκτήτη (%)">
              <FieldInput type="number" value={String(ownerPct)} onChange={() => {}} disabled />
            </FormField>
          </div>
          <FormField label="Σειρά ταξινόμησης" hint="Προαιρετικό">
            <FieldInput
              type="number"
              value={form.sortOrder}
              onChange={(v) => setForm((f) => ({ ...f, sortOrder: v }))}
            />
          </FormField>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)" }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            Ενεργή
          </label>
        </div>
      </Modal>
    </div>
  );
}
