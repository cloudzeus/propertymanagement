"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { RiCheckLine, RiCloseLine, RiLoaderLine, RiPulseLine, RiSettings3Line, RiExternalLinkLine } from "react-icons/ri";

export type IntegrationItem = {
  id: string;
  name: string;
  icon: string;
  description: string;
  details: string;
  envVars: string[];
  docsUrl: string;
  configured: boolean;
  envPresent: Record<string, boolean>;
};

type TestState = { loading: boolean; ok?: boolean; message?: string; latencyMs?: number };

export function IntegrationsClient({ items }: { items: IntegrationItem[] }) {
  const [tests, setTests] = useState<Record<string, TestState>>({});
  const [configuring, setConfiguring] = useState<IntegrationItem | null>(null);

  async function runTest(id: string) {
    setTests((p) => ({ ...p, [id]: { loading: true } }));
    try {
      const res = await fetch("/api/super-admin/integrations/test", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) { setTests((p) => ({ ...p, [id]: { loading: false, ok: false, message: data.error ?? `HTTP ${res.status}` } })); return; }
      setTests((p) => ({ ...p, [id]: { loading: false, ok: data.ok, message: data.message, latencyMs: data.latencyMs } }));
    } catch (e) {
      setTests((p) => ({ ...p, [id]: { loading: false, ok: false, message: e instanceof Error ? e.message : "Σφάλμα δικτύου" } }));
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Ενσωματώσεις</h1>
        <p style={{ fontSize: 14, color: "var(--muted-foreground)", margin: "4px 0 0" }}>
          Εξωτερικές υπηρεσίες. Η ρύθμιση γίνεται μέσω μεταβλητών περιβάλλοντος (env)· εδώ ελέγχετε την κατάσταση και τη σύνδεση.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {items.map((it) => {
          const t = tests[it.id];
          return (
            <div key={it.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
                  <div style={{ fontSize: 26, lineHeight: 1 }}>{it.icon}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>{it.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{it.description}</div>
                  </div>
                </div>
                <StatusBadge configured={it.configured} />
              </div>

              <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>{it.details}</p>

              {t && !t.loading && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "8px 10px", borderRadius: 6,
                  background: t.ok ? "#16a34a14" : "#dc262614", color: t.ok ? "#15803d" : "#b91c1c",
                }}>
                  {t.ok ? <RiCheckLine /> : <RiCloseLine />}
                  <span style={{ flex: 1, minWidth: 0 }}>{t.message}</span>
                  {t.latencyMs != null && <span style={{ opacity: 0.7, flexShrink: 0 }}>{t.latencyMs}ms</span>}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                <button onClick={() => setConfiguring(it)} style={{ ...btn, flex: 1 }}>
                  <RiSettings3Line /> Ρύθμιση
                </button>
                <button onClick={() => runTest(it.id)} disabled={t?.loading} style={{ ...btn, ...btnPrimary }}>
                  {t?.loading ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiPulseLine />} Έλεγχος
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {configuring && <ConfigureModal item={configuring} onClose={() => setConfiguring(null)} />}
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function StatusBadge({ configured }: { configured: boolean }) {
  return (
    <span style={{
      flexShrink: 0, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 9999,
      background: configured ? "#16a34a18" : "#71717118", color: configured ? "#15803d" : "#6b7280",
    }}>
      {configured ? "Ρυθμισμένο" : "Μη ρυθμισμένο"}
    </span>
  );
}

function ConfigureModal({ item, onClose }: { item: IntegrationItem; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title={`Ρύθμιση — ${item.name}`} width={520}
      footer={<button onClick={onClose} style={btnCancel}>Κλείσιμο</button>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>
          Οι τιμές ορίζονται ως μεταβλητές περιβάλλοντος (env) στο περιβάλλον εκτέλεσης (π.χ. Coolify) και δεν επεξεργάζονται εδώ για λόγους ασφαλείας. Παρακάτω φαίνεται ποιες υπάρχουν:
        </p>
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          {item.envVars.map((v, i) => (
            <div key={v} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderTop: i ? "1px solid var(--border)" : "none" }}>
              <code style={{ fontSize: 12, color: "var(--foreground)" }}>{v}</code>
              {item.envPresent[v]
                ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#15803d" }}><RiCheckLine /> Ορισμένο</span>
                : <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#b91c1c" }}><RiCloseLine /> Λείπει</span>}
            </div>
          ))}
        </div>
        <a href={item.docsUrl} target="_blank" rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--color-primary)", textDecoration: "none" }}>
          <RiExternalLinkLine /> Τεκμηρίωση {item.name}
        </a>
      </div>
    </Modal>
  );
}

const btn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
  border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)",
  borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};
const btnPrimary: React.CSSProperties = { background: "var(--color-primary)", color: "#fff", borderColor: "var(--color-primary)" };
const btnCancel: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: 13, color: "var(--foreground)" };
