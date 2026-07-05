"use client";

import { useState } from "react";
import { RichTextEditor } from "@/components/ui/rich-text";
import { createAnnouncement, type Audience, type TargetInput } from "@/app/actions/announcements";
import { RiMegaphoneLine } from "react-icons/ri";

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
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <RiMegaphoneLine style={{ fontSize: 20, color: "var(--color-primary)" }} />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--foreground)" }}>Νέα ανακοίνωση</h1>
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", display: "block", marginBottom: 6 }}>
          Κτίρια-παραλήπτες
        </label>
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, maxHeight: 260, overflow: "auto" }}>
          {buildings.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Δεν βρέθηκαν κτίρια.</p>
          )}
          {[...byProperty.entries()].map(([prop, bs]) => (
            <div key={prop} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)" }}>{prop}</div>
              {bs.map((b) => (
                <label key={b.id} style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 12, paddingTop: 4, paddingBottom: 4, fontSize: 13 }}>
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
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", display: "block", marginBottom: 6 }}>
          Παραλήπτες
        </label>
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value as Audience)}
          style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "var(--background)", color: "var(--foreground)" }}
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
        style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, background: "var(--background)", color: "var(--foreground)" }}
      />
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Θέμα email (προαιρετικό)"
        style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, background: "var(--background)", color: "var(--foreground)" }}
      />
      <input
        value={preview}
        onChange={(e) => setPreview(e.target.value)}
        placeholder="Preview text (προαιρετικό)"
        style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, background: "var(--background)", color: "var(--foreground)" }}
      />

      <div>
        <RichTextEditor value={content} onChange={setContent} placeholder="Κείμενο ανακοίνωσης..." />
        <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>
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
          fontSize: 13,
          fontWeight: 600,
          cursor: busy || !selected.size || !title.trim() ? "not-allowed" : "pointer",
          opacity: busy || !selected.size || !title.trim() ? 0.5 : 1,
        }}
      >
        {busy ? "Αποστολή..." : "Αποστολή"}
      </button>

      {msg && (
        <p style={{ fontSize: 13, color: error ? "var(--color-red, #c50f1f)" : "var(--color-green, #107c10)" }}>{msg}</p>
      )}
    </div>
  );
}
