"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type ColDef, type RowAction } from "@/components/ui/data-table";
import { CmsPage, CmsField, CmsInput, CmsButton } from "@/components/cms/ui";
import { Modal } from "@/components/ui/modal";
import { createArticle, deleteArticle } from "@/app/actions/blog";
import { suggestArticleTopics } from "@/app/actions/ai-cms";
import type { Topic } from "@/lib/ai/articles";
import { RiArticleLine, RiPencilLine, RiDeleteBinLine, RiSparkling2Line } from "react-icons/ri";

type Article = {
  id: string;
  slug: string;
  i18n: any;
  status: string;
  publishedAt: string | null;
  tags: string[];
  author: { id: string; name: string } | null;
};

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
      background: `color-mix(in srgb, ${color} 12%, transparent)`, color,
    }}>{label}</span>
  );
}

function statusBadge(status: string) {
  if (status === "PUBLISHED") return <Badge label="Δημοσιευμένο" color="var(--color-success)" />;
  if (status === "ARCHIVED") return <Badge label="Αρχείο" color="var(--muted-foreground)" />;
  return <Badge label="Πρόχειρο" color="var(--color-primary)" />;
}

function fmtDate(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("el-GR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function ArticlesClient({ initial }: { initial: Article[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [aiOpen, setAiOpen] = useState(false);
  const [theme, setTheme] = useState("");
  const [count, setCount] = useState(5);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function runSuggest() {
    setAiError(null); setAiBusy(true);
    try {
      setTopics(await suggestArticleTopics(theme, count));
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Αποτυχία");
    } finally { setAiBusy(false); }
  }

  function createFromTopic(t: Topic) {
    startTransition(async () => {
      const id = await createArticle({
        status: "DRAFT",
        tags: t.tags,
        galleryMediaIds: [],
        i18n: {
          title: { el: t.title, en: "" },
          excerpt: { el: t.angle, en: "" },
          body: { el: "", en: "" },
        },
      });
      router.push(`/super-admin/cms/articles/${id}`);
    });
  }

  function handleAdd() {
    startTransition(async () => {
      try {
        const id = await createArticle({
          i18n: {
            title: { el: "Νέο άρθρο", en: "New article" },
            excerpt: { el: "", en: "" },
            body: { el: "", en: "" },
          },
          status: "DRAFT",
          tags: [],
          galleryMediaIds: [],
        });
        router.push(`/super-admin/cms/articles/${id}`);
      } catch (e: any) {
        alert(e?.message ?? "Σφάλμα δημιουργίας");
      }
    });
  }

  function handleEdit(a: Article) {
    router.push(`/super-admin/cms/articles/${a.id}`);
  }

  function handleDelete(a: Article) {
    if (!confirm(`Διαγραφή άρθρου «${a.i18n?.title?.el ?? a.slug}»;`)) return;
    startTransition(async () => {
      try {
        await deleteArticle(a.id);
        router.refresh();
      } catch (e: any) {
        alert(e?.message ?? "Σφάλμα διαγραφής");
      }
    });
  }

  const columns: ColDef<Article>[] = [
    {
      id: "title", header: "Τίτλος", sortKey: "title", width: 280,
      accessor: (a) => a.i18n?.title?.el ?? a.slug,
      cell: (a) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{a.i18n?.title?.el ?? a.slug}</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "monospace" }}>{a.slug}</div>
        </div>
      ),
    },
    {
      id: "author", header: "Συγγραφέας", sortKey: "author", width: 160,
      accessor: (a) => a.author?.name ?? "—",
      cell: (a) => <span style={{ fontSize: 13, color: "var(--foreground)" }}>{a.author?.name ?? "—"}</span>,
    },
    {
      id: "status", header: "Κατάσταση", sortKey: "status", width: 140,
      accessor: (a) => a.status,
      cell: (a) => statusBadge(a.status),
    },
    {
      id: "publishedAt", header: "Ημερομηνία", sortKey: "publishedAt", width: 130,
      accessor: (a) => a.publishedAt ?? "",
      cell: (a) => <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{fmtDate(a.publishedAt)}</span>,
    },
    {
      id: "tags", header: "Tags", width: 200,
      accessor: (a) => a.tags.join(", "),
      cell: (a) => <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{a.tags.join(", ") || "—"}</span>,
    },
  ];

  const getRowActions = (_a: Article): RowAction<Article>[] => [
    { label: "Επεξεργασία", icon: <RiPencilLine />, onClick: handleEdit },
    { label: "Διαγραφή", icon: <RiDeleteBinLine />, danger: true, onClick: handleDelete },
  ];

  return (
    <CmsPage icon={<RiArticleLine />} title="Άρθρα" subtitle="Διαχείριση άρθρων blog">
      <div style={{ marginBottom: 12 }}>
        <CmsButton onClick={() => setAiOpen(true)} icon={<RiSparkling2Line size={15} />}>
          Προτάσεις με AI
        </CmsButton>
      </div>

      <Modal open={aiOpen} onClose={() => setAiOpen(false)} title="Προτάσεις άρθρων (AI)" width={640}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <CmsField label="Θέμα (προαιρετικό)">
            <CmsInput value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="π.χ. ενεργειακή αναβάθμιση πολυκατοικίας" />
          </CmsField>
          <CmsField label="Πλήθος">
            <CmsInput type="number" min={1} max={8} value={count} onChange={(e) => setCount(Number(e.target.value))} />
          </CmsField>
          {aiError && <p style={{ color: "var(--destructive)", fontSize: 13, margin: 0 }}>{aiError}</p>}
          <div>
            <CmsButton variant="secondary" loading={aiBusy} disabled={aiBusy} onClick={runSuggest} icon={<RiSparkling2Line size={15} />}>
              {aiBusy ? "Δημιουργία…" : "Δημιουργία προτάσεων"}
            </CmsButton>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topics.map((t, i) => (
              <div key={i} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--card)", padding: 12 }}>
                <div style={{ fontWeight: 700, color: "var(--foreground)" }}>{t.title}</div>
                {t.angle && <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>{t.angle}</div>}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {t.tags.map((tag) => (
                    <span key={tag} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "var(--paper)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>{tag}</span>
                  ))}
                </div>
                <div style={{ marginTop: 10 }}>
                  <CmsButton variant="secondary" onClick={() => createFromTopic(t)}>Δημιουργία draft →</CmsButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <DataTable
        data={initial}
        columns={columns}
        totalRows={initial.length}
        page={1}
        pageSize={25}
        clientSide
        storageKey="super-admin-cms-articles"
        searchPlaceholder="Αναζήτηση άρθρου…"
        getRowActions={getRowActions}
        onAddNew={handleAdd}
        addNewLabel={isPending ? "Δημιουργία…" : "Νέο άρθρο"}
      />
    </CmsPage>
  );
}
