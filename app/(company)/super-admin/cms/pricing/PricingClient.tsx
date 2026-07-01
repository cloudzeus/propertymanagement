"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type ColDef, type RowAction } from "@/components/ui/data-table";
import { Modal, FormField, FieldInput } from "@/components/ui/modal";
import { CmsPage, LocaleTabs } from "@/components/cms/ui";
import { AutoTranslateButton } from "@/components/i18n/AutoTranslateButton";
import { createPricingTier, updatePricingTier, deletePricingTier, reorderTiers } from "@/app/actions/pages-cms";
import { ReorderPanel } from "@/components/cms/ReorderPanel";
import { RiPriceTag3Line, RiCheckLine, RiLoaderLine, RiPencilLine, RiDeleteBinLine } from "react-icons/ri";

type Tier = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
  highlighted: boolean;
  order: number;
  published: boolean;
  i18n: any;
};

type Locale = "el" | "en";

type I18n = {
  name: { el: string; en: string };
  description: { el: string; en: string };
  features: { el: string[]; en: string[] };
};

function initI18n(tier: Tier | null): I18n {
  const raw = (tier?.i18n ?? {}) as any;
  return {
    name: { el: raw?.name?.el ?? tier?.name ?? "", en: raw?.name?.en ?? "" },
    description: { el: raw?.description?.el ?? tier?.description ?? "", en: raw?.description?.en ?? "" },
    features: {
      el: Array.isArray(raw?.features?.el) ? raw.features.el : (tier?.features ?? []),
      en: Array.isArray(raw?.features?.en) ? raw.features.en : [],
    },
  };
}

function splitFeatures(s: string): string[] {
  return s.split("\n").map((x) => x.trim()).filter(Boolean);
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
      background: `color-mix(in srgb, ${color} 12%, transparent)`, color,
    }}>{label}</span>
  );
}

