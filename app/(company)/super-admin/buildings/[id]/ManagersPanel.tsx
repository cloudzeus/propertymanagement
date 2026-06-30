"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { DataTable, type ColDef, type RowAction } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import {
  listManagers, searchManagerCandidates, addManager, removeManager,
  type ManagerRow, type ManagerCandidate,
} from "@/app/actions/managers";
import { RiUserStarLine, RiAddLine, RiDeleteBinLine } from "react-icons/ri";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin", ADMIN: "Admin", MANAGER: "Manager", EMPLOYEE: "Υπάλληλος",
  PROPERTY_ADMIN: "Διαχειριστής", PROPERTY_OWNER: "Ιδιοκτήτης", PROPERTY_RESIDENT: "Ένοικος", PROPERTY_VIEWER: "Προβολή",
};

export function ManagersPanel({ buildingId }: { buildingId: string }) {
  const scope = { buildingId } as const;
  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [, startTransition] = useTransition();

  const reload = useCallback(() => {
    return listManagers({ buildingId }).then(setManagers).finally(() => setLoading(false));
  }, [buildingId]);
  useEffect(() => { reload(); }, [reload]);

  function remove(assignmentId: string, name: string) {
    if (!confirm(`Αφαίρεση διαχειριστή «${name}»;`)) return;
    startTransition(async () => { await removeManager(assignmentId); await reload(); });
  }

  const columns: ColDef<ManagerRow>[] = [
    {
      id: "name", header: "Όνομα", sortKey: "name", width: 240, accessor: (m) => m.name ?? m.email,
      cell: (m) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: "var(--color-primary)18", color: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RiUserStarLine style={{ fontSize: 14 }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name ?? "—"}</span>
        </div>
      ),
    },
    { id: "email", header: "Email", sortKey: "email", width: 260, accessor: (m) => m.email, cell: (m) => <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{m.email}</span> },
    {
      id: "role", header: "Ρόλος", width: 150, accessor: (m) => ROLE_LABEL[m.role] ?? m.role,
      cell: (m) => <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: "var(--bg-canvas)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>{ROLE_LABEL[m.role] ?? m.role}</span>,
    },
  ];

  const getRowActions = (_m: ManagerRow): RowAction<ManagerRow>[] => [
    { label: "Αφαίρεση", icon: <RiDeleteBinLine />, danger: true, onClick: (m) => remove(m.assignmentId, m.name ?? m.email) },
  ];

  if (loading) {
    return <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: 40, textAlign: "center", color: "var(--muted-foreground)", fontSize: 14 }}>Φόρτωση…</div>;
  }

  return (
    <>
      <DataTable
        data={managers}
        columns={columns}
        totalRows={managers.length}
        page={1}
        pageSize={25}
        clientSide
        storageKey="building-managers"
        searchPlaceholder="Αναζήτηση διαχειριστή…"
        getRowActions={getRowActions}
        toolbar={
          <button onClick={() => setAdding(true)} style={{ ...btn, ...btnPrimary }}><RiAddLine /> Προσθήκη διαχειριστή</button>
        }
      />
      {adding && (
        <AddManagerModal
          scope={scope}
          assignedIds={new Set(managers.map((m) => m.id))}
          onClose={() => setAdding(false)}
          onDone={() => { setAdding(false); reload(); }}
        />
      )}
    </>
  );
}

function AddManagerModal({ scope, assignedIds, onClose, onDone }: { scope: { buildingId: string }; assignedIds: Set<string>; onClose: () => void; onDone: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ManagerCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSearching(true);
    const h = setTimeout(async () => {
      try { setResults(await searchManagerCandidates(scope, query)); } finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(h);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  function add(userId: string) {
    setError(null);
    startTransition(async () => {
      const r = await addManager(scope, userId);
      if (r && "error" in r && r.error) { setError(r.error); return; }
      onDone();
    });
  }

  const visible = results.filter((r) => !assignedIds.has(r.id));

  return (
    <Modal open onClose={onClose} title="Προσθήκη διαχειριστή" width={520}
      footer={<button onClick={onClose} style={btnCancel}>Κλείσιμο</button>}>
      {error && <div style={errBox}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Αναζήτηση: ιδιοκτήτες/ένοικοι ή προσωπικό εταιρείας…"
          autoComplete="off"
          autoFocus
          style={{ height: 38, padding: "0 12px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13, color: "var(--foreground)", background: "var(--card)", outline: "none", boxSizing: "border-box", width: "100%" }}
        />
        <div style={{ border: "1px solid var(--border)", borderRadius: 6, maxHeight: 320, overflowY: "auto" }}>
          {searching && visible.length === 0 && <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--muted-foreground)" }}>Φόρτωση…</div>}
          {!searching && visible.length === 0 && <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--muted-foreground)" }}>Κανένας διαθέσιμος υποψήφιος</div>}
          {visible.map((c) => (
            <button key={c.id} type="button" onClick={() => add(c.id)} disabled={isPending}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 12px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", borderBottom: "1px solid var(--border)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-canvas)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{c.name || c.email}</span>
                <span style={{ display: "block", fontSize: 11, color: "var(--muted-foreground)" }}>{c.email}</span>
              </span>
              <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: c.origin === "staff" ? "#0078D418" : "#16a34a18", color: c.origin === "staff" ? "#0078D4" : "#16a34a" }}>
                {c.origin === "staff" ? "Εταιρεία" : "Ένοικος/Ιδιοκτήτης"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

const btn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--border)",
  background: "var(--card)", color: "var(--foreground)", borderRadius: 6, padding: "7px 13px",
  fontSize: 13, fontWeight: 600, cursor: "pointer",
};
const btnPrimary: React.CSSProperties = { background: "var(--color-primary)", color: "#fff", borderColor: "var(--color-primary)" };
const btnCancel: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: 13, color: "var(--foreground)" };
const errBox: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, marginBottom: 12 };
