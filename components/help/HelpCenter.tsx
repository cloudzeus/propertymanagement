import Link from "next/link";
import { Markdown } from "@/components/cms/Markdown";
import { MANUALS, manualForRole, manualsForRole, loadManual, type ManualKey } from "@/lib/help";
import { RiBookOpenLine, RiQuestionLine, RiPhoneLine } from "react-icons/ri";

/**
 * Help center: the manual for the viewer's role, plus the others they may read.
 * `base` is the surface's help route (e.g. /portal/help); `?m=` picks a manual.
 */
export async function HelpCenter({ role, base, requested, supportPhone, supportEmail }: {
  role: string; base: string; requested?: string; supportPhone?: string | null; supportEmail?: string | null;
}) {
  const allowed = manualsForRole(role);
  const key: ManualKey = allowed.includes(requested as ManualKey) ? (requested as ManualKey) : manualForRole(role);
  const md = await loadManual(key);

  return (
    <div className="dash-page" style={{ display: "grid", gridTemplateColumns: "240px minmax(0, 1fr)", gap: 20, alignItems: "start" }}>
      <aside style={{ position: "sticky", top: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--fs-12)", fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            <RiBookOpenLine /> Εγχειρίδια
          </div>
          <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {allowed.map((k) => {
              const on = k === key;
              return (
                <Link key={k} href={`${base}?m=${k}`} style={{ display: "block", padding: "9px 12px", borderRadius: 8, textDecoration: "none", fontSize: "var(--fs-13-5)", fontWeight: on ? 700 : 500,
                  background: on ? "var(--color-primary)" : "var(--card)", color: on ? "#fff" : "var(--foreground)", border: `1px solid ${on ? "var(--color-primary)" : "var(--border)"}` }}>
                  {MANUALS[k].title}
                  <span style={{ display: "block", fontSize: "var(--fs-11)", opacity: 0.8, fontWeight: 400 }}>{MANUALS[k].audience}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, fontSize: "var(--fs-13)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, marginBottom: 6 }}><RiQuestionLine style={{ color: "var(--color-primary)" }} /> Χρειάζεστε βοήθεια;</div>
          <p style={{ margin: 0, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
            Η εταιρεία διαχείρισης απαντά σε κάθε απορία.
            {supportPhone && <span style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, color: "var(--foreground)" }}><RiPhoneLine /> {supportPhone}</span>}
            {supportEmail && <span style={{ display: "block", marginTop: 4, color: "var(--foreground)" }}>{supportEmail}</span>}
          </p>
        </div>
      </aside>
      <article style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "24px 32px", maxWidth: 860, fontSize: "var(--fs-15)", lineHeight: 1.65 }}>
        <Markdown>{md}</Markdown>
      </article>
    </div>
  );
}
