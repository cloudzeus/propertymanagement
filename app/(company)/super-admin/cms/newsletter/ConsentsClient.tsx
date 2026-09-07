"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type ColDef, type RowAction } from "@/components/ui/data-table";
import { CmsPage } from "@/components/cms/ui";
import { adminUnsubscribe, adminEraseSubscriber, adminEraseContactMessage, adminSetContactStatus } from "@/app/actions/newsletter";
import { RiMailCheckLine, RiDownloadLine, RiUserUnfollowLine, RiDeleteBinLine, RiCheckDoubleLine, RiSpamLine, RiEyeLine } from "react-icons/ri";

type Sub = { id: string; email: string; locale: string; source: string; status: string; consentText: string; consentVersion: string; consentedAt: string; confirmedAt: string | null; unsubscribedAt: string | null; ipAddress: string | null; userAgent: string | null };
type Contact = { id: string; name: string; email: string; phone: string | null; subject: string; message: string; status: string; ipAddress: string | null; consentText: string | null; consentedAt: string | null; createdAt: string };
type Demo = { id: string; name: string; email: string; company: string | null; scheduledAt: string; status: string; consentText: string | null; consentedAt: string | null; createdAt: string };

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" }) : "—");
const SUB_STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Αναμένει επιβεβαίωση", color: "#CA5D00" },
  CONFIRMED: { label: "Ενεργός", color: "#2E7D5B" },
  UNSUBSCRIBED: { label: "Διαγράφηκε", color: "#6b7280" },
};
const CONTACT_STATUS: Record<string, string> = { NEW: "Νέο", READ: "Διαβάστηκε", RESPONDED: "Απαντήθηκε", SPAM: "Spam" };

