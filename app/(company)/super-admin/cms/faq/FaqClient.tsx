"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type ColDef, type RowAction } from "@/components/ui/data-table";
import { Modal, FormField, FieldInput } from "@/components/ui/modal";
import { CmsPage, LocaleTabs, CmsTextarea } from "@/components/cms/ui";
import { AutoTranslateButton } from "@/components/i18n/AutoTranslateButton";
import { createFaq, updateFaq, deleteFaq, reorderFaqs } from "@/app/actions/pages-cms";
import { ReorderPanel } from "@/components/cms/ReorderPanel";
import { RiQuestionLine, RiCheckLine, RiLoaderLine, RiPencilLine, RiDeleteBinLine } from "react-icons/ri";

type Faq = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  order: number;
  published: boolean;
  i18n: any;
};

type Locale = "el" | "en";

type I18n = {
  question: { el: string; en: string };
  answer: { el: string; en: string };
};

function initI18n(faq: Faq | null): I18n {
  const raw = (faq?.i18n ?? {}) as any;
  return {
    question: { el: raw?.question?.el ?? faq?.question ?? "", en: raw?.question?.en ?? "" },
    answer: { el: raw?.answer?.el ?? faq?.answer ?? "", en: raw?.answer?.en ?? "" },
  };
}

function truncate(s: string, n = 80): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
      background: `color-mix(in srgb, ${color} 12%, transparent)`, color,
    }}>{label}</span>
  );
}

export function FaqClient({ initial }: { initial: Faq[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Faq | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [locale, setLocale] = useState<Locale>("el");

  // form state
  const [i18n, setI18n] = useState<I18n>(initI18n(null));
  const [category, setCategory] = useState("general");
  const [order, setOrder] = useState("0");
  const [published, setPublished] = useState(false);

  function loadForm(faq: Faq | null) {
    setI18n(initI18n(faq));
    setCategory(faq?.category ?? "general");
    setOrder(String(faq?.order ?? 0));
    setPublished(faq?.published ?? false);
    setLocale("el");
    setError(null);
  }

  function openAdd() { setEditing(null); loadForm(null); setOpen(true); }
  function openEdit(f: Faq) { setEditing(f); loadForm(f); setOpen(true); }

  function handleSave() {
    if (!i18n.question.el.trim()) { setError("Η ερώτηση είναι υποχρεωτική"); return; }
    const payload = {
      i18n,
      question: i18n.question.el,
      answer: i18n.answer.el,
      category: category.trim() || "general",
      order: Number(order) || 0,
      published,
    };
    startTransition(async () => {
      try {
        if (editing) await updateFaq(editing.id, payload);
        else await createFaq(payload);
        setOpen(false);
        router.refresh();
      } catch (e: any) {
        setError(e?.message ?? "Σφάλμα αποθήκευσης");
      }
    });
  }

  function handleDelete(f: Faq) {
    if (!confirm(`Διαγραφή ερώτησης «${f.i18n?.question?.el ?? f.question}»;`)) return;
    startTransition(async () => {
      try {
        await deleteFaq(f.id);
        router.refresh();
      } catch (e: any) {
        alert(e?.message ?? "Σφάλμα διαγραφής");
      }
    });
  }

  const columns: ColDef<Faq>[] = [
    {
      id: "question", header: "Ερώτηση", sortKey: "question", width: 360,
      accessor: (f) => f.i18n?.question?.el ?? f.question,
      cell: (f) => (
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
          {truncate(f.i18n?.question?.el ?? f.question ?? "(χωρίς τίτλο)")}
        </span>
      ),
    },
    {
      id: "category", header: "Κατηγορία", sortKey: "category", width: 140,
      accessor: (f) => f.category ?? "",
      cell: (f) => <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{f.category ?? "—"}</span>,
    },
    {
      id: "order", header: "Σειρά", sortKey: "order", width: 80,
      accessor: (f) => f.order,
      cell: (f) => <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{f.order}</span>,
    },
    {
      id: "published", header: "Κατάσταση", sortKey: "published", width: 130,
      accessor: (f) => (f.published ? "Δημοσιευμένο" : "Πρόχειρο"),
      cell: (f) => f.published
        ? <Badge label="Δημοσιευμένο" color="var(--color-success)" />
        : <Badge label="Πρόχειρο" color="var(--muted-foreground)" />,
    },
  ];

  const getRowActions = (_f: Faq): RowAction<Faq>[] => [
    { label: "Επεξεργασία", icon: <RiPencilLine />, onClick: openEdit },
    { label: "Διαγραφή", icon: <RiDeleteBinLine />, danger: true, onClick: handleDelete },
  ];

  const labelCheck: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)", cursor: "pointer" };

  return (
    <CmsPage icon={<RiQuestionLine />} title="FAQ" subtitle="Διαχείριση συχνών ερωτήσεων">
      <ReorderPanel
        title="Σειρά εμφάνισης — σύρετε"
        items={initial.map((f) => ({ id: f.id, label: f.i18n?.question?.el ?? f.question }))}
        onReorder={reorderFaqs}
      />
      <DataTable
        data={initial}
        columns={columns}
        totalRows={initial.length}
        page={1}
        pageSize={25}
        clientSide
        storageKey="super-admin-cms-faq"
        searchPlaceholder="Αναζήτηση ερώτησης…"
        getRowActions={getRowActions}
        onAddNew={openAdd}
        addNewLabel="Νέα ερώτηση"
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Επεξεργασία ερώτησης" : "Νέα ερώτηση"}
        width={560}
        footer={
          <>
            <button onClick={() => setOpen(false)} style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: 13, color: "var(--foreground)" }}>Ακύρωση</button>
            <button onClick={handleSave} disabled={isPending} style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: isPending ? "wait" : "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              {isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />}
              Αποθήκευση
            </button>
          </>
        }
      >
        {error && <div style={{ padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, border: "1px solid #fca5a530", marginBottom: 14 }}>{error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <LocaleTabs value={locale} onChange={setLocale} />

          <FormField label="Ερώτηση" required>
            <FieldInput value={i18n.question[locale]} onChange={(v) => setI18n((p) => ({ ...p, question: { ...p.question, [locale]: v } }))} placeholder="π.χ. Πώς λειτουργεί;" />
            {locale === "en" && (
              <div style={{ marginTop: 6 }}>
                <AutoTranslateButton source={i18n.question.el} onResult={(t) => setI18n((p) => ({ ...p, question: { ...p.question, en: t } }))} />
              </div>
            )}
          </FormField>
          <FormField label="Απάντηση">
            <CmsTextarea
              value={i18n.answer[locale]}
              onChange={(e) => setI18n((p) => ({ ...p, answer: { ...p.answer, [locale]: e.target.value } }))}
              rows={6}
              style={{ resize: "vertical", fontFamily: "inherit" }}
            />
            {locale === "en" && (
              <div style={{ marginTop: 6 }}>
                <AutoTranslateButton source={i18n.answer.el} onResult={(t) => setI18n((p) => ({ ...p, answer: { ...p.answer, en: t } }))} />
              </div>
            )}
          </FormField>

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="Κατηγορία"><FieldInput value={category} onChange={setCategory} placeholder="general" /></FormField>
            <FormField label="Σειρά"><FieldInput type="number" value={order} onChange={setOrder} /></FormField>
          </div>

          <label style={labelCheck}>
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            Δημοσιευμένο
          </label>
        </div>

        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </Modal>
    </CmsPage>
  );
}
