"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type ColDef, type RowAction } from "@/components/ui/data-table";
import { CmsPage } from "@/components/cms/ui";
import { createArticle, deleteArticle } from "@/app/actions/blog";
import { RiArticleLine, RiPencilLine, RiDeleteBinLine } from "react-icons/ri";

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