function csv(rows: Record<string, unknown>[], name: string) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const body = [cols.join(";"), ...rows.map((r) => cols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(";"))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" }));
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

export function ConsentsClient({ subscribers, contacts, demos, caps }: { subscribers: Sub[]; contacts: Contact[]; demos: Demo[]; caps: { edit: boolean; delete: boolean } }) {
  const router = useRouter();
  const [tab, setTab] = useState<"subs" | "contacts" | "demos">("subs");
  const [, start] = useTransition();
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  const active = subscribers.filter((s) => s.status === "CONFIRMED").length;
  const pending = subscribers.filter((s) => s.status === "PENDING").length;

  const subCols: ColDef<Sub>[] = [
    { id: "email", header: "Email", width: 240, sortKey: "email", accessor: (r) => r.email, cell: (r) => <b>{r.email}</b> },
    { id: "status", header: "Κατάσταση", width: 170, sortKey: "status", accessor: (r) => r.status, cell: (r) => { const s = SUB_STATUS[r.status] ?? { label: r.status, color: "#6b7280" }; return <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: "var(--fs-11-5)", fontWeight: 600, color: s.color, background: `${s.color}18`, border: `1px solid ${s.color}40` }}>{s.label}</span>; } },
    { id: "consentedAt", header: "Συναίνεση", width: 140, sortKey: "consentedAt", accessor: (r) => r.consentedAt, cell: (r) => fmt(r.consentedAt) },
    { id: "confirmedAt", header: "Επιβεβαίωση", width: 140, accessor: (r) => r.confirmedAt ?? "", cell: (r) => fmt(r.confirmedAt) },
    { id: "unsubscribedAt", header: "Διαγραφή", width: 140, accessor: (r) => r.unsubscribedAt ?? "", cell: (r) => fmt(r.unsubscribedAt) },
    { id: "source", header: "Πηγή / γλώσσα", width: 120, accessor: (r) => `${r.source} ${r.locale}`, cell: (r) => `${r.source} · ${r.locale}` },
    { id: "version", header: "Έκδοση κειμένου", width: 120, accessor: (r) => r.consentVersion, cell: (r) => r.consentVersion },
    { id: "ip", header: "IP", width: 130, accessor: (r) => r.ipAddress ?? "", cell: (r) => r.ipAddress ?? "—", defaultVisible: false },
    { id: "text", header: "Κείμενο συναίνεσης", width: 380, accessor: (r) => r.consentText, cell: (r) => <span style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }}>{r.consentText}</span>, defaultVisible: false },
  ];
  const subActions = (r: Sub): RowAction<Sub>[] => [
    ...(caps.edit && r.status !== "UNSUBSCRIBED" ? [{ label: "Διαγραφή από τη λίστα", icon: <RiUserUnfollowLine />, onClick: () => confirm(`Διαγραφή του ${r.email} από τη λίστα;`) && run(() => adminUnsubscribe(r.id)) }] : []),
    ...(caps.delete ? [{ label: "Οριστική διαγραφή (GDPR)", icon: <RiDeleteBinLine />, danger: true, onClick: () => confirm(`Οριστική διαγραφή όλων των στοιχείων του ${r.email}; Δεν αναιρείται.`) && run(() => adminEraseSubscriber(r.id)) }] : []),
  ];

  const contactCols: ColDef<Contact>[] = [
    { id: "when", header: "Ημ/νία", width: 140, sortKey: "when", accessor: (r) => r.createdAt, cell: (r) => fmt(r.createdAt) },
    { id: "name", header: "Όνομα", width: 170, accessor: (r) => r.name, cell: (r) => <b>{r.name}</b> },
    { id: "email", header: "Email", width: 220, accessor: (r) => r.email, cell: (r) => r.email },
    { id: "subject", header: "Θέμα", width: 200, accessor: (r) => r.subject, cell: (r) => r.subject },
    { id: "status", header: "Κατάσταση", width: 120, accessor: (r) => r.status, cell: (r) => CONTACT_STATUS[r.status] ?? r.status },
    { id: "consent", header: "Συναίνεση", width: 150, accessor: (r) => r.consentedAt ?? "", cell: (r) => r.consentedAt ? <span style={{ color: "#2E7D5B", fontWeight: 600 }}>✓ {fmt(r.consentedAt)}</span> : <span style={{ color: "var(--muted-foreground)" }}>— (παλιά φόρμα)</span> },
    { id: "message", header: "Μήνυμα", width: 360, accessor: (r) => r.message, cell: (r) => <span style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }}>{r.message.slice(0, 160)}{r.message.length > 160 ? "…" : ""}</span> },
    { id: "ip", header: "IP", width: 130, accessor: (r) => r.ipAddress ?? "", cell: (r) => r.ipAddress ?? "—", defaultVisible: false },
  ];
  const contactActions = (r: Contact): RowAction<Contact>[] => [
    ...(caps.edit ? [
      { label: "Σήμανση: Διαβάστηκε", icon: <RiEyeLine />, onClick: () => run(() => adminSetContactStatus(r.id, "READ")) },
      { label: "Σήμανση: Απαντήθηκε", icon: <RiCheckDoubleLine />, onClick: () => run(() => adminSetContactStatus(r.id, "RESPONDED")) },
      { label: "Σήμανση: Spam", icon: <RiSpamLine />, onClick: () => run(() => adminSetContactStatus(r.id, "SPAM")) },
    ] : []),
    ...(caps.delete ? [{ label: "Οριστική διαγραφή (GDPR)", icon: <RiDeleteBinLine />, danger: true, onClick: () => confirm("Οριστική διαγραφή του μηνύματος;") && run(() => adminEraseContactMessage(r.id)) }] : []),
  ];

  const demoCols: ColDef<Demo>[] = [
    { id: "when", header: "Ραντεβού", width: 150, sortKey: "when", accessor: (r) => r.scheduledAt, cell: (r) => fmt(r.scheduledAt) },
    { id: "name", header: "Όνομα", width: 170, accessor: (r) => r.name, cell: (r) => <b>{r.name}</b> },
    { id: "email", header: "Email", width: 220, accessor: (r) => r.email, cell: (r) => r.email },
    { id: "company", header: "Εταιρεία", width: 160, accessor: (r) => r.company ?? "", cell: (r) => r.company ?? "—" },
    { id: "status", header: "Κατάσταση", width: 110, accessor: (r) => r.status, cell: (r) => r.status },
    { id: "consent", header: "Συναίνεση", width: 150, accessor: (r) => r.consentedAt ?? "", cell: (r) => r.consentedAt ? <span style={{ color: "#2E7D5B", fontWeight: 600 }}>✓ {fmt(r.consentedAt)}</span> : <span style={{ color: "var(--muted-foreground)" }}>—</span> },
    { id: "created", header: "Κράτηση", width: 140, accessor: (r) => r.createdAt, cell: (r) => fmt(r.createdAt) },
  ];

  const tabs = [
    { key: "subs" as const, label: `Newsletter (${subscribers.length})` },
    { key: "contacts" as const, label: `Φόρμα επικοινωνίας (${contacts.length})` },
    { key: "demos" as const, label: `Demo (${demos.length})` },
  ];

  return (
    <CmsPage icon={<RiMailCheckLine />} title="Newsletter & συναινέσεις" subtitle="Μητρώο συναινέσεων GDPR: κάθε εγγραφή κρατά το ακριβές κείμενο που αποδέχθηκε ο χρήστης, ώρα, IP και την επιβεβαίωση double opt-in. Η διαγραφή από τη λίστα κρατά το ίχνος· η οριστική διαγραφή το σβήνει.">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
        {[{ label: "Ενεργοί συνδρομητές", value: active }, { label: "Αναμένουν επιβεβαίωση", value: pending }, { label: "Μηνύματα με συναίνεση", value: contacts.filter((c) => c.consentedAt).length }, { label: "Demo με συναίνεση", value: demos.filter((d) => d.consentedAt).length }].map((k) => (
          <div key={k.label} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "12px 14px" }}>
            <div style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }}>{k.label}</div>
            <div style={{ fontSize: "var(--fs-22)", fontWeight: 700 }}>{k.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ height: 32, padding: "0 14px", borderRadius: 999, border: "1px solid var(--border)", background: tab === t.key ? "var(--primary)" : "var(--card)", color: tab === t.key ? "var(--primary-foreground)" : "var(--foreground)", fontSize: "var(--fs-12-5)", fontWeight: 600, cursor: "pointer" }}>{t.label}</button>
        ))}
        <span style={{ flex: 1 }} />
        <button onClick={() => tab === "subs" ? csv(subscribers, "newsletter") : tab === "contacts" ? csv(contacts, "contact-consents") : csv(demos, "demo-consents")} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--card)", fontSize: "var(--fs-12-5)", fontWeight: 600, cursor: "pointer" }}><RiDownloadLine /> Εξαγωγή CSV</button>
      </div>
      {tab === "subs" && <DataTable data={subscribers} columns={subCols} totalRows={subscribers.length} page={1} pageSize={25} clientSide storageKey="newsletter-subs" searchPlaceholder="Αναζήτηση email…" getRowActions={subActions} />}
      {tab === "contacts" && <DataTable data={contacts} columns={contactCols} totalRows={contacts.length} page={1} pageSize={25} clientSide storageKey="contact-consents" searchPlaceholder="Αναζήτηση…" getRowActions={contactActions} />}
      {tab === "demos" && <DataTable data={demos} columns={demoCols} totalRows={demos.length} page={1} pageSize={25} clientSide storageKey="demo-consents" searchPlaceholder="Αναζήτηση…" />}
    </CmsPage>
  );
}