export function PricingClient({ initial }: { initial: Tier[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [locale, setLocale] = useState<Locale>("el");

  // form state
  const [i18n, setI18n] = useState<I18n>(initI18n(null));
  const [featuresText, setFeaturesText] = useState<{ el: string; en: string }>({ el: "", en: "" });
  const [slug, setSlug] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState("0");
  const [annualPrice, setAnnualPrice] = useState("0");
  const [order, setOrder] = useState("0");
  const [highlighted, setHighlighted] = useState(false);
  const [published, setPublished] = useState(false);

  function loadForm(tier: Tier | null) {
    const init = initI18n(tier);
    setI18n(init);
    setFeaturesText({ el: init.features.el.join("\n"), en: init.features.en.join("\n") });
    setSlug(tier?.slug ?? `tier-${Date.now()}`);
    setMonthlyPrice(String(tier?.monthlyPrice ?? 0));
    setAnnualPrice(String(tier?.annualPrice ?? 0));
    setOrder(String(tier?.order ?? 0));
    setHighlighted(tier?.highlighted ?? false);
    setPublished(tier?.published ?? false);
    setLocale("el");
    setError(null);
  }

  function openAdd() { setEditing(null); loadForm(null); setOpen(true); }
  function openEdit(t: Tier) { setEditing(t); loadForm(t); setOpen(true); }

  function handleSave() {
    if (!i18n.name.el.trim()) { setError("Το όνομα είναι υποχρεωτικό"); return; }
    if (!slug.trim()) { setError("Το slug είναι υποχρεωτικό"); return; }
    const features = { el: splitFeatures(featuresText.el), en: splitFeatures(featuresText.en) };
    const fullI18n = { name: i18n.name, description: i18n.description, features };
    const payload = {
      i18n: fullI18n,
      name: i18n.name.el,
      description: i18n.description.el,
      features: features.el,
      slug: slug.trim(),
      monthlyPrice: Number(monthlyPrice) || 0,
      annualPrice: Number(annualPrice) || 0,
      order: Number(order) || 0,
      highlighted,
      published,
    };
    startTransition(async () => {
      try {
        if (editing) await updatePricingTier(editing.id, payload);
        else await createPricingTier(payload);
        setOpen(false);
        router.refresh();
      } catch (e: any) {
        setError(e?.message ?? "Σφάλμα αποθήκευσης");
      }
    });
  }

  function handleDelete(t: Tier) {
    if (!confirm(`Διαγραφή πλάνου «${t.i18n?.name?.el ?? t.name}»;`)) return;
    startTransition(async () => {
      try {
        await deletePricingTier(t.id);
        router.refresh();
      } catch (e: any) {
        alert(e?.message ?? "Σφάλμα διαγραφής");
      }
    });
  }

  const columns: ColDef<Tier>[] = [
    {
      id: "name", header: "Όνομα", sortKey: "name", width: 240,
      accessor: (t) => t.i18n?.name?.el ?? t.name,
      cell: (t) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{t.i18n?.name?.el ?? t.name}</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "monospace" }}>{t.slug}</div>
        </div>
      ),
    },
    {
      id: "monthlyPrice", header: "Τιμή/μήνα", sortKey: "monthlyPrice", width: 120,
      accessor: (t) => t.monthlyPrice,
      cell: (t) => <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{t.monthlyPrice ? `€ ${t.monthlyPrice}` : "—"}</span>,
    },
    {
      id: "highlighted", header: "Προβολή", sortKey: "highlighted", width: 120,
      accessor: (t) => (t.highlighted ? "Δημοφιλές" : ""),
      cell: (t) => (t.highlighted ? <Badge label="Δημοφιλές" color="var(--color-primary)" /> : <span style={{ color: "var(--muted-foreground)" }}>—</span>),
    },
    {
      id: "order", header: "Σειρά", sortKey: "order", width: 80,
      accessor: (t) => t.order,
      cell: (t) => <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{t.order}</span>,
    },
    {
      id: "published", header: "Κατάσταση", sortKey: "published", width: 130,
      accessor: (t) => (t.published ? "Δημοσιευμένο" : "Πρόχειρο"),
      cell: (t) => t.published
        ? <Badge label="Δημοσιευμένο" color="var(--color-success)" />
        : <Badge label="Πρόχειρο" color="var(--muted-foreground)" />,
    },
  ];

  const getRowActions = (_t: Tier): RowAction<Tier>[] => [
    { label: "Επεξεργασία", icon: <RiPencilLine />, onClick: openEdit },
    { label: "Διαγραφή", icon: <RiDeleteBinLine />, danger: true, onClick: handleDelete },
  ];

  const labelCheck: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)", cursor: "pointer" };

  return (
    <CmsPage icon={<RiPriceTag3Line />} title="Τιμές" subtitle="Διαχείριση πακέτων τιμολόγησης">
      <ReorderPanel
        title="Σειρά εμφάνισης — σύρετε"
        items={initial.map((t) => ({ id: t.id, label: t.i18n?.name?.el ?? t.name }))}
        onReorder={reorderTiers}
      />
      <DataTable
        data={initial}
        columns={columns}
        totalRows={initial.length}
        page={1}
        pageSize={25}
        clientSide
        storageKey="super-admin-cms-pricing"
        searchPlaceholder="Αναζήτηση πλάνου…"
        getRowActions={getRowActions}
        onAddNew={openAdd}
        addNewLabel="Νέο πλάνο"
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Επεξεργασία πλάνου" : "Νέο πλάνο"}
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

          <FormField label="Όνομα" required>
            <FieldInput value={i18n.name[locale]} onChange={(v) => setI18n((p) => ({ ...p, name: { ...p.name, [locale]: v } }))} placeholder="π.χ. Basic" />
            {locale === "en" && (
              <div style={{ marginTop: 6 }}>
                <AutoTranslateButton source={i18n.name.el} onResult={(t) => setI18n((p) => ({ ...p, name: { ...p.name, en: t } }))} />
              </div>
            )}
          </FormField>
          <FormField label="Περιγραφή">
            <textarea
              value={i18n.description[locale]}
              onChange={(e) => setI18n((p) => ({ ...p, description: { ...p.description, [locale]: e.target.value } }))}
              rows={2}
              style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, color: "var(--foreground)", background: "var(--card)", outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }}
            />
            {locale === "en" && (
              <div style={{ marginTop: 6 }}>
                <AutoTranslateButton source={i18n.description.el} onResult={(t) => setI18n((p) => ({ ...p, description: { ...p.description, en: t } }))} />
              </div>
            )}
          </FormField>
          <FormField label="Χαρακτηριστικά (ένα ανά γραμμή)">
            <textarea
              value={featuresText[locale]}
              onChange={(e) => setFeaturesText((p) => ({ ...p, [locale]: e.target.value }))}
              rows={5}
              style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, color: "var(--foreground)", background: "var(--card)", outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }}
            />
            {locale === "en" && (
              <div style={{ marginTop: 6 }}>
                <AutoTranslateButton source={featuresText.el} onResult={(t) => setFeaturesText((p) => ({ ...p, en: t }))} />
              </div>
            )}
          </FormField>

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="Slug" required><FieldInput value={slug} onChange={setSlug} placeholder="basic" /></FormField>
            <FormField label="Σειρά"><FieldInput type="number" value={order} onChange={setOrder} /></FormField>
            <FormField label="Μηνιαία τιμή (€)"><FieldInput type="number" value={monthlyPrice} onChange={setMonthlyPrice} /></FormField>
            <FormField label="Ετήσια τιμή (€)"><FieldInput type="number" value={annualPrice} onChange={setAnnualPrice} /></FormField>
          </div>

          <div style={{ display: "flex", gap: 24 }}>
            <label style={labelCheck}>
              <input type="checkbox" checked={highlighted} onChange={(e) => setHighlighted(e.target.checked)} />
              Προβεβλημένο
            </label>
            <label style={labelCheck}>
              <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
              Δημοσιευμένο
            </label>
          </div>
        </div>

        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </Modal>
    </CmsPage>
  );
}
