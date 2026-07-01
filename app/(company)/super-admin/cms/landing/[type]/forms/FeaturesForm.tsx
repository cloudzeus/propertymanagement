"use client";
import { useState, useTransition } from "react";
import { CmsField, CmsInput, CmsTextarea, CmsButton } from "@/components/cms/ui";
import { MediaPicker } from "@/components/cms/MediaPicker";
import { ItemsEditor } from "@/components/cms/ItemsEditor";
import { IconPicker } from "./IconPicker";
import { useSectionForm, FormChrome } from "./formShared";
import { generateFeatures } from "@/app/actions/ai-cms";
import { ICON_NAMES } from "@/lib/cms/icon-registry";
import { RiSparkling2Line } from "react-icons/ri";

type Item = { id: string; icon: string; title: string; body: string; imageUrl?: string };

export function FeaturesForm({ section }: { section: { id: string; type: string; data: unknown } }) {
  const f = useSectionForm(section);
  const c = f.cur;
  const items: Item[] = Array.isArray(c.items) ? c.items : [];
  const [brief, setBrief] = useState("");
  const [count, setCount] = useState(4);
  const [aiPending, startAi] = useTransition();
  const [aiError, setAiError] = useState<string | null>(null);

  function runAi() {
    setAiError(null);
    startAi(async () => {
      try {
        const gen = await generateFeatures(brief, count, f.locale);
        const withIds: Item[] = gen.map((g) => ({ id: crypto.randomUUID(), ...g }));
        f.setItems("items", [...items, ...withIds]);
      } catch (e) {
        setAiError(e instanceof Error ? e.message : "Αποτυχία δημιουργίας");
      }
    });
  }

  return (
    <FormChrome locale={f.locale} setLocale={f.setLocale} save={f.save} saved={f.saved} pending={f.pending}>
      <CmsField label="Επικεφαλίδα"><CmsInput value={c.heading ?? ""} onChange={(e) => f.patch({ heading: e.target.value })} /></CmsField>
      <CmsField label="Κεντρική εικόνα"><MediaPicker value={c.imageUrl ?? ""} onChange={(v) => f.patch({ imageUrl: typeof v === "string" ? v : v[0] ?? "" })} accept="image" /></CmsField>

      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--paper)", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "var(--foreground)" }}><RiSparkling2Line /> Δημιουργία με AI</div>
        <CmsField label="Σύντομη περιγραφή"><CmsTextarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="π.χ. πλατφόρμα διαχείρισης κοινοχρήστων για πολυκατοικίες…" /></CmsField>
        <CmsField label="Πλήθος"><CmsInput type="number" min={1} max={8} value={count} onChange={(e) => setCount(Number(e.target.value))} /></CmsField>
        {aiError && <p style={{ color: "var(--destructive)", fontSize: 13 }}>{aiError}</p>}
        <div><CmsButton variant="secondary" onClick={runAi} loading={aiPending} disabled={aiPending || !brief.trim()}>{aiPending ? "Δημιουργία…" : "Δημιουργία δυνατοτήτων"}</CmsButton></div>
      </div>

      <ItemsEditor<Item>
        items={items}
        onChange={(next) => f.setItems("items", next)}
        newItem={() => ({ id: crypto.randomUUID(), icon: ICON_NAMES[0] ?? "", title: "", body: "" })}
        addLabel="Προσθήκη δυνατότητας"
        renderFields={(item, patch) => (
          <>
            <IconPicker value={item.icon} onChange={(icon) => patch({ icon })} />
            <CmsField label="Τίτλος"><CmsInput value={item.title} onChange={(e) => patch({ title: e.target.value })} /></CmsField>
            <CmsField label="Περιγραφή"><CmsTextarea value={item.body} onChange={(e) => patch({ body: e.target.value })} /></CmsField>
            <CmsField label="Εικόνα (προαιρετικό)"><MediaPicker value={item.imageUrl ?? ""} onChange={(v) => patch({ imageUrl: typeof v === "string" ? v : v[0] ?? "" })} accept="image" /></CmsField>
          </>
        )}
      />
    </FormChrome>
  );
}
