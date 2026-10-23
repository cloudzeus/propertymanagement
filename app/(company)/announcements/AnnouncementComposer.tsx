"use client";

import { useState } from "react";
import { RichTextEditor } from "@/components/ui/rich-text";
import { createAnnouncement, type Audience, type TargetInput } from "@/app/actions/announcements";
import { RiMegaphoneLine, RiMailSendLine, RiNotification3Line, RiTvLine, RiSmartphoneLine } from "react-icons/ri";

type B = { id: string; name: string; propertyId: string | null; propertyName: string | null };

const AUDIENCE_LABEL: Record<Audience, string> = { ALL: "Όλοι", OWNERS: "Ιδιοκτήτες", RESIDENTS: "Ένοικοι", CUSTOM: "Επιλεγμένοι" };

export default function AnnouncementComposer({ buildings }: { buildings: B[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [preview, setPreview] = useState("");
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState<Audience>("ALL");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMsg(null);
    setError(false);
    const targets: TargetInput[] = [...selected].map((id) => ({ scopeType: "BUILDING", scopeId: id }));
    const res = await createAnnouncement({
      title,
      content,
      emailSubject: subject || undefined,
      emailPreview: preview || undefined,
      audience,
      targets,
    });
    setBusy(false);
    if ("error" in res && res.error) {
      setError(true);
      setMsg(res.error);
      return;
    }
    setMsg(`Στάλθηκε σε ${(res as { sent?: number }).sent ?? 0} παραλήπτες`);
    setTitle("");
    setSubject("");
    setPreview("");
    setContent("");
    setSelected(new Set());
  }

  const byProperty = new Map<string, B[]>();
  for (const b of buildings) {
    const key = b.propertyName ?? "—";
    byProperty.set(key, [...(byProperty.get(key) ?? []), b]);
  }

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <RiMegaphoneLine style={{ fontSize: "var(--fs-20)", color: "var(--color-primary)" }} />
        <h1 style={{ fontSize: "var(--fs-22)", fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Νέα ανακοίνωση</h1>
      </div>
      {/* Forms always sit on a white card (user rule 2026-10-23); the helper column fills the width instead of empty canvas. */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: 14, alignItems: "start" }}>
      <section style={{ ...formCard, display: "flex", flexDirection: "column", gap: 14 }}>

      <div>
        <label style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--muted-foreground)", display: "block", marginBottom: 6 }}>
          Κτίρια-παραλήπτες
        </label>
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, maxHeight: 260, overflow: "auto", background: "var(--paper)" }}>
          {buildings.length === 0 && (
            <p style={{ fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>Δεν βρέθηκαν κτίρια.</p>
          )}
          {[...byProperty.entries()].map(([prop, bs]) => (
            <div key={prop} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--muted-foreground)" }}>{prop}</div>
              {bs.map((b) => (
                <label key={b.id} style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 12, paddingTop: 4, paddingBottom: 4, fontSize: "var(--fs-13)" }}>
                  <input
                    type="checkbox"
                    checked={selected.has(b.id)}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(b.id);
                      else next.delete(b.id);
                      setSelected(next);
                    }}
                  />
                  {b.name}
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div>
        <label style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--muted-foreground)", display: "block", marginBottom: 6 }}>
          Παραλήπτες
        </label>
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value as Audience)}
          style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: "var(--fs-13)", background: "var(--card)", color: "var(--foreground)", minHeight: 40, boxSizing: "border-box" }}
        >
          {(Object.keys(AUDIENCE_LABEL) as Audience[])
            .filter((a) => a !== "CUSTOM")
            .map((a) => (
              <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>
            ))}
        </select>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Θέμα"
        style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: "var(--fs-13)", background: "var(--card)", color: "var(--foreground)", minHeight: 40, boxSizing: "border-box" }}
      />
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Θέμα email (προαιρετικό)"
        style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: "var(--fs-13)", background: "var(--card)", color: "var(--foreground)", minHeight: 40, boxSizing: "border-box" }}
      />
      <input
        value={preview}
        onChange={(e) => setPreview(e.target.value)}
        placeholder="Preview text (προαιρετικό)"
        style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: "var(--fs-13)", background: "var(--card)", color: "var(--foreground)", minHeight: 40, boxSizing: "border-box" }}
      />

      <div>
        <RichTextEditor value={content} onChange={setContent} placeholder="Κείμενο ανακοίνωσης..." />
        <p style={{ fontSize: "var(--fs-11)", color: "var(--muted-foreground)", marginTop: 4 }}>
          Διαθέσιμα πεδία συγχώνευσης: {"{{name}} {{building}} {{property}} {{unit}}"}
        </p>
      </div>

      <button
        disabled={busy || !selected.size || !title.trim()}
        onClick={submit}
        style={{
          alignSelf: "flex-start",
          background: "var(--color-primary)",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "8px 20px",
          fontSize: "var(--fs-13)",
          fontWeight: 600,
          cursor: busy || !selected.size || !title.trim() ? "not-allowed" : "pointer",
          opacity: busy || !selected.size || !title.trim() ? 0.5 : 1,
        }}
      >
        {busy ? "Αποστολή..." : "Αποστολή"}
      </button>

      {msg && (
        <p role="status" style={{ margin: 0, fontSize: "var(--fs-13)", color: error ? "var(--color-danger)" : "var(--color-success)" }}>{msg}</p>
      )}
      </section>
      <aside style={{ ...formCard, display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: "var(--fs-14)", fontWeight: 700, color: "var(--foreground)" }}>Πώς φτάνει η ανακοίνωση</h2>
        {[
          [RiMailSendLine, "Email σε κάθε παραλήπτη, με το θέμα και το preview που ορίζετε."],
          [RiNotification3Line, "Καμπανάκι και ειδοποίηση στο κινητό, όσων έχουν ενεργοποιήσει ειδοποιήσεις."],
          [RiSmartphoneLine, "Στην καρτέλα «Ανακοινώσεις» του κτηρίου για ιδιοκτήτες και ενοίκους."],
          [RiTvLine, "Στην πινακίδα εισόδου (signage), αν το κτήριο έχει οθόνη."],
        ].map(([Icon, text], i) => {
          const I = Icon as React.ElementType;
          return (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: "var(--fs-12-5)", lineHeight: 1.45, color: "var(--muted-foreground)" }}>
              <I style={{ flexShrink: 0, marginTop: 2, color: "var(--color-primary)", fontSize: "var(--fs-16)" }} /> <span>{text as string}</span>
            </div>
          );
        })}
        <p style={{ margin: "4px 0 0", fontSize: "var(--fs-12)", color: "var(--muted-foreground)", lineHeight: 1.45 }}>
          Πεδία συγχώνευσης: <code>{"{{name}}"}</code>, <code>{"{{building}}"}</code>, <code>{"{{property}}"}</code>, <code>{"{{unit}}"}</code> — αντικαθίστανται ανά παραλήπτη.
        </p>
      </aside>
      </div>
    </div>
  );
}

const formCard: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 18, boxShadow: "var(--shadow-ghost)" };
