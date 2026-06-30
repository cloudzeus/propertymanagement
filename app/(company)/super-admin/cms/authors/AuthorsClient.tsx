"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type ColDef, type RowAction } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { CmsPage, CmsField, CmsInput, CmsTextarea, LocaleTabs } from "@/components/cms/ui";
import { MediaPicker } from "@/components/cms/MediaPicker";
import { createAuthor, updateAuthor, deleteAuthor } from "@/app/actions/blog";
import { RiUserStarLine, RiCheckLine, RiLoaderLine, RiPencilLine, RiDeleteBinLine } from "react-icons/ri";

type Author = {
  id: string;
  name: string;
  slug: string;
  avatarMediaId: string | null;
  bio: any;
  createdAt: string;
};

type Locale = "el" | "en";

export function AuthorsClient({ initial }: { initial: Author[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Author | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [locale, setLocale] = useState<Locale>("el");

  // form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [bio, setBio] = useState<{ el: string; en: string }>({ el: "", en: "" });

  function loadForm(a: Author | null) {
    setName(a?.name ?? "");
    setSlug(a?.slug ?? "");
    setAvatar(a?.avatarMediaId ?? null);
    const raw = (a?.bio ?? {}) as any;
    setBio({ el: raw?.el ?? "", en: raw?.en ?? "" });
    setLocale("el");
    setError(null);
  }

  function openAdd() { setEditing(null); loadForm(null); setOpen(true); }
  function openEdit(a: Author) { setEditing(a); loadForm(a); setOpen(true); }

  function handleSave() {
    if (!name.trim()) { setError("Το όνομα είναι υποχρεωτικό"); return; }
    const payload = {
      name: name.trim(),
      slug: slug.trim() || undefined,
      avatarMediaId: avatar || null,
      bio: { el: bio.el, en: bio.en },
    };
    startTransition(async () => {
      try {
        if (editing) await updateAuthor(editing.id, payload);
        else await createAuthor(payload);
        setOpen(false);
        router.refresh();
      } catch (e: any) {
        setError(e?.message ?? "Σφάλμα αποθήκευσης");
      }
    });
  }

  function handleDelete(a: Author) {
    if (!confirm(`Διαγραφή συγγραφέα «${a.name}»;`)) return;
    startTransition(async () => {
      try {
        await deleteAuthor(a.id);
        router.refresh();
      } catch (e: any) {
        alert(e?.message ?? "Σφάλμα διαγραφής");
      }
    });
  }

  const columns: ColDef<Author>[] = [
    {
      id: "name", header: "Όνομα", sortKey: "name", width: 320,
      accessor: (a) => a.name,
      cell: (a) => (
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{a.name}</span>
      ),
    },
    {
      id: "slug", header: "Slug", sortKey: "slug", width: 240,
      accessor: (a) => a.slug,
      cell: (a) => <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{a.slug || "—"}</span>,
    },
  ];

  const getRowActions = (_a: Author): RowAction<Author>[] => [
    { label: "Επεξεργασία", icon: <RiPencilLine />, onClick: openEdit },
    { label: "Διαγραφή", icon: <RiDeleteBinLine />, danger: true, onClick: handleDelete },
  ];

  return (
    <CmsPage icon={<RiUserStarLine />} title="Συγγραφείς" subtitle="Διαχείριση συγγραφέων blog">
      <DataTable
        data={initial}
        columns={columns}
        totalRows={initial.length}
        page={1}
        pageSize={25}
        clientSide
        storageKey="super-admin-cms-authors"
        searchPlaceholder="Αναζήτηση συγγραφέα…"
        getRowActions={getRowActions}
        onAddNew={openAdd}
        addNewLabel="Νέος συγγραφέας"
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Επεξεργασία συγγραφέα" : "Νέος συγγραφέας"}
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
          <CmsField label="Όνομα">
            <CmsInput value={name} onChange={(e) => setName(e.target.value)} placeholder="π.χ. Γιώργος Παπαδόπουλος" />
          </CmsField>

          <CmsField label="Slug" hint="Προαιρετικό — δημιουργείται αυτόματα από το όνομα αν μείνει κενό">
            <CmsInput value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="giorgos-papadopoulos" />
          </CmsField>

          <CmsField label="Avatar">
            <MediaPicker value={avatar} onChange={(v) => setAvatar(v as string)} accept="image" />
          </CmsField>

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
            <LocaleTabs value={locale} onChange={setLocale} />
            <CmsField label="Βιογραφικό">
              <CmsTextarea
                value={bio[locale]}
                onChange={(e) => setBio((p) => ({ ...p, [locale]: e.target.value }))}
                rows={6}
                style={{ resize: "vertical", fontFamily: "inherit" }}
              />
            </CmsField>
          </div>
        </div>

        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </Modal>
    </CmsPage>
  );
}
