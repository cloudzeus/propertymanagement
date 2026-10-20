import Link from "next/link";
import { Markdown } from "@/components/cms/Markdown";
import { MANUALS, manualForRole, manualsForRole, loadManual, type ManualKey } from "@/lib/help";
import { getArticle, listArticlesForRole, searchWikiArticles } from "@/lib/help/index";
import { openHref } from "@/lib/help/match";
import { WikiNav } from "./WikiNav";
import { RiBookOpenLine, RiQuestionLine, RiPhoneLine, RiSearchLine, RiExternalLinkLine, RiCompass3Line } from "react-icons/ri";

/**
 * Help center (hub): page guides by area + search + the role's manuals.
 * `base` is the surface's help route (e.g. /portal/help); `?m=` picks a manual, `?a=` a page guide, `?q=` searches.
 */
export async function HelpCenter({ role, base, requested, article, q, firstBuildingId = null, supportPhone, supportEmail }: {
  role: string; base: string; requested?: string; article?: string; q?: string; firstBuildingId?: string | null; supportPhone?: string | null; supportEmail?: string | null;
}) {
  const allowed = manualsForRole(role);
  const key: ManualKey = allowed.includes(requested as ManualKey) ? (requested as ManualKey) : manualForRole(role);
  const query = q?.trim() ?? "";
  const [groups, picked, results, md] = await Promise.all([
    listArticlesForRole(role),
    article ? getArticle(article, role) : Promise.resolve(null),
    query ? searchWikiArticles(query, role) : Promise.resolve([]),
    !article && !query ? loadManual(key) : Promise.resolve(""),
  ]);
  const mode: "search" | "article" | "manual" = query ? "search" : article ? "article" : "manual";

  return (
    <div className="dash-page" style={{ display: "grid", gridTemplateColumns: "260px minmax(0, 1fr)", gap: 20, alignItems: "start" }}>
      <aside style={{ position: "sticky", top: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <form action={base} method="get" role="search" style={{ display: "flex", gap: 6 }}>
          <input name="q" defaultValue={query} placeholder="Αναζήτηση στους οδηγούς…" aria-label="Αναζήτηση στους οδηγούς" style={{ flex: 1, minHeight: 44, border: "1px solid var(--border)", borderRadius: 10, padding: "0 12px", font: "inherit", fontSize: "var(--fs-13-5)", background: "var(--card)" }} />
          <button type="submit" aria-label="Αναζήτηση" style={{ width: 44, height: 44, borderRadius: 10, border: "1px solid var(--color-primary)", background: "var(--color-primary)", color: "var(--color-accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><RiSearchLine /></button>
        </form>
        <div>
          <div style={sectionHead}><RiCompass3Line /> Οδηγός ανά σελίδα</div>
          <WikiNav groups={groups} base={base} active={article} />
        </div>
        <div>
          <div style={sectionHead}><RiBookOpenLine /> Εγχειρίδια</div>
          <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {allowed.map((k) => {
              const on = mode === "manual" && k === key;
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
        {mode === "search" && (
          <>
            <h1 style={{ margin: "0 0 6px", fontSize: "var(--fs-22)" }}>Αποτελέσματα για «{query}»</h1>
            <p style={{ margin: "0 0 18px", color: "var(--muted-foreground)", fontSize: "var(--fs-13-5)" }}>{results.length ? `${results.length} οδηγοί` : "Δεν βρέθηκαν οδηγοί. Δοκιμάστε άλλη λέξη ή ανοίξτε το εγχειρίδιο του ρόλου σας."}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {results.map((r) => (
                <div key={r.slug} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontWeight: 700, fontSize: "var(--fs-15)" }}>{r.title}</div>
                  {r.summary && <p style={{ margin: "4px 0 8px", color: "var(--muted-foreground)", fontSize: "var(--fs-13-5)" }}>{r.summary}</p>}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link href={`${base}?a=${encodeURIComponent(r.slug)}`} style={btn}>Άνοιγμα οδηγού</Link>
                    <Link href={openHref(r.route, firstBuildingId)} style={btnGhost}><RiExternalLinkLine /> Άνοιγμα σελίδας</Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {mode === "article" && !picked && (
          <>
            <h1 style={{ margin: "0 0 6px", fontSize: "var(--fs-22)" }}>Ο οδηγός δεν βρέθηκε</h1>
            <p style={{ color: "var(--muted-foreground)" }}>Δεν υπάρχει οδηγός με αυτό το όνομα για τον ρόλο σας. Επιλέξτε έναν από τη λίστα αριστερά.</p>
          </>
        )}
        {mode === "article" && picked && (
          <>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: "var(--fs-11)", textTransform: "uppercase", letterSpacing: 0.5, color: "var(--muted-foreground)", fontWeight: 700 }}>Οδηγός σελίδας</div>
                <h1 style={{ margin: "2px 0 0", fontSize: "var(--fs-24)" }}>{picked.meta.title}</h1>
                {picked.meta.summary && <p style={{ margin: "6px 0 0", color: "var(--muted-foreground)", fontSize: "var(--fs-14)" }}>{picked.meta.summary}</p>}
              </div>
              <Link href={openHref(picked.meta.route, firstBuildingId)} style={btn}><RiExternalLinkLine /> Άνοιγμα σελίδας</Link>
            </div>
            <Markdown>{picked.markdown}</Markdown>
            {picked.meta.related.length > 0 && (
              <div style={{ marginTop: 20, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: "var(--fs-12)", fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 8 }}>ΣΧΕΤΙΚΟΙ ΟΔΗΓΟΙ</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {picked.meta.related.map((slug) => <Link key={slug} href={`${base}?a=${encodeURIComponent(slug)}`} style={btnGhost}>{slug}</Link>)}
                </div>
              </div>
            )}
          </>
        )}
        {mode === "manual" && <Markdown>{md}</Markdown>}
      </article>
    </div>
  );
}

const sectionHead: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: "var(--fs-12)", fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 };
const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40, padding: "0 14px", borderRadius: 10, background: "var(--color-primary)", color: "var(--color-accent)", textDecoration: "none", fontSize: "var(--fs-13)", fontWeight: 600 };
const btnGhost: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40, padding: "0 14px", borderRadius: 10, background: "var(--paper)", border: "1px solid var(--border)", color: "var(--foreground)", textDecoration: "none", fontSize: "var(--fs-13)", fontWeight: 600 };
